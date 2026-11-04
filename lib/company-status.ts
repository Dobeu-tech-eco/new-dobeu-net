import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { safeErrorFields } from "@/lib/log-safe";

export interface SuspendedCompany {
  id: string;
  name: string;
}

/**
 * Companies the caller actively belongs to whose status is not 'active'.
 * Two plain reads (own memberships, then companies) so each stays readable
 * under RLS for a suspended company. Never throws: any read error yields []
 * and logs a log-safe summary only, so the portal layout is never blocked.
 */
export async function listSuspendedCompanies(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<SuspendedCompany[]> {
  try {
    const memberships = await supabase
      .from("company_members")
      .select("company_id")
      .eq("user_id", userId)
      .eq("status", "active");
    if (memberships.error) {
      console.error("company-status: membership read failed", safeErrorFields(memberships.error));
      return [];
    }
    const ids = (memberships.data ?? []).map((m) => m.company_id);
    if (ids.length === 0) return [];

    const companies = await supabase.from("companies").select("id, name, status")
      .in("id", ids)
      .neq("status", "active");
    if (companies.error) {
      console.error("company-status: companies read failed", safeErrorFields(companies.error));
      return [];
    }
    return (companies.data ?? [])
      .filter((c) => c.status !== "active")
      .map((c) => ({ id: c.id, name: c.name }));
  } catch (error) {
    console.error("company-status: read threw", safeErrorFields(error));
    return [];
  }
}
