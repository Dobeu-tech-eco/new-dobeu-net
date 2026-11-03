/**
 * Log-safe error summaries for anything that reaches Datadog: the HTTP log
 * intake (lib/datadog-server.ts) AND stdout/stderr, which the Vercel log drain
 * also ships to Datadog.
 *
 * Postgres / PostgREST embed row values (emails, tokens) in `message`,
 * `details` and `hint`, and `stack` repeats the message. None of those may be
 * logged. This module returns only:
 *   - kind:       the error class name (`Error`, `PostgrestError`, ...)
 *   - code:       SQLSTATE / PostgREST code, validated as a short identifier
 *   - constraint: constraint identifier (own field, or parsed from the message)
 *   - table:      table identifier (own field, or parsed from the message)
 * The message is read only to pull out identifiers with an identifier-only
 * pattern, so no free text survives. One level of `cause` is inspected so a
 * fixed-message wrapper (`new Error("x failed", { cause: dbError })`) still
 * reports the DB code.
 *
 * Dependency-free and isomorphic on purpose (no `server-only`), so it is safe
 * to import from route handlers, server actions and their tests.
 */

export interface SafeErrorFields {
  kind: string;
  code?: string;
  constraint?: string;
  table?: string;
}

const CODE_RE = /^[A-Za-z0-9_]{1,16}$/;
const IDENT_RE = /^[A-Za-z0-9_]{1,63}$/;
const TABLE_RE = /^[A-Za-z0-9_.]{1,63}$/;
const CONSTRAINT_IN_MESSAGE = /constraint "([A-Za-z0-9_]{1,63})"/;
const TABLE_IN_MESSAGE = /(?:relation|table) "([A-Za-z0-9_.]{1,63})"/;

function kindOf(error: unknown): string {
  if (error instanceof Error) {
    return IDENT_RE.test(error.name) ? error.name : "Error";
  }
  return "UnknownError";
}

export function safeErrorFields(error: unknown): SafeErrorFields {
  const fields: SafeErrorFields = { kind: kindOf(error) };
  const sources = [error, error instanceof Error ? error.cause : undefined];

  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    const o = source as {
      code?: unknown;
      constraint?: unknown;
      table?: unknown;
      message?: unknown;
    };
    const text = typeof o.message === "string" ? o.message : "";

    if (!fields.code && typeof o.code === "string" && CODE_RE.test(o.code)) {
      fields.code = o.code;
    }

    const constraint =
      typeof o.constraint === "string" ? o.constraint : CONSTRAINT_IN_MESSAGE.exec(text)?.[1];
    if (!fields.constraint && constraint && IDENT_RE.test(constraint)) {
      fields.constraint = constraint;
    }

    const table = typeof o.table === "string" ? o.table : TABLE_IN_MESSAGE.exec(text)?.[1];
    if (!fields.table && table && TABLE_RE.test(table)) {
      fields.table = table;
    }
  }

  return fields;
}
