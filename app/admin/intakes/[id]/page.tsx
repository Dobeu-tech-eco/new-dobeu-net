/** Admin detail and review surface for one Typeform budget intake. */
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { requireAdminAal2 } from "@/lib/actions/auth";
import type { Json } from "@/lib/database.types";
import { IntakeReviewActions } from "./IntakeReviewActions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

function statusTone(status: string): "amber" | "indigo" | "neutral" {
  if (status === "new") return "amber";
  if (status === "reviewed") return "indigo";
  return "neutral";
}

function formatWhen(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "—";
}

function displayValue(value: string | null): string {
  return value?.trim() || "—";
}

function warningText(value: Json | undefined): string {
  if (value === null || value === undefined) return "Unknown mapping warning";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return JSON.stringify(value);
}

function mappingWarnings(value: Json): string[] {
  if (Array.isArray(value)) return value.map(warningText);
  if (value && typeof value === "object") {
    return Object.entries(value).map(
      ([key, detail]) => `${key}: ${warningText(detail)}`,
    );
  }
  if (value === null) return [];
  return [warningText(value)];
}

export default async function AdminIntakeDetailPage({ params }: PageProps) {
  const { id } = await params;
  const parsedId = z.string().uuid().safeParse(id);
  if (!parsedId.success) notFound();

  const { admin } = await requireAdminAal2();
  const { data: intake, error } = await admin
    .from("typeform_budget_intakes")
    .select("*")
    .eq("id", parsedId.data)
    .single();

  if (error) {
    if (error.code === "PGRST116") notFound();
    console.error("[intakes] failed to load intake detail:", error.message);
    throw new Error("Failed to load intake");
  }
  if (!intake) notFound();

  const warnings = mappingWarnings(intake.mapping_warnings);

  return (
    <div className="space-y-6">
      <nav className="text-sm text-muted-foreground">
        <Link
          href="/admin/intakes"
          className="rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          ← All intakes
        </Link>
      </nav>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-bold tracking-tight">
            {intake.name ?? intake.email ?? "Budget intake"}
          </h1>
          <Badge
            tone={statusTone(intake.status)}
            aria-label={`Status: ${intake.status}`}
          >
            {intake.status}
          </Badge>
          <Badge
            tone={
              intake.mapping_status === "needs_review" ? "amber" : "neutral"
            }
            aria-label={`Mapping: ${intake.mapping_status.replace(/_/g, " ")}`}
          >
            {intake.mapping_status.replace(/_/g, " ")}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Received {formatWhen(intake.received_at)} · Submission {intake.id}
        </p>
      </header>

      {intake.mapping_status === "needs_review" && (
        <section className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
          <h2 className="font-semibold">Mapping needs review</h2>
          {warnings.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {warnings.map((warning, index) => (
                <li key={`${index}-${warning}`}>{warning}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              One or more answers could not be mapped automatically.
            </p>
          )}
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 font-semibold">Contact</h2>
          <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Name</dt>
            <dd>{displayValue(intake.name)}</dd>
            <dt className="text-muted-foreground">Email</dt>
            <dd className="break-all">
              {intake.email ? (
                <a
                  className="underline-offset-4 hover:underline"
                  href={`mailto:${intake.email}`}
                >
                  {intake.email}
                </a>
              ) : (
                "—"
              )}
            </dd>
            <dt className="text-muted-foreground">Company</dt>
            <dd>{displayValue(intake.company)}</dd>
          </dl>
        </section>

        <section className="rounded-lg border border-border bg-card p-4">
          <h2 className="mb-3 font-semibold">Structured scope</h2>
          <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Service</dt>
            <dd>
              {displayValue(
                intake.service_family_label ?? intake.service_family_ref,
              )}
            </dd>
            <dt className="text-muted-foreground">Service ref</dt>
            <dd className="font-mono text-xs">
              {displayValue(intake.service_family_ref)}
            </dd>
            <dt className="text-muted-foreground">Budget band</dt>
            <dd>
              {displayValue(intake.budget_band_label ?? intake.budget_band_ref)}
            </dd>
            <dt className="text-muted-foreground">Budget ref</dt>
            <dd className="font-mono text-xs">
              {displayValue(intake.budget_band_ref)}
            </dd>
          </dl>
        </section>
      </div>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-2 font-semibold">Project summary</h2>
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
          {displayValue(intake.project_summary)}
        </p>
      </section>

      <section className="rounded-lg border border-accent/30 bg-accent/5 p-5">
        <h2 className="font-semibold">Admin review</h2>
        <p className="mb-4 mt-1 text-sm text-muted-foreground">
          Confirm the mapped submission or archive it from the working queue.
        </p>
        <IntakeReviewActions
          intakeId={intake.id}
          status={intake.status}
          initialNotes={intake.review_notes}
        />
      </section>

      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 font-semibold">Submission metadata</h2>
        <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-muted-foreground">Form ID</dt>
          <dd className="break-all font-mono text-xs">{intake.form_id}</dd>
          <dt className="text-muted-foreground">Response token</dt>
          <dd className="break-all font-mono text-xs">
            {intake.response_token}
          </dd>
          <dt className="text-muted-foreground">Event ID</dt>
          <dd className="break-all font-mono text-xs">
            {displayValue(intake.event_id)}
          </dd>
          <dt className="text-muted-foreground">Submitted</dt>
          <dd>{formatWhen(intake.submitted_at)}</dd>
          <dt className="text-muted-foreground">Received</dt>
          <dd>{formatWhen(intake.received_at)}</dd>
          <dt className="text-muted-foreground">Updated</dt>
          <dd>{formatWhen(intake.updated_at)}</dd>
          <dt className="text-muted-foreground">Reviewed</dt>
          <dd>{formatWhen(intake.reviewed_at)}</dd>
          <dt className="text-muted-foreground">Reviewed by</dt>
          <dd className="break-all font-mono text-xs">
            {displayValue(intake.reviewed_by)}
          </dd>
        </dl>
      </section>

      <details className="rounded-lg border border-border bg-card p-4">
        <summary className="cursor-pointer font-semibold">
          Raw Typeform payload
        </summary>
        <p className="mt-2 text-xs text-muted-foreground">
          Preserved for mapping diagnostics. Treat this payload as submitted
          client data.
        </p>
        <pre className="mt-3 max-h-[32rem] overflow-auto rounded-md bg-muted/50 p-3 text-xs">
          {JSON.stringify(intake.raw_payload, null, 2)}
        </pre>
      </details>
    </div>
  );
}
