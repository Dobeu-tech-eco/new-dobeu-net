import { describe, it, expect, beforeEach, vi } from "vitest";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import {
  createProject,
  updateProject,
  deleteProject,
} from "@/lib/actions/projects";
import { buildStubClient, type StubUser } from "./__test-helpers";

const h = vi.hoisted(() => ({
  cookie: null as unknown,
  admin: null as unknown,
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => h.cookie),
  createAdminClient: vi.fn(() => h.admin),
}));

const PROJECT_ID = "00000000-0000-0000-0000-000000000001";
const OWNER_ID = "00000000-0000-0000-0000-000000000002";
const OLD_COMPANY_ID = "00000000-0000-0000-0000-000000000003";
const COMPANY_ID = "00000000-0000-0000-0000-000000000004";
const CREATE_INPUT = { owner_user_id: OWNER_ID, title: "New website redesign" };
const LIST_PATHS = ["/admin/projects", "/portal/projects"];
const UPDATE_PATHS = [
  "/admin/projects",
  `/admin/projects/${PROJECT_ID}`,
  "/portal/projects",
  `/portal/projects/${PROJECT_ID}`,
];

function arrange(
  options: {
    user?: StubUser | null;
    level?: "aal1" | "aal2";
    company?: { id: string; status: string } | null;
    companyError?: { message: string };
    existingProject?: { company_id: string | null } | null;
    projectReadError?: { message: string };
    insert?: { data?: unknown; error?: { message: string } | null };
    updateError?: { message: string };
    deleteError?: { message: string };
  } = {},
) {
  const cookie = buildStubClient({
    user:
      options.user === undefined
        ? { id: "admin_id", email: "admin@dobeu.net" }
        : options.user,
  });
  h.cookie = {
    ...cookie.supabase,
    auth: {
      ...cookie.supabase.auth,
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn(async () => ({
          data: { currentLevel: options.level ?? "aal2", nextLevel: "aal2" },
          error: null,
        })),
      },
    },
  };
  const stub = buildStubClient({
    tables: {
      projects: {
        selectSingle: {
          data:
            options.existingProject === undefined
              ? { company_id: OLD_COMPANY_ID }
              : options.existingProject,
          error: options.projectReadError,
        },
        insert: options.insert ?? { data: { id: PROJECT_ID } },
        update: { error: options.updateError },
        delete: { error: options.deleteError },
      },
      companies: {
        selectSingle: {
          data:
            options.company === undefined
              ? { id: COMPANY_ID, status: "active" }
              : options.company,
          error: options.companyError,
        },
      },
    },
  });
  h.admin = stub.supabase;
  return stub;
}

let admin: ReturnType<typeof arrange>;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.ADMIN_EMAILS = "admin@dobeu.net";
  admin = arrange();
});

function expectPaths(paths: string[]) {
  expect(vi.mocked(revalidatePath).mock.calls).toEqual(
    paths.map((path) => [path]),
  );
}

function expectNoMutation() {
  expect(
    admin.recorded.filter((entry) =>
      ["insert", "update", "delete"].includes(entry.method),
    ),
  ).toEqual([]);
  expect(revalidatePath).not.toHaveBeenCalled();
}

function expectCompanyLookup() {
  expect(admin.recorded).toContainEqual({
    table: "companies",
    method: "select",
    args: ["id,status"],
  });
  expect(admin.recorded).toContainEqual({
    table: "companies",
    method: "eq",
    args: ["id", COMPANY_ID],
  });
}

describe("createProject", () => {
  it.each([undefined, null])(
    "creates with no company (%s) without a company lookup",
    async (companyId) => {
      const result = await createProject({
        ...CREATE_INPUT,
        ...(companyId === undefined ? {} : { company_id: companyId }),
      });
      expect(result).toEqual({ ok: true, data: { id: PROJECT_ID } });
      expect(admin.recorded).toContainEqual({
        table: "projects",
        method: "insert",
        args: [
          {
            ...CREATE_INPUT,
            company_id: null,
            description: null,
            status: "proposed",
            total_cents: 0,
          },
        ],
      });
      expect(admin.recorded.some((entry) => entry.table === "companies")).toBe(
        false,
      );
      expectPaths(LIST_PATHS);
    },
  );

  it("sets an active company and revalidates its detail page", async () => {
    const result = await createProject({
      ...CREATE_INPUT,
      company_id: COMPANY_ID,
    });
    expect(result).toEqual({ ok: true, data: { id: PROJECT_ID } });
    expectCompanyLookup();
    expect(admin.recorded).toContainEqual({
      table: "projects",
      method: "insert",
      args: [expect.objectContaining({ company_id: COMPANY_ID })],
    });
    expectPaths([...LIST_PATHS, `/admin/companies/${COMPANY_ID}`]);
  });

  it.each([
    { name: "nonexistent", company: null, expected: "Company not found" },
    {
      name: "suspended",
      company: { id: COMPANY_ID, status: "suspended" },
      expected: "Company must be active",
    },
    {
      name: "read error",
      company: { id: COMPANY_ID, status: "active" },
      companyError: { message: "database unavailable" },
      expected: "Company not found",
    },
  ])(
    "rejects a company with $name before insertion",
    async ({ company, companyError, expected }) => {
      admin = arrange({ company, companyError });
      expect(
        await createProject({ ...CREATE_INPUT, company_id: COMPANY_ID }),
      ).toEqual({ ok: false, error: expected });
      expectCompanyLookup();
      expectNoMutation();
    },
  );

  it.each([
    { owner_user_id: "bad" },
    { title: "x" },
    { company_id: "not-a-uuid" },
  ])("rejects invalid input %j before admin access", async (patch) => {
    expect((await createProject({ ...CREATE_INPUT, ...patch })).ok).toBe(false);
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(admin.supabase.from).not.toHaveBeenCalled();
    expectNoMutation();
  });

  it("surfaces an insert error without revalidation", async () => {
    admin = arrange({
      insert: { data: null, error: { message: "unique violation" } },
    });
    expect(
      await createProject({ ...CREATE_INPUT, company_id: COMPANY_ID }),
    ).toEqual({ ok: false, error: "unique violation" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("reports a missing inserted row without revalidation", async () => {
    admin = arrange({ insert: { data: null } });
    expect(await createProject(CREATE_INPUT)).toEqual({
      ok: false,
      error: "insert failed",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("updateProject", () => {
  it("preserves the current company when company_id is omitted", async () => {
    expect(await updateProject({ id: PROJECT_ID, title: "Renamed" })).toEqual({
      ok: true,
      data: { id: PROJECT_ID },
    });
    expect(admin.recorded).toContainEqual({
      table: "projects",
      method: "update",
      args: [{ title: "Renamed" }],
    });
    expect(admin.recorded.some((entry) => entry.table === "companies")).toBe(
      false,
    );
    expectPaths([...UPDATE_PATHS, `/admin/companies/${OLD_COMPANY_ID}`]);
  });

  it("assigns an active company and revalidates both old and new companies", async () => {
    expect(
      await updateProject({ id: PROJECT_ID, company_id: COMPANY_ID }),
    ).toEqual({ ok: true, data: { id: PROJECT_ID } });
    expectCompanyLookup();
    expect(admin.recorded).toContainEqual({
      table: "projects",
      method: "select",
      args: ["company_id"],
    });
    expect(admin.recorded).toContainEqual({
      table: "projects",
      method: "eq",
      args: ["id", PROJECT_ID],
    });
    expect(admin.recorded).toContainEqual({
      table: "projects",
      method: "update",
      args: [{ company_id: COMPANY_ID }],
    });
    expectPaths([
      ...UPDATE_PATHS,
      `/admin/companies/${OLD_COMPANY_ID}`,
      `/admin/companies/${COMPANY_ID}`,
    ]);
  });

  it("assigns a company to a previously unassigned project", async () => {
    admin = arrange({ existingProject: { company_id: null } });
    expect(
      (await updateProject({ id: PROJECT_ID, company_id: COMPANY_ID })).ok,
    ).toBe(true);
    expectPaths([...UPDATE_PATHS, `/admin/companies/${COMPANY_ID}`]);
  });

  it("clears the company with null and revalidates the old company", async () => {
    expect(await updateProject({ id: PROJECT_ID, company_id: null })).toEqual({
      ok: true,
      data: { id: PROJECT_ID },
    });
    expect(admin.recorded).toContainEqual({
      table: "projects",
      method: "update",
      args: [{ company_id: null }],
    });
    expect(admin.recorded.some((entry) => entry.table === "companies")).toBe(
      false,
    );
    expectPaths([...UPDATE_PATHS, `/admin/companies/${OLD_COMPANY_ID}`]);
  });

  it("deduplicates company revalidation when the assignment is unchanged", async () => {
    admin = arrange({ existingProject: { company_id: COMPANY_ID } });
    expect(
      (await updateProject({ id: PROJECT_ID, company_id: COMPANY_ID })).ok,
    ).toBe(true);
    expectPaths([...UPDATE_PATHS, `/admin/companies/${COMPANY_ID}`]);
  });

  it.each([
    { name: "nonexistent", company: null, expected: "Company not found" },
    {
      name: "suspended",
      company: { id: COMPANY_ID, status: "suspended" },
      expected: "Company must be active",
    },
    {
      name: "read error",
      company: { id: COMPANY_ID, status: "active" },
      companyError: { message: "database unavailable" },
      expected: "Company not found",
    },
  ])(
    "rejects a company with $name before mutation",
    async ({ company, companyError, expected }) => {
      admin = arrange({ company, companyError });
      expect(
        await updateProject({ id: PROJECT_ID, company_id: COMPANY_ID }),
      ).toEqual({ ok: false, error: expected });
      expectCompanyLookup();
      expectNoMutation();
    },
  );

  it.each([
    { name: "missing project", existingProject: null },
    {
      name: "project read error",
      projectReadError: { message: "database unavailable" },
    },
  ])(
    "rejects $name before checking the company or mutating",
    async (options) => {
      admin = arrange(options);
      expect(
        await updateProject({ id: PROJECT_ID, company_id: COMPANY_ID }),
      ).toEqual({ ok: false, error: "Project not found" });
      expect(admin.recorded.some((entry) => entry.table === "companies")).toBe(
        false,
      );
      expectNoMutation();
    },
  );

  it("rejects a no-op before admin access", async () => {
    expect(await updateProject({ id: PROJECT_ID })).toEqual({
      ok: false,
      error: "no fields to update",
    });
    expect(createAdminClient).not.toHaveBeenCalled();
    expectNoMutation();
  });

  it.each([
    { id: "not-a-uuid", title: "Renamed" },
    { id: PROJECT_ID, status: "bogus" },
    { id: PROJECT_ID, company_id: "not-a-uuid" },
  ])("rejects invalid input %j before admin access", async (input) => {
    expect((await updateProject(input)).ok).toBe(false);
    expect(createAdminClient).not.toHaveBeenCalled();
    expect(admin.supabase.from).not.toHaveBeenCalled();
    expectNoMutation();
  });

  it("propagates update errors without revalidation", async () => {
    admin = arrange({ updateError: { message: "rls violation" } });
    expect(
      await updateProject({ id: PROJECT_ID, company_id: COMPANY_ID }),
    ).toEqual({ ok: false, error: "rls violation" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("deleteProject", () => {
  it("deletes when admin and revalidates project lists", async () => {
    expect(await deleteProject({ id: PROJECT_ID })).toEqual({
      ok: true,
      data: { id: PROJECT_ID },
    });
    expect(admin.recorded).toContainEqual({
      table: "projects",
      method: "delete",
      args: [],
    });
    expect(admin.recorded).toContainEqual({
      table: "projects",
      method: "eq",
      args: ["id", PROJECT_ID],
    });
    expectPaths(LIST_PATHS);
  });

  it("rejects an invalid id", async () => {
    expect((await deleteProject({ id: "not-uuid" })).ok).toBe(false);
    expect(createAdminClient).not.toHaveBeenCalled();
    expectNoMutation();
  });

  it("propagates delete errors without revalidation", async () => {
    admin = arrange({ deleteError: { message: "FK violation" } });
    expect(await deleteProject({ id: PROJECT_ID })).toEqual({
      ok: false,
      error: "FK violation",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe.each([
  {
    name: "createProject",
    run: () => createProject({ ...CREATE_INPUT, company_id: COMPANY_ID }),
  },
  {
    name: "updateProject",
    run: () => updateProject({ id: PROJECT_ID, company_id: COMPANY_ID }),
  },
  { name: "deleteProject", run: () => deleteProject({ id: PROJECT_ID }) },
])("$name admin guard", ({ run }) => {
  it.each([
    { name: "unauthenticated", user: null, expected: "not_authenticated" },
    {
      name: "non-admin",
      user: { id: "other", email: "stranger@example.com" },
      expected: "forbidden",
    },
    { name: "MFA required", level: "aal1" as const, expected: "mfa_required" },
  ])(
    "blocks $name without creating or querying an admin client",
    async ({ user, level, expected }) => {
      admin = arrange({ user, level });
      expect(await run()).toEqual({ ok: false, error: expected });
      expect(createAdminClient).not.toHaveBeenCalled();
      expect(admin.supabase.from).not.toHaveBeenCalled();
      expectNoMutation();
    },
  );
});
