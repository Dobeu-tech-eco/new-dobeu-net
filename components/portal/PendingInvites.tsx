import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  acceptCompanyInviteForm,
  declineCompanyInviteForm,
} from "@/lib/actions/invites";
import { listPendingInvites, loadSessionMethods } from "@/lib/company-invites";
import { createClient } from "@/lib/supabase/server";

/**
 * "Pending company invites" for the signed-in user. Takes only the user id
 * from the cookie-bound session. A read failure renders a non-blocking notice
 * and never blocks the rest of the dashboard.
 */
export async function PendingInvites({ userId }: { userId: string }) {
  // Details are shown only once an email-link sign-in after the invite proves
  // the mailbox (D56); a lookup failure yields null, which withholds all.
  let methods = null;
  try {
    methods = await loadSessionMethods(await createClient());
  } catch {
    methods = null;
  }
  const { invites, withheld, error } = await listPendingInvites(userId, methods);

  if (error) {
    return (
      <p
        role="status"
        className="rounded-lg border border-accent/40 bg-accent/10 p-3 text-sm"
      >
        Couldn&apos;t check for company invites right now. Refresh to try again.
      </p>
    );
  }
  if (invites.length === 0 && withheld === 0) return null;

  const withheldNotice =
    withheld > 0 ? (
      <p
        role="status"
        className="rounded-lg border border-accent/40 bg-accent/10 p-3 text-sm"
      >
        You have {withheld} pending {withheld === 1 ? "invite" : "invites"}
        {invites.length > 0 ? " more" : ""}. Sign in with an emailed link to
        view {withheld === 1 ? "it" : "them"}.
      </p>
    ) : null;

  if (invites.length === 0) return withheldNotice;

  return (
    <section aria-labelledby="pending-invites-heading" className="space-y-3">
      <h2
        id="pending-invites-heading"
        className="font-display text-lg font-semibold"
      >
        Pending company invites
      </h2>
      <ul className="rounded-xl border border-border divide-y divide-border overflow-hidden">
        {invites.map((invite) => {
          const suspended = !invite.companyActive;
          return (
            <li
              key={invite.memberId}
              className="px-4 py-3.5 flex flex-wrap items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <p className="font-medium text-sm">{invite.companyName}</p>
                <p className="text-xs uppercase tracking-wider text-muted-foreground mt-0.5">
                  {invite.roleLabel}
                </p>
                {invite.isAdminRole && (
                  <p className="text-xs text-muted-foreground mt-1 max-w-md">
                    This is an admin role. After accepting, you&apos;ll need
                    two-factor verification;{" "}
                    <Link
                      href="/portal/settings/mfa"
                      className="text-primary hover:underline"
                    >
                      set it up in settings
                    </Link>
                    .
                  </p>
                )}
                {suspended && (
                  <p className="text-xs text-muted-foreground mt-1 max-w-md">
                    {invite.companyName} is suspended right now. You can decline
                    this invite, or accept it once the company is active again.
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                {!suspended && (
                  <form
                    action={acceptCompanyInviteForm.bind(null, invite.memberId)}
                  >
                    <Button
                      type="submit"
                      size="sm"
                      aria-label={`Accept invite to ${invite.companyName}`}
                    >
                      Accept
                    </Button>
                  </form>
                )}
                <form
                  action={declineCompanyInviteForm.bind(null, invite.memberId)}
                >
                  <Button
                    type="submit"
                    size="sm"
                    variant="outline"
                    aria-label={`Decline invite to ${invite.companyName}`}
                  >
                    Decline
                  </Button>
                </form>
              </div>
            </li>
          );
        })}
      </ul>
      {withheldNotice}
    </section>
  );
}
