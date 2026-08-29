import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/server";
import { estimatesTable } from "@/lib/pricing/estimate-store";
import { formatCurrency } from "@/lib/utils";

// Reads per-request from the service-role client; must never be pre-rendered.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your project estimate",
  // A capability URL. Keep it out of search results and referrer headers.
  robots: { index: false, follow: false, nocache: true }
};

interface LineItem {
  key: string;
  label: string;
  discipline: string;
  hours: number;
  amount: number;
}

interface Factor {
  key: string;
  label: string;
  factor: number;
}

interface EstimateRow {
  token: string;
  name: string | null;
  company: string | null;
  track: string;
  amount_low: number;
  amount_mid: number;
  amount_high: number;
  total_hours: number;
  confidence: string;
  rate_card_version: string;
  created_at: string;
  breakdown: {
    lineItems?: LineItem[];
    multipliers?: Factor[];
    uplifts?: Factor[];
    monthlyRetainer?: { low: number; high: number } | null;
  } | null;
}

/** Dollars -> the cents `formatCurrency` expects. */
function usd(dollars: number): string {
  return formatCurrency(Math.round(dollars) * 100);
}

const CONFIDENCE_COPY: Record<string, string> = {
  firm: "Your answers were specific, so this range is tight.",
  indicative:
    "A few answers were still open, so this range is wider than it would be after a scoping call.",
  rough:
    "Several answers were still to be determined, so treat this as a planning range rather than a quote."
};

const TOKEN_PATTERN = /^[a-f0-9]{32}$/;

async function loadEstimate(token: string): Promise<EstimateRow | null> {
  if (!TOKEN_PATTERN.test(token)) return null;
  try {
    const { data, error } = await estimatesTable(createAdminClient())
      .select(
        "token, name, company, track, amount_low, amount_mid, amount_high, total_hours, confidence, rate_card_version, created_at, breakdown"
      )
      .eq("token", token)
      .maybeSingle();
    if (error) {
      console.error("[estimate page] load failed:", error.message ?? error);
      return null;
    }
    return (data as EstimateRow | null) ?? null;
  } catch (e) {
    console.error("[estimate page] load threw", e);
    return null;
  }
}

export default async function EstimateDetailPage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const estimate = await loadEstimate(token);
  if (!estimate) notFound();

  const lineItems = estimate.breakdown?.lineItems ?? [];
  const multipliers = estimate.breakdown?.multipliers ?? [];
  const retainer = estimate.breakdown?.monthlyRetainer ?? null;
  const who = estimate.company?.trim() || estimate.name?.trim() || null;
  const confidenceNote = CONFIDENCE_COPY[estimate.confidence] ?? CONFIDENCE_COPY["indicative"]!;
  const dated = new Date(estimate.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6 lg:py-16">
      <header className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Preliminary estimate{who ? ` · ${who}` : ""}
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {usd(estimate.amount_low)} – {usd(estimate.amount_high)}
        </h1>
        <p className="text-sm text-muted-foreground">
          {estimate.confidence} range · approx. {estimate.total_hours} hours · prepared {dated}
        </p>
      </header>

      <p className="mt-6 max-w-2xl text-sm">{confidenceNote}</p>

      {retainer ? (
        <p className="mt-3 max-w-2xl text-sm">
          Ongoing support would run{" "}
          <strong>
            {usd(retainer.low)} – {usd(retainer.high)} per month
          </strong>{" "}
          on top of the build.
        </p>
      ) : null}

      <section className="mt-10">
        <h2 className="text-lg font-semibold">What the range is built from</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Each line is an hours estimate priced at the rate for that discipline.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[32rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Work
                </th>
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Discipline
                </th>
                <th scope="col" className="py-2 pr-4 text-right font-semibold">
                  Hours
                </th>
                <th scope="col" className="py-2 text-right font-semibold">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((entry) => (
                <tr key={entry.key} className="border-b border-border/60">
                  <td className="py-2 pr-4">{entry.label}</td>
                  <td className="py-2 pr-4 capitalize text-muted-foreground">{entry.discipline}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{entry.hours}</td>
                  <td className="py-2 text-right tabular-nums">{usd(entry.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {multipliers.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Adjustments applied</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {multipliers.map((factor) => (
              <li key={factor.key} className="flex justify-between gap-4 border-b border-border/60 py-2">
                <span>{factor.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  ×{factor.factor.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Project management and quality assurance are included in every estimate and are
            already reflected in the total.
          </p>
        </section>
      ) : null}

      <section className="mt-10 rounded-lg border border-border bg-muted/30 p-5">
        <h2 className="text-sm font-semibold">This is a planning estimate, not a proposal</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          It is generated from the answers you gave, priced against rate card{" "}
          <span className="font-mono">{estimate.rate_card_version}</span>. Final scope, fixed
          price, contract terms, and any deposit are confirmed only after review and your
          explicit written acceptance.
        </p>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild>
          <a href="mailto:jeremyw@dobeu.net?subject=About%20my%20estimate">Reply with questions</a>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Back to dobeu.net</Link>
        </Button>
      </div>
    </main>
  );
}
