/**
 * Shared Supabase Auth admin helpers (service-role client only). Deliberately
 * not a "use server" module so nothing here is callable from the client.
 */
import type { createAdminClient } from "@/lib/supabase/server";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Detect Supabase's "already registered" signal from a createUser error, across
 * the shapes it has shipped (message text, `email_exists` code). A bare 422 is
 * NOT enough: it also covers validation failures such as a weak password.
 */
export function isAlreadyRegistered(error: {
  message?: string;
  code?: string;
  status?: number;
}): boolean {
  const msg = (error.message ?? "").toLowerCase();
  return (
    msg.includes("already registered") ||
    msg.includes("already been registered") ||
    error.code === "email_exists"
  );
}

/**
 * Find an existing auth user id by email via the service-role-only SQL function
 * `public.find_auth_user_id_by_email` (direct auth.users lookup, no paging cap).
 * Call it only after createUser reported the email is already registered.
 * Fails closed: returns null when no user matches, the rpc errors or is
 * missing, or it throws.
 */
export async function findUserIdByEmail(
  admin: AdminClient,
  email: string,
): Promise<string | null> {
  try {
    const { data, error } = await admin.rpc("find_auth_user_id_by_email", {
      p_email: email.trim().toLowerCase(),
    });
    if (error || typeof data !== "string" || data.length === 0) return null;
    return data;
  } catch {
    return null;
  }
}
