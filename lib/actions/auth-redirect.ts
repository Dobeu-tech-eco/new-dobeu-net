import { getSiteUrl } from "@/lib/utils";

/** URL utility used by guarded invite actions; not a callable server action. */
export function inviteRedirect(next: string): string {
  return `${getSiteUrl()}/auth/callback?next=${encodeURIComponent(next)}`;
}
