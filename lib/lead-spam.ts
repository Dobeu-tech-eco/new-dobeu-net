/**
 * Pure heuristics for dropping obvious bot submissions to /api/lead.
 * No I/O: callers pass in the clock and request facts.
 */

export type LeadSpamReason = "honeypot" | "missing_signal" | "too_fast" | "origin" | "gibberish";

export interface AssessLeadInput {
  /** Honeypot field (`hp_ref`); real users never see or fill it. */
  honeypot?: string | null;
  /** Client-measured ms since the form mounted (clock-skew independent). */
  elapsedMs?: number | null;
  /** Request Origin header (null when absent). */
  origin: string | null;
  allowedOrigins: ReadonlySet<string>;
  message?: string | null;
}

export interface LeadAssessment {
  spam: boolean;
  reason?: LeadSpamReason;
}

const MIN_FILL_MS = 1500;

export function buildAllowedOrigins(env: NodeJS.ProcessEnv = process.env): Set<string> {
  const set = new Set<string>(["https://dobeu.net", "https://www.dobeu.net"]);
  if (env.NEXT_PUBLIC_SITE_URL) {
    try {
      set.add(new URL(env.NEXT_PUBLIC_SITE_URL).origin);
    } catch {
      /* ignore malformed env */
    }
  }
  if (env.VERCEL_URL) set.add(`https://${env.VERCEL_URL}`);
  if (env.VERCEL_BRANCH_URL) set.add(`https://${env.VERCEL_BRANCH_URL}`);
  if (env.NODE_ENV !== "production") {
    set.add("http://localhost:3000");
    set.add("http://127.0.0.1:3000");
  }
  return set;
}

/**
 * Random mixed-case single token, e.g. "IwRRUNZxkePMWRwvjkC": letters only,
 * no whitespace, 12+ chars, 3+ non-leading capitals including an adjacent
 * capital pair. Ordinary camelCase words do not contain adjacent capitals.
 */
export function looksLikeGibberish(message: string): boolean {
  const m = message.trim();
  if (m.length < 12 || /\s/.test(m) || !/^[A-Za-z]+$/.test(m)) return false;
  if (!/[a-z]/.test(m)) return false;
  const tail = m.slice(1);
  const upper = tail.match(/[A-Z]/g)?.length ?? 0;
  return upper >= 3 && /[A-Z]{2}/.test(tail);
}

export function assessLead(input: AssessLeadInput): LeadAssessment {
  if (input.honeypot && input.honeypot.trim().length > 0) return { spam: true, reason: "honeypot" };

  if (typeof input.elapsedMs !== "number") return { spam: true, reason: "missing_signal" };
  if (input.elapsedMs < MIN_FILL_MS) return { spam: true, reason: "too_fast" };

  if (!input.origin || !input.allowedOrigins.has(input.origin)) {
    return { spam: true, reason: "origin" };
  }

  if (input.message && looksLikeGibberish(input.message)) {
    return { spam: true, reason: "gibberish" };
  }
  return { spam: false };
}
