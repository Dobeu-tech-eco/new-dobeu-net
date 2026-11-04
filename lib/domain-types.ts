/**
 * Domain unions that `lib/database.types.ts` (generated) cannot express.
 *
 * Postgres enums (`work_order_*`) are derived from the generated `Enums` so
 * they can never drift. Columns guarded only by CHECK constraints are emitted
 * as plain `string` by `supabase gen types`, so their unions are hand-written
 * here and must match the migrations:
 *   - company_members.status       -> 20260717120000_multi_tenant_companies.sql
 *   - typeform_budget_intakes.status / mapping_status
 *                                  -> 20260829010000_typeform_budget_intakes.sql
 */
import { Constants } from "@/lib/database.types";
import type { Database } from "@/lib/database.types";

type PublicEnums = Database["public"]["Enums"];

export type WorkOrderStatus = PublicEnums["work_order_status"];
export type WorkOrderServiceType = PublicEnums["work_order_service_type"];

export const COMPANY_MEMBER_STATUSES = ["invited", "active", "disabled"] as const;
export type CompanyMemberStatus = (typeof COMPANY_MEMBER_STATUSES)[number];

export const INTAKE_STATUSES = ["new", "reviewed", "archived"] as const;
export type IntakeStatus = (typeof INTAKE_STATUSES)[number];

export const INTAKE_MAPPING_STATUSES = ["mapped", "needs_review"] as const;
export type IntakeMappingStatus = (typeof INTAKE_MAPPING_STATUSES)[number];

function includes<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

export function isWorkOrderStatus(value: unknown): value is WorkOrderStatus {
  return includes(Constants.public.Enums.work_order_status, value);
}

export function isWorkOrderServiceType(
  value: unknown,
): value is WorkOrderServiceType {
  return includes(Constants.public.Enums.work_order_service_type, value);
}

export function isCompanyMemberStatus(
  value: unknown,
): value is CompanyMemberStatus {
  return includes(COMPANY_MEMBER_STATUSES, value);
}

export function isIntakeStatus(value: unknown): value is IntakeStatus {
  return includes(INTAKE_STATUSES, value);
}

export function isIntakeMappingStatus(
  value: unknown,
): value is IntakeMappingStatus {
  return includes(INTAKE_MAPPING_STATUSES, value);
}
