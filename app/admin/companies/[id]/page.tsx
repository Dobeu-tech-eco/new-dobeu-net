import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils";
import { provisionCompanyAdmin } from "@/lib/actions/companies";

export const dynamic = "force-dynamic";

async function provisionAdminAction(formData: FormData): Promise<void> {
  "use server";
  await provisionCompanyAdmin({
    companyId: String(formData.get("companyId") ?? ""),
    email: String(formData.get("email") ?? "")
  });
}

const ghostBtn =
  "inline-flex items-center justify-center rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary";

export default async function AdminCompanyDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createAdminClient();

  const [companyRes, membersRes, projectsRes, workOrdersRes, entitlementsRes] =
    await Promise.all([
      supabase
        .from("companies")
        .select("id,name,status,stripe_customer_id,created_at")
        .eq("id", id)
        .single(),
      supabase
        .from("company_members")
        .select("id,user_id,role,status,created_at")
        .eq("company_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("projects")
        .select("id,title,status,total_cents")
        .eq("company_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("work_orders")
        .select("id,title,service_type,status,quoted_amount_cents")
        .eq("company_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("asset_entitlements")
        .select("id,asset_id,source,granted_at")
        .eq("company_id", id)
        .order("granted_at", { ascending: false })
    ]);

  if (companyRes.error || !companyRes.data) notFound();
  const company = companyRes.data;
  const members = membersRes.data ?? [];
  const projects = projectsRes.data ?? [];
  const workOrders = workOrdersRes.data ?? [];
  const entitlements = entitlementsRes.data ?? [];

  // Resolve member names + asset titles via companion lookups (service role).
  const userIds = members.map((m) => m.user_id);
  const assetIds = entitlements.map((e) => e.asset_id);
  const [profilesRes, assetsRes] = await Promise.all([
    userIds.length
      ? supabase.from("profiles").select("id,full_name").in("id", userIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
    assetIds.length
      ? supabase.from("digital_assets").select("id,title").in("id", assetIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] })
  ]);

  const nameByUser = new Map<string, string | null>();
  for (const p of profilesRes.data ?? []) nameByUser.set(p.id, p.full_name);
  const titleByAsset = new Map<string, string>();
  for (const a of assetsRes.data ?? []) titleByAsset.set(a.id, a.title);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/companies"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          ← All companies
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="font-display text-3xl font-bold tracking-tight">
            {company.name}
          </h1>
          <span
            className={
              "inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider " +
              (company.status === "active"
                ? "bg-accent/15 text-accent"
                : "bg-destructive/15 text-destructive")
            }
          >
            {company.status}
          </span>
        </div>
        <p className="text-muted-foreground text-sm font-mono mt-1">{company.id}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Created {new Date(company.created_at).toLocaleString()}
          {company.stripe_customer_id ? ` · Stripe ${company.stripe_customer_id}` : ""}
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="font-display text-xl font-semibold">Provision company admin</h2>
        <p className="text-sm text-muted-foreground">
          Invites the email (or links an existing account) as this company&apos;s admin.
        </p>
        <form action={provisionAdminAction} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="companyId" value={company.id} />
          <div className="space-y-1.5">
            <label htmlFor="provision_email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="provision_email"
              name="email"
              type="email"
              required
              maxLength={254}
              placeholder="admin@company.com"
              autoComplete="off"
              className="h-10 w-72 rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <button type="submit" className={ghostBtn + " h-10"}>
            Provision admin
          </button>
        </form>
      </section>

      <section>
        <h2 className="font-display text-xl font-semibold mb-3">
          Members ({members.length})
        </h2>
        {members.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No members yet.
          </p>
        ) : (
          <ul className="rounded-lg border border-border divide-y divide-border">
            {members.map((m) => (
              <li key={m.id} className="p-4 grid grid-cols-[1fr_auto_auto] gap-3 items-center">
                <div>
                  <p className="font-medium">
                    {nameByUser.get(m.user_id) ?? "(no name set)"}
                  </p>
                  <p className="text-xs font-mono text-muted-foreground">{m.user_id}</p>
                </div>
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  {m.role}
                </span>
                <span
                  className={
                    "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider " +
                    (m.status === "active"
                      ? "bg-accent/15 text-accent"
                      : m.status === "invited"
                        ? "bg-primary/15 text-primary"
                        : "bg-muted text-muted-foreground")
                  }
                >
                  {m.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-display text-xl font-semibold mb-3">
          Projects ({projects.length})
        </h2>
        {projects.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No company projects.
          </p>
        ) : (
          <ul className="rounded-lg border border-border divide-y divide-border">
            {projects.map((p) => (
              <li key={p.id} className="p-4 grid grid-cols-[1fr_auto_auto] gap-3 items-center">
                <p className="font-medium">{p.title}</p>
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  {p.status}
                </span>
                <span className="text-sm font-medium">{formatCurrency(p.total_cents)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-display text-xl font-semibold mb-3">
          Work orders ({workOrders.length})
        </h2>
        {workOrders.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No company work orders.
          </p>
        ) : (
          <ul className="rounded-lg border border-border divide-y divide-border">
            {workOrders.map((w) => (
              <li key={w.id} className="p-4 grid grid-cols-[1fr_auto_auto] gap-3 items-center">
                <div>
                  <p className="font-medium">{w.title}</p>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    {w.service_type}
                  </p>
                </div>
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  {w.status}
                </span>
                <span className="text-sm font-medium">
                  {w.quoted_amount_cents ? formatCurrency(w.quoted_amount_cents) : "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-display text-xl font-semibold mb-3">
          Asset entitlements ({entitlements.length})
        </h2>
        {entitlements.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No digital-asset entitlements.
          </p>
        ) : (
          <ul className="rounded-lg border border-border divide-y divide-border">
            {entitlements.map((e) => (
              <li key={e.id} className="p-4 grid grid-cols-[1fr_auto_auto] gap-3 items-center">
                <p className="font-medium">
                  {titleByAsset.get(e.asset_id) ?? e.asset_id}
                </p>
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  {e.source}
                </span>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(e.granted_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
