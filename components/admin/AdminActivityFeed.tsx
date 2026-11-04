import Link from "next/link";
import { ADMIN_ERROR_MESSAGES } from "@/lib/admin-status";

export type ActivityEntry = {
  key: string;
  at: string;
  label: string;
  // Internal admin route; omitted for entries with no detail page (audit rows).
  href?: string;
};

export const ACTIVITY_FEED_LIMIT = 15;

// Deduplicated by key, newest first, capped. Entries with an unparseable timestamp sort last.
export function mergeActivity(
  sources: readonly (readonly ActivityEntry[])[],
): ActivityEntry[] {
  const time = (e: ActivityEntry) => {
    const t = new Date(e.at).getTime();
    return Number.isNaN(t) ? -Infinity : t;
  };
  const seen = new Set<string>();
  return sources
    .flat()
    .filter((e) => (seen.has(e.key) ? false : (seen.add(e.key), true)))
    .toSorted((a, b) => time(b) - time(a))
    .slice(0, ACTIVITY_FEED_LIMIT);
}

export function AdminActivityFeed({
  entries,
  hasFailedSource,
}: {
  entries: readonly ActivityEntry[];
  hasFailedSource: boolean;
}) {
  return (
    <section>
      <h2 className="font-display text-xl font-semibold mb-3">
        Recent activity
      </h2>
      {hasFailedSource && (
        <p
          role="status"
          className="mb-3 rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground"
        >
          {ADMIN_ERROR_MESSAGES.activity_partial}
        </p>
      )}
      {entries.length === 0 ? (
        hasFailedSource ? null : (
          <p className="text-sm text-muted-foreground rounded-lg border border-dashed border-border p-6 text-center">
            No recent activity.
          </p>
        )
      ) : (
        <ul className="rounded-lg border border-border divide-y divide-border">
          {entries.map((e) => (
            <li
              key={e.key}
              className="p-4 grid grid-cols-[1fr_auto] items-center gap-2"
            >
              {e.href ? (
                <Link href={e.href} className="font-medium hover:underline">
                  {e.label}
                </Link>
              ) : (
                <span className="font-medium">{e.label}</span>
              )}
              <time
                className="text-xs text-muted-foreground"
                dateTime={e.at}
              >
                {new Date(e.at).toLocaleString()}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
