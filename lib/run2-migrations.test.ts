/**
 * Static assertions over the Run 2 storage/index migrations. These do not run
 * SQL (see supabase/tests/database/run2_storage.test.sql for the pgTAP
 * behaviour checks); they pin the key statements so a later edit cannot
 * silently make the bucket public, widen writes, or drop a guard.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS = join(process.cwd(), "supabase", "migrations");

/** Read a migration with `--` comments stripped and whitespace collapsed. */
function sql(file: string): string {
  return readFileSync(join(MIGRATIONS, file), "utf8")
    .replace(/--[^\n]*/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

const T1 = sql("20261023000100_digital_assets_storage.sql");
const T2 = sql("20261023000200_drop_company_members_company_idx.sql");
const T3 = sql("20261023000300_project_files_storage_path_unique.sql");
const T11 = sql("20261023000400_company_storage_select.sql");
const T5 = sql("20261023000500_storage_path_unique_indexes.sql");
const ALL = [T1, T2, T3, T11, T5];

const WRITE_POLICY = /create policy[^;]*\bfor (insert|update|delete|all)\b/;

describe("20261023000100_digital_assets_storage", () => {
  it("creates the digital-assets bucket private and forces an existing one private", () => {
    // pgTAP also re-runs this statement over a public bucket (run2_storage.test.sql).
    expect(T1).toContain(
      "insert into storage.buckets (id, name, public) values ('digital-assets', 'digital-assets', false) on conflict (id) do update set public = false;"
    );
    expect(T1).not.toContain("do nothing");
    expect(T1).not.toMatch(/'digital-assets',\s*true/);
  });

  it("adds the entitlement-gated SELECT policy for authenticated only", () => {
    expect(T1).toContain('drop policy if exists "digital_assets_storage_select_entitled" on storage.objects');
    expect(T1).toContain(
      'create policy "digital_assets_storage_select_entitled" on storage.objects for select to authenticated'
    );
    expect(T1).toContain("bucket_id = 'digital-assets'");
    expect(T1).toContain("da.storage_path = objects.name");
    expect(T1).toContain("and da.active");
    expect(T1).toContain("e.user_id = (select auth.uid())");
    expect(T1).toContain("e.company_id is not null and public.is_company_member(e.company_id)");
  });

  it("guards the policy on its dependencies and fails loudly when one is missing", () => {
    expect(T1).toMatch(/else raise exception 'digital_assets_storage_select_entitled:/);
    expect(T1).not.toMatch(/raise notice/);
    expect(T1).toContain("to_regclass('storage.objects') is not null");
    expect(T1).toContain("to_regclass('public.digital_assets') is not null");
    expect(T1).toContain("to_regclass('public.asset_entitlements') is not null");
    expect(T1).toContain("to_regprocedure('public.is_company_member(uuid)') is not null");
  });

  it("adds no write policy", () => {
    expect(T1).not.toMatch(WRITE_POLICY);
  });
});

describe("20261023000200_drop_company_members_company_idx", () => {
  it("drops the redundant index", () => {
    expect(T2).toContain("drop index if exists public.company_members_company_idx;");
  });

  it("refuses to drop it without a unique index leading with company_id", () => {
    expect(T2).toMatch(/i\.indisunique and a\.attname = 'company_id'/);
    expect(T2).toMatch(/raise exception 'company_members has no unique index leading with company_id/);
  });
});

describe("20261023000300_project_files_storage_path_unique", () => {
  it("raises (never skips) when duplicate storage_path values exist", () => {
    expect(T3).toMatch(/group by storage_path having count\(\*\) > 1/);
    expect(T3).toMatch(/if v_dup_paths > 0 then raise exception 'project_files\.storage_path has % duplicated value/);
    expect(T3).not.toMatch(/raise notice/);
    expect(T3).not.toMatch(/\breturn\b/);
  });

  it("creates the unique index", () => {
    expect(T3).toContain(
      "create unique index if not exists project_files_storage_path_key on public.project_files (storage_path);"
    );
  });
});

describe("20261023000400_company_storage_select", () => {
  it("drops the owner-only storage SELECT policies", () => {
    expect(T11).toContain('drop policy if exists "project_files_storage_select_own" on storage.objects');
    expect(T11).toContain('drop policy if exists "wo_attachments_storage_select_own" on storage.objects');
  });

  it("creates company-aware SELECT policies for authenticated", () => {
    expect(T11).toContain(
      'create policy "project_files_storage_select_owner_or_company" on storage.objects for select to authenticated'
    );
    expect(T11).toContain(
      'create policy "wo_attachments_storage_select_owner_or_company" on storage.objects for select to authenticated'
    );
    expect(T11).toContain("p.company_id is not null and public.is_company_member(p.company_id)");
    expect(T11).toContain("w.company_id is not null and public.is_company_member(w.company_id)");
    expect(T11).toContain("p.owner_user_id = (select auth.uid())");
    expect(T11).toContain("w.created_by = (select auth.uid())");
  });

  it("fails loudly (never skips) when a table dependency is missing", () => {
    expect(T11).toMatch(/raise exception 'project_files_storage_select_owner_or_company:/);
    expect(T11).toMatch(/raise exception 'wo_attachments_storage_select_owner_or_company:/);
    expect(T11).not.toMatch(/raise notice/);
  });

  it("does not touch or widen any write policy", () => {
    expect(T11).not.toMatch(WRITE_POLICY);
    expect(T11).not.toContain("wo_attachments_storage_insert_own");
    expect(T11).not.toContain("wo_attachments_storage_delete_own");
  });
});

describe("20261023000500_storage_path_unique_indexes", () => {
  it("raises (never skips) on a missing table or duplicate storage_path values", () => {
    expect(T5).toContain("values ('digital_assets'), ('work_order_attachments')");
    expect(T5).toMatch(/if to_regclass\('public\.' \|\| r\.table_name\) is null then raise exception/);
    expect(T5).toMatch(/group by storage_path having count\(\*\) > 1/);
    expect(T5).toMatch(/if v_dup_paths > 0 then raise exception '%\.storage_path has % duplicated value/);
    expect(T5).not.toMatch(/raise notice/);
  });

  it("creates both unique indexes", () => {
    expect(T5).toContain(
      "create unique index if not exists digital_assets_storage_path_key on public.digital_assets (storage_path);"
    );
    expect(T5).toContain(
      "create unique index if not exists work_order_attachments_storage_path_key on public.work_order_attachments (storage_path);"
    );
  });
});

describe("all Run 2 storage migrations", () => {
  it("never call auth.uid() without the (select ...) initplan wrapper", () => {
    for (const body of ALL) {
      expect(body.replace(/\(select auth\.uid\(\)\)/g, "")).not.toContain("auth.uid()");
    }
  });

  it("add no UPDATE policy anywhere", () => {
    for (const body of ALL) {
      expect(body).not.toMatch(/create policy[^;]*\bfor update\b/);
    }
  });
});
