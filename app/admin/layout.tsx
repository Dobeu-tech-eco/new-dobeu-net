import Link from "next/link";
import { redirect } from "next/navigation";

// All /admin/* pages read Supabase via service role + cookies; never pre-render.
export const dynamic = "force-dynamic";

import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Receipt,
  Inbox,
  CalendarCheck,
  BarChart3,
  Ticket
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/utils";
import { DobeuMark } from "@/components/brand/DobeuMark";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "@/components/portal/LogoutButton";
import { IntercomIdentify } from "@/components/portal/IntercomIdentify";
import { intercomNameFromUser } from "@/lib/intercom";
import { createIntercomUserJwt } from "@/lib/intercom-jwt";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/projects", label: "Projects", icon: FolderKanban },
  { href: "/admin/tickets", label: "Tickets", icon: Ticket },
  { href: "/admin/invoices", label: "Invoices", icon: Receipt },
  { href: "/admin/leads", label: "Leads", icon: Inbox },
  { href: "/admin/bookings", label: "Bookings", icon: CalendarCheck },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 }
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    redirect("/portal?error=not_authorized");
  }

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const needsEnroll = aal?.nextLevel !== "aal2"; // no verified factor yet

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <IntercomIdentify
        user_id={user.id}
        email={user.email ?? undefined}
        name={intercomNameFromUser(user)}
        created_at={user.created_at}
        intercom_user_jwt={createIntercomUserJwt({
          user_id: user.id,
          email: user.email ?? undefined,
          name: intercomNameFromUser(user),
          created_at: Math.floor(new Date(user.created_at).getTime() / 1000)
        })}
      />
      <aside className="md:w-64 md:min-h-screen border-b md:border-b-0 md:border-r border-accent/40 bg-card/60">
        <div className="p-4 flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-2">
            <DobeuMark className="h-8 w-8" />
            <span className="font-display text-lg font-bold lowercase">
              dobeu <span className="text-accent text-xs uppercase tracking-wider">admin</span>
            </span>
          </Link>
          <ThemeToggle />
        </div>
        <nav aria-label="Admin" className="px-2 pb-2 md:pb-6 flex md:block gap-1 overflow-x-auto">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors whitespace-nowrap"
            >
              <item.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{item.label}</span>
            </Link>
          ))}
          <Link
            href="/portal"
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors whitespace-nowrap"
          >
            <LayoutDashboard className="h-4 w-4" /> <span className="hidden sm:inline">Portal view</span>
          </Link>
          <LogoutButton />
        </nav>
      </aside>
      <div className="flex-1 min-w-0">
        <main className="p-4 md:p-8 max-w-6xl">
          {needsEnroll && (
            <div
              role="status"
              className="mb-6 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm"
            >
              Two-factor authentication isn&apos;t enabled.{" "}
              <Link href="/portal/settings" className="font-medium underline">
                Enable it now
              </Link>{" "}
              to secure admin access.
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
