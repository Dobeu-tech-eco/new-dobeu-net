import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ---- collaborator mocks ----
// All mutable state + vi.fn()s live inside vi.hoisted so they exist before the
// hoisted vi.mock factories run.
const h = vi.hoisted(() => {
  const supaConfig: { insert: "success" | "error" | "throw"; insertId: string | null } = {
    insert: "success",
    insertId: "lead_1"
  };
  const apolloConfig: { mode: "ok" | "fail" | "throw" } = { mode: "ok" };
  const cioConfig: { configured: boolean; idOk: boolean; trackOk: boolean } = {
    configured: true,
    idOk: true,
    trackOk: true
  };
  const resendConfig: { mode: "ok" | "reject" } = { mode: "ok" };

  const updateEq = vi.fn(() => Promise.resolve({ data: null, error: null }));

  const createAdminClient = vi.fn(() => {
    if (supaConfig.insert === "throw") throw new Error("supabase down");
    return {
      from: vi.fn(() => ({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() =>
              supaConfig.insert === "error"
                ? Promise.resolve({ data: null, error: new Error("insert failed") })
                : Promise.resolve({ data: { id: supaConfig.insertId }, error: null })
            )
          }))
        })),
        update: vi.fn(() => ({ eq: updateEq }))
      }))
    };
  });

  const upsertApolloContact = vi.fn(async () => {
    if (apolloConfig.mode === "throw") throw new Error("apollo blew up");
    if (apolloConfig.mode === "fail") return { ok: false, error: "bad request" };
    return { ok: true, contact_id: "apollo_1" };
  });

  const cioIdentify = vi.fn(async () => ({ ok: cioConfig.idOk, error: cioConfig.idOk ? undefined : "id err" }));
  const cioTrack = vi.fn(async () => ({ ok: cioConfig.trackOk, error: cioConfig.trackOk ? undefined : "track err" }));
  const isCustomerIoConfigured = vi.fn(() => cioConfig.configured);

  const emailsSend = vi.fn(async () => {
    if (resendConfig.mode === "reject") throw new Error("resend down");
    return { id: "email_1" };
  });
  const ResendCtor = vi.fn(function () {
    return { emails: { send: emailsSend } };
  });

  return {
    supaConfig,
    apolloConfig,
    cioConfig,
    resendConfig,
    updateEq,
    createAdminClient,
    upsertApolloContact,
    cioIdentify,
    cioTrack,
    isCustomerIoConfigured,
    emailsSend,
    ResendCtor
  };
});

const {
  supaConfig,
  apolloConfig,
  cioConfig,
  resendConfig,
  updateEq,
  createAdminClient,
  upsertApolloContact,
  cioIdentify,
  cioTrack,
  emailsSend,
  ResendCtor
} = h;

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => h.createAdminClient()
}));
vi.mock("@/lib/apollo", () => ({
  upsertApolloContact: (...args: unknown[]) => h.upsertApolloContact(...(args as []))
}));
vi.mock("@/lib/customerio", () => ({
  cioIdentify: (...a: unknown[]) => h.cioIdentify(...(a as [])),
  cioTrack: (...a: unknown[]) => h.cioTrack(...(a as [])),
  isCustomerIoConfigured: () => h.isCustomerIoConfigured()
}));
vi.mock("resend", () => ({ Resend: h.ResendCtor }));

import { processLead, escapeHtml } from "@/lib/leads";

const baseInput = {
  email: "a@b.com",
  name: "Jane Doe",
  company: "Acme",
  message: "hello",
  source: "form" as const,
  utm: { utm_source: "google", utm_medium: "cpc", utm_campaign: "spring" },
  referrer: "https://ref.example",
  ipHash: "hash123"
};

beforeEach(() => {
  vi.clearAllMocks();
  supaConfig.insert = "success";
  supaConfig.insertId = "lead_1";
  apolloConfig.mode = "ok";
  cioConfig.configured = true;
  cioConfig.idOk = true;
  cioConfig.trackOk = true;
  resendConfig.mode = "ok";

  process.env.APOLLO_API_KEY = "apollo-key";
  process.env.RESEND_API_KEY = "resend-key";
  process.env.RESEND_FROM_EMAIL = "hello@dobeu.net";
  process.env.RESEND_REPLY_TO = "jeremyw@dobeu.net";
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("processLead — happy path", () => {
  it("returns leadId + apolloContactId and fans out to every collaborator", async () => {
    const logSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const result = await processLead(baseInput);

    expect(result).toEqual({ leadId: "lead_1", apolloContactId: "apollo_1" });

    // Supabase insert called once with mapped fields
    expect(createAdminClient).toHaveBeenCalled();

    // Apollo called
    expect(upsertApolloContact).toHaveBeenCalledTimes(1);
    expect(upsertApolloContact).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "a@b.com",
        first_name: "Jane",
        last_name: "Doe",
        organization_name: "Acme",
        label_names: ["dobeu.net-form", "utm_source-google"]
      })
    );

    // Backfill apollo id onto the lead row
    expect(updateEq).toHaveBeenCalledWith("id", "lead_1");

    // Customer.io identify + track
    expect(cioIdentify).toHaveBeenCalledWith(
      expect.objectContaining({ email: "a@b.com", attributes: expect.objectContaining({ apollo_contact_id: "apollo_1", supabase_lead_id: "lead_1" }) })
    );
    expect(cioTrack).toHaveBeenCalledWith(
      expect.objectContaining({ email: "a@b.com", name: "lead_captured" })
    );

    // Both Resend emails sent
    expect(emailsSend).toHaveBeenCalledTimes(2);

    logSpy.mockRestore();
  });

  it("maps the insert payload (email/name/source/utm split + raw_payload.ip_hash)", async () => {
    // Capture insert args via a spy on the chain
    let insertArg: Record<string, unknown> | undefined;
    createAdminClient.mockImplementationOnce(() => ({
      from: vi.fn(() => ({
        insert: vi.fn((arg: Record<string, unknown>) => {
          insertArg = arg;
          return {
            select: vi.fn(() => ({ single: vi.fn(() => Promise.resolve({ data: { id: "lead_1" }, error: null })) }))
          };
        }),
        update: vi.fn(() => ({ eq: updateEq }))
      }))
    }));

    await processLead(baseInput);

    expect(insertArg).toMatchObject({
      email: "a@b.com",
      name: "Jane Doe",
      company: "Acme",
      source: "form",
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "spring",
      referrer: "https://ref.example"
    });
    expect(insertArg!.raw_payload).toMatchObject({ message: "hello", ip_hash: "hash123", utm_source: "google" });
  });
});

describe("processLead — Supabase failures stay non-fatal", () => {
  it("insert error -> leadId null but apollo + emails still attempted", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    supaConfig.insert = "error";

    const result = await processLead(baseInput);

    expect(result.leadId).toBeNull();
    expect(result.apolloContactId).toBe("apollo_1");
    expect(upsertApolloContact).toHaveBeenCalled();
    expect(emailsSend).toHaveBeenCalledTimes(2);
    // No backfill when leadId is null
    expect(updateEq).not.toHaveBeenCalled();

    errSpy.mockRestore();
  });

  it("createAdminClient throws -> leadId null, no throw, flow continues", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    supaConfig.insert = "throw";

    await expect(processLead(baseInput)).resolves.toEqual(
      expect.objectContaining({ leadId: null, apolloContactId: "apollo_1" })
    );
    expect(emailsSend).toHaveBeenCalledTimes(2);

    errSpy.mockRestore();
  });
});

describe("processLead — env-gated steps", () => {
  it("APOLLO_API_KEY unset -> apollo not called, apolloContactId undefined", async () => {
    delete process.env.APOLLO_API_KEY;

    const result = await processLead(baseInput);

    expect(upsertApolloContact).not.toHaveBeenCalled();
    expect(result.apolloContactId).toBeUndefined();
    // No backfill since no apollo id
    expect(updateEq).not.toHaveBeenCalled();
  });

  it("isCustomerIoConfigured() false -> cio not called", async () => {
    cioConfig.configured = false;

    await processLead(baseInput);

    expect(cioIdentify).not.toHaveBeenCalled();
    expect(cioTrack).not.toHaveBeenCalled();
  });

  it("RESEND_API_KEY unset -> no emails sent", async () => {
    delete process.env.RESEND_API_KEY;

    await processLead(baseInput);

    expect(emailsSend).not.toHaveBeenCalled();
    expect(ResendCtor).not.toHaveBeenCalled();
  });
});

describe("processLead — collaborator throws are swallowed", () => {
  it("apollo throws -> resolves with apolloContactId undefined, flow continues", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    apolloConfig.mode = "throw";

    const result = await processLead(baseInput);

    expect(result.leadId).toBe("lead_1");
    expect(result.apolloContactId).toBeUndefined();
    expect(emailsSend).toHaveBeenCalledTimes(2);

    errSpy.mockRestore();
  });

  it("apollo returns ok:false -> apolloContactId undefined, no throw", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    apolloConfig.mode = "fail";

    const result = await processLead(baseInput);

    expect(result.apolloContactId).toBeUndefined();
    expect(updateEq).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("resend send rejects -> processLead still resolves", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    resendConfig.mode = "reject";

    await expect(processLead(baseInput)).resolves.toEqual(
      expect.objectContaining({ leadId: "lead_1", apolloContactId: "apollo_1" })
    );

    errSpy.mockRestore();
  });

  it("cio identify + track returning ok:false does not throw", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    cioConfig.idOk = false;
    cioConfig.trackOk = false;

    await expect(processLead(baseInput)).resolves.toEqual(
      expect.objectContaining({ leadId: "lead_1" })
    );

    warnSpy.mockRestore();
  });
});

describe("escapeHtml", () => {
  it("escapes &, <, >, double-quote and single-quote", () => {
    expect(escapeHtml(`<a href="x" data='y'>Tom & Jerry</a>`)).toBe(
      "&lt;a href=&quot;x&quot; data=&#39;y&#39;&gt;Tom &amp; Jerry&lt;/a&gt;"
    );
  });
  it("coerces non-string input to string before escaping", () => {
    expect(escapeHtml(123)).toBe("123");
    expect(escapeHtml(null)).toBe("null");
  });
  it("leaves safe text untouched", () => {
    expect(escapeHtml("plain text 42")).toBe("plain text 42");
  });
});
