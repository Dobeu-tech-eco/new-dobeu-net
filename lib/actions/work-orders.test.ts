import { describe, it, expect, beforeEach, vi } from "vitest";
import type { SendEmailResult } from "@/lib/resend";

// Hoisted shared mock state so the vi.mock factories below can read it.
const h = vi.hoisted(() => {
  const state: {
    user: { id: string; email: string } | null;
    insertResult: { data: { id: string } | null; error: { message: string } | null };
    selectResult: {
      data:
        | {
            id: string;
            created_by: string;
            status: string;
            project_id?: string | null;
            quoted_amount_cents?: number | null;
            title?: string | null;
          }
        | null;
      error: { message: string } | null;
    };
    updateError: { message: string } | null;
    updateMatchesNoRows: boolean;
    attachmentInsertError: { message: string } | null;
    updateSelectData: {
      id: string;
      title?: string;
      service_type?: string;
      created_by?: string;
    } | null;
  } = {
    user: { id: "user_owner", email: "owner@example.com" },
    insertResult: { data: { id: "wo_1" }, error: null },
    selectResult: {
      data: {
        id: "wo_1",
        created_by: "user_owner",
        status: "quoted",
        project_id: "proj_1",
        quoted_amount_cents: 50000,
        title: "Logo"
      },
      error: null
    },
    updateError: null,
    updateMatchesNoRows: false,
    attachmentInsertError: null,
    updateSelectData: { id: "wo_1", title: "Logo", service_type: "logo", created_by: "user_owner" }
  };

  const adminEmails: { value: string } = { value: "admin@dobeu.net" };
  const sendEmailMock = vi.fn<() => Promise<SendEmailResult>>(() => Promise.resolve({ ok: true }));
  const cioTrackMock = vi.fn(() => Promise.resolve({ ok: true }));

  const recordings: { table: string; method: string; args: unknown[] }[][] = [];
  return {
    state, adminEmails, sendEmailMock, cioTrackMock,
    recordings,
    get recorded() { return recordings.flat(); },
    level: "aal2",
    client: { email: "owner@example.com" } as { email: string } | null,
    company: { id: "company_1", status: "active" } as { id: string; status: string } | null,
    membership: { id: "member_1" } as { id: string } | null,
    project: { owner_user_id: "00000000-0000-0000-0000-000000000002", company_id: null } as { owner_user_id: string; company_id: string | null } | null,
    auditError: null as { message: string; code: string } | null,
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/resend", () => ({
  sendEmail: h.sendEmailMock,
  isResendConfigured: () => true
}));

vi.mock("@/lib/customerio", () => ({
  cioTrack: h.cioTrackMock,
  isCustomerIoConfigured: () => true
}));

vi.mock("@/lib/supabase/server", async () => {
  const { buildStubClient } = await import("./__test-helpers");
  function buildAuthMock() {
    return {
      mfa: { getAuthenticatorAssuranceLevel: vi.fn(async () => ({ data: { currentLevel: h.level, nextLevel: "aal2" }, error: null })) },
      getUser: vi.fn(async () => ({ data: { user: h.state.user }, error: null })),
      admin: {
        getUserById: vi.fn(async () => ({
          data: { user: h.client },
          error: null
        }))
      }
    };
  }

  function buildStorageMock() {
    return {
      from: vi.fn(() => ({
        createSignedUploadUrl: vi.fn(async (path: string) => ({
          data: { path, token: "signed-token", signedUrl: `https://storage.test/${path}` },
          error: null
        }))
      }))
    };
  }

  function buildClient() {
    const stub = buildStubClient({
      tables: {
        work_orders: {
          insert: h.state.insertResult,
          selectSingle: h.state.selectResult,
          update: { error: h.state.updateError },
        },
        work_order_attachments: { insert: { error: h.state.attachmentInsertError } },
        companies: { selectSingle: { data: h.company } },
        company_members: { selectSingle: { data: h.membership } },
        projects: { selectSingle: { data: h.project } },
        admin_audit_log: { insert: { error: h.auditError } },
      },
    });
    const from = stub.supabase.from.getMockImplementation()!;
    stub.supabase.from.mockImplementation((table: string) => {
      const api = from(table);
      if (table === "work_orders") {
        const update = api.update;
        api.update = vi.fn((...args: unknown[]) => {
          const chain = update(...args);
          // buildStubClient's update terminal omits data; these actions RETURNING rows.
          chain.single = vi.fn(async () => ({
            data: h.state.updateError ? null : h.state.updateSelectData,
            error: h.state.updateError,
          }));
          // Conditional writes use maybeSingle: zero matched rows => null data, no error.
          chain.maybeSingle = vi.fn(async () => {
            if (h.state.updateError) return { data: null, error: h.state.updateError };
            if (h.state.updateMatchesNoRows) return { data: null, error: null };
            return { data: h.state.updateSelectData, error: null };
          });
          return chain;
        });
      }
      return api;
    });
    h.recordings.push(stub.recorded);
    return {
      ...stub.supabase,
      auth: buildAuthMock(),
      storage: buildStorageMock(),
    };
  }

  return {
    createClient: vi.fn(async () => buildClient()),
    createAdminClient: vi.fn(() => buildClient())
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  h.recordings.length = 0;
  h.level = "aal2";
  h.client = { email: "owner@example.com" };
  h.company = { id: "company_1", status: "active" };
  h.membership = { id: "member_1" };
  h.project = { owner_user_id: "00000000-0000-0000-0000-000000000002", company_id: null };
  h.auditError = null;
  h.sendEmailMock.mockResolvedValue({ ok: true });
  h.state.user = { id: "user_owner", email: "owner@example.com" };
  h.state.insertResult = { data: { id: "wo_1" }, error: null };
  h.state.selectResult = {
    data: {
      id: "wo_1",
      created_by: "user_owner",
      status: "quoted",
      project_id: "proj_1",
      quoted_amount_cents: 50000,
      title: "Logo"
    },
    error: null
  };
  h.state.updateError = null;
  h.state.updateMatchesNoRows = false;
  h.state.attachmentInsertError = null;
  h.state.updateSelectData = {
    id: "wo_1",
    title: "Logo",
    service_type: "logo",
    created_by: "user_owner"
  };
  h.sendEmailMock.mockClear();
  h.cioTrackMock.mockClear();
  process.env.ADMIN_EMAILS = h.adminEmails.value;
});

describe("submitWorkOrder", () => {
  it("inserts a valid work order and returns the new id", async () => {
    const { submitWorkOrder } = await import("@/lib/actions/work-orders");
    const result = await submitWorkOrder({
      service_type: "logo",
      title: "Need a new logo",
      description: "Something modern"
    });
    expect(result).toEqual({ ok: true, data: { id: "wo_1", uploadPaths: [], uploadTargets: [] } });
  });

  it("fires an admin notification email on submit (non-fatal)", async () => {
    const { submitWorkOrder } = await import("@/lib/actions/work-orders");
    await submitWorkOrder({
      service_type: "logo",
      title: "Need a new logo",
      description: "Something modern"
    });
    expect(h.sendEmailMock).toHaveBeenCalledTimes(1);
    expect(h.sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringMatching(/New ticket/) })
    );
  });

  it("rejects when not authenticated", async () => {
    h.state.user = null;
    const { submitWorkOrder } = await import("@/lib/actions/work-orders");
    const result = await submitWorkOrder({
      service_type: "other",
      title: "Hello",
      description: null
    });
    expect(result).toEqual({ ok: false, error: "not_authenticated" });
  });

  it("rejects invalid service_type via Zod", async () => {
    const { submitWorkOrder } = await import("@/lib/actions/work-orders");
    const result = await submitWorkOrder({ service_type: "spaceship", title: "x" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.length).toBeGreaterThan(0);
  });

  it("rejects title shorter than 2 chars", async () => {
    const { submitWorkOrder } = await import("@/lib/actions/work-orders");
    const result = await submitWorkOrder({ service_type: "logo", title: "x" });
    expect(result.ok).toBe(false);
  });

  it("rejects attachments above 25 MB", async () => {
    const { submitWorkOrder } = await import("@/lib/actions/work-orders");
    const result = await submitWorkOrder({
      service_type: "logo",
      title: "Logo",
      attachments: [
        { filename: "huge.png", mime_type: "image/png", size_bytes: 30 * 1024 * 1024 }
      ]
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/25 MB/);
  });

  it("rejects executable MIME types", async () => {
    const { submitWorkOrder } = await import("@/lib/actions/work-orders");
    const result = await submitWorkOrder({
      service_type: "logo",
      title: "Logo",
      attachments: [
        { filename: "evil.exe", mime_type: "application/x-msdownload", size_bytes: 1000 }
      ]
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not allowed/);
  });

  it("mints signed upload targets for allowed attachments", async () => {
    const { submitWorkOrder } = await import("@/lib/actions/work-orders");
    const result = await submitWorkOrder({
      service_type: "logo",
      title: "Logo with brief",
      attachments: [{ filename: "brief.pdf", mime_type: "application/pdf", size_bytes: 1024 }]
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.uploadPaths).toHaveLength(1);
      expect(result.data.uploadPaths[0]).toMatch(/^wo_1\/.+brief\.pdf$/);
      expect(result.data.uploadTargets).toHaveLength(1);
      expect(result.data.uploadTargets[0]).toMatchObject({
        filename: "brief.pdf",
        mime_type: "application/pdf",
        size_bytes: 1024,
        token: "signed-token"
      });
      expect(result.data.uploadTargets[0].storage_path).toMatch(/^wo_1\/.+brief\.pdf$/);
    }
  });

  it("emits a non-fatal work_order_created event", async () => {
    const { submitWorkOrder } = await import("@/lib/actions/work-orders");
    await submitWorkOrder({ service_type: "logo", title: "Need a new logo" });
    expect(h.cioTrackMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "work_order_created" })
    );
  });

  it("returns a fixed code on a Supabase insert error, never the raw message", async () => {
    h.state.insertResult = { data: null, error: { message: "db down" } };
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { submitWorkOrder } = await import("@/lib/actions/work-orders");
    const result = await submitWorkOrder({ service_type: "logo", title: "Logo" });
    expect(result).toEqual({ ok: false, error: "submit failed" });
    expect(JSON.stringify(errSpy.mock.calls)).not.toContain("db down");
    errSpy.mockRestore();
  });
});

describe("quoteWorkOrder (admin)", () => {
  it("requires admin gating", async () => {
    h.state.user = { id: "user_owner", email: "notadmin@example.com" };
    const { quoteWorkOrder } = await import("@/lib/actions/work-orders");
    const result = await quoteWorkOrder({
      id: "00000000-0000-0000-0000-000000000001",
      amount_cents: 50000
    });
    expect(result).toEqual({ ok: false, error: "forbidden" });
  });

  it("rejects non-uuid id", async () => {
    h.state.user = { id: "admin_id", email: "admin@dobeu.net" };
    const { quoteWorkOrder } = await import("@/lib/actions/work-orders");
    const result = await quoteWorkOrder({ id: "not-a-uuid", amount_cents: 1000 });
    expect(result.ok).toBe(false);
  });

  it("rejects non-positive amount", async () => {
    h.state.user = { id: "admin_id", email: "admin@dobeu.net" };
    const { quoteWorkOrder } = await import("@/lib/actions/work-orders");
    const result = await quoteWorkOrder({
      id: "00000000-0000-0000-0000-000000000001",
      amount_cents: 0
    });
    expect(result.ok).toBe(false);
  });

  it("succeeds when admin + valid input + emails the client", async () => {
    h.state.user = { id: "admin_id", email: "admin@dobeu.net" };
    // Pre-read status must be `open` for the open→quoted transition to be legal.
    h.state.selectResult = {
      data: { id: "wo_1", created_by: "user_owner", status: "open", title: "Logo" },
      error: null
    };
    const { quoteWorkOrder } = await import("@/lib/actions/work-orders");
    const result = await quoteWorkOrder({
      id: "00000000-0000-0000-0000-000000000001",
      amount_cents: 50000
    });
    expect(result.ok).toBe(true);
    expect(h.sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringMatching(/Quote ready/) })
    );
  });

  it("rejects quoting a non-open (e.g. closed) work order", async () => {
    h.state.user = { id: "admin_id", email: "admin@dobeu.net" };
    h.state.selectResult = {
      data: { id: "wo_1", created_by: "user_owner", status: "closed", title: "Logo" },
      error: null
    };
    const { quoteWorkOrder } = await import("@/lib/actions/work-orders");
    const result = await quoteWorkOrder({
      id: "00000000-0000-0000-0000-000000000001",
      amount_cents: 50000
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/cannot quote/);
  });
});

describe("acceptWorkOrderQuote (client)", () => {
  it("blocks accepting another user's work order", async () => {
    h.state.user = { id: "different_user", email: "other@example.com" };
    h.state.selectResult = {
      data: {
        id: "wo_1",
        created_by: "user_owner",
        status: "quoted",
        project_id: "proj_1",
        quoted_amount_cents: 50000,
        title: "Logo"
      },
      error: null
    };
    const { acceptWorkOrderQuote } = await import("@/lib/actions/work-orders");
    const result = await acceptWorkOrderQuote({ id: "00000000-0000-0000-0000-000000000001" });
    expect(result).toEqual({ ok: false, error: "forbidden" });
  });

  it("blocks acceptance when status is not 'quoted'", async () => {
    h.state.selectResult = {
      data: {
        id: "wo_1",
        created_by: "user_owner",
        status: "open",
        project_id: "proj_1",
        quoted_amount_cents: 50000,
        title: "Logo"
      },
      error: null
    };
    const { acceptWorkOrderQuote } = await import("@/lib/actions/work-orders");
    const result = await acceptWorkOrderQuote({ id: "00000000-0000-0000-0000-000000000001" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/open/);
  });

  it("accepts when owner + status='quoted' (no auto-invoice; invoice_id stays null)", async () => {
    const { acceptWorkOrderQuote } = await import("@/lib/actions/work-orders");
    const result = await acceptWorkOrderQuote({ id: "00000000-0000-0000-0000-000000000001" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Locked model: accept only flips to `accepted`; the ADMIN creates the
      // invoice later via createInvoiceForWorkOrder.
      expect(result.data.invoice_id).toBeNull();
    }
    // Admin gets the "quote accepted" cue email.
    expect(h.sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringMatching(/accepted/i) })
    );
  });

  it("rejects accept when work order has no quote amount", async () => {
    h.state.selectResult = {
      data: {
        id: "wo_1",
        created_by: "user_owner",
        status: "quoted",
        project_id: "proj_1",
        quoted_amount_cents: 0,
        title: "Logo"
      },
      error: null
    };
    const { acceptWorkOrderQuote } = await import("@/lib/actions/work-orders");
    const result = await acceptWorkOrderQuote({ id: "00000000-0000-0000-0000-000000000001" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/quote amount/);
  });

  it("returns not_authenticated when no user", async () => {
    h.state.user = null;
    const { acceptWorkOrderQuote } = await import("@/lib/actions/work-orders");
    const result = await acceptWorkOrderQuote({ id: "00000000-0000-0000-0000-000000000001" });
    expect(result).toEqual({ ok: false, error: "not_authenticated" });
  });
});

describe("updateWorkOrderStatus (admin)", () => {
  it("requires admin gating", async () => {
    h.state.user = { id: "u", email: "bob@example.com" };
    const { updateWorkOrderStatus } = await import("@/lib/actions/work-orders");
    const result = await updateWorkOrderStatus({
      id: "00000000-0000-0000-0000-000000000001",
      status: "delivered"
    });
    expect(result).toEqual({ ok: false, error: "forbidden" });
  });

  it("rejects status outside the allowed transitions", async () => {
    h.state.user = { id: "admin_id", email: "admin@dobeu.net" };
    const { updateWorkOrderStatus } = await import("@/lib/actions/work-orders");
    const result = await updateWorkOrderStatus({
      id: "00000000-0000-0000-0000-000000000001",
      status: "quoted"
    });
    expect(result.ok).toBe(false);
  });

  it("updates status for an admin caller + emails the owner", async () => {
    h.state.user = { id: "admin_id", email: "admin@dobeu.net" };
    // Pre-read status must be `accepted` for accepted→in_progress to be legal.
    h.state.selectResult = {
      data: { id: "wo_1", created_by: "user_owner", status: "accepted", title: "Logo" },
      error: null
    };
    const { updateWorkOrderStatus } = await import("@/lib/actions/work-orders");
    const result = await updateWorkOrderStatus({
      id: "00000000-0000-0000-0000-000000000001",
      status: "in_progress"
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.status).toBe("in_progress");
    expect(h.sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringMatching(/Update:/) })
    );
  });

  it("rejects an illegal transition (delivered → in_progress)", async () => {
    h.state.user = { id: "admin_id", email: "admin@dobeu.net" };
    h.state.selectResult = {
      data: { id: "wo_1", created_by: "user_owner", status: "delivered", title: "Logo" },
      error: null
    };
    const { updateWorkOrderStatus } = await import("@/lib/actions/work-orders");
    const result = await updateWorkOrderStatus({
      id: "00000000-0000-0000-0000-000000000001",
      status: "in_progress"
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/illegal transition/);
  });
});

const CLIENT_ID = "00000000-0000-0000-0000-000000000002";
const COMPANY_ID = "00000000-0000-0000-0000-000000000003";
const PROJECT_ID = "00000000-0000-0000-0000-000000000004";
const CREATE_INPUT = { client_user_id: CLIENT_ID, service_type: "logo", title: "Client logo" };

function writes(table: string, method = "insert") {
  return h.recorded.filter((entry) => entry.table === table && entry.method === method).map((entry) => entry.args[0]);
}

describe("createWorkOrderForClient", () => {
  beforeEach(() => {
    h.state.user = { id: "admin_id", email: "admin@dobeu.net" };
  });

  it("posts an open ticket for the client, audits only ids/statuses, and revalidates all three pages", async () => {
    const { createWorkOrderForClient } = await import("./work-orders");
    const { revalidatePath } = await import("next/cache");
    const result = await createWorkOrderForClient({ ...CREATE_INPUT, description: "Private notes", priority: "high" });
    expect(result).toEqual({ ok: true, data: { id: "wo_1", status: "open" } });
    expect(writes("work_orders")).toEqual([{
      created_by: CLIENT_ID, company_id: null, project_id: null,
      service_type: "logo", title: "Client logo", description: "Private notes", priority: "high", status: "open",
    }]);
    expect(writes("admin_audit_log")).toEqual([{
      actor_user_id: "admin_id", action: "work_order.create_for_client", target_type: "work_order", target_id: "wo_1",
      data: { client_user_id: CLIENT_ID, company_id: null, project_id: null, status: "open" },
    }]);
    expect(h.sendEmailMock).not.toHaveBeenCalled();
    expect(vi.mocked(revalidatePath).mock.calls).toEqual([["/admin/tickets"], ["/portal/tickets"], ["/admin"]]);
  });

  it("posts a quoted ticket with a guarded transition, email and both audits", async () => {
    const { createWorkOrderForClient } = await import("./work-orders");
    const result = await createWorkOrderForClient({ ...CREATE_INPUT, company_id: COMPANY_ID, project_id: PROJECT_ID, quoted_amount_cents: 12345 });
    expect(result).toEqual({ ok: true, data: { id: "wo_1", status: "quoted" } });
    expect(writes("work_orders", "update")).toEqual([{
      status: "quoted", quoted_amount_cents: 12345, quoted_at: expect.any(String),
    }]);
    expect(h.recorded).toContainEqual({ table: "work_orders", method: "eq", args: ["status", "open"] });
    for (const args of [["company_id", COMPANY_ID], ["user_id", CLIENT_ID], ["status", "active"]]) {
      expect(h.recorded).toContainEqual({ table: "company_members", method: "eq", args });
    }
    expect(writes("admin_audit_log")).toEqual([
      expect.objectContaining({ action: "work_order.create_for_client" }),
      expect.objectContaining({ action: "work_order.quote", data: { previous_status: "open", status: "quoted", amount_cents: 12345 } }),
    ]);
    expect(h.sendEmailMock).toHaveBeenCalledWith(expect.objectContaining({ to: "owner@example.com", subject: expect.stringMatching(/Quote ready/) }));
  });

  it("allows a project owned by another member of the selected company", async () => {
    h.project = { owner_user_id: "another-client", company_id: COMPANY_ID };
    const { createWorkOrderForClient } = await import("./work-orders");
    expect((await createWorkOrderForClient({ ...CREATE_INPUT, company_id: COMPANY_ID, project_id: PROJECT_ID })).ok).toBe(true);
  });

  it.each([
    ["not_authenticated", null, "aal2"],
    ["forbidden", { id: "client", email: "client@example.com" }, "aal2"],
    ["mfa_required", { id: "admin_id", email: "admin@dobeu.net" }, "aal1"],
  ] as const)("propagates %s without writes", async (error, user, level) => {
    h.state.user = user;
    h.level = level;
    const { createWorkOrderForClient } = await import("./work-orders");
    expect(await createWorkOrderForClient(CREATE_INPUT)).toEqual({ ok: false, error });
    expect(h.recorded).toEqual([]);
    expect(h.sendEmailMock).not.toHaveBeenCalled();
  });

  it.each(["client", "company", "inactive company", "membership", "project", "foreign project"])("rejects invalid %s before inserting or auditing", async (invalid) => {
    if (invalid === "client") h.client = null;
    if (invalid === "company") h.company = null;
    if (invalid === "inactive company") h.company = { id: COMPANY_ID, status: "suspended" };
    if (invalid === "membership") h.membership = null;
    if (invalid === "project") h.project = null;
    if (invalid === "foreign project") h.project = { owner_user_id: "someone-else", company_id: "another-company" };
    const { createWorkOrderForClient } = await import("./work-orders");
    const result = await createWorkOrderForClient({ ...CREATE_INPUT, company_id: COMPANY_ID, project_id: PROJECT_ID });
    expect(result.ok).toBe(false);
    expect(writes("work_orders")).toEqual([]);
    expect(writes("admin_audit_log")).toEqual([]);
  });

  it("rejects a company project without selecting its company", async () => {
    h.project = { owner_user_id: "another-client", company_id: COMPANY_ID };
    const { createWorkOrderForClient } = await import("./work-orders");
    expect((await createWorkOrderForClient({ ...CREATE_INPUT, project_id: PROJECT_ID })).ok).toBe(false);
    expect(writes("work_orders")).toEqual([]);
  });

  it.each([
    { client_user_id: "invalid" }, { company_id: "invalid" }, { project_id: "invalid" },
    { title: "x" }, { title: "x".repeat(161) }, { description: "x".repeat(8001) },
    { service_type: "invalid" }, { priority: "urgent" },
    { quoted_amount_cents: 0 }, { quoted_amount_cents: -1 }, { quoted_amount_cents: 1.5 },
  ])("validates the input: %o", async (patch) => {
    const { createWorkOrderForClient } = await import("./work-orders");
    expect((await createWorkOrderForClient({ ...CREATE_INPUT, ...patch })).ok).toBe(false);
    expect(h.recorded).toEqual([]);
  });

  it("treats email delivery failure as non-fatal", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    h.sendEmailMock.mockRejectedValueOnce(new Error("email unavailable"));
    const { createWorkOrderForClient } = await import("./work-orders");
    expect(await createWorkOrderForClient({ ...CREATE_INPUT, quoted_amount_cents: 1000 })).toEqual({ ok: true, data: { id: "wo_1", status: "quoted" } });
    expect(writes("admin_audit_log")).toHaveLength(2);
    expect(warn).toHaveBeenCalledWith(
      "[createWorkOrderForClient] client email failed (non-fatal):",
      { kind: "Error" },
    );
    warn.mockRestore();
  });

  it.each([
    { ok: false },
    { ok: false, error: "private provider details" },
  ])("warns safely when email delivery returns %o without throwing", async (emailResult) => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    h.sendEmailMock.mockResolvedValueOnce(emailResult);
    const { createWorkOrderForClient } = await import("./work-orders");
    expect(await createWorkOrderForClient({ ...CREATE_INPUT, quoted_amount_cents: 1000 })).toEqual({ ok: true, data: { id: "wo_1", status: "quoted" } });
    expect(writes("admin_audit_log")).toHaveLength(2);
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      "[createWorkOrderForClient] client email failed (non-fatal):",
      { kind: "UnknownError" },
    );
    warn.mockRestore();
  });

  it("treats audit failure as non-fatal", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    h.auditError = { message: "audit unavailable", code: "XX000" };
    const { createWorkOrderForClient } = await import("./work-orders");
    expect(await createWorkOrderForClient({ ...CREATE_INPUT, quoted_amount_cents: 1000 })).toEqual({ ok: true, data: { id: "wo_1", status: "quoted" } });
    expect(warn).toHaveBeenCalledWith("[createWorkOrderForClient] audit log insert failed (non-fatal):", "XX000");
    warn.mockRestore();
  });

  it("does not audit or email a failed insert", async () => {
    h.state.insertResult = { data: null, error: { message: "insert failed" } };
    const { createWorkOrderForClient } = await import("./work-orders");
    expect(await createWorkOrderForClient(CREATE_INPUT)).toEqual({ ok: false, error: "insert failed" });
    expect(writes("admin_audit_log")).toEqual([]);
    expect(h.sendEmailMock).not.toHaveBeenCalled();
  });

  it.each(["database error", "zero rows"])("reports a saved open ticket when quoting returns %s", async (failure) => {
    if (failure === "database error") h.state.updateError = { message: "conflict" };
    else h.state.updateSelectData = null;
    const { createWorkOrderForClient } = await import("./work-orders");
    const { revalidatePath } = await import("next/cache");
    const result = await createWorkOrderForClient({ ...CREATE_INPUT, quoted_amount_cents: 1000 });
    expect(result).toEqual({ ok: true, data: { id: "wo_1", status: "open", quoteFailed: true } });
    expect(writes("work_orders")).toHaveLength(1);
    expect(writes("admin_audit_log")).toEqual([expect.objectContaining({ action: "work_order.create_for_client" })]);
    expect(h.sendEmailMock).not.toHaveBeenCalled();
    expect(vi.mocked(revalidatePath).mock.calls).toEqual([["/admin/tickets"], ["/portal/tickets"], ["/admin"]]);
  });
});

describe("existing work-order transition audit rows", () => {
  beforeEach(() => {
    h.state.user = { id: "admin_id", email: "admin@dobeu.net" };
  });

  it("audits a successful quote", async () => {
    h.state.selectResult.data!.status = "open";
    const { quoteWorkOrder } = await import("./work-orders");
    await quoteWorkOrder({ id: CLIENT_ID, amount_cents: 5000 });
    expect(writes("admin_audit_log")).toEqual([{
      actor_user_id: "admin_id", action: "work_order.quote", target_type: "work_order", target_id: "wo_1",
      data: { previous_status: "open", status: "quoted", amount_cents: 5000 },
    }]);
  });

  it("audits a successful status change", async () => {
    h.state.selectResult.data!.status = "accepted";
    const { updateWorkOrderStatus } = await import("./work-orders");
    await updateWorkOrderStatus({ id: CLIENT_ID, status: "in_progress" });
    expect(writes("admin_audit_log")).toEqual([{
      actor_user_id: "admin_id", action: "work_order.status", target_type: "work_order", target_id: CLIENT_ID,
      data: { previous_status: "accepted", status: "in_progress" },
    }]);
  });

  it.each(["quote", "status"])("does not audit a rejected %s transition", async (action) => {
    h.state.selectResult.data!.status = "closed";
    const { quoteWorkOrder, updateWorkOrderStatus } = await import("./work-orders");
    if (action === "quote") await quoteWorkOrder({ id: CLIENT_ID, amount_cents: 5000 });
    else await updateWorkOrderStatus({ id: CLIENT_ID, status: "in_progress" });
    expect(writes("admin_audit_log")).toEqual([]);
  });
});

describe("conditional status writes (optimistic concurrency)", () => {
  const ID = "00000000-0000-0000-0000-000000000001";
  const cases = () => [
    { name: "quote", read: "open", run: async () => (await import("./work-orders")).quoteWorkOrder({ id: ID, amount_cents: 5000 }) },
    { name: "status", read: "accepted", run: async () => (await import("./work-orders")).updateWorkOrderStatus({ id: ID, status: "in_progress" }) },
    { name: "accept", read: "quoted", run: async () => (await import("./work-orders")).acceptWorkOrderQuote({ id: ID }) },
  ];

  beforeEach(() => {
    h.state.user = { id: "admin_id", email: "admin@dobeu.net" };
  });

  function setup(name: string, read: string) {
    if (name === "accept") h.state.user = { id: "user_owner", email: "owner@example.com" };
    h.state.selectResult.data!.status = read;
  }

  it.each(cases())("$name update is conditional on the read status", async ({ name, read, run }) => {
    setup(name, read);
    const result = await run();
    expect(result.ok).toBe(true);
    // The status filter must sit on the UPDATE chain, not the earlier read.
    const calls = h.recorded.filter((c) => c.table === "work_orders");
    const updateAt = calls.findIndex((c) => c.method === "update");
    expect(updateAt).toBeGreaterThanOrEqual(0);
    expect(calls.slice(updateAt)).toContainEqual({ table: "work_orders", method: "eq", args: ["status", read] });
    expect(calls.slice(0, updateAt)).not.toContainEqual({ table: "work_orders", method: "eq", args: ["status", read] });
  });

  it.each(cases())("$name returns status_conflict with no audit/email when zero rows match", async ({ name, read, run }) => {
    setup(name, read);
    h.state.updateMatchesNoRows = true;
    const { revalidatePath } = await import("next/cache");
    expect(await run()).toEqual({ ok: false, error: "status_conflict" });
    expect(h.sendEmailMock).not.toHaveBeenCalled();
    expect(writes("admin_audit_log")).toEqual([]);
    expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled();
  });

  it.each(cases().filter((c) => c.name !== "accept"))("$name surfaces a DB error on update without auditing", async ({ name, read, run }) => {
    setup(name, read);
    h.state.updateError = { message: "db down" };
    const { revalidatePath } = await import("next/cache");
    expect(await run()).toEqual({ ok: false, error: "db down" });
    expect(h.sendEmailMock).not.toHaveBeenCalled();
    expect(writes("admin_audit_log")).toEqual([]);
    expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled();
  });

  it("accept surfaces a DB error on update without emailing or revalidating", async () => {
    setup("accept", "quoted");
    h.state.updateError = { message: "db down" };
    const { revalidatePath } = await import("next/cache");
    const { acceptWorkOrderQuote } = await import("./work-orders");
    expect(await acceptWorkOrderQuote({ id: ID })).toEqual({ ok: false, error: "db down" });
    expect(h.sendEmailMock).not.toHaveBeenCalled();
    expect(vi.mocked(revalidatePath)).not.toHaveBeenCalled();
  });
});
