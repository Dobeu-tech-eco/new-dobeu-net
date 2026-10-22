import { describe, it, expect, beforeEach, vi } from "vitest";

const h = vi.hoisted(() => {
  const state: {
    user: { id: string; email: string } | null;
    projectSelect: { data: { id: string } | null; error: { message: string } | null };
    signedUrl: { data: { path: string; token: string } | null; error: { message: string } | null };
    insertResult: { data: { id: string } | null; error: { message: string } | null };
    capturedInsert: Record<string, unknown> | null;
    refs: { data: unknown[] | null; error: { message: string } | null };
    aal: { currentLevel: string; nextLevel: string } | null;
    info: { data: Record<string, unknown> | null; error: { message: string } | null };
    removeSpy: (...a: unknown[]) => void;
    signSpy: (...a: unknown[]) => void;
  } = {
    user: { id: "admin_id", email: "admin@dobeu.net" },
    projectSelect: { data: { id: "proj_1" }, error: null },
    signedUrl: { data: { path: "proj_1/abc-file.pdf", token: "tok_1" }, error: null },
    insertResult: { data: { id: "file_1" }, error: null },
    capturedInsert: null,
    refs: { data: [], error: null },
    aal: { currentLevel: "aal2", nextLevel: "aal2" },
    info: { data: { size: 1024, contentType: "application/pdf" }, error: null },
    removeSpy: vi.fn() as unknown as (...a: unknown[]) => void,
    signSpy: vi.fn() as unknown as (...a: unknown[]) => void
  };
  return { state };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/supabase/server", () => {
  const mockDbQuery = {
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(() => Promise.resolve(h.state.projectSelect)),
    limit: vi.fn(() => Promise.resolve(h.state.refs))
  };

  const mockDbInsert = {
    select: vi.fn().mockReturnThis(),
    single: vi.fn(() => Promise.resolve(h.state.insertResult))
  };

  function buildClient() {
    return {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: h.state.user }, error: null })),
        mfa: {
          getAuthenticatorAssuranceLevel: vi.fn(async () => ({ data: h.state.aal, error: null }))
        }
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
          }),
          info: vi.fn(() => Promise.resolve(h.state.info)),
          remove: vi.fn((...a: unknown[]) => {
            h.state.removeSpy(...a);
            return Promise.resolve({ data: [], error: null });
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
  h.state.refs = { data: [], error: null };
  h.state.aal = { currentLevel: "aal2", nextLevel: "aal2" };
  h.state.info = { data: { size: 1024, contentType: "application/pdf" }, error: null };
  process.env.ADMIN_EMAILS = "admin@dobeu.net";
});

const projectId = "00000000-0000-0000-0000-000000000001";
const pdf = { size_bytes: 1024, mime: "application/pdf" };
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const KEY_RE = new RegExp(`^${projectId}/${UUID}-[A-Za-z0-9._-]+$`);
const KEY_ID = "11111111-1111-4111-8111-111111111111";

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
    expect(h.state.signSpy as unknown).not.toHaveBeenCalled();
  });

  it("rejects an AAL1 admin and never mints", async () => {
    h.state.aal = { currentLevel: "aal1", nextLevel: "aal2" };
    const { createDeliverableUploadUrl } = await import("@/lib/actions/files");
    const result = await createDeliverableUploadUrl({ project_id: projectId, filename: "spec.pdf", ...pdf });
    expect(result).toEqual({ ok: false, error: "mfa_required" });
    expect(h.state.signSpy as unknown).not.toHaveBeenCalled();
  });

  it("builds the path server-side under the project prefix", async () => {
    const { createDeliverableUploadUrl } = await import("@/lib/actions/files");
    await createDeliverableUploadUrl({ project_id: projectId, filename: "spec.pdf", ...pdf });
    const path = (h.state.signSpy as unknown as { mock: { calls: string[][] } }).mock.calls[0][0];
    expect(path.startsWith(`${projectId}/`)).toBe(true);
    expect(path).toMatch(KEY_RE);
    expect(path.endsWith("-spec.pdf")).toBe(true);
    expect(h.state.signSpy as unknown).toHaveBeenCalledWith(path, { upsert: false });
  });

  it("mints unique keys for the same filename", async () => {
    const { createDeliverableUploadUrl } = await import("@/lib/actions/files");
    await createDeliverableUploadUrl({ project_id: projectId, filename: "spec.pdf", ...pdf });
    await createDeliverableUploadUrl({ project_id: projectId, filename: "spec.pdf", ...pdf });
    const calls = (h.state.signSpy as unknown as { mock: { calls: string[][] } }).mock.calls;
    expect(calls[0][0]).not.toBe(calls[1][0]);
  });

  it("keeps spaces out of the key: Q1 Report.pdf -> <uuid>-Q1-Report.pdf", async () => {
    const { createDeliverableUploadUrl } = await import("@/lib/actions/files");
    const result = await createDeliverableUploadUrl({ project_id: projectId, filename: "Q1 Report.pdf", ...pdf });
    expect(result.ok).toBe(true);
    const path = (h.state.signSpy as unknown as { mock: { calls: string[][] } }).mock.calls[0][0];
    expect(path).toMatch(new RegExp(`^${projectId}/${UUID}-Q1-Report\.pdf$`));
    expect(path).not.toContain(" ");
  });

  it.each([
    ["svg", "logo.svg", "image/png"],
    ["html", "page.html", "text/plain"],
    ["docm", "macro.docm", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ["encoded traversal", "%2e%2e%2fother.pdf", "application/pdf"],
    ["quote", 'a"b.pdf', "application/pdf"],
    ["CRLF", "a\r\nb.pdf", "application/pdf"],
    ["leading dot", ".hidden.pdf", "application/pdf"],
    ["too long", `${"a".repeat(120)}.pdf`, "application/pdf"],
    ["ext/mime mismatch", "photo.png", "application/pdf"]
  ])("rejects filename case: %s", async (_n, filename, mime) => {
    const { createDeliverableUploadUrl } = await import("@/lib/actions/files");
    const result = await createDeliverableUploadUrl({ project_id: projectId, filename, mime, size_bytes: 10 });
    expect(result.ok).toBe(false);
    expect(h.state.signSpy as unknown).not.toHaveBeenCalled();
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
    storage_path: `${projectId}/${KEY_ID}-spec.pdf`,
    filename: "spec.pdf",
    mime: "application/pdf",
    size_bytes: 1024
  };

  it("inserts a row with REAL size/mime and uploaded_by = admin uuid", async () => {
    h.state.info = { data: { size: 2048, contentType: "application/pdf" }, error: null };
    const { recordDeliverable } = await import("@/lib/actions/files");
    const result = await recordDeliverable(base);
    expect(result).toEqual({ ok: true, data: { id: "file_1" } });
    expect(h.state.capturedInsert).toMatchObject({
      project_id: projectId,
      storage_path: `${projectId}/${KEY_ID}-spec.pdf`,
      filename: "spec.pdf",
      mime: "application/pdf",
      size_bytes: 2048,
      uploaded_by: "admin_id"
    });
  });

  it("blocks non-admin", async () => {
    h.state.user = { id: "u", email: "x@x.com" };
    const { recordDeliverable } = await import("@/lib/actions/files");
    const result = await recordDeliverable(base);
    expect(result).toEqual({ ok: false, error: "forbidden" });
    expect(h.state.capturedInsert).toBeNull();
  });

  it("rejects an AAL1 admin without inserting", async () => {
    h.state.aal = { currentLevel: "aal1", nextLevel: "aal2" };
    const { recordDeliverable } = await import("@/lib/actions/files");
    const result = await recordDeliverable(base);
    expect(result).toEqual({ ok: false, error: "mfa_required" });
    expect(h.state.capturedInsert).toBeNull();
  });

  it("rejects a storage_path outside the project prefix", async () => {
    const { recordDeliverable } = await import("@/lib/actions/files");
    const result = await recordDeliverable({
      ...base,
      storage_path: `00000000-0000-0000-0000-000000000009/${KEY_ID}-spec.pdf`
    });
    expect(result).toEqual({ ok: false, error: "storage_path outside project namespace" });
    expect(h.state.capturedInsert).toBeNull();
  });

  it("rejects a nested or traversing storage_path", async () => {
    const { recordDeliverable } = await import("@/lib/actions/files");
    const r1 = await recordDeliverable({ ...base, storage_path: `${projectId}/x/${KEY_ID}-spec.pdf` });
    const r2 = await recordDeliverable({ ...base, storage_path: `${projectId}/..%2fabc.pdf` });
    expect(r1.ok).toBe(false);
    expect(r2.ok).toBe(false);
  });

  it("rejects a legacy-shaped key (not <uuid>-<name>)", async () => {
    const { recordDeliverable } = await import("@/lib/actions/files");
    const result = await recordDeliverable({ ...base, storage_path: `${projectId}/abc-spec.pdf` });
    expect(result).toEqual({ ok: false, error: "storage_path outside project namespace" });
  });

  it("records the display name with spaces for a spaced upload", async () => {
    const { recordDeliverable } = await import("@/lib/actions/files");
    const result = await recordDeliverable({
      project_id: projectId,
      storage_path: `${projectId}/${KEY_ID}-Q1-Report.pdf`,
      filename: "Q1 Report.pdf"
    });
    expect(result.ok).toBe(true);
    expect(h.state.capturedInsert).toMatchObject({
      storage_path: `${projectId}/${KEY_ID}-Q1-Report.pdf`,
      filename: "Q1 Report.pdf"
    });
  });

  it("accepts a .csv whose browser type was application/vnd.ms-excel", async () => {
    h.state.info = { data: { size: 10, contentType: "text/csv" }, error: null };
    const { recordDeliverable } = await import("@/lib/actions/files");
    const result = await recordDeliverable({
      project_id: projectId,
      storage_path: `${projectId}/${KEY_ID}-data.csv`,
      filename: "data.csv"
    });
    expect(result.ok).toBe(true);
    expect(h.state.capturedInsert).toMatchObject({ mime: "text/csv" });
  });

  it("rejects a declared mime that differs from the canonical one", async () => {
    const { recordDeliverable } = await import("@/lib/actions/files");
    const result = await recordDeliverable({
      project_id: projectId,
      storage_path: `${projectId}/${KEY_ID}-data.csv`,
      filename: "data.csv",
      mime: "application/vnd.ms-excel"
    });
    expect(result.ok).toBe(false);
    expect(h.state.capturedInsert).toBeNull();
  });

  it("rejects a key with a non-allowlisted extension even with text/plain content", async () => {
    h.state.info = { data: { size: 10, contentType: "text/plain" }, error: null };
    const { recordDeliverable } = await import("@/lib/actions/files");
    const result = await recordDeliverable({
      project_id: projectId,
      storage_path: `${projectId}/${KEY_ID}-x.html`,
      filename: "n.txt"
    });
    expect(result.ok).toBe(false);
    expect(h.state.capturedInsert).toBeNull();
  });

  it("rejects when the key extension and real contentType disagree", async () => {
    h.state.info = { data: { size: 10, contentType: "text/plain" }, error: null };
    const { recordDeliverable } = await import("@/lib/actions/files");
    const result = await recordDeliverable({
      project_id: projectId,
      storage_path: `${projectId}/${KEY_ID}-x.pdf`,
      filename: "x.pdf"
    });
    expect(result.ok).toBe(false);
    expect(h.state.capturedInsert).toBeNull();
  });

  it("strips a parameterised contentType", async () => {
    h.state.info = { data: { size: 10, contentType: "application/pdf; charset=binary" }, error: null };
    const { recordDeliverable } = await import("@/lib/actions/files");
    const result = await recordDeliverable(base);
    expect(result.ok).toBe(true);
    expect(h.state.capturedInsert).toMatchObject({ mime: "application/pdf" });
  });

  it("never deletes an object an existing row already references", async () => {
    h.state.refs = { data: [{ id: "existing" }], error: null };
    h.state.info = { data: { size: 10, contentType: "image/png" }, error: null };
    const { recordDeliverable } = await import("@/lib/actions/files");
    const result = await recordDeliverable(base);
    expect(result.ok).toBe(false);
    expect(h.state.removeSpy as unknown).not.toHaveBeenCalled();
    expect(h.state.capturedInsert).toBeNull();
  });

  it("does not delete when the reference lookup fails", async () => {
    h.state.refs = { data: null, error: { message: "db down" } };
    const { recordDeliverable } = await import("@/lib/actions/files");
    const result = await recordDeliverable(base);
    expect(result.ok).toBe(false);
    expect(h.state.removeSpy as unknown).not.toHaveBeenCalled();
  });

  it("rejects a missing object", async () => {
    h.state.info = { data: null, error: { message: "Object not found" } };
    const { recordDeliverable } = await import("@/lib/actions/files");
    const result = await recordDeliverable(base);
    expect(result.ok).toBe(false);
    expect(h.state.capturedInsert).toBeNull();
  });

  it("rejects and removes an object whose real size exceeds the cap", async () => {
    h.state.info = { data: { size: 40 * 1024 * 1024, contentType: "application/pdf" }, error: null };
    const { recordDeliverable } = await import("@/lib/actions/files");
    const result = await recordDeliverable(base);
    expect(result.ok).toBe(false);
    expect(h.state.removeSpy as unknown).toHaveBeenCalledWith([base.storage_path]);
    expect(h.state.capturedInsert).toBeNull();
  });

  it("rejects and removes an object whose real mimetype is not allowed", async () => {
    h.state.info = { data: { size: 1024, contentType: "text/html" }, error: null };
    const { recordDeliverable } = await import("@/lib/actions/files");
    const result = await recordDeliverable(base);
    expect(result.ok).toBe(false);
    expect(h.state.removeSpy as unknown).toHaveBeenCalledWith([base.storage_path]);
    expect(h.state.capturedInsert).toBeNull();
  });

  it("rejects and removes an object whose real mime disagrees with the extension", async () => {
    h.state.info = { data: { size: 1024, contentType: "image/png" }, error: null };
    const { recordDeliverable } = await import("@/lib/actions/files");
    const result = await recordDeliverable(base);
    expect(result.ok).toBe(false);
    expect(h.state.removeSpy as unknown).toHaveBeenCalledTimes(1);
  });

  it("rejects a disallowed declared MIME type", async () => {
    const { recordDeliverable } = await import("@/lib/actions/files");
    const result = await recordDeliverable({ ...base, mime: "application/x-msdownload" });
    expect(result.ok).toBe(false);
  });

  it("rejects declared size over 25MB", async () => {
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
