import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildStubClient } from "@/lib/actions/__test-helpers";
import { listSuspendedCompanies } from "./company-status";

type Tables = NonNullable<Parameters<typeof buildStubClient>[0]["tables"]>;

function client(tables: Tables) {
  const { supabase, recorded } = buildStubClient({ tables });
  // The shared stub has no .neq(); add a recording one to the companies chain.
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
  it("returns [] without a second read when there are no memberships", async () => {
    const { supabase, from } = client({ company_members: { selectSingle: { data: [] } } });
    expect(await listSuspendedCompanies(supabase, "u1")).toEqual([]);
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("company_members");
  });

  it("returns [] when every company is active", async () => {
    const { supabase } = client({
      company_members: { selectSingle: { data: [{ company_id: "c1" }] } },
      companies: { selectSingle: { data: [{ id: "c1", name: "A", status: "active" }] } },
    });
    expect(await listSuspendedCompanies(supabase, "u1")).toEqual([]);
  });

  it("returns only the suspended company among several, scoped to the caller", async () => {
    const { supabase, recorded } = client({
      company_members: { selectSingle: { data: [{ company_id: "c1" }, { company_id: "c2" }, { company_id: "c3" }] } },
      companies: {
        selectSingle: {
          data: [
            { id: "c1", name: "A", status: "active" },
            { id: "c2", name: "B", status: "suspended" },
            { id: "c3", name: "C", status: "active" },
          ],
        },
      },
    });
    expect(await listSuspendedCompanies(supabase, "u1")).toEqual([{ id: "c2", name: "B" }]);
    expect(recorded).toContainEqual({ table: "company_members", method: "eq", args: ["user_id", "u1"] });
    expect(recorded).toContainEqual({ table: "company_members", method: "eq", args: ["status", "active"] });
    expect(recorded).toContainEqual({ table: "companies", method: "neq", args: ["status", "active"] });
    expect(recorded).toContainEqual({ table: "companies", method: "in", args: ["id", ["c1", "c2", "c3"]] });
  });

  it("returns [] and logs only a safe summary when the membership read errors", async () => {
    const { supabase, from } = client({
      company_members: { selectSingle: { error: { message: "secret@example.com leaked" } } },
    });
    expect(await listSuspendedCompanies(supabase, "u1")).toEqual([]);
    expect(from).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("secret@example.com");
  });

  it("returns [] and logs only a safe summary when the companies read errors", async () => {
    const { supabase } = client({
      company_members: { selectSingle: { data: [{ company_id: "c1" }] } },
      companies: { selectSingle: { error: { message: "secret@example.com leaked" } } },
    });
    expect(await listSuspendedCompanies(supabase, "u1")).toEqual([]);
    expect(console.error).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("secret@example.com");
  });
});
