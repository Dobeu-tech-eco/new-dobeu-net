import type { SuspendedCompany } from "@/lib/company-status";
import { NAP } from "@/lib/jeremy-data";

/** Explains empty shared lists for members of suspended companies. Fixed copy only. */
export function CompanySuspendedBanner({ companies }: { companies: SuspendedCompany[] }) {
  if (companies.length === 0) return null;
  const single = companies.length === 1;

  return (
    <div
      role="status"
      className="mb-6 rounded-xl border border-amber-500/50 bg-amber-500/10 p-4 text-sm text-foreground break-words"
    >
      {single ? (
        <p className="font-semibold">
          {companies[0].name} is suspended. Contact Dobeu to reactivate it.
        </p>
      ) : (
        <>
          <p className="font-semibold">
            These companies are suspended. Contact Dobeu to reactivate them.
          </p>
          <ul className="mt-1 list-disc pl-5">
            {companies.map((c) => (
              <li key={c.id}>{c.name}</li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-1 text-muted-foreground">
        Shared company projects, files, invoices, work orders and assets are hidden until{" "}
        {single ? "it is" : "they are"} reactivated. Items you own stay visible.
      </p>
      <p className="mt-1">
        <a href={`mailto:${NAP.email}`} className="font-medium underline underline-offset-2">
          Email {NAP.email}
        </a>
      </p>
    </div>
  );
}
