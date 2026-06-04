/**
 * Shared mock builders for server-action tests.
 * Keeps every action test file consistent without making any of them
 * depend on the others' state.
 */
import { vi } from "vitest";

export type StubUser = { id: string; email: string };

export interface StubTable {
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
}

/**
 * Build a thenable query builder where every method returns `this` and a
 * final `.single()` / await resolves to `{ data, error }`.
 *
 * Tests can assert against the call args of any method on the returned object.
 */
export function buildStubClient(opts: {
  user?: StubUser | null;
  // Per-table behavior: { insert?: {data,error}, update?: {error}, delete?: {error},
  // selectSingle?: {data,error}, selectMany?: {data,error} }.
  tables?: Record<
    string,
    {
      insert?: { data?: unknown; error?: { message: string } | null };
      update?: { data?: unknown; error?: { message: string } | null };
      delete?: { error?: { message: string } | null };
      selectSingle?: { data?: unknown; error?: { message: string } | null };
    }
  >;
}) {
  const tablesArg = opts.tables ?? {};
  const recorded: { table: string; method: string; args: unknown[] }[] = [];

  function makeChain(
    table: string,
    terminal:
      | { kind: "insert"; data?: unknown; error?: { message: string } | null }
      | { kind: "update"; error?: { message: string } | null }
      | { kind: "delete"; error?: { message: string } | null }
      | { kind: "select"; data?: unknown; error?: { message: string } | null }
  ) {
    // The builder is itself awaitable AND has `.select().single()` / `.eq()` etc.
    const builder: Record<string, unknown> = {
      select: vi.fn((...a: unknown[]) => {
        recorded.push({ table, method: "select", args: a });
        return builder;
      }),
      eq: vi.fn((...a: unknown[]) => {
        recorded.push({ table, method: "eq", args: a });
        return builder;
      }),
      in: vi.fn((...a: unknown[]) => {
        recorded.push({ table, method: "in", args: a });
        return builder;
      }),
      order: vi.fn((...a: unknown[]) => {
        recorded.push({ table, method: "order", args: a });
        return builder;
      }),
      limit: vi.fn((...a: unknown[]) => {
        recorded.push({ table, method: "limit", args: a });
        return builder;
      }),
      single: vi.fn(() => {
        recorded.push({ table, method: "single", args: [] });
        if (terminal.kind === "insert" || terminal.kind === "select") {
          return Promise.resolve({ data: terminal.data ?? null, error: terminal.error ?? null });
        }
        return Promise.resolve({ data: null, error: terminal.error ?? null });
      }),
      then: (resolve: (v: { data: unknown; error: unknown }) => void) => {
        if (terminal.kind === "insert" || terminal.kind === "select") {
          resolve({ data: terminal.data ?? null, error: terminal.error ?? null });
        } else {
          resolve({ data: null, error: terminal.error ?? null });
        }
      }
    };
    return builder;
  }

  const from = vi.fn((table: string) => {
    const cfg = tablesArg[table] ?? {};
    return {
      insert: vi.fn((...a: unknown[]) => {
        recorded.push({ table, method: "insert", args: a });
        return makeChain(table, {
          kind: "insert",
          data: cfg.insert?.data,
          error: cfg.insert?.error ?? null
        });
      }),
      update: vi.fn((...a: unknown[]) => {
        recorded.push({ table, method: "update", args: a });
        return makeChain(table, { kind: "update", error: cfg.update?.error ?? null });
      }),
      delete: vi.fn((...a: unknown[]) => {
        recorded.push({ table, method: "delete", args: a });
        return makeChain(table, { kind: "delete", error: cfg.delete?.error ?? null });
      }),
      select: vi.fn((...a: unknown[]) => {
        recorded.push({ table, method: "select", args: a });
        return makeChain(table, {
          kind: "select",
          data: cfg.selectSingle?.data,
          error: cfg.selectSingle?.error ?? null
        });
      })
    };
  });

  const user = opts.user === undefined ? { id: "user_default", email: "user@example.com" } : opts.user;

  const supabase = {
    from,
    auth: {
      getUser: vi.fn(async () => ({ data: { user }, error: null }))
    }
  };

  return { supabase, recorded };
}
