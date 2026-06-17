/**
 * Minimal Resend SDK wrapper.
 *
 * `sendEmail()` is the single send path the work-order actions, invoice
 * notifications, and (eventually) the lead-capture flow all share, so any
 * future tweaks (default `from`, retries, observability) only need to land
 * here.
 *
 * Best-effort by design: a Resend outage / domain mis-configuration MUST
 * NOT break the upstream action. Every call site wraps in `try/catch` and
 * logs the failure.
 */
import { Resend } from "resend";

export interface SendEmailArgs {
  to: string | string[];
  subject: string;
  text?: string;
  html: string;
  /** Optional override; defaults to `RESEND_FROM_EMAIL` env (Dobeu sender). */
  from?: string;
  /** Optional override; defaults to `RESEND_REPLY_TO` env. */
  replyTo?: string;
  /** Optional Cc/Bcc — undefined keeps Resend behavior default. */
  cc?: string | string[];
  bcc?: string | string[];
}

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

const DEFAULT_FROM_EMAIL = "hello@dobeu.net";
const DEFAULT_REPLY_TO = "jeremyw@dobeu.net";
const DEFAULT_FROM_NAME = "Dobeu Tech Solutions";

let _client: Resend | null = null;
function getResend(): Resend {
  if (_client) return _client;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY missing");
  _client = new Resend(key);
  return _client;
}

/** Test-only: drop the cached SDK so each test gets a fresh constructor call. */
export function __resetResendForTests(): void {
  _client = null;
}

export async function sendEmail(args: SendEmailArgs): Promise<SendEmailResult> {
  if (!isResendConfigured()) {
    return { ok: false, error: "RESEND_API_KEY unset" };
  }
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? DEFAULT_FROM_EMAIL;
  const replyTo = args.replyTo ?? process.env.RESEND_REPLY_TO ?? DEFAULT_REPLY_TO;
  const from = args.from ?? `${DEFAULT_FROM_NAME} <${fromEmail}>`;

  try {
    const r = getResend();
    const { data, error } = await r.emails.send({
      from,
      to: Array.isArray(args.to) ? args.to : [args.to],
      subject: args.subject,
      html: args.html,
      text: args.text,
      replyTo,
      cc: args.cc,
      bcc: args.bcc
    });
    if (error) {
      console.error("[resend] send failed:", error.message ?? error);
      return { ok: false, error: error.message ?? "send failed" };
    }
    return { ok: true, id: data?.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[resend] send threw:", msg);
    return { ok: false, error: msg };
  }
}
