import type { User } from "@supabase/supabase-js";
import type { createAdminClient } from "@/lib/supabase/server";

export const USERS_PER_PAGE = 200;
export const USERS_MAX_PAGES = 50;

export type AdminUserListResult = {
  users: User[];
  failed: boolean;
  truncated: boolean;
};

type AdminAuthClient = Pick<ReturnType<typeof createAdminClient>, "auth">;

/**
 * Pages through every auth user (200 per page, hard cap of 50 pages).
 * Any error result or thrown exception returns `failed: true` with no users.
 * Server-side only: callers pass the service-role admin client.
 */
export async function listAllUsers(
  admin: AdminAuthClient,
): Promise<AdminUserListResult> {
  const users: User[] = [];
  try {
    for (let page = 1; page <= USERS_MAX_PAGES; page++) {
      const { data, error } = await admin.auth.admin.listUsers({
        page,
        perPage: USERS_PER_PAGE,
      });
      if (error) return { users: [], failed: true, truncated: false };
      const batch = data?.users ?? [];
      users.push(...batch);
      if (batch.length < USERS_PER_PAGE) {
        return { users, failed: false, truncated: false };
      }
    }
  } catch {
    console.warn("[admin-user-list] auth.admin.listUsers failed");
    return { users: [], failed: true, truncated: false };
  }
  return { users, failed: false, truncated: true };
}
