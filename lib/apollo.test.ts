import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { upsertApolloContact, logApolloActivity } from "@/lib/apollo";

function jsonResponse(data: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as unknown as Response;
}

function errorResponse(status: number, text: string): Response {
  return {
    ok: false,
    status,
    json: async () => ({}),
    text: async () => text,
  } as unknown as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  process.env.APOLLO_API_KEY = "test-apollo-key";
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.APOLLO_API_KEY;
});

describe("upsertApolloContact", () => {
  const input = {
    email: "jane@example.com",
    first_name: "Jane",
    last_name: "Doe",
    organization_name: "Acme",
    title: "CEO",
    phone: "+15551234567",
    label_names: ["lead", "spring"],
  };

  it("returns ok:false when APOLLO_API_KEY is missing (not configured)", async () => {
    delete process.env.APOLLO_API_KEY;
    const result = await upsertApolloContact(input);
    expect(result.ok).toBe(false);
    expect(result.error).toBe("APOLLO_API_KEY missing");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts to the contacts endpoint with the right method/headers/body and returns the contact id", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ contact: { id: "c_123" } }));

    const result = await upsertApolloContact(input);

    expect(result.ok).toBe(true);
    expect(result.contact_id).toBe("c_123");
    expect(result.raw).toEqual({ contact: { id: "c_123" } });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.apollo.io/api/v1/contacts");
    expect(opts.method).toBe("POST");
    expect(opts.headers["Content-Type"]).toBe("application/json");
    expect(opts.headers["Cache-Control"]).toBe("no-cache");
    expect(opts.headers["X-Api-Key"]).toBe("test-apollo-key");

    const body = JSON.parse(opts.body);
    expect(body).toMatchObject({
      first_name: "Jane",
      last_name: "Doe",
      email: "jane@example.com",
      organization_name: "Acme",
      title: "CEO",
      phone_numbers: [{ raw_number: "+15551234567" }],
      label_names: ["lead", "spring"],
    });
  });

  it("omits phone_numbers when no phone is supplied", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ contact: { id: "c_1" } }));
    await upsertApolloContact({ email: "a@b.com", first_name: "A" });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.phone_numbers).toBeUndefined();
  });

  it("defaults first/last name to empty strings when no name is given", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ contact: { id: "c_1" } }));
    await upsertApolloContact({ email: "a@b.com" });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.first_name).toBe("");
    expect(body.last_name).toBe("");
  });

  it("returns ok:false with an error message on a non-2xx response", async () => {
    fetchMock.mockResolvedValue(errorResponse(422, "Unprocessable Entity"));
    const result = await upsertApolloContact(input);
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Apollo upsert failed: 422 Unprocessable Entity");
  });

  it("returns ok:false when fetch throws (network error)", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const result = await upsertApolloContact(input);
    expect(result.ok).toBe(false);
    expect(result.error).toBe("network down");
  });

  it("handles a successful response with no contact id", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    const result = await upsertApolloContact(input);
    expect(result.ok).toBe(true);
    expect(result.contact_id).toBeUndefined();
  });
});

describe("logApolloActivity", () => {
  it("returns ok:false when APOLLO_API_KEY is missing (not configured)", async () => {
    delete process.env.APOLLO_API_KEY;
    const result = await logApolloActivity("c_1", "booked call");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("APOLLO_API_KEY missing");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts to the notes endpoint with the right body and default activity type", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));

    const result = await logApolloActivity("c_1", "booked discovery call");

    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.apollo.io/api/v1/notes");
    expect(opts.method).toBe("POST");
    expect(opts.headers["X-Api-Key"]).toBe("test-apollo-key");
    expect(opts.headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(opts.body);
    expect(body).toEqual({
      contact_id: "c_1",
      note: { content: "booked discovery call", type: "note" },
    });
  });

  it("uses a custom activity type when provided", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    await logApolloActivity("c_1", "called", "call");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.note.type).toBe("call");
  });

  it("returns ok:false with an error message on a non-2xx response", async () => {
    fetchMock.mockResolvedValue(errorResponse(500, "boom"));
    const result = await logApolloActivity("c_1", "note");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Apollo activity failed: 500 boom");
  });

  it("returns ok:false when fetch throws (network error)", async () => {
    fetchMock.mockRejectedValue(new Error("timeout"));
    const result = await logApolloActivity("c_1", "note");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("timeout");
  });
});
