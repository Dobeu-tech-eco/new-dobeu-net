import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/server";
import {
  createCompany,
  suspendCompany,
  reactivateCompany,
  provisionCompanyAdmin
} from "@/lib/actions/companies";

// Reads Supabase via service role; never pre-render.
export const dynamic = "force-dynamic";

// Progressive-enhancement wrappers: adapt FormData -> the typed server actions.
// Each underlying action revalidates /admin/companies, so the list refreshes.
async function createCompanyAction(formData: FormData): Promise<void> {
  "use server";
  await createCompany({ name: String(formData.get("name") ?? "") });
}

async function suspendCompanyAction(formData: FormData): Promise<void> {
  "use server";
  await suspendCompany({ id: String(formData.get("id") ?? "") });
}

async function reactivateCompanyAction(formData: FormData): Promise<void> {
  "use server";
  await reactivateCompany({ id: String(formData.get("id") ?? "") });
}

async function provisionAdminAction(formData: FormData): Promise<void> {
  "use server";
  await provisionCompanyAdmin({
    companyId: String(formData.get("companyId") ?? ""),
    email: String(formData.get("email") ?? "")
  });
}

const primaryBtn =
  "inline-flex items-center justify-center rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-[filter] duration-150 ease-out hover:brightness-95";
const ghostBtn =
  "inline-flex items-center justify-center rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary";

export default async function AdminCompaniesPage() {
  const supabase = createAdminClient();

  const [companiesRes, membersRes] = await Promise.all([
    supabase
      .from("companies")
      .select("id,name,status,created_at")
      .order("created_at", { ascending: false }),
    supabase.from("company_members").select("company_id")
  ]);

  const companies = companiesRes.data ?? [];
  const memberCounts = new Map<string, number>();
  for (const m of membersRes.data ?? []) {
    memberCounts.set(m.company_id, (memberCounts.get(m.company_id) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">Companies</h1>
        <p className="text-muted-foreground mt-1">
          Multi-tenant employer accounts. Suspend to revoke company-wide access.
        </p>
      </header>

      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="font-display text-xl font-semibold mb-1">Create a company</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Creates an active tenant. Provision a company admin from its row below.
        </p>
        <form action={createCompanyAction} className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label htmlFor="company_name" className="text-sm font-medium">
              Company name
            </label>
            <input
              id="company_name"
              name="name"
              required
              minLength={2}
              maxLength={160}
              placeholder="Acme Corp"
              autoComplete="off"
              className="h-10 w-64 rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <button type="submit" className={primaryBtn + " h-10"}>
            Create
          </button>
        </form>
      </section>

      {companies.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No companies yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3">Company</th>
                <th className="p-3">Status</th>
                <th className="p-3">Members</th>
                <th className="p-3">Created</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {companies.map((c) => (
                <tr key={c.id} className="align-top">
                  <td className="p-3">
                    <Link
                      href={`/admin/companies/${c.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="p-3">
                    <span
                      className={
                        "inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider " +
                        (c.status === "active"
                          ? "bg-accent/15 text-accent"
                          : "bg-destructive/15 text-destructive")
                      }
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="p-3 tabular-nums">{memberCounts.get(c.id) ?? 0}</td>
                  <td className="p-3 whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-col gap-2">
                      {c.status === "active" ? (
                        <form action={suspendCompanyAction}>
                          <input type="hidden" name="id" value={c.id} />
                          <button type="submit" className={ghostBtn}>
                            Suspend
                          </button>
                        </form>
                      ) : (
                        <form action={reactivateCompanyAction}>
                          <input type="hidden" name="id" value={c.id} />
                          <button type="submit" className={primaryBtn}>
                            Reactivate
                          </button>
                        </form>
                      )}
                      <form
                        action={provisionAdminAction}
                        className="flex flex-wrap items-center gap-2"
                      >
                        <input type="hidden" name="companyId" value={c.id} />
                        <input
                          name="email"
                          type="email"
                          required
                          maxLength={254}
                          placeholder="admin@company.com"
                          autoComplete="off"
                          aria-label={`Provision admin for ${c.name}`}
                          className="h-8 w-52 rounded-md border border-border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        />
                        <button type="submit" className={ghostBtn + " h-8 text-xs"}>
                          Provision admin
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
