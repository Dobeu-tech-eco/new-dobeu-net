const fs = require('fs');
let code = fs.readFileSync('lib/apollo.ts', 'utf8');
const searchPatch = `async function patchApolloContact(contactId: string, payload: Record<string, unknown>): Promise<void> {
  const candidates = [\`/contacts/\${contactId}\`, \`/contacts/\${contactId}/update\`];
  for (const endpoint of candidates) {
    try {
      const res = await apolloRequest(endpoint, "PATCH", payload);
      if (res.ok) return;
    } catch {
      // keep trying
    }
  }
}`;
const replacePatch = `async function patchApolloContact(contactId: string, payload: Record<string, unknown>): Promise<void> {
  const candidates = [\`/contacts/\${contactId}\`, \`/contacts/\${contactId}/update\`];
  try {
    await Promise.any(
      candidates.map(async (endpoint) => {
        const res = await apolloRequest(endpoint, "PATCH", payload);
        if (!res.ok) throw new Error("Not OK");
        return true;
      })
    );
  } catch {
    // all failed, ignore
  }
}`;
fs.writeFileSync('lib/apollo.ts', code.replace(searchPatch, replacePatch));
