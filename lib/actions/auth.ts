/**
 * Shared auth guards for server actions.
 *
 * Pattern (per CLAUDE.md Phase 2):
 *   - Client actions use `requireUser()` -> cookie-bound `createClient()` so
 *     RLS enforces ownership.
 *   - Admin actions use `requireAdmin()` -> checks ADMIN_EMAILS env, then
 *     returns the cookie-bound client (for the auth identity) AND a paired
 *     service-role `createAdminClient()` for the actual mutation (admin pages
 *     read/write through service role, not RLS).
 */
// This file is server-only by transitive import: `@/lib/supabase/server` pulls
// in `next/headers`, which Next refuses to bundle into client components.
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  isAdminEmail,
  requiresAal2Stepup,
  requiresMfaEnrollment,
} from "@/lib/utils";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type DBClient = SupabaseClient<Database>;

/**
 * Resolve the current authed user via the cookie-bound client.
 * Returns `{ user, supabase }`. Throws `AuthError` if no user.
 */
export async function requireUser(): Promise<{
  user: User;
  supabase: DBClient;
}> {
  const supabase = (await createClient()) as DBClient;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new AuthError("not_authenticated");
  }
  return { user, supabase };
}

/**
 * Resolve the current admin caller. Returns the user, the cookie-bound client
 * (RLS-respecting, used for identity/audit), AND a separate service-role
 * client for actual mutations (admin reads/writes bypass RLS by convention).
 */
export async function requireAdmin(): Promise<{
  user: User;
  supabase: DBClient;
  admin: DBClient;
}> {
  const { user, supabase } = await requireUser();
  if (!isAdminEmail(user.email)) {
    throw new AuthError("forbidden");
  }
  return { user, supabase, admin: createAdminClient() as DBClient };
}

/**
 * Resolve an admin caller whose current session has satisfied AAL2.
 *
 * Use this guard immediately before service-role access to sensitive admin
 * data. The admin client is created only after both the email allowlist and
 * MFA checks pass.
 */
export async function requireAdminAal2(): Promise<{
  user: User;
  supabase: DBClient;
  admin: DBClient;
}> {
  const { user, supabase } = await requireUser();
  if (!isAdminEmail(user.email)) {
    throw new AuthError("forbidden");
  }

  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const assurance = data ?? null;
  if (requiresMfaEnrollment(assurance, true) || requiresAal2Stepup(assurance)) {
    throw new AuthError("mfa_required");
  }

  return { user, supabase, admin: createAdminClient() as DBClient };
}

/**
 * Custom error used by server-action guards. Client-action call sites convert
 * these to `{ error }` return values; admin pages will surface them as 403/redirect.
 */
export class AuthError extends Error {
  readonly code: "not_authenticated" | "forbidden" | "mfa_required";
  constructor(code: "not_authenticated" | "forbidden" | "mfa_required") {
    super(code);
    this.code = code;
    this.name = "AuthError";
  }
}
