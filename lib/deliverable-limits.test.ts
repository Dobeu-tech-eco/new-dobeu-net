import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { tooLargeMessage, MAX_DELIVERABLE_BYTES, ALLOWED_DELIVERABLE_MIME, EXTENSION_MIME, filenameError } from "@/lib/deliverable-limits";

describe("deliverable-limits", () => {
  it("formats the over-cap message with one decimal", () => {
    expect(tooLargeMessage(26 * 1024 * 1024)).toBe(
      "File too large: 26.0 MB. Deliverables are capped at 25 MB."
    );
    expect(tooLargeMessage(27262976)).toBe("File too large: 26.0 MB. Deliverables are capped at 25 MB.");
  });

  it("caps at 26214400 bytes and excludes svg", () => {
    expect(MAX_DELIVERABLE_BYTES).toBe(26214400);
    expect((ALLOWED_DELIVERABLE_MIME as readonly string[]).includes("image/svg+xml")).toBe(false);
  });

  it("MIME list equals the migration SQL allowed_mime_types array", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/20261022000200_storage_deliverable_size_limit.sql"),
      "utf8"
    );
    const m = sql.match(/allowed_mime_types\s*=\s*array\[([\s\S]*?)\]/i);
    expect(m).not.toBeNull();
    const sqlList = [...(m as RegExpMatchArray)[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    expect([...sqlList].sort()).toEqual([...ALLOWED_DELIVERABLE_MIME].sort());
    expect(sql).toContain(`file_size_limit = ${MAX_DELIVERABLE_BYTES}`);
    expect(sql).toMatch(/raise exception/i);
  });

  it("every extension maps into the MIME allowlist", () => {
    for (const mime of Object.values(EXTENSION_MIME)) {
      expect((ALLOWED_DELIVERABLE_MIME as readonly string[]).includes(mime)).toBe(true);
    }
  });

  it("filenameError accepts good names and rejects bad ones", () => {
    expect(filenameError("Report v1_final-2.pdf", "application/pdf")).toBeNull();
    for (const bad of ["a.svg", "a.html", "a.docm", "%2e%2e.pdf", 'a"b.pdf', "a\r\nb.pdf", ".x.pdf", "a/b.pdf", "a..b.pdf", "noext"]) {
      expect(filenameError(bad)).not.toBeNull();
    }
    expect(filenameError("a.pdf", "image/png")).not.toBeNull();
  });
});
