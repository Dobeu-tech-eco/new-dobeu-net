import type { createAdminClient } from "@/lib/supabase/server";
import { logToDatadog } from "@/lib/datadog-server";

type AdminClient = ReturnType<typeof createAdminClient>;
const DAY_MS = 86_400_000;
const PAGE_SIZE = 1000;
const MAX_STORAGE_DELETIONS = 500;
const TARGETS = [
  { bucket: "project-files", table: "project_files" },
  { bucket: "work-order-attachments", table: "work_order_attachments" },
] as const;

export async function runCleanup(client: AdminClient, now = new Date()) {
  const summary = {
    pageEvents: 0,
    projectFiles: 0,
    workOrderAttachments: 0,
    failedTargets: [] as string[],
  };

  try {
    const { count, error } = await client
      .from("page_events")
      .delete({ count: "exact" })
      .lt("occurred_at", new Date(now.getTime() - 90 * DAY_MS).toISOString());
    if (error) throw error;
    summary.pageEvents = count ?? 0;
  } catch {
    summary.failedTargets.push("page_events");
    await logToDatadog("warn", "Cleanup target failed", {
      target: "page_events",
    });
  }
  await logToDatadog("info", "Cleanup target completed", {
    target: "page_events",
    deleted: summary.pageEvents,
  });

  const cutoff = now.getTime() - 7 * DAY_MS;
  let remaining = MAX_STORAGE_DELETIONS;
  for (const { bucket, table } of TARGETS) {
    let deleted = 0;
    try {
      const storage = client.storage.from(bucket);
      const candidates: string[] = [];
      const prefixes = [""];
      // Collect before removing: deleting during offset pagination can skip files.
      for (
        let index = 0;
        index < prefixes.length && candidates.length < remaining;
        index++
      ) {
        const prefix = prefixes[index];
        for (
          let offset = 0;
          candidates.length < remaining;
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
            // Supabase list returns virtual directories with null IDs/timestamps.
            if (!object.id) {
              prefixes.push(path);
            } else if (
              object.created_at &&
              Date.parse(object.created_at) < cutoff
            ) {
              oldPaths.push(path);
            }
          }
          if (oldPaths.length > 0) {
            const {
              data: references,
              count,
              error: referenceError,
            } = await client
              .from(table)
              .select("storage_path", { count: "exact" })
              .in("storage_path", oldPaths);
            if (referenceError || !references || count !== references.length) {
              // Never classify files from a truncated reference result as orphaned.
              throw new Error("Storage reference query incomplete");
            }
            const referenced = new Set(
              references.map((row) => row.storage_path),
            );
            candidates.push(
              ...oldPaths
                .filter((path) => !referenced.has(path))
                .slice(0, remaining - candidates.length),
            );
          }
          if (data.length < PAGE_SIZE) break;
        }
      }

      if (candidates.length > 0) {
        // Recheck the whole batch immediately before deleting; fail closed if the
        // API returns a partial result, including when multiple rows share a path.
        const { data, count, error } = await client
          .from(table)
          .select("storage_path", { count: "exact" })
          .in("storage_path", candidates);
        if (error || !data || count !== data.length) {
          throw new Error("Storage reference check incomplete");
        }
        const referenced = new Set(data.map((row) => row.storage_path));
        const orphans = candidates.filter((path) => !referenced.has(path));
        if (orphans.length > 0) {
          // Charge attempts as well as successes so partial failures cannot exceed the cap.
          remaining -= orphans.length;
          const { data, error } = await storage.remove(orphans);
          if (error || !data) throw new Error("Storage removal failed");
          deleted = data.length;
        }
      }
    } catch {
      summary.failedTargets.push(bucket);
      await logToDatadog("warn", "Cleanup target failed", { target: bucket });
    }
    if (bucket === "project-files") summary.projectFiles = deleted;
    else summary.workOrderAttachments = deleted;
    await logToDatadog("info", "Cleanup target completed", {
      target: bucket,
      deleted,
    });
  }
  return summary;
}
