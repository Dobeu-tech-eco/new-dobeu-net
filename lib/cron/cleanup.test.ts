import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildStubClient } from "@/lib/actions/__test-helpers";
import type { createAdminClient } from "@/lib/supabase/server";
import { logToDatadog } from "@/lib/datadog-server";
import { runCleanup } from "./cleanup";

vi.mock("@/lib/datadog-server", () => ({ logToDatadog: vi.fn() }));

const NOW = new Date("2026-10-22T08:00:00.000Z");
const ago = (days: number) =>
  new Date(NOW.getTime() - days * 86_400_000).toISOString();
type StoredFile = { path: string; created_at: string | null };
type PageEvent = { id: string; occurred_at: string };
type ListedObject = {
  id: string | null;
  name: string;
  created_at: string | null;
};
const file = (path: string, days = 8): StoredFile => ({
  path,
  created_at: ago(days),
});

function stubCleanup(
  opts: {
    files?: Record<string, StoredFile[]>;
    references?: Record<string, string[]>;
    events?: PageEvent[];
    failEvents?: boolean;
    failReferences?: string;
    truncateReferences?: string;
    linkOnRecheck?: string;
    failList?: string;
    failLaterPage?: boolean;
    failRemove?: string;
  } = {},
) {
  const stub = buildStubClient({});
  const files = structuredClone(opts.files ?? {});
  const references = structuredClone(opts.references ?? {});
  let events = structuredClone(opts.events ?? []);
  const checks: Record<string, number> = {};
  const originalFrom = stub.supabase.from.getMockImplementation()!;
  const lt = vi.fn();
  stub.supabase.from.mockImplementation((table: string) => {
    const result = originalFrom(table);
    const originalDelete = result.delete.getMockImplementation()!;
    result.delete.mockImplementation((...args: unknown[]) => {
      const chain = originalDelete(...args);
      chain.lt = lt.mockImplementation((column: string, cutoff: string) => {
        if (opts.failEvents)
          return Promise.resolve({
            error: { message: "offline" },
            count: null,
          });
        const deleted = events.filter((event) => event.occurred_at < cutoff);
        events = events.filter((event) => !deleted.includes(event));
        return Promise.resolve({ error: null, count: deleted.length });
      });
      return chain;
    });
    const originalSelect = result.select.getMockImplementation()!;
    result.select.mockImplementation((...args: unknown[]) => {
      const chain = originalSelect(...args);
      const originalIn = chain.in as (...args: unknown[]) => unknown;
      chain.in = (column: string, paths: string[]) => {
        originalIn(column, paths);
        checks[table] = (checks[table] ?? 0) + 1;
        if (opts.linkOnRecheck === table && checks[table] === 2) {
          references[table] = [...(references[table] ?? []), ...paths];
        }
        const matches = (references[table] ?? []).filter((path) =>
          paths.includes(path),
        );
        const data = matches.map((storage_path) => ({ storage_path }));
        return Promise.resolve({
          data: opts.truncateReferences === table ? data.slice(0, 1) : data,
          count: data.length,
          error: opts.failReferences === table ? { message: "offline" } : null,
        });
      };
      return chain;
    });
    return result;
  });

  const list = vi.fn(
    async (
      bucket: string,
      prefix: string,
      options: { offset: number; limit: number },
    ) => {
      if (
        opts.failList === bucket ||
        (opts.failLaterPage && options.offset > 0)
      ) {
        return { data: null, error: { message: "offline" } };
      }
      const entries = new Map<string, ListedObject>();
      for (const object of files[bucket] ?? []) {
        const start = prefix ? `${prefix}/` : "";
        if (!object.path.startsWith(start)) continue;
        const tail = object.path.slice(start.length);
        const [name, ...rest] = tail.split("/");
        entries.set(
          name,
          rest.length > 0
            ? { id: null, name, created_at: null }
            : { id: object.path, name, created_at: object.created_at },
        );
      }
      return {
        data: [...entries.values()]
          .sort((a, b) => a.name.localeCompare(b.name))
          .slice(options.offset, options.offset + options.limit),
        error: null,
      };
    },
  );
  const remove = vi.fn(async (bucket: string, paths: string[]) => {
    if (opts.failRemove === bucket)
      return { data: null, error: { message: "offline" } };
    files[bucket] = (files[bucket] ?? []).filter(
      (object) => !paths.includes(object.path),
    );
    return { data: paths.map((name) => ({ name })), error: null };
  });
  const supabase = Object.assign(stub.supabase, {
    storage: {
      from: vi.fn((bucket: string) => ({
        list: (prefix: string, options: { offset: number; limit: number }) =>
          list(bucket, prefix, options),
        remove: (paths: string[]) => remove(bucket, paths),
      })),
    },
  });
  return {
    ...stub,
    client: supabase as unknown as ReturnType<typeof createAdminClient>,
    files,
    list,
    remove,
    lt,
    events: () => events,
  };
}

beforeEach(() => vi.clearAllMocks());

describe("runCleanup", () => {
  it("deletes only old unreferenced objects in both buckets, including nested paths", async () => {
    const stub = stubCleanup({
      files: {
        "project-files": [
          file("project/deep/orphan.pdf"),
          file("referenced.pdf", 20),
          file("young.pdf", 6),
          file("boundary.pdf", 7),
          { path: "no-date.pdf", created_at: null },
          { path: "invalid.pdf", created_at: "invalid" },
        ],
        "work-order-attachments": [
          file("work/orphan.png"),
          file("work/linked.png", 40),
        ],
      },
      references: {
        project_files: ["referenced.pdf", "work/orphan.png"],
        work_order_attachments: ["work/linked.png"],
      },
    });
    expect(await runCleanup(stub.client, NOW)).toEqual({
      pageEvents: 0,
      projectFiles: 1,
      workOrderAttachments: 1,
      failedTargets: [],
    });
    expect(stub.remove.mock.calls).toEqual([
      ["project-files", ["project/deep/orphan.pdf"]],
      ["work-order-attachments", ["work/orphan.png"]],
    ]);
    for (const target of [
      "page_events",
      "project-files",
      "work-order-attachments",
    ]) {
      expect(logToDatadog).toHaveBeenCalledWith(
        "info",
        "Cleanup target completed",
        {
          target,
          deleted: target === "page_events" ? 0 : 1,
        },
      );
    }
  });

  it("deletes page events using a strict 90-day occurred_at cutoff", async () => {
    const stub = stubCleanup({
      events: [
        { id: "old", occurred_at: ago(91) },
        { id: "boundary", occurred_at: ago(90) },
        { id: "recent", occurred_at: ago(1) },
      ],
    });
    expect((await runCleanup(stub.client, NOW)).pageEvents).toBe(1);
    expect(stub.lt).toHaveBeenCalledWith("occurred_at", ago(90));
    expect(stub.recorded).toContainEqual({
      table: "page_events",
      method: "delete",
      args: [{ count: "exact" }],
    });
    expect(stub.events().map((event) => event.id)).toEqual([
      "boundary",
      "recent",
    ]);
  });

  it("is idempotent: the second consecutive run deletes zero rows and objects", async () => {
    const stub = stubCleanup({
      events: [{ id: "old", occurred_at: ago(91) }],
      files: {
        "project-files": [file("orphan")],
        "work-order-attachments": [file("orphan")],
      },
    });
    expect(await runCleanup(stub.client, NOW)).toEqual({
      pageEvents: 1,
      projectFiles: 1,
      workOrderAttachments: 1,
      failedTargets: [],
    });
    const removeCount = stub.remove.mock.calls.length;
    expect(await runCleanup(stub.client, NOW)).toEqual({
      pageEvents: 0,
      projectFiles: 0,
      workOrderAttachments: 0,
      failedTargets: [],
    });
    expect(stub.remove).toHaveBeenCalledTimes(removeCount);
  });

  it("shares the 500 deletion cap across both buckets", async () => {
    const stub = stubCleanup({
      files: {
        "project-files": Array.from({ length: 499 }, (_, i) =>
          file(`file-${i}`),
        ),
        "work-order-attachments": [file("a"), file("b"), file("c")],
      },
    });
    const summary = await runCleanup(stub.client, NOW);
    expect(summary.projectFiles).toBe(499);
    expect(summary.workOrderAttachments).toBe(1);
    expect(
      stub.remove.mock.calls.reduce((sum, call) => sum + call[1].length, 0),
    ).toBe(500);
    expect(stub.files["work-order-attachments"]).toHaveLength(2);
  });

  it("caps a single bucket at 500 and leaves the next bucket untouched", async () => {
    const stub = stubCleanup({
      files: {
        "project-files": Array.from({ length: 501 }, (_, i) =>
          file(`file-${i}`),
        ),
        "work-order-attachments": [file("other")],
      },
    });
    const summary = await runCleanup(stub.client, NOW);
    expect(summary.projectFiles).toBe(500);
    expect(summary.workOrderAttachments).toBe(0);
    expect(stub.files["project-files"]).toHaveLength(1);
    expect(stub.remove).toHaveBeenCalledTimes(1);
  });

  it("paginates storage listings past 1000 referenced objects without skipping an orphan", async () => {
    const linked = Array.from({ length: 1000 }, (_, i) =>
      file(`a-${String(i).padStart(4, "0")}`),
    );
    const stub = stubCleanup({
      files: { "project-files": [...linked, file("z-orphan")] },
      references: { project_files: linked.map((object) => object.path) },
    });
    expect((await runCleanup(stub.client, NOW)).projectFiles).toBe(1);
    expect(stub.list).toHaveBeenCalledWith(
      "project-files",
      "",
      expect.objectContaining({ offset: 1000 }),
    );
    expect(stub.remove).toHaveBeenCalledExactlyOnceWith("project-files", [
      "z-orphan",
    ]);
  });

  it("continues the other targets when event deletion and one storage listing fail", async () => {
    const stub = stubCleanup({
      failEvents: true,
      failList: "project-files",
      files: { "work-order-attachments": [file("orphan")] },
    });
    expect(await runCleanup(stub.client, NOW)).toEqual({
      pageEvents: 0,
      projectFiles: 0,
      workOrderAttachments: 1,
      failedTargets: ["page_events", "project-files"],
    });
  });

  it("never removes objects if the reference query fails", async () => {
    const stub = stubCleanup({
      failReferences: "project_files",
      files: { "project-files": [file("unknown")] },
    });
    const summary = await runCleanup(stub.client, NOW);
    expect(summary.failedTargets).toEqual(["project-files"]);
    expect(stub.remove).not.toHaveBeenCalled();
  });

  it("fails closed when database row limits truncate reference results", async () => {
    const stub = stubCleanup({
      truncateReferences: "project_files",
      files: { "project-files": [file("protected-a"), file("protected-b")] },
      references: { project_files: ["protected-a", "protected-b"] },
    });
    expect((await runCleanup(stub.client, NOW)).failedTargets).toEqual([
      "project-files",
    ]);
    expect(stub.remove).not.toHaveBeenCalled();
  });

  it("preserves a file linked after discovery and before the final reference check", async () => {
    const stub = stubCleanup({
      linkOnRecheck: "project_files",
      files: { "project-files": [file("newly-linked")] },
    });
    expect((await runCleanup(stub.client, NOW)).projectFiles).toBe(0);
    expect(stub.remove).not.toHaveBeenCalled();
  });

  it("does not delete collected candidates after a later listing page fails", async () => {
    const linked = Array.from({ length: 999 }, (_, i) =>
      file(`a-${String(i).padStart(4, "0")}`),
    );
    const stub = stubCleanup({
      failLaterPage: true,
      files: {
        "project-files": [...linked, file("b-orphan"), file("c-orphan")],
      },
      references: { project_files: linked.map((object) => object.path) },
    });
    expect((await runCleanup(stub.client, NOW)).failedTargets).toEqual([
      "project-files",
    ]);
    expect(stub.remove).not.toHaveBeenCalled();
  });

  it("counts failed removal attempts toward the cap and continues without throwing", async () => {
    const stub = stubCleanup({
      failRemove: "project-files",
      files: {
        "project-files": Array.from({ length: 500 }, (_, i) =>
          file(`file-${i}`),
        ),
        "work-order-attachments": [file("other")],
      },
    });
    expect(await runCleanup(stub.client, NOW)).toEqual({
      pageEvents: 0,
      projectFiles: 0,
      workOrderAttachments: 0,
      failedTargets: ["project-files"],
    });
    expect(stub.remove).toHaveBeenCalledTimes(1);
    expect(logToDatadog).toHaveBeenCalledWith("warn", "Cleanup target failed", {
      target: "project-files",
    });
  });
});
