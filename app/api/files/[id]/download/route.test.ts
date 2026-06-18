import { beforeEach, describe, expect, it, vi } from "vitest";

const single = vi.fn();
const eq = vi.fn(() => ({ single }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));
const createSignedUrl = vi.fn();
const storageFrom = vi.fn(() => ({ createSignedUrl }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from,
    storage: { from: storageFrom }
  }))
}));

import { POST } from "@/app/api/files/[id]/download/route";

beforeEach(() => {
  from.mockClear();
  select.mockClear();
  eq.mockClear();
  single.mockClear();
  storageFrom.mockClear();
  createSignedUrl.mockClear();
});

describe("POST /api/files/[id]/download", () => {
  it("redirects to a signed URL when file exists", async () => {
    single.mockResolvedValue({ data: { id: "f1", storage_path: "private/file.pdf" }, error: null });
    createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://signed.example/file.pdf" }, error: null });

    const res = await POST(new Request("http://localhost/api/files/f1/download", { method: "POST" }), {
      params: Promise.resolve({ id: "f1" })
    });

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://signed.example/file.pdf");
    expect(storageFrom).toHaveBeenCalledWith("project-files");
  });

  it("returns 404 when file does not exist", async () => {
    single.mockResolvedValue({ data: null, error: new Error("not found") });

    const res = await POST(new Request("http://localhost/api/files/missing/download", { method: "POST" }), {
      params: Promise.resolve({ id: "missing" })
    });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "File not found" });
  });
});
