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
        new RegExp(`alter function public\\.${escaped} set search_path = pg_catalog, public;`)
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

  it("does not list pg_temp in any search_path", () => {
    expect(sql).not.toMatch(/search_path[^;]*pg_temp/);
  });

  it("re-revokes EXECUTE on the typeform trigger functions, guarded by existence", () => {
    for (const fn of [
      "enforce_typeform_budget_intake_state",
      "audit_typeform_budget_intake_review"
    ]) {
      expect(sql).toContain(`to_regprocedure('public.${fn}()') is not null`);
      expect(sql).toMatch(
        new RegExp(
          `revoke execute on function public\\.${fn}\\(\\) from public, anon, authenticated;`
        )
      );
    }
  });

  it("locks profiles writes to column-level UPDATE on non-sensitive columns", () => {
    expect(sql).toMatch(
      /revoke insert, update, delete on table public\.profiles from anon, authenticated;/
    );
    expect(sql).toMatch(/'full_name', 'company', 'phone', 'notify_email'/);
    expect(sql).toMatch(/grant update \(%s\) on table public\.profiles to authenticated/);
    expect(sql).not.toMatch(/grant\s+update\s*\([^)]*(stripe_customer_id|apollo_contact_id)/);
    expect(sql).not.toMatch(/grant\s+(all|update)\s+on\s+table\s+public\.profiles/);
  });

  it("locks company_members to column-level grants (no user_id/company_id rewrite)", () => {
    expect(sql).toMatch(
      /revoke insert, update on table public\.company_members from anon, authenticated;/
    );
    expect(sql).toMatch(/grant update \(role, status\)\s+on table public\.company_members to authenticated;/);
    expect(sql).toMatch(
      /grant insert \(company_id, user_id, role, status, invited_by\)\s+on table public\.company_members to authenticated;/
    );
    const ins = policies.find((p) => p.includes('"company_members_admin_insert"')) ?? "";
    expect(ins).toMatch(/status = 'invited'/);
    expect(ins).toMatch(/invited_by = \(select auth\.uid\(\)\)/);
    for (const name of ["company_members_admin_insert", "company_members_admin_update"]) {
      const pol = policies.find((p) => p.includes(`"${name}"`)) ?? "";
      expect(pol, name).toMatch(
        /company_roles r where r\.key = company_members\.role\), 0 \) <= public\.company_role_rank\(company_id\)/
      );
    }
  });

  it("wo_insert_own requires the project's company to match the work order's company", () => {
    const wo = policies.find(
      (p) => p.includes('"wo_insert_own"') && p.includes("is_company_member")
    );
    expect(wo).toBeTruthy();
    expect(wo).toMatch(/p\.company_id = work_orders\.company_id/);
  });

  it("digital_assets select requires an entitlement, not just active", () => {
    const da = policies.find((p) => p.includes('"digital_assets_select_active"')) ?? "";
    expect(da).toMatch(/from public\.asset_entitlements e/);
    expect(da).toMatch(/e\.asset_id = digital_assets\.id/);
  });
});
