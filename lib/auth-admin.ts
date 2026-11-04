/**
 * Shared Supabase Auth admin helpers (service-role client only). Deliberately
 * not a "use server" module so nothing here is callable from the client.
 */
import type { createAdminClient } from "@/lib/supabase/server";

type AdminClient = ReturnType<typeof createAdminClient>;

/** Upper bound on listUsers pages scanned (200 users per page). */
export const LIST_USERS_MAX_PAGES = 20;

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
 * Find an existing auth user id by email. auth-js `listUsers` has no email
 * filter, so this pages through the admin list (bounded) and is a last resort:
 * call it only after createUser reported the email is already registered.
 * Returns null when no user matches, the list call fails, or the user sits
 * beyond the page cap.
 */
export async function findUserIdByEmail(
  admin: AdminClient,
  email: string,
): Promise<string | null> {
  const target = email.toLowerCase();
  const perPage = 200;
  for (let page = 1; page <= LIST_USERS_MAX_PAGES; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) return null;
    const users = data?.users ?? [];
    const match = users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (match) return match.id;
    if (users.length < perPage) break;
  }
  return null;
}
