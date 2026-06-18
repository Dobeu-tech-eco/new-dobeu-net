/**
 * Embedded Claude Agents SDK + Composio Tool Router.
 *
 * The landing markets "Claude + Composio + MCP integrations" as a core
 * Dobeu service — this module makes that real inside the app. It opens a
 * per-user Composio tool-router session (Stripe, Vercel, Calendly, Apollo,
 * Customer.io, GitHub, and 500+ more) and runs the Agent SDK's `query()`
 * against it.
 *
 * Graceful degradation, matching the rest of the codebase:
 *  - If COMPOSIO_API_KEY or ANTHROPIC_API_KEY is unset, runAgent() returns
 *    { ok: false, error: "not_configured" } without throwing.
 *  - If the SDK packages aren't installed yet, the dynamic imports fail
 *    cleanly with { ok: false, error: "sdk_not_installed" } so the rest of
 *    the app keeps building.
 *
 * Security:
 *  - Server-only. Never import from a Client Component.
 *  - The HTTP surface (app/api/agent/route.ts) is admin-gated via isAdminEmail.
 *  - `permissionMode` defaults to "default" (SDK enforces approvals). The
 *    `mode` parameter lets trusted, non-interactive callers (cron, batch
 *    scripts) opt into "bypassPermissions" — never accept that value
 *    from an end-user request body.
 *  - Treat all tool output as untrusted external content.
 */

/**
 * Agent permission mode. The safe default is to let the SDK enforce its
 * normal approval flow — callers must opt into `bypassPermissions` for
 * automation use cases (e.g. cron jobs in scripts/agent.ts) where there is
 * no human in the loop. Never accept this value from an end-user request.
 */
export type AgentPermissionMode = "default" | "acceptEdits" | "plan" | "bypassPermissions";

export interface AgentRunInput {
  /** A short stable identifier for the calling user — scopes the Composio session. */
  userId: string;
  /** The natural-language task to run. */
  prompt: string;
  /** Optional system prompt override. */
  systemPrompt?: string;
  /**
   * Permission mode. Defaults to `"default"` (SDK enforces approvals).
   * Pass `"bypassPermissions"` only from trusted, non-interactive contexts.
   */
  mode?: AgentPermissionMode;
}

export type AgentRunResult =
  | { ok: true; result: string; trace: AgentTraceEntry[] }
  | { ok: false; error: AgentError };

export type AgentError =
  | "not_configured"
  | "sdk_not_installed"
  | "session_create_failed"
  | "query_failed";

export interface AgentTraceEntry {
  type: string;
  subtype?: string;
}

export function isAgentConfigured(): boolean {
  return Boolean(process.env.COMPOSIO_API_KEY && process.env.ANTHROPIC_API_KEY);
}

export async function runAgent(input: AgentRunInput): Promise<AgentRunResult> {
  if (!isAgentConfigured()) return { ok: false, error: "not_configured" };

  // Bundler-opaque dynamic import: hides the module specifier from Webpack
  // so `next build` doesn't fail with "Module not found" before the SDKs are
  // installed. Once `pnpm add @composio/core @anthropic-ai/claude-agent-sdk`
  // runs, this resolves at runtime exactly like a normal `import()`.
  const dynamicImport = new Function("p", "return import(p)") as <T>(p: string) => Promise<T>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let Composio: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any;
  try {
    ({ Composio } = await dynamicImport<{ Composio: unknown }>("@composio/core"));
    ({ query } = await dynamicImport<{ query: unknown }>("@anthropic-ai/claude-agent-sdk"));
  } catch (e) {
    console.warn("[agent] SDKs not installed:", e instanceof Error ? e.message : e);
    return { ok: false, error: "sdk_not_installed" };
  }

  // Per-user tool-router session. Composio scopes which integrations the
  // agent can actually call to those the user has connected.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let session: any;
  try {
    const composio = new Composio();
    session = await composio.create(input.userId);
  } catch (e) {
    console.error("[agent] session create failed:", e);
    return { ok: false, error: "session_create_failed" };
  }

  try {
    const stream = await query({
      prompt: input.prompt,
      ...(input.systemPrompt ? { systemPrompt: input.systemPrompt } : {}),
      options: {
        permissionMode: input.mode ?? "default",
        mcpServers: {
          composio: session.mcp
        }
      }
    });

    let result = "";
    const trace: AgentTraceEntry[] = [];
    for await (const event of stream) {
      trace.push({ type: event.type, subtype: event.subtype });
      if (event.type === "result" && event.subtype === "success") {
        result += event.result;
      }
    }
    return { ok: true, result, trace };
  } catch (e) {
    console.error("[agent] query failed:", e);
    return { ok: false, error: "query_failed" };
  }
}
