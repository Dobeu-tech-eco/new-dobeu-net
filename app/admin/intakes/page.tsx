/** Admin queue for review-first Typeform budget intakes. */
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { requireAdminAal2 } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_FILTERS = ["all", "new", "reviewed", "archived"] as const;
const MAPPING_FILTERS = ["all", "needs_review", "mapped"] as const;
const PAGE_SIZE = 50;

type StatusFilter = (typeof STATUS_FILTERS)[number];
type MappingFilter = (typeof MAPPING_FILTERS)[number];

interface PageProps {
  searchParams: Promise<{ status?: string; mapping?: string; page?: string }>;
}

function isStatusFilter(value: string | undefined): value is StatusFilter {
  return STATUS_FILTERS.includes(value as StatusFilter);
}

function isMappingFilter(value: string | undefined): value is MappingFilter {
  return MAPPING_FILTERS.includes(value as MappingFilter);
}

function statusTone(status: string): "amber" | "indigo" | "neutral" {
  if (status === "new") return "amber";
  if (status === "reviewed") return "indigo";
  return "neutral";
}

function formatWhen(value: string | null): string {
  return value ? new Date(value).toLocaleString() : "—";
}

function pageHref(
  page: number,
  status: StatusFilter,
  mapping: MappingFilter,
): string {
  const search = new URLSearchParams();
  if (status !== "all") search.set("status", status);
  if (mapping !== "all") search.set("mapping", mapping);
  if (page > 1) search.set("page", String(page));
  return search.size > 0 ? `/admin/intakes?${search}` : "/admin/intakes";
}

export default async function AdminIntakesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const status: StatusFilter = isStatusFilter(params.status)
    ? params.status
    : "all";
  const mapping: MappingFilter = isMappingFilter(params.mapping)
    ? params.mapping
    : "all";
  const requestedPage = Number(params.page ?? "1");
  const page =
    Number.isSafeInteger(requestedPage) && requestedPage > 0
      ? requestedPage
      : 1;
  const firstRow = (page - 1) * PAGE_SIZE;

  const { admin } = await requireAdminAal2();
  let query = admin
    .from("typeform_budget_intakes")
    .select(
      "id,status,mapping_status,email,name,company,service_family_ref,service_family_label,budget_band_ref,budget_band_label,submitted_at,received_at",
    );

  if (status !== "all") query = query.eq("status", status);
  if (mapping !== "all") query = query.eq("mapping_status", mapping);

  const { data: rows, error } = await query
    .order("received_at", { ascending: false })
    .range(firstRow, firstRow + PAGE_SIZE);
  const hasNextPage = (rows?.length ?? 0) > PAGE_SIZE;
  const intakes = rows?.slice(0, PAGE_SIZE);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Budget intakes
        </h1>
        <p className="mt-1 text-muted-foreground">
          Review Typeform submissions before any pricing, quote, or client
          communication.
        </p>
      </header>

      <div className="space-y-2" aria-label="Intake filters">
        <FilterRow
          label="Status"
          param="status"
          current={status}
          options={STATUS_FILTERS}
          keep={{ mapping }}
        />
        <FilterRow
          label="Mapping"
          param="mapping"
          current={mapping}
          options={MAPPING_FILTERS}
          keep={{ status }}
        />
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          Unable to load the intake queue: {error.message}
        </p>
      )}

      {!error && (!intakes || intakes.length === 0) ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="font-semibold">No intakes matching those filters</p>
          <p className="mt-1 text-sm text-muted-foreground">
            New signed Typeform submissions will appear here for review.
          </p>
        </div>
      ) : intakes && intakes.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Typeform budget intakes awaiting admin review
            </caption>
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th scope="col" className="p-3">
                  Received
                </th>
                <th scope="col" className="p-3">
                  Contact
                </th>
                <th scope="col" className="p-3">
                  Service
                </th>
                <th scope="col" className="p-3">
                  Budget
                </th>
                <th scope="col" className="p-3">
                  Mapping
                </th>
                <th scope="col" className="p-3">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {intakes.map((intake) => (
                <tr
                  key={intake.id}
                  className="transition-colors hover:bg-muted/30"
                >
                  <td className="whitespace-nowrap p-3 text-xs text-muted-foreground">
                    {formatWhen(intake.received_at ?? intake.submitted_at)}
                  </td>
                  <td className="p-3">
                    <Link
                      href={`/admin/intakes/${intake.id}`}
                      className="rounded-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      {intake.name ?? intake.email ?? "Unnamed submission"}
                    </Link>
                    {intake.email && (
                      <p className="text-xs text-muted-foreground">
                        {intake.email}
                      </p>
                    )}
                    {intake.company && (
                      <p className="text-xs text-muted-foreground">
                        {intake.company}
                      </p>
                    )}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {intake.service_family_label ??
                      intake.service_family_ref ??
                      "—"}
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {intake.budget_band_label ?? intake.budget_band_ref ?? "—"}
                  </td>
                  <td className="p-3">
                    <Badge
                      tone={
                        intake.mapping_status === "needs_review"
                          ? "amber"
                          : "neutral"
                      }
                      aria-label={`Mapping: ${intake.mapping_status.replace(/_/g, " ")}`}
                    >
                      {intake.mapping_status.replace(/_/g, " ")}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <Badge
                      tone={statusTone(intake.status)}
                      aria-label={`Status: ${intake.status}`}
                    >
                      {intake.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!error && (page > 1 || hasNextPage) && (
        <nav
          className="flex items-center justify-between gap-4"
          aria-label="Intake queue pagination"
        >
          {page > 1 ? (
            <Link
              href={pageHref(page - 1, status, mapping)}
              rel="prev"
              className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-muted-foreground">Page {page}</span>
          {hasNextPage ? (
            <Link
              href={pageHref(page + 1, status, mapping)}
              rel="next"
              className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              Next →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}

function FilterRow<T extends string>({
  label,
  param,
  current,
  options,
  keep,
}: {
  label: string;
  param: string;
  current: T;
  options: readonly T[];
  keep: Record<string, string>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-xs uppercase tracking-wider text-muted-foreground">
        {label}:
      </span>
      {options.map((option) => {
        const search = new URLSearchParams();
        for (const [key, value] of Object.entries(keep)) {
          if (value && value !== "all") search.set(key, value);
        }
        if (option !== "all") search.set(param, option);

        const href = search.toString()
          ? `/admin/intakes?${search}`
          : "/admin/intakes";
        const active = current === option;
        return (
          <Link
            key={option}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-full border px-3 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              active
                ? "border-accent bg-accent/10 font-semibold text-accent"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {option.replace(/_/g, " ")}
          </Link>
        );
      })}
    </div>
  );
}
