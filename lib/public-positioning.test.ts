import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Same pattern as e2e/business-positioning.spec.ts (not exported there).
const retiredPositioning =
  /\b(?:AI|agents?|consulting|consultancy|consultants?)\b|artificial intelligence/gi;

function read(relativePath: string): string {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function matches(text: string): string[] {
  return text.match(retiredPositioning) ?? [];
}

/**
 * OG image source with block and line comments stripped. The regex then runs
 * over all remaining code (string literals of any quote style, template
 * literals, JSX text beside expressions), so no rendered form can be missed.
 * Only comments are excluded.
 */
function ogCode(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("public positioning copy", () => {
  it("public/llms.txt avoids retired positioning terms", () => {
    const text = read("public/llms.txt");
    expect(text).toContain("usable business technology");
    expect(matches(text)).toEqual([]);
  });

  it("OG image source avoids retired positioning terms", () => {
    const code = ogCode(read("app/opengraph-image.tsx"));
    // Guard against a vacuous pass if the file is empty or moved.
    expect(code).toContain("business technology");
    expect(code).toContain("Dobeu Tech Solutions");
    expect(matches(code)).toEqual([]);
  });

  it.each([
    ["double-quoted string", 'export const alt = "We are AI consultants";'],
    ["single-quoted string", "const label = 'Agent workflows';"],
    ["template literal", "const t = `Our ${x} consulting team`;"],
    ["JSX text beside an expression", '<span>We build {" "}AI tools</span>'],
  ])("the matcher flags a retired term in a %s", (_name, snippet) => {
    expect(matches(ogCode(snippet)).length).toBeGreaterThan(0);
  });
});
