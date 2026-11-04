import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { safeErrorFields } from "@/lib/log-safe";

export interface SuspendedCompany {
  id: string;
  name: string;
}

/**
 * Companies the caller actively belongs to whose status is not 'active'.
 * One read: the caller's own active memberships joined to their companies
 * (`companies!inner`), keeping only non-active companies. Both sides stay
 * readable under RLS for a suspended company (own membership row, and
 * companies_select_member is membership-only). Never throws: any read error
 * yields [] and logs a log-safe summary only, so the portal layout is never
 * blocked.
 */
export async function listSuspendedCompanies(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<SuspendedCompany[]> {
  try {
    const { data, error } = await supabase
      .from("company_members")
      .select("companies!inner(id, name, status)")
      .eq("user_id", userId)
      .eq("status", "active")
      .neq("companies.status", "active");
    if (error) {
      console.error("company-status: read failed", safeErrorFields(error));
      return [];
    }
    return (data ?? []).map(({ companies }) => ({ id: companies.id, name: companies.name }));
  } catch (error) {
    console.error("company-status: read threw", safeErrorFields(error));
    return [];
  }
}
