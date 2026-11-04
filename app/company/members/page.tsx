import { redirect } from "next/navigation";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  inviteMemberForm,
  changeMemberRoleForm,
  deactivateMemberForm
} from "@/lib/actions/members";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { companyNext, guardCompanyPage, pickCompany, resolveAdminCompanies, GuardNotice } from "../_lib/admin-companies";
import { memberNoticeMessage, type MemberNoticeTone } from "./notices";
import { safeErrorFields } from "@/lib/log-safe";
import { isCompanyMemberStatus, type CompanyMemberStatus } from "@/lib/domain-types";

export const dynamic = "force-dynamic";

interface RoleOption {
  key: string;
  label: string;
  rank: number;
}

/**
 * Resolve member emails for display. Member rows expose only `user_id` to the
 * cookie-bound client (other users' profiles/auth rows are not RLS-readable),
 * so we use the service-role Auth admin API — the same pattern as the global
 * admin users page. Safe here only because the page's `guardCompanyPage`
 * (requireCompanyAdmin: admin rank, active company, AAL2) runs BEFORE this is
 * called — layout and page render in parallel, so the layout is not a gate for
 * this read. We only surface emails for the caller's own company members.
 */
async function resolveEmails(userIds: string[]): Promise<Map<string, string>> {
  const wanted = new Set(userIds);
  const byId = new Map<string, string>();
  if (wanted.size === 0) return byId;
  try {
    const admin = createAdminClient();
    for (let page = 1; page <= 10; page++) {
      const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      const users = data?.users ?? [];
      for (const u of users) {
        if (wanted.has(u.id) && u.email) byId.set(u.id, u.email);
      }
      if (users.length < 200 || byId.size >= wanted.size) break;
    }
  } catch (e) {
    console.warn("[company members] email resolution failed:", safeErrorFields(e));
  }
  return byId;
}

export default async function CompanyMembersPage({
  searchParams
}: {
  searchParams: Promise<{ company?: string; notice?: string | string[] }>;
}) {
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(await companyNext("/company/members"))}`);
  }

  const { companies } = await resolveAdminCompanies(supabase, user.id);
  const selected = pickCompany(companies, sp.company);

  if (!selected) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center">
        <p className="font-semibold">No company found</p>
      </div>
    );
  }

  const companyId = selected.id;
  const guard = await guardCompanyPage(selected, "/company/members");
  if (guard !== "ok") {
    return <GuardNotice outcome={guard} />;
  }

  const [membersRes, rolesRes] = await Promise.all([
    supabase
      .from("company_members")
      .select("id, user_id, role, status, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true }),
    supabase.from("company_roles").select("key, label, rank").order("rank", { ascending: false })
  ]);

  // Rendered only past the guard; a fixed-map lookup, never the raw param.
  const notice = memberNoticeMessage(sp.notice);

  const members = membersRes.data ?? [];
  const roles = (rolesRes.data ?? []) as RoleOption[];
  const emailById = await resolveEmails(members.map((m) => m.user_id));

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight">Members</h1>
        <p className="text-muted-foreground mt-1">
          Manage who belongs to <span className="font-medium text-foreground">{selected.name}</span>.
        </p>
      </header>

      {notice && (
        <p
          role={notice.role}
          className={`rounded-lg border p-3 text-sm ${NOTICE_STYLES[notice.tone]}`}
        >
          {notice.text}
        </p>
      )}

      {/* Invite */}
      <section className="rounded-lg border border-border bg-card p-6">
        <h2 className="font-display text-xl font-semibold mb-1">Invite a member</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Adds them with an <code>invited</code> status, then emails them to sign in at /login.
        </p>
        <form action={inviteMemberForm.bind(null, companyId)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] items-end">
            <div className="space-y-1.5">
              <Label htmlFor="invite_email">Email</Label>
              <Input
                id="invite_email"
                name="email"
                type="email"
                required
                maxLength={254}
                placeholder="teammate@example.com"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite_role">Role</Label>
              <select
                id="invite_role"
                name="roleKey"
                defaultValue={roles.at(-1)?.key ?? "employee"}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {roles.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit">Send invite</Button>
          </div>
        </form>
      </section>

      {/* Roster */}
      {members.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No members yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <caption className="sr-only">Company members</caption>
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th scope="col" className="p-3">Member</th>
                <th scope="col" className="p-3">Role</th>
                <th scope="col" className="p-3">Status</th>
                <th scope="col" className="p-3">Joined</th>
                <th scope="col" className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.map((m) => {
                const isSelf = m.user_id === user.id;
                return (
                  <tr key={m.id} className="align-middle">
                    <td className="p-3">
                      <span className="font-medium">
                        {emailById.get(m.user_id) ?? m.user_id}
                      </span>
                      {isSelf && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                          you
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      <form
                        action={changeMemberRoleForm.bind(null, companyId, m.id)}
                        className="flex items-center gap-2"
                      >
                        <select
                          name="roleKey"
                          defaultValue={m.role}
                          aria-label={`Role for ${emailById.get(m.user_id) ?? m.user_id}`}
                          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                        >
                          {roles.map((r) => (
                            <option key={r.key} value={r.key}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          Save
                        </button>
                      </form>
                    </td>
                    <td className="p-3">
                      <StatusBadge status={m.status} />
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {new Date(m.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-right">
                      {!isSelf && m.status !== "disabled" ? (
                        <form action={deactivateMemberForm.bind(null, companyId, m.id)}>
                          <button
                            type="submit"
                            className="text-xs font-medium text-destructive hover:underline"
                          >
                            Disable
                          </button>
                        </form>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Role legend keeps labels meaningful even for custom catalog rows. */}
      <p className="text-xs text-muted-foreground">
        Roles:{" "}
        {roles.map((r, i) => (
          <span key={r.key}>
            {i > 0 ? ", " : ""}
            <span className="font-medium text-foreground">{r.label}</span> (rank {r.rank})
          </span>
        ))}
      </p>

    </div>
  );
}

const NOTICE_STYLES: Record<MemberNoticeTone, string> = {
  success: "border-primary/30 bg-primary/10 text-foreground",
  warning: "border-accent/40 bg-accent/10 text-foreground",
  error: "border-destructive/40 bg-destructive/10 text-destructive"
};

function StatusBadge({ status }: { status: string }) {
  const styles: Record<CompanyMemberStatus, string> = {
    active: "bg-primary/15 text-primary",
    invited: "bg-accent/15 text-accent",
    disabled: "bg-muted text-muted-foreground"
  };
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${styles[isCompanyMemberStatus(status) ? status : "disabled"]}`}
    >
      {status}
    </span>
  );
}
