import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  isCustomerIoConfigured,
  cioIdentify,
  cioTrack,
} from "@/lib/customerio";

function okResponse(): Response {
  return {
    ok: true,
    status: 200,
    text: async () => "",
    json: async () => ({}),
  } as unknown as Response;
}

function errorResponse(status: number, text: string): Response {
  return {
    ok: false,
    status,
    text: async () => text,
    json: async () => ({}),
  } as unknown as Response;
}

const fetchMock = vi.fn();

const SITE_ID = "site-abc";
const API_KEY = "key-xyz";
const EXPECTED_AUTH =
  "Basic " + Buffer.from(`${SITE_ID}:${API_KEY}`).toString("base64");

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  process.env.CUSTOMERIO_SITE_ID = SITE_ID;
  process.env.CUSTOMERIO_API_KEY = API_KEY;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.CUSTOMERIO_SITE_ID;
  delete process.env.CUSTOMERIO_API_KEY;
});

describe("isCustomerIoConfigured", () => {
  it("returns true when both site id and api key are set", () => {
    expect(isCustomerIoConfigured()).toBe(true);
  });

  it("returns false when site id is missing", () => {
    delete process.env.CUSTOMERIO_SITE_ID;
    expect(isCustomerIoConfigured()).toBe(false);
  });

  it("returns false when api key is missing", () => {
    delete process.env.CUSTOMERIO_API_KEY;
    expect(isCustomerIoConfigured()).toBe(false);
  });
});

describe("cioIdentify", () => {
  it("returns not_configured and does not call fetch when env is missing", async () => {
    delete process.env.CUSTOMERIO_SITE_ID;
    const result = await cioIdentify({ email: "a@b.com" });
    expect(result).toEqual({ ok: false, error: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("PUTs to the customers endpoint with auth, url-encoded id, and merged attributes", async () => {
    fetchMock.mockResolvedValue(okResponse());

    const result = await cioIdentify({
      email: "jane+test@example.com",
      attributes: { plan: "pro", count: 3 },
    });

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe(
      `https://track.customer.io/api/v1/customers/${encodeURIComponent("jane+test@example.com")}`,
    );
    expect(opts.method).toBe("PUT");
    expect(opts.headers.Authorization).toBe(EXPECTED_AUTH);
    expect(opts.headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(opts.body);
    expect(body.email).toBe("jane+test@example.com");
    expect(body.plan).toBe("pro");
    expect(body.count).toBe(3);
    expect(typeof body.last_identified_at).toBe("number");
  });

  it("returns ok:false with an error message on a non-2xx response", async () => {
    fetchMock.mockResolvedValue(errorResponse(400, "bad request"));
    const result = await cioIdentify({ email: "a@b.com" });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Customer.io identify 400: bad request");
  });

  it("returns ok:false when fetch throws (network error)", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const result = await cioIdentify({ email: "a@b.com" });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("network down");
  });
});

describe("cioTrack", () => {
  it("returns not_configured and does not call fetch when env is missing", async () => {
    delete process.env.CUSTOMERIO_API_KEY;
    const result = await cioTrack({ email: "a@b.com", name: "lead_captured" });
    expect(result).toEqual({ ok: false, error: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs to the events endpoint with auth, name, data, and timestamp", async () => {
    fetchMock.mockResolvedValue(okResponse());

    const result = await cioTrack({
      email: "jane@example.com",
      name: "lead_captured",
      data: { source: "homepage" },
    });

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe(
      `https://track.customer.io/api/v1/customers/${encodeURIComponent("jane@example.com")}/events`,
    );
    expect(opts.method).toBe("POST");
    expect(opts.headers.Authorization).toBe(EXPECTED_AUTH);
    expect(opts.headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(opts.body);
    expect(body.name).toBe("lead_captured");
    expect(body.data).toEqual({ source: "homepage" });
    expect(typeof body.timestamp).toBe("number");
  });

  it("defaults data to an empty object when omitted", async () => {
    fetchMock.mockResolvedValue(okResponse());
    await cioTrack({ email: "a@b.com", name: "evt" });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.data).toEqual({});
  });

  it("returns ok:false with an error message on a non-2xx response", async () => {
    fetchMock.mockResolvedValue(errorResponse(500, "server error"));
    const result = await cioTrack({ email: "a@b.com", name: "evt" });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Customer.io track 500: server error");
  });

  it("returns ok:false when fetch throws (network error)", async () => {
    fetchMock.mockRejectedValue(new Error("timeout"));
    const result = await cioTrack({ email: "a@b.com", name: "evt" });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("timeout");
  });
});
