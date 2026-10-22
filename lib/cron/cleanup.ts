import type { createAdminClient } from "@/lib/supabase/server";
import { logToDatadog } from "@/lib/datadog-server";
import { DAY_MS, PAGE_SIZE } from "./constants";

type AdminClient = ReturnType<typeof createAdminClient>;
const MAX_STORAGE_DELETIONS = 500;
const REFERENCE_CHUNK_SIZE = 100;
// Bound each invocation to 20,000 events; remaining rows wait for a later run.
const MAX_EVENT_BATCHES = 20;
const TARGETS = [
  { bucket: "project-files", table: "project_files", key: "projectFiles" },
  {
    bucket: "work-order-attachments",
    table: "work_order_attachments",
    key: "workOrderAttachments",
  },
] as const;
type StorageTarget = (typeof TARGETS)[number];

async function cleanPageEvents(client: AdminClient, cutoff: string) {
  let deleted = 0;
  try {
    for (let batch = 0; batch < MAX_EVENT_BATCHES; batch++) {
      const { data, error } = await client
        .from("page_events")
        .select("id")
        .lt("occurred_at", cutoff)
        .order("id")
        .limit(PAGE_SIZE);
      if (error || !data) throw new Error("Page events query failed");
      if (data.length === 0) return { deleted, failed: false };

      const { count, error: deleteError } = await client
        .from("page_events")
        .delete({ count: "exact" })
        .in(
          "id",
          data.map((row) => row.id),
        );
      if (deleteError || count === null) {
        throw new Error("Page events deletion failed");
      }
      deleted += count;
      if (data.length < PAGE_SIZE) return { deleted, failed: false };
    }
    throw new Error("Page events batch limit reached");
  } catch {
    return { deleted, failed: true };
  }
}

async function findUnreferenced(
  client: AdminClient,
  table: StorageTarget["table"],
  paths: string[],
) {
  const unreferenced: string[] = [];
  for (let offset = 0; offset < paths.length; offset += REFERENCE_CHUNK_SIZE) {
    const chunk = paths.slice(offset, offset + REFERENCE_CHUNK_SIZE);
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
  // Recheck immediately before removal and keep the per-chunk count guard.
  const orphans = await findUnreferenced(client, table, candidates);
  if (orphans.length === 0) return 0;
  const { data, error } = await client.storage.from(bucket).remove(orphans);
  if (error || !data) throw new Error("Storage removal failed");
  return data.length;
}

export async function runCleanup(client: AdminClient, now = new Date()) {
  const events = await cleanPageEvents(
    client,
    new Date(now.getTime() - 90 * DAY_MS).toISOString(),
  );
  const summary = {
    pageEvents: events.deleted,
    projectFiles: 0,
    workOrderAttachments: 0,
    failedTargets: events.failed ? ["page_events"] : ([] as string[]),
  };
  if (events.failed) {
    await logToDatadog("warn", "Cleanup target failed", {
      target: "page_events",
    });
  }
  await logToDatadog("info", "Cleanup target completed", {
    target: "page_events",
    deleted: summary.pageEvents,
  });

  for (const target of TARGETS) {
    try {
      const candidates = await listOldPaths(
        client,
        target,
        now.getTime() - 7 * DAY_MS,
      );
      summary[target.key] = await deleteOrphans(client, target, candidates);
    } catch {
      summary.failedTargets.push(target.bucket);
      await logToDatadog("warn", "Cleanup target failed", {
        target: target.bucket,
      });
    }
    await logToDatadog("info", "Cleanup target completed", {
      target: target.bucket,
      deleted: summary[target.key],
    });
  }
  return summary;
}
