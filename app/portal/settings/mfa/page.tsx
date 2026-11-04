import { MfaStepUp } from "@/components/portal/MfaStepUp";
import { sanitizeNextPath } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * AAL2 step-up. Middleware and the company layout redirect an admin here when they have a TOTP
 * factor enrolled but the current session is still AAL1. Code-only — no
 * re-enroll. The `next` query param is the originally-requested path (sanitized to same-origin).
 */
export default async function MfaStepUpPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  // Fallback is /portal (not /admin): company admins land here too, and /portal
  // is the always-reachable, non-MFA-gated surface.
  return (
    <div className="mx-auto max-w-md py-12 space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight">Confirm your identity</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Enter the 6-digit code from your authenticator app to continue.
        </p>
      </header>
      <MfaStepUp next={sanitizeNextPath(next, "/portal")} />
    </div>
  );
}
