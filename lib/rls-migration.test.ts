import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Static guardrails for the RLS / advisor hardening migration. These run in
 * CI without a database: they parse the migration text and fail if a future
 * edit reintroduces a pattern the Supabase advisors flag.
 */
const MIGRATION = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20261022000100_rls_advisor_hardening.sql"
);

const raw = readFileSync(MIGRATION, "utf8");

/** Strip `-- line` comments so prose cannot satisfy or trip an assertion. */
const sql = raw
  .split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n")
  .toLowerCase();

/** Every `create policy ... ;` statement, whitespace-normalised. */
const policies = (sql.match(/create\s+policy[\s\S]*?;/g) ?? []).map((s) =>
  s.replace(/\s+/g, " ")
);

describe("20261022000100_rls_advisor_hardening.sql", () => {
  it("defines policies", () => {
    expect(policies.length).toBeGreaterThan(0);
  });

  it("every UPDATE policy has both USING and WITH CHECK", () => {
    const updates = policies.filter((p) => /\bfor update\b/.test(p));
    expect(updates.length).toBeGreaterThan(0);
    for (const p of updates) {
      expect(p, p).toMatch(/\busing\s*\(/);
      expect(p, p).toMatch(/\bwith check\s*\(/);
    }
  });

  it("never uses a bare auth.uid() — only (select auth.uid())", () => {
    const stripped = sql.replace(/\(\s*select\s+auth\.uid\(\)\s*\)/g, "");
    expect(stripped).not.toMatch(/auth\.uid\(\)/);
    expect(sql).toMatch(/\(select auth\.uid\(\)\)/);
  });

  it("every create or replace function sets search_path", () => {
    const fns = sql.match(/create\s+or\s+replace\s+function[\s\S]*?\$\$/g) ?? [];
    for (const f of fns) {
      expect(f, f).toMatch(/set\s+search_path/);
    }
  });

  it("pins search_path on every flagged public function", () => {
    for (const fn of [
      "set_updated_at()",
      "handle_new_user()",
      "is_company_member(uuid)",
      "company_role_rank(uuid)",
      "enforce_typeform_budget_intake_state()",
      "audit_typeform_budget_intake_review()"
    ]) {
      const escaped = fn.replace(/[()]/g, "\\$&");
      expect(sql).toMatch(
        new RegExp(`alter function public\\.${escaped} set search_path = pg_catalog, public`)
      );
    }
  });

  it("keeps authenticated EXECUTE on membership helpers used by RLS", () => {
    for (const fn of ["is_company_member", "company_role_rank"]) {
      expect(sql).toMatch(
        new RegExp(`revoke execute on function public\\.${fn}\\(uuid\\) from public, anon;`)
      );
      expect(sql).toMatch(
        new RegExp(`grant execute on function public\\.${fn}\\(uuid\\) to authenticated`)
      );
      expect(sql).not.toMatch(
        new RegExp(`revoke execute on function public\\.${fn}\\(uuid\\)[^;]*authenticated`)
      );
    }
  });

  it("every created policy is preceded by a drop policy if exists of the same name", () => {
    for (const p of policies) {
      const name = /create policy "([^"]+)"/.exec(p)?.[1];
      expect(name, p).toBeTruthy();
      expect(sql).toContain(`drop policy if exists "${name}"`);
    }
  });

  it("every policy targets authenticated (no anon / public policies)", () => {
    for (const p of policies) {
      expect(p, p).toMatch(/\bto authenticated\b/);
    }
  });

  it("leaves no anon-insertable page_events policy", () => {
    expect(sql).toContain('drop policy if exists "page_events_insert_anon"');
    expect(sql).not.toMatch(/create policy "page_events_insert_anon"/);
    expect(sql).not.toMatch(/with check\s*\(\s*true\s*\)/);
  });

  it("creates indexes idempotently", () => {
    const creates = sql.match(/create\s+(unique\s+)?index[^;']*/g) ?? [];
    expect(creates.length).toBeGreaterThan(0);
    for (const c of creates) {
      expect(c, c).toMatch(/if not exists/);
    }
  });

  it("does not touch storage.buckets or drop tables", () => {
    expect(sql).not.toMatch(/storage\.buckets/);
    expect(sql).not.toMatch(/drop\s+table/);
  });
});
