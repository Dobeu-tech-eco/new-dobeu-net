/**
 * Placeholder kept so `tsconfig.json`'s `include` pattern doesn't go cold
 * if other `.d.ts` shims land here later. The agent module (`lib/agent/`)
 * itself does its dynamic imports through `new Function('p','return import(p)')`
 * so it doesn't need ambient module declarations — Webpack never sees the
 * specifier and TypeScript treats the result as `any`.
 *
 * Once `pnpm add @composio/core @anthropic-ai/claude-agent-sdk` runs, the
 * packages bring their own types and this file can stay empty (or be deleted).
 */

export {};
