import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildStubClient } from "@/lib/actions/__test-helpers";
import { listSuspendedCompanies } from "./company-status";

type Tables = NonNullable<Parameters<typeof buildStubClient>[0]["tables"]>;

function client(tables: Tables) {
  const { supabase, recorded } = buildStubClient({ tables });
  // The shared stub has no .neq(); add a recording one to the select chain.
  const from = supabase.from;
  supabase.from = vi.fn((table: string) => {
    const q = from(table);
    const select = q.select;
    q.select = vi.fn((...a: unknown[]) => {
      const b = select(...a) as Record<string, unknown>;
      b.neq = vi.fn((...n: unknown[]) => {
        recorded.push({ table, method: "neq", args: n });
        return b;
      });
      return b;
    }) as typeof q.select;
    return q;
  }) as typeof supabase.from;
  return { supabase: supabase as unknown as SupabaseClient<Database>, recorded, from: supabase.from };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe("listSuspendedCompanies", () => {
  it("makes one joined read scoped to the caller's active memberships and non-active companies", async () => {
    const { supabase, recorded, from } = client({
      company_members: { selectSingle: { data: [{ companies: { id: "c2", name: "B", status: "suspended" } }] } },
    });
    expect(await listSuspendedCompanies(supabase, "u1")).toEqual([{ id: "c2", name: "B" }]);
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("company_members");
    expect(recorded).toContainEqual({ table: "company_members", method: "select", args: ["companies!inner(id, name, status)"] });
    expect(recorded).toContainEqual({ table: "company_members", method: "eq", args: ["user_id", "u1"] });
    expect(recorded).toContainEqual({ table: "company_members", method: "eq", args: ["status", "active"] });
    expect(recorded).toContainEqual({ table: "company_members", method: "neq", args: ["companies.status", "active"] });
  });

  it("returns [] when no membership has a non-active company", async () => {
    const { supabase } = client({ company_members: { selectSingle: { data: [] } } });
    expect(await listSuspendedCompanies(supabase, "u1")).toEqual([]);
  });

  it("returns every suspended company, mapped to id and name only", async () => {
    const { supabase } = client({
      company_members: {
        selectSingle: {
          data: [
            { companies: { id: "c2", name: "B", status: "suspended" } },
            { companies: { id: "c4", name: "D", status: "suspended" } },
          ],
        },
      },
    });
    expect(await listSuspendedCompanies(supabase, "u1")).toEqual([
      { id: "c2", name: "B" },
      { id: "c4", name: "D" },
    ]);
  });

  it("returns [] and logs only a safe summary when the read errors", async () => {
    const { supabase } = client({
      company_members: { selectSingle: { error: { message: "secret@example.com leaked" } } },
    });
    expect(await listSuspendedCompanies(supabase, "u1")).toEqual([]);
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("secret@example.com");
  });

  it("returns [] when the client throws", async () => {
    const { supabase } = client({});
    supabase.from = vi.fn(() => {
      throw new Error("secret@example.com boom");
    }) as typeof supabase.from;
    expect(await listSuspendedCompanies(supabase, "u1")).toEqual([]);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("secret@example.com");
  });
});
