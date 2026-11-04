import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Static guardrails for the company_members AAL2 migration (D42). They parse
 * the migration text (no database) so a future edit cannot silently drop the
 * AAL2 / active-company requirement from the admin write policies.
 */
const MIGRATION = join(
  process.cwd(),
  "supabase",
  "migrations",
  "20261104000200_company_members_admin_aal2.sql"
);

const sql = readFileSync(MIGRATION, "utf8")
  .split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n")
  .toLowerCase()
  .replace(/\s+/g, " ");

const policy = (name: string): string => {
  const m = sql.match(
    new RegExp(`create policy "${name}"[\\s\\S]*?;(?= drop | end if)`)
  );
  expect(m, `policy ${name}`).not.toBeNull();
  return m![0];
};

const HELPER = "public.can_manage_company_members(company_id)";
const RANK_CAP =
  "coalesce( (select r.rank from public.company_roles r where r.key = company_members.role), 0 ) <= public.company_role_rank(company_id)";

describe("20261104000200_company_members_admin_aal2.sql", () => {
  it("defines a SECURITY DEFINER helper with a pinned search_path", () => {
    expect(sql).toMatch(
      /create or replace function public\.can_manage_company_members\(cid uuid\)/
    );
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = pg_catalog, public, pg_temp");
  });

  it("requires an aal2 claim, rank >= 100 and an active company", () => {
    expect(sql).toMatch(/auth\.jwt\(\)->>'aal'\)[^)]*\) = 'aal2'/);
    expect(sql).toContain("public.company_role_rank(cid) >= 100");
    expect(sql).toMatch(/c\.id = cid and c\.status = 'active'/);
  });

  it("revokes execute from anon and public", () => {
    expect(sql).toMatch(
      /revoke execute on function public\.can_manage_company_members\(uuid\) from public, anon/
    );
    expect(sql).toMatch(
      /grant execute on function public\.can_manage_company_members\(uuid\) to authenticated, service_role/
    );
  });

  it("insert policy uses the helper and keeps invited/invited_by/rank cap", () => {
    const p = policy("company_members_admin_insert");
    expect(p).toContain(HELPER);
    expect(p).toContain("status = 'invited'");
    expect(p).toContain("invited_by = (select auth.uid())");
    expect(p).toContain(RANK_CAP);
    expect(p).toContain("to authenticated");
  });

  it("update policy uses the helper in USING and WITH CHECK and keeps the rank cap", () => {
    const p = policy("company_members_admin_update");
    expect(p).toMatch(new RegExp(`using \\(${HELPER.replace(/[().]/g, "\\$&")}\\)`));
    expect(p).toMatch(
      new RegExp(`with check \\( ${HELPER.replace(/[().]/g, "\\$&")}`)
    );
    expect(p).toContain(RANK_CAP);
    expect(p).toContain("to authenticated");
  });

  it("delete policy uses the helper", () => {
    const p = policy("company_members_admin_delete");
    expect(p).toContain(HELPER);
    expect(p).toContain("to authenticated");
  });

  it("raises when a prerequisite is missing instead of silently skipping", () => {
    expect(sql).toMatch(/ else raise exception 'company_members aal2 migration cannot apply/);
    expect(sql).toContain("to_regprocedure('public.company_role_rank(uuid)') is null");
    expect(sql).toMatch(/end if; end \$\$;\s*$/);
  });

  it("no longer relies on a bare rank check for the policy gate", () => {
    expect(sql).not.toMatch(
      /(using|with check) \(\s*public\.company_role_rank\(company_id\) >= 100/
    );
  });
});
