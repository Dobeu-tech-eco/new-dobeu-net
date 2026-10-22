import type { createAdminClient } from "@/lib/supabase/server";
import { logToDatadog } from "@/lib/datadog-server";
import { DAY_MS, PAGE_SIZE } from "./constants";

type AdminClient = ReturnType<typeof createAdminClient>;
const MAX_STORAGE_DELETIONS = 500;
// Storage paths and ids travel in the request URL, so chunks are bounded by
// encoded bytes (about 6000) with a hard cap of 100 items.
const CHUNK_BYTE_BUDGET = 6000;
const CHUNK_MAX_ITEMS = 100;
// Bound each invocation to 20,000 events (not a failure); remaining rows wait for a later run.
const MAX_EVENT_BATCHES = 200;
// Stop starting new event batches after this much wall-clock time; later runs drain the rest.
const EVENT_PURGE_BUDGET_MS = 120_000;
const TARGETS = [
  { bucket: "project-files", table: "project_files", key: "projectFiles" },
  {
    bucket: "work-order-attachments",
    table: "work_order_attachments",
    key: "workOrderAttachments",
  },
] as const;
type StorageTarget = (typeof TARGETS)[number];

export function chunkByBytes(items: string[]) {
  const chunks: string[][] = [];
  let current: string[] = [];
  let bytes = 0;
  for (const item of items) {
    const size = encodeURIComponent(item).length + 1;
    if (
      current.length > 0 &&
      (bytes + size > CHUNK_BYTE_BUDGET || current.length >= CHUNK_MAX_ITEMS)
    ) {
      chunks.push(current);
      current = [];
      bytes = 0;
    }
    current.push(item);
    bytes += size;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

async function cleanPageEvents(
  client: AdminClient,
  cutoff: string,
  clock: () => number,
) {
  let deleted = 0;
  const started = clock();
  try {
    for (let batch = 0; batch < MAX_EVENT_BATCHES; batch++) {
      if (clock() - started >= EVENT_PURGE_BUDGET_MS) {
        return { deleted, failed: false, truncated: true };
      }
      const { data, error } = await client
        .from("page_events")
        .select("id")
        .lt("occurred_at", cutoff)
        .order("id")
        .limit(CHUNK_MAX_ITEMS);
      if (error || !data) throw new Error("Page events query failed");
      if (data.length === 0)
        return { deleted, failed: false, truncated: false };

      for (const ids of chunkByBytes(data.map((row) => row.id))) {
        const { count, error: deleteError } = await client
          .from("page_events")
          .delete({ count: "exact" })
          .in("id", ids);
        if (deleteError || count === null) {
          throw new Error("Page events deletion failed");
        }
        deleted += count;
      }
      if (data.length < CHUNK_MAX_ITEMS) {
        return { deleted, failed: false, truncated: false };
      }
    }
    // Batch cap reached: the remaining backlog is purged by later runs.
    return { deleted, failed: false, truncated: true };
  } catch {
    return { deleted, failed: true, truncated: false };
  }
}

async function findUnreferenced(
  client: AdminClient,
  table: StorageTarget["table"],
  paths: string[],
) {
  const unreferenced: string[] = [];
  for (const chunk of chunkByBytes(paths)) {
    const { data, count, error } = await client
      .from(table)
      .select("storage_path", { count: "exact" })
      .in("storage_path", chunk);
    // Fail closed per chunk, including when multiple rows share a storage path.
    if (error || !data || count !== data.length) {
      throw new Error("Storage reference query incomplete");
    }
    const referenced = new Set(data.map((row) => row.storage_path));
    unreferenced.push(...chunk.filter((path) => !referenced.has(path)));
  }
  return unreferenced;
}

async function listOldPaths(
  client: AdminClient,
  { bucket, table }: StorageTarget,
  cutoff: number,
) {
  const storage = client.storage.from(bucket);
  const candidates: string[] = [];
  const prefixes = [""];
  // Collect before removing: deleting during offset pagination can skip files.
  for (
    let index = 0;
    index < prefixes.length && candidates.length < MAX_STORAGE_DELETIONS;
    index++
  ) {
    const prefix = prefixes[index];
    for (
      let offset = 0;
      candidates.length < MAX_STORAGE_DELETIONS;
      offset += PAGE_SIZE
    ) {
      const { data, error } = await storage.list(prefix, {
        limit: PAGE_SIZE,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error || !data) throw new Error("Storage listing failed");
      const oldPaths: string[] = [];
      for (const object of data) {
        const path = prefix ? `${prefix}/${object.name}` : object.name;
        // Supabase lists virtual directories with null IDs/timestamps.
        if (!object.id) {
          prefixes.push(path);
        } else if (
          object.created_at &&
          Date.parse(object.created_at) < cutoff
        ) {
          oldPaths.push(path);
        }
      }
      candidates.push(
        ...(await findUnreferenced(client, table, oldPaths)).slice(
          0,
          MAX_STORAGE_DELETIONS - candidates.length,
        ),
      );
      if (data.length < PAGE_SIZE) break;
    }
  }
  return candidates;
}

async function deleteOrphans(
  client: AdminClient,
  { bucket, table }: StorageTarget,
  candidates: string[],
) {
  // Recheck and remove one chunk at a time. A reference row can still appear
  // between a chunk's recheck and its remove; that window is one round trip
  // per chunk and is further bounded by the 7-day object age gate.
  let deleted = 0;
  let failed = false;
  try {
    for (const chunk of chunkByBytes(candidates)) {
      const orphans = await findUnreferenced(client, table, chunk);
      if (orphans.length === 0) continue;
      const { data, error } = await client.storage.from(bucket).remove(orphans);
      if (error || !data) throw new Error("Storage removal failed");
      deleted += data.length;
      // A short result means some objects were not removed.
      if (data.length < orphans.length) failed = true;
    }
  } catch {
    failed = true;
  }
  return { deleted, failed };
}

export async function runCleanup(
  client: AdminClient,
  now = new Date(),
  clock: () => number = Date.now,
) {
  const summary = {
    pageEvents: 0,
    projectFiles: 0,
    workOrderAttachments: 0,
    truncated: false,
    failedTargets: [] as string[],
  };

  // Storage first: the page_events purge is the unbounded part of the run.
  for (const target of TARGETS) {
    try {
      const candidates = await listOldPaths(
        client,
        target,
        now.getTime() - 7 * DAY_MS,
      );
      const result = await deleteOrphans(client, target, candidates);
      summary[target.key] = result.deleted;
      if (result.failed) summary.failedTargets.push(target.bucket);
    } catch {
      summary.failedTargets.push(target.bucket);
    }
    if (summary.failedTargets.includes(target.bucket)) {
      await logToDatadog("warn", "Cleanup target failed", {
        target: target.bucket,
      });
    }
    await logToDatadog("info", "Cleanup target completed", {
      target: target.bucket,
      deleted: summary[target.key],
    });
  }

  const events = await cleanPageEvents(
    client,
    new Date(now.getTime() - 90 * DAY_MS).toISOString(),
    clock,
  );
  summary.pageEvents = events.deleted;
  summary.truncated = events.truncated;
  if (events.failed) {
    summary.failedTargets.push("page_events");
    await logToDatadog("warn", "Cleanup target failed", {
      target: "page_events",
    });
  }
  await logToDatadog("info", "Cleanup target completed", {
    target: "page_events",
    deleted: summary.pageEvents,
    truncated: summary.truncated,
  });
  return summary;
}
