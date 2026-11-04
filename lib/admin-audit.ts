import type { DBClient } from "@/lib/actions/auth";
import type { Json } from "@/lib/database.types";
import { safeErrorFields } from "@/lib/log-safe";

/** Best-effort audit writes never undo the primary action's success. */
export async function writeAdminAudit(
  admin: DBClient,
  entry: {
    actorUserId: string | null;
    action: string;
    targetType: "company" | "work_order" | "invoice" | "project" | "user";
    targetId: string | null;
    data: Json;
    logScope: string;
  },
): Promise<void> {
  try {
    const { error } = await admin.from("admin_audit_log").insert({
      actor_user_id: entry.actorUserId,
      action: entry.action,
      target_type: entry.targetType,
      target_id: entry.targetId,
      data: entry.data,
    });
    if (error) throw error;
  } catch (error) {
    console.warn(
      `[${entry.logScope}] audit log insert failed (non-fatal):`,
      safeErrorFields(error).code,
    );
  }
}
