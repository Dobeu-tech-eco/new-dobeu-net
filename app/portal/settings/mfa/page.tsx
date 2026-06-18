import { MfaStepUp } from "@/components/portal/MfaStepUp";

export const dynamic = "force-dynamic";

/**
 * AAL2 step-up. Middleware redirects an admin here when they have a TOTP
 * factor enrolled but the current session is still AAL1. Code-only — no
 * re-enroll. The `next` query param is the originally-requested admin path.
 */
export default async function MfaStepUpPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <div className="mx-auto max-w-md py-12 space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight">Confirm your identity</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Enter the 6-digit code from your authenticator app to access the admin area.
        </p>
      </header>
      <MfaStepUp next={next ?? "/admin"} />
    </div>
  );
}
