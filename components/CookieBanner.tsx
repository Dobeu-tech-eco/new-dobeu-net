"use client";

import * as React from "react";
import Link from "next/link";
import { useCookieConsent, type ConsentState } from "@/hooks/use-cookie-consent";

/**
 * CookieBanner — GDPR/CCPA-compliant consent UI.
 *
 * Shows a compact banner on first visit. A "Manage preferences" panel
 * allows granular opt-in per category. Respects the DNT header automatically.
 *
 * A `window.openCookiePreferences()` global is exposed so the footer
 * "Cookie preferences" link can re-open the dialog at any time.
 */
export function CookieBanner() {
  const { consent, acceptAll, declineAll, savePreferences, isDNT } = useCookieConsent();
  const [showPrefs, setShowPrefs] = React.useState(false);
  const [draft, setDraft] = React.useState<Omit<ConsentState, "decided">>({
    analytics: false,
    support: false,
    marketing: false,
  });

  // Expose a global so the footer "Cookie preferences" link works.
  React.useEffect(() => {
    (window as Window & { openCookiePreferences?: () => void }).openCookiePreferences = () => {
      setDraft({ analytics: consent.analytics, support: consent.support, marketing: consent.marketing });
      setShowPrefs(true);
    };
    return () => {
      delete (window as Window & { openCookiePreferences?: () => void }).openCookiePreferences;
    };
  }, [consent]);

  // DNT: no banner, no cookies. Nothing to show.
  if (isDNT) return null;

  // Already decided and not in prefs mode.
  if (consent.decided && !showPrefs) return null;

  if (showPrefs) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-prefs-title"
        className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-background/70 backdrop-blur-sm p-4"
      >
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
          <h2 id="cookie-prefs-title" className="font-display text-lg font-extrabold mb-1">
            Cookie preferences
          </h2>
          <p className="text-sm text-muted-foreground mb-5">
            Choose which categories you allow. Strictly necessary cookies cannot be
            disabled &mdash; they are required for authentication, payments, and
            Vercel Skew Protection.{" "}
            <Link href="/cookies" className="underline hover:text-foreground">
              Cookie policy
            </Link>
          </p>

          <div className="space-y-4">
            {/* Strictly necessary — always on */}
            <CategoryRow
              label="Strictly necessary"
              description="Authentication, Stripe payments, Vercel deployment safety. Always active."
              checked={true}
              disabled
              onChange={() => {}}
            />

            {/* Analytics */}
            <CategoryRow
              label="Analytics"
              description="PostHog, Mixpanel, Google Analytics 4. Helps us improve the site. All data is aggregated."
              checked={draft.analytics}
              onChange={(v) => setDraft((d) => ({ ...d, analytics: v }))}
            />

            {/* Support / Chat */}
            <CategoryRow
              label="Support & chat"
              description="Intercom live chat. Allows you to message us directly from the site."
              checked={draft.support}
              onChange={(v) => setDraft((d) => ({ ...d, support: v }))}
            />

            {/* Marketing */}
            <CategoryRow
              label="Marketing communications"
              description="Customer.io email sequences. Enables follow-up emails if you submit a lead form."
              checked={draft.marketing}
              onChange={(v) => setDraft((d) => ({ ...d, marketing: v }))}
            />
          </div>

          <div className="flex gap-2 mt-6 flex-wrap">
            <button
              className="flex-1 rounded-lg bg-primary text-primary-foreground text-sm font-semibold py-2 px-4 hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onClick={() => { savePreferences(draft); setShowPrefs(false); }}
            >
              Save preferences
            </button>
            <button
              className="rounded-lg border border-border text-sm font-semibold py-2 px-4 hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onClick={() => { acceptAll(); setShowPrefs(false); }}
            >
              Accept all
            </button>
            <button
              className="rounded-lg border border-border text-sm font-semibold py-2 px-4 hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onClick={() => { declineAll(); setShowPrefs(false); }}
            >
              Decline all
            </button>
          </div>
        </div>
      </div>
    );
  }

  // First-visit banner
  return (
    <div
      role="dialog"
      aria-labelledby="cookie-banner-title"
      aria-describedby="cookie-banner-desc"
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-50 rounded-xl border border-border bg-card p-4 shadow-2xl"
    >
      <p id="cookie-banner-title" className="font-semibold text-sm mb-1">
        We use cookies
      </p>
      <p id="cookie-banner-desc" className="text-xs text-muted-foreground mb-3">
        Analytics, chat, and marketing cookies only fire after you opt in. See our{" "}
        <Link href="/cookies" className="underline hover:text-foreground">
          Cookie policy
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline hover:text-foreground">
          Privacy policy
        </Link>
        .
      </p>
      <div className="flex gap-2 flex-wrap">
        <button
          className="rounded-md bg-primary text-primary-foreground text-xs font-semibold py-1.5 px-3 hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          onClick={acceptAll}
        >
          Accept all
        </button>
        <button
          className="rounded-md border border-border text-xs font-semibold py-1.5 px-3 hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          onClick={declineAll}
        >
          Decline
        </button>
        <button
          className="rounded-md border border-border text-xs font-semibold py-1.5 px-3 hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          onClick={() => {
            setDraft({ analytics: false, support: false, marketing: false });
            setShowPrefs(true);
          }}
        >
          Manage
        </button>
      </div>
    </div>
  );
}

function CategoryRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = React.useId();
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 shrink-0">
        <input
          id={id}
          type="checkbox"
          className="h-4 w-4 rounded border-border accent-primary cursor-pointer disabled:cursor-not-allowed"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          aria-describedby={`${id}-desc`}
        />
      </div>
      <div>
        <label htmlFor={id} className="text-sm font-semibold cursor-pointer">
          <span>{label}</span>
          {disabled && (
            <span className="ml-2 text-xs font-normal text-muted-foreground">Always on</span>
          )}
        </label>
        <p id={`${id}-desc`} className="text-xs text-muted-foreground mt-0.5">
          {description}
        </p>
      </div>
    </div>
  );
}
