import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/utils";
import { runAgent } from "@/lib/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Agent calls can chain multiple tool invocations — raise from the default 10s.
export const maxDuration = 60;

const AgentRequestSchema = z.object({
  prompt: z.string().min(1).max(8000),
  systemPrompt: z.string().max(8000).optional()
});

/**
 * Admin-only entry point to the embedded Claude Agents SDK + Composio
 * Tool Router. Useful for on-demand ops: triage a lead, draft a follow-up,
 * create a Stripe customer/invoice, file a GitHub/Linear task, validate
 * Vercel env or a deployment status, etc.
 *
 * Heavier / long-running automations should run as `scripts/agent.ts` out
 * of band, since serverless has time limits even with maxDuration raised.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = AgentRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const result = await runAgent({
    userId: user.id,
    prompt: parsed.data.prompt,
    ...(parsed.data.systemPrompt ? { systemPrompt: parsed.data.systemPrompt } : {})
  });

  if (!result.ok) {
    const status = result.error === "not_configured" || result.error === "sdk_not_installed" ? 503 : 500;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }
  return NextResponse.json({ ok: true, result: result.result, trace: result.trace });
}
