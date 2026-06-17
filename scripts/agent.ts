/**
 * Standalone Claude Agents SDK + Composio Tool Router worker.
 *
 * Use for heavier or long-running automations invoked out of band (cron,
 * queue, manual). Serverless time limits make the /api/agent route a poor
 * fit for multi-minute jobs — run those here instead.
 *
 * Usage:
 *   pnpm tsx scripts/agent.ts "<prompt>"
 *   pnpm tsx scripts/agent.ts "Star composiohq/composio on GitHub"
 *
 * Requires: COMPOSIO_API_KEY, ANTHROPIC_API_KEY in the environment, and
 * `pnpm add @composio/core @anthropic-ai/claude-agent-sdk` to have been run.
 */
import { runAgent } from "@/lib/agent";

async function main() {
  const prompt = process.argv.slice(2).join(" ").trim();
  if (!prompt) {
    console.error('usage: pnpm tsx scripts/agent.ts "<prompt>"');
    process.exit(2);
  }
  const userId = process.env.AGENT_USER_ID ?? "dobeu-ops";
  const res = await runAgent({ userId, prompt });
  if (!res.ok) {
    console.error(`[agent] ${res.error}`);
    process.exit(1);
  }
  process.stdout.write(res.result);
  process.stdout.write("\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
