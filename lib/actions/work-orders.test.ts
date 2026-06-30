import { describe, it, expect, beforeEach, vi } from "vitest";

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
    attachmentInsertError: null,
    updateSelectData: { id: "wo_1", title: "Logo", service_type: "logo", created_by: "user_owner" }
  };

  const adminEmails: { value: string } = { value: "admin@dobeu.net" };
  const sendEmailMock = vi.fn(() => Promise.resolve({ ok: true }));
  const cioTrackMock = vi.fn(() => Promise.resolve({ ok: true }));

  return { state, adminEmails, sendEmailMock, cioTrackMock };
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

vi.mock("@/lib/supabase/server", () => {
  function buildAuthMock() {
    return {
      getUser: vi.fn(async () => ({ data: { user: h.state.user }, error: null })),
      admin: {
        getUserById: vi.fn(async () => ({
          data: { user: { email: "owner@example.com", user_metadata: {} } },
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

  function buildFromMock() {
    return vi.fn((table: string) => ({
      insert: vi.fn(() => {
        if (table === "work_order_attachments") {
          return Promise.resolve({ data: null, error: h.state.attachmentInsertError });
        }
        return {
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve(h.state.insertResult))
          }))
        };
      }),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() =>
              Promise.resolve({
                data: h.state.updateError ? null : h.state.updateSelectData,
                error: h.state.updateError
              })
            )
          })),
          then: (resolve: (v: { data: unknown; error: unknown }) => void) =>
            resolve({ data: null, error: h.state.updateError })
        }))
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve(h.state.selectResult))
        }))
      }))
    }));
  }

  function buildClient() {
    return {
      auth: buildAuthMock(),
      storage: buildStorageMock(),
      from: buildFromMock()
    };
  }

  return {
    createClient: vi.fn(async () => buildClient()),
    createAdminClient: vi.fn(() => buildClient())
  };
});

beforeEach(() => {
  vi.clearAllMocks();
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

  it("surfaces a Supabase insert error", async () => {
    h.state.insertResult = { data: null, error: { message: "db down" } };
    const { submitWorkOrder } = await import("@/lib/actions/work-orders");
    const result = await submitWorkOrder({ service_type: "logo", title: "Logo" });
    expect(result).toEqual({ ok: false, error: "db down" });
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
