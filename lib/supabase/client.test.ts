import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Mock the Supabase SSR factory so no real client/network is created. We just
// capture the (url, anon) arguments to assert the env-fallback branching.
const createBrowserClientMock = vi.fn((url: string, anon: string) => ({ url, anon }));

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: createBrowserClientMock
}));

const URL_KEY = "NEXT_PUBLIC_VERCEL_SUPABASE_URL";
const ANON_KEY = "NEXT_PUBLIC_VERCEL_SUPABASE_ANON_KEY";

function clearEnv() {
  delete process.env[URL_KEY];
  delete process.env[ANON_KEY];
}

async function freshImport() {
  vi.resetModules();
  return import("@/lib/supabase/client");
}

beforeEach(() => {
  clearEnv();
  createBrowserClientMock.mockClear();
});

afterEach(() => {
  clearEnv();
});

describe("isSupabaseConfigured", () => {
  it("returns false when both env vars are absent", async () => {
    const { isSupabaseConfigured } = await freshImport();
    expect(isSupabaseConfigured()).toBe(false);
  });

  it("returns false when only the url is present", async () => {
    process.env[URL_KEY] = "https://proj.supabase.co";
    const { isSupabaseConfigured } = await freshImport();
    expect(isSupabaseConfigured()).toBe(false);
  });

  it("returns false when only the anon key is present", async () => {
    process.env[ANON_KEY] = "anon-key";
    const { isSupabaseConfigured } = await freshImport();
    expect(isSupabaseConfigured()).toBe(false);
  });

  it("returns true when both env vars are present", async () => {
    process.env[URL_KEY] = "https://proj.supabase.co";
    process.env[ANON_KEY] = "anon-key";
    const { isSupabaseConfigured } = await freshImport();
    expect(isSupabaseConfigured()).toBe(true);
  });
});

describe("createClient", () => {
  it("uses placeholder credentials when env is missing", async () => {
    const { createClient } = await freshImport();
    createClient();
    expect(createBrowserClientMock).toHaveBeenCalledWith(
      "https://placeholder.supabase.co",
      "placeholder-anon-key"
    );
  });

  it("uses the real env credentials when configured", async () => {
    process.env[URL_KEY] = "https://proj.supabase.co";
    process.env[ANON_KEY] = "anon-key";
    const { createClient } = await freshImport();
    createClient();
    expect(createBrowserClientMock).toHaveBeenCalledWith(
      "https://proj.supabase.co",
      "anon-key"
    );
  });

  it("falls back to placeholder when only the url is set", async () => {
    process.env[URL_KEY] = "https://proj.supabase.co";
    const { createClient } = await freshImport();
    createClient();
    expect(createBrowserClientMock).toHaveBeenCalledWith(
      "https://placeholder.supabase.co",
      "placeholder-anon-key"
    );
  });

  it("returns the constructed client instance", async () => {
    process.env[URL_KEY] = "https://proj.supabase.co";
    process.env[ANON_KEY] = "anon-key";
    const { createClient } = await freshImport();
    const client = createClient();
    expect(client).toEqual({ url: "https://proj.supabase.co", anon: "anon-key" });
  });
});
