import { describe, it, expect, beforeEach, vi } from "vitest";

// Hoisted shared mock state so the vi.mock factories below can read it.
const h = vi.hoisted(() => {
  const state: {
    user: { id: string; email: string } | null;
    insertResult: { data: { id: string } | null; error: { message: string } | null };
    selectResult: {
      data: { id: string; created_by: string; status: string } | null;
      error: { message: string } | null;
    };
    updateError: { message: string } | null;
    attachmentInsertError: { message: string } | null;
  } = {
    user: { id: "user_owner", email: "owner@example.com" },
    insertResult: { data: { id: "wo_1" }, error: null },
    selectResult: { data: { id: "wo_1", created_by: "user_owner", status: "quoted" }, error: null },
    updateError: null,
    attachmentInsertError: null
  };

  const adminEmails: { value: string } = { value: "admin@dobeu.net" };

  return { state, adminEmails };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/supabase/server", () => {
  function buildClient() {
    return {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: h.state.user }, error: null }))
      },
      from: vi.fn((table: string) => ({
        insert: vi.fn(() => {
          if (table === "work_order_attachments") {
            return Promise.resolve({ data: null, error: h.state.attachmentInsertError });
          }
          // work_orders insert returns chainable .select().single()
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
                  data: h.state.updateError ? null : { id: "wo_1" },
                  error: h.state.updateError
                })
              )
            })),
            // bare update().eq() awaits directly
            then: (resolve: (v: { data: unknown; error: unknown }) => void) =>
              resolve({ data: null, error: h.state.updateError })
          }))
        })),
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve(h.state.selectResult))
          }))
        }))
      }))
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
  h.state.selectResult = { data: { id: "wo_1", created_by: "user_owner", status: "quoted" }, error: null };
  h.state.updateError = null;
  h.state.attachmentInsertError = null;
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
    expect(result).toEqual({ ok: true, data: { id: "wo_1", uploadPaths: [] } });
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

  it("records signed upload paths for allowed attachments", async () => {
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
    }
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

  it("succeeds when admin + valid input", async () => {
    h.state.user = { id: "admin_id", email: "admin@dobeu.net" };
    const { quoteWorkOrder } = await import("@/lib/actions/work-orders");
    const result = await quoteWorkOrder({
      id: "00000000-0000-0000-0000-000000000001",
      amount_cents: 50000
    });
    expect(result.ok).toBe(true);
  });
});

describe("acceptWorkOrderQuote (client)", () => {
  it("blocks accepting another user's work order", async () => {
    h.state.user = { id: "different_user", email: "other@example.com" };
    h.state.selectResult = {
      data: { id: "wo_1", created_by: "user_owner", status: "quoted" },
      error: null
    };
    const { acceptWorkOrderQuote } = await import("@/lib/actions/work-orders");
    const result = await acceptWorkOrderQuote({ id: "00000000-0000-0000-0000-000000000001" });
    expect(result).toEqual({ ok: false, error: "forbidden" });
  });

  it("blocks acceptance when status is not 'quoted'", async () => {
    h.state.selectResult = {
      data: { id: "wo_1", created_by: "user_owner", status: "open" },
      error: null
    };
    const { acceptWorkOrderQuote } = await import("@/lib/actions/work-orders");
    const result = await acceptWorkOrderQuote({ id: "00000000-0000-0000-0000-000000000001" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/open/);
  });

  it("accepts when owner + status='quoted'", async () => {
    h.state.selectResult = {
      data: { id: "wo_1", created_by: "user_owner", status: "quoted" },
      error: null
    };
    const { acceptWorkOrderQuote } = await import("@/lib/actions/work-orders");
    const result = await acceptWorkOrderQuote({ id: "00000000-0000-0000-0000-000000000001" });
    expect(result.ok).toBe(true);
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

  it("updates status for an admin caller", async () => {
    h.state.user = { id: "admin_id", email: "admin@dobeu.net" };
    const { updateWorkOrderStatus } = await import("@/lib/actions/work-orders");
    const result = await updateWorkOrderStatus({
      id: "00000000-0000-0000-0000-000000000001",
      status: "in_progress"
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.status).toBe("in_progress");
  });
});
