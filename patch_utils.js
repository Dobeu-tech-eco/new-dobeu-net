const fs = require('fs');
const content = fs.readFileSync('lib/utils.ts', 'utf8');
const search = `/** Assurance-level shape returned by \`supabase.auth.mfa.getAuthenticatorAssuranceLevel()\`. */
export type AssuranceLevel = { currentLevel: string | null; nextLevel: string | null } | null;`;
const replace = `/**
 * Safely stringifies JSON for use inside HTML script tags.
 * Replaces < and > to prevent XSS vulnerabilities when injecting JSON-LD.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function safeJsonLdStringify(data: any): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e');
}

/** Assurance-level shape returned by \`supabase.auth.mfa.getAuthenticatorAssuranceLevel()\`. */
export type AssuranceLevel = { currentLevel: string | null; nextLevel: string | null } | null;`;

if (content.includes(search)) {
  fs.writeFileSync('lib/utils.ts', content.replace(search, replace));
  console.log("Success");
} else {
  console.log("Search block not found");
}
