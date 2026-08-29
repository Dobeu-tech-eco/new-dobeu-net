"use client";

import dynamic from "next/dynamic";

/**
 * Client boundary for the estimate intake embed.
 *
 * `@typeform/embed-react` is browser-only, so it must load with `ssr: false` —
 * and `ssr: false` is rejected inside a Server Component. This thin wrapper is
 * the client boundary that makes that legal, matching the pattern already used
 * by `components/landing/LightboxProvider.tsx`.
 */
const EstimateIntake = dynamic(
  () => import("./EstimateIntake").then((m) => m.EstimateIntake),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[min(78vh,820px)] items-center justify-center rounded-xl border border-border">
        <p className="text-sm text-muted-foreground">Loading the form…</p>
      </div>
    )
  }
);

export function EstimateIntakeClient() {
  return <EstimateIntake />;
}
