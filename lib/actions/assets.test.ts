import { describe, it, expect, beforeEach, vi } from "vitest";
import { buildStubClient } from "./__test-helpers";

// Mutable holder so each test swaps in a differently-configured stub client.
const h = vi.hoisted(() => {
  const state: { client: unknown } = { client: null };
  return { state };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => h.state.client),
  createAdminClient: vi.fn(() => ({ __admin: true }))
}));

import { listEntitledAssets, getAssetDownloadUrl } from "@/lib/actions/assets";

const USER = { id: "user_1", email: "member@example.com" };
const ASSET_ID = "11111111-1111-1111-1111-111111111111";

/**
 * buildStubClient has no storage mock; extend the returned client locally
 * (never edit __test-helpers.ts).
 */
function withStorage(
  client: ReturnType<typeof buildStubClient>["supabase"],
  createSignedUrl: ReturnType<typeof vi.fn>
) {
  return {
    ...client,
    storage: { from: vi.fn(() => ({ createSignedUrl })) }
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.state.client = null;
});

describe("listEntitledAssets", () => {
  it("returns not_authenticated when there is no user", async () => {
    h.state.client = buildStubClient({ user: null }).supabase;
    const res = await listEntitledAssets();
    expect(res).toEqual({ ok: false, error: "not_authenticated" });
  });

  it("returns an empty list when the caller has no entitlements", async () => {
    h.state.client = buildStubClient({
      user: USER,
      tables: { asset_entitlements: { selectSingle: { data: [] } } }
    }).supabase;

    const res = await listEntitledAssets();
    expect(res).toEqual({ ok: true, data: [] });
  });

  it("joins entitlements to the catalog, newest grant first", async () => {
    h.state.client = buildStubClient({
      user: USER,
      tables: {
        asset_entitlements: {
          selectSingle: {
            data: [
              { asset_id: "a1", source: "stripe", granted_at: "2026-07-10T00:00:00Z" },
              { asset_id: "a2", source: "stripe", granted_at: "2026-07-12T00:00:00Z" }
            ]
          }
        },
        digital_assets: {
          selectSingle: {
            data: [
              { id: "a1", title: "Brand Kit", description: "Logos" },
              { id: "a2", title: "Slide Template", description: null }
            ]
          }
        }
      }
    }).supabase;

    const res = await listEntitledAssets();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.map((a) => a.id)).toEqual(["a2", "a1"]);
      expect(res.data[0]).toMatchObject({
        title: "Slide Template",
        description: null,
        granted_at: "2026-07-12T00:00:00Z",
        source: "stripe"
      });
    }
  });

  it("surfaces an entitlement query error", async () => {
    h.state.client = buildStubClient({
      user: USER,
      tables: { asset_entitlements: { selectSingle: { error: { message: "boom" } } } }
    }).supabase;

    const res = await listEntitledAssets();
    expect(res).toEqual({ ok: false, error: "boom" });
  });
});

describe("getAssetDownloadUrl", () => {
  it("rejects a non-uuid id before touching the DB", async () => {
    const res = await getAssetDownloadUrl("not-a-uuid");
    expect(res.ok).toBe(false);
  });

  it("returns not_entitled when no entitlement row is visible", async () => {
    h.state.client = buildStubClient({
      user: USER,
      tables: { asset_entitlements: { selectSingle: { data: [] } } }
    }).supabase;

    const res = await getAssetDownloadUrl(ASSET_ID);
    expect(res).toEqual({ ok: false, error: "not_entitled" });
  });

  it("returns a signed URL for an entitled asset", async () => {
    const createSignedUrl = vi.fn(async () => ({
      data: { signedUrl: "https://signed.example/a1.zip" },
      error: null
    }));
    const base = buildStubClient({
      user: USER,
      tables: {
        asset_entitlements: { selectSingle: { data: [{ id: "ent_1" }] } },
        digital_assets: { selectSingle: { data: { storage_path: "a1/kit.zip" } } }
      }
    }).supabase;
    h.state.client = withStorage(base, createSignedUrl);

    const res = await getAssetDownloadUrl(ASSET_ID);
    expect(res).toEqual({ ok: true, data: { url: "https://signed.example/a1.zip" } });
    expect(createSignedUrl).toHaveBeenCalledWith("a1/kit.zip", 600);
  });

  it("returns an error when the signed URL cannot be created", async () => {
    const createSignedUrl = vi.fn(async () => ({
      data: null,
      error: { message: "storage down" }
    }));
    const base = buildStubClient({
      user: USER,
      tables: {
        asset_entitlements: { selectSingle: { data: [{ id: "ent_1" }] } },
        digital_assets: { selectSingle: { data: { storage_path: "a1/kit.zip" } } }
      }
    }).supabase;
    h.state.client = withStorage(base, createSignedUrl);

    const res = await getAssetDownloadUrl(ASSET_ID);
    expect(res).toEqual({ ok: false, error: "storage down" });
  });
});
