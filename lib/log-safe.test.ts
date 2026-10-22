import { describe, it, expect } from "vitest";
import { safeErrorFields } from "@/lib/log-safe";

const EMAIL = "leak@example.com";

describe("safeErrorFields", () => {
  it("returns only the kind for a plain Error, never its message or stack", () => {
    const out = safeErrorFields(new Error(`lookup failed for ${EMAIL}`));
    expect(out).toEqual({ kind: "Error" });
    expect(JSON.stringify(out)).not.toContain(EMAIL);
  });

  it("keeps code + constraint from a PostgREST-shaped error and drops message/details/hint", () => {
    const pg = {
      code: "23505",
      message: `duplicate key value violates unique constraint "bookings_email_key" (${EMAIL})`,
      details: `Key (email)=(${EMAIL}) already exists.`,
      hint: `try another value than ${EMAIL}`
    };
    const out = safeErrorFields(pg);
    expect(out).toEqual({ kind: "UnknownError", code: "23505", constraint: "bookings_email_key" });
    expect(JSON.stringify(out)).not.toContain(EMAIL);
  });

  it("extracts the table from an FK message", () => {
    const out = safeErrorFields({
      code: "23503",
      message:
        'insert or update on table "asset_entitlements" violates foreign key constraint "asset_entitlements_user_id_fkey"'
    });
    expect(out).toEqual({
      kind: "UnknownError",
      code: "23503",
      constraint: "asset_entitlements_user_id_fkey",
      table: "asset_entitlements"
    });
  });

  it("reads one level of cause so a fixed-message wrapper keeps the DB code", () => {
    const cause = { code: "42501", message: `permission denied for ${EMAIL}` };
    const out = safeErrorFields(new Error("invoice voided update failed", { cause }));
    expect(out).toEqual({ kind: "Error", code: "42501" });
    expect(JSON.stringify(out)).not.toContain(EMAIL);
  });

  it("prefers explicit constraint/table fields over the message", () => {
    const out = safeErrorFields({ code: "23505", constraint: "x_key", table: "public.t", message: "m" });
    expect(out).toEqual({ kind: "UnknownError", code: "23505", constraint: "x_key", table: "public.t" });
  });

  it("rejects codes and identifiers that are not short identifiers", () => {
    const out = safeErrorFields({
      code: `${EMAIL} is not a code`,
      constraint: `bad ${EMAIL}`,
      table: "has spaces"
    });
    expect(out).toEqual({ kind: "UnknownError" });
  });

  it("uses a safe kind for an Error whose name is free text", () => {
    const err = new Error("x");
    err.name = `Custom ${EMAIL}`;
    expect(safeErrorFields(err)).toEqual({ kind: "Error" });
  });

  it("handles non-object throwables", () => {
    expect(safeErrorFields(`string ${EMAIL}`)).toEqual({ kind: "UnknownError" });
    expect(safeErrorFields(null)).toEqual({ kind: "UnknownError" });
    expect(safeErrorFields(undefined)).toEqual({ kind: "UnknownError" });
  });
});
