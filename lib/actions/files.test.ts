import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => {
  const state: {
    user: { id: string; email: string } | null;
    projectSelect: { data: { id: string } | null; error: { message: string } | null };
    signedUrl: { data: { path: string; token: string } | null; error: { message: string } | null };
    insertResult: { data: { id: string } | null; error: { message: string } | null };
    capturedInsert: Record<string, unknown> | null;
    signSpy: (...a: unknown[]) => void;
  } = {
    user: { id: "admin_id", email: "admin@dobeu.net" },
    projectSelect: { data: { id: "proj_1" }, error: null },
    signedUrl: { data: { path: "proj_1/abc-file.pdf", token: "tok_1" }, error: null },
    insertResult: { data: { id: "file_1" }, error: null },
    capturedInsert: null,
    signSpy: vi.fn() as unknown as (...a: unknown[]) => void
  };
  return { state };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/supabase/server", () => {
  const mockDbQuery = {
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(() => Promise.resolve(h.state.projectSelect))
  };

  const mockDbInsert = {
    select: vi.fn().mockReturnThis(),
    single: vi.fn(() => Promise.resolve(h.state.insertResult))
  };

  function buildClient() {
    return {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: h.state.user }, error: null }))
      },
      from: vi.fn(() => ({
        select: vi.fn(() => mockDbQuery),
        insert: vi.fn((row: Record<string, unknown>) => {
          h.state.capturedInsert = row;
          return mockDbInsert;
        })
      })),
      storage: {
        from: vi.fn(() => ({
          createSignedUploadUrl: vi.fn((...a: unknown[]) => {
            h.state.signSpy(...a);
            return Promise.resolve(h.state.signedUrl);
          })
        }))
      }
    };
  }
  return {
    createClient: vi.fn(async () => buildClient()),
    createAdminClient: vi.fn(() => buildClient())
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  h.state.user = { id: "admin_id", email: "admin@dobeu.net" };
  h.state.projectSelect = { data: { id: "proj_1" }, error: null };
  h.state.signedUrl = { data: { path: "proj_1/abc-file.pdf", token: "tok_1" }, error: null };
  h.state.insertResult = { data: { id: "file_1" }, error: null };
  h.state.capturedInsert = null;
  process.env.ADMIN_EMAILS = "admin@dobeu.net";
});

const projectId = "00000000-0000-0000-0000-000000000001";
const pdf = { size_bytes: 1024, mime: "application/pdf" };

describe("createDeliverableUploadUrl", () => {
  it("mints a signed url for an admin", async () => {
    const { createDeliverableUploadUrl } = await import("@/lib/actions/files");
    const result = await createDeliverableUploadUrl({ project_id: projectId, filename: "spec.pdf", ...pdf });
    expect(result).toEqual({ ok: true, data: { path: "proj_1/abc-file.pdf", token: "tok_1" } });
  });

  it("blocks non-admin callers", async () => {
    h.state.user = { id: "u", email: "stranger@example.com" };
    const { createDeliverableUploadUrl } = await import("@/lib/actions/files");
    const result = await createDeliverableUploadUrl({ project_id: projectId, filename: "spec.pdf", ...pdf });
    expect(result).toEqual({ ok: false, error: "forbidden" });
  });

  it("rejects filenames with path separators", async () => {
    const { createDeliverableUploadUrl } = await import("@/lib/actions/files");
    const result = await createDeliverableUploadUrl({
      project_id: projectId,
      filename: "../../etc/passwd",
      ...pdf
    });
    expect(result.ok).toBe(false);
  });

  it("fails when the project does not exist", async () => {
    h.state.projectSelect = { data: null, error: { message: "not found" } };
    const { createDeliverableUploadUrl } = await import("@/lib/actions/files");
    const result = await createDeliverableUploadUrl({ project_id: projectId, filename: "spec.pdf", ...pdf });
    expect(result.ok).toBe(false);
  });

  it("rejects over-cap files before minting a url", async () => {
    const { createDeliverableUploadUrl } = await import("@/lib/actions/files");
    const result = await createDeliverableUploadUrl({
      project_id: projectId,
      filename: "big.pdf",
      mime: "application/pdf",
      size_bytes: 26 * 1024 * 1024
    });
    expect(result).toEqual({
      ok: false,
      error: "File too large: 26.0 MB. Deliverables are capped at 25 MB."
    });
    expect(h.state.signSpy as unknown).not.toHaveBeenCalled();
  });

  it("accepts exactly 25MB", async () => {
    const { createDeliverableUploadUrl } = await import("@/lib/actions/files");
    const result = await createDeliverableUploadUrl({
      project_id: projectId,
      filename: "edge.pdf",
      mime: "application/pdf",
      size_bytes: 26214400
    });
    expect(result.ok).toBe(true);
    expect(h.state.signSpy as unknown).toHaveBeenCalledTimes(1);
  });

  it("rejects a disallowed MIME before minting a url", async () => {
    const { createDeliverableUploadUrl } = await import("@/lib/actions/files");
    const result = await createDeliverableUploadUrl({
      project_id: projectId,
      filename: "evil.exe",
      mime: "application/x-msdownload",
      size_bytes: 1024
    });
    expect(result.ok).toBe(false);
    expect(h.state.signSpy as unknown).not.toHaveBeenCalled();
  });

  it("requires size_bytes and mime", async () => {
    const { createDeliverableUploadUrl } = await import("@/lib/actions/files");
    const result = await createDeliverableUploadUrl({ project_id: projectId, filename: "a.pdf" });
    expect(result.ok).toBe(false);
    expect(h.state.signSpy as unknown).not.toHaveBeenCalled();
  });

  it("surfaces a storage error", async () => {
    h.state.signedUrl = { data: null, error: { message: "bucket missing" } };
    const { createDeliverableUploadUrl } = await import("@/lib/actions/files");
    const result = await createDeliverableUploadUrl({ project_id: projectId, filename: "spec.pdf", ...pdf });
    expect(result).toEqual({ ok: false, error: "bucket missing" });
  });
});

describe("recordDeliverable", () => {
  const base = {
    project_id: projectId,
    storage_path: "proj_1/abc-spec.pdf",
    filename: "spec.pdf",
    mime: "application/pdf",
    size_bytes: 1024
  };

  it("inserts a project_files row with uploaded_by = admin uuid", async () => {
    const { recordDeliverable } = await import("@/lib/actions/files");
    const result = await recordDeliverable(base);
    expect(result).toEqual({ ok: true, data: { id: "file_1" } });
    expect(h.state.capturedInsert).toMatchObject({
      project_id: projectId,
      storage_path: "proj_1/abc-spec.pdf",
      filename: "spec.pdf",
      mime: "application/pdf",
      size_bytes: 1024,
      uploaded_by: "admin_id"
    });
  });

  it("blocks non-admin", async () => {
    h.state.user = { id: "u", email: "x@x.com" };
    const { recordDeliverable } = await import("@/lib/actions/files");
    const result = await recordDeliverable(base);
    expect(result).toEqual({ ok: false, error: "forbidden" });
  });

  it("rejects a disallowed MIME type", async () => {
    const { recordDeliverable } = await import("@/lib/actions/files");
    const result = await recordDeliverable({ ...base, mime: "application/x-msdownload" });
    expect(result.ok).toBe(false);
  });

  it("rejects files over 25MB", async () => {
    const { recordDeliverable } = await import("@/lib/actions/files");
    const result = await recordDeliverable({ ...base, size_bytes: 26 * 1024 * 1024 });
    expect(result.ok).toBe(false);
  });

  it("surfaces a Supabase insert error", async () => {
    h.state.insertResult = { data: null, error: { message: "fk violation" } };
    const { recordDeliverable } = await import("@/lib/actions/files");
    const result = await recordDeliverable(base);
    expect(result).toEqual({ ok: false, error: "fk violation" });
  });
});
