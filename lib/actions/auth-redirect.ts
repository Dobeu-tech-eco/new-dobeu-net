import { buildServerAuthCallbackUrl } from "@/lib/utils";

/**
 * URL utility used by guarded invite actions; not a callable server action.
 * Delegates to the shared helper so `next` is always sanitized.
 */
export function inviteRedirect(next: string): string {
  return buildServerAuthCallbackUrl(next);
}
