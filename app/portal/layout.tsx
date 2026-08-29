import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  Receipt,
  Ticket,
  Package,
  Settings
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DobeuMark } from "@/components/brand/DobeuMark";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "@/components/portal/LogoutButton";
import { IntercomIdentify } from "@/components/portal/IntercomIdentify";
import { AnalyticsIdentify } from "@/components/portal/AnalyticsIdentify";
import { isAdminEmail } from "@/lib/utils";
import { intercomNameFromUser } from "@/lib/intercom";
import { createIntercomUserJwt } from "@/lib/intercom-jwt";

const NAV = [
  { href: "/portal", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portal/projects", label: "Projects", icon: FolderKanban },
  { href: "/portal/tickets", label: "Tickets", icon: Ticket },
  { href: "/portal/files", label: "Files", icon: FileText },
  { href: "/portal/invoices", label: "Invoices", icon: Receipt },
  { href: "/portal/assets", label: "Assets", icon: Package },
  { href: "/portal/settings", label: "Settings", icon: Settings }
];

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/portal");
  }

  const isAdmin = isAdminEmail(user.email);
  const displayName = user.user_metadata?.full_name ?? user.email ?? "Client";
  const initials = displayName
    .split(" ")
    .map((w: string) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      <AnalyticsIdentify user_id={user.id} email={user.email ?? undefined} is_admin={isAdmin} />
      <IntercomIdentify
        user_id={user.id}
        email={user.email ?? undefined}
        name={intercomNameFromUser(user)}
        created_at={user.created_at}
        intercom_user_jwt={createIntercomUserJwt({
          user_id: user.id,
          email: user.email ?? undefined,
          name: intercomNameFromUser(user),
          created_at: Math.floor(new Date(user.created_at).getTime() / 1000),
        })}
      />

      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <aside className="md:w-60 md:min-h-screen md:flex md:flex-col border-b md:border-b-0 md:border-r border-border bg-card/40">
        {/* Wordmark row */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-border/60">
          <Link href="/" className="flex items-center gap-2 group">
            <DobeuMark className="h-7 w-7 transition-opacity group-hover:opacity-80" />
            <span className="font-display text-base font-bold lowercase tracking-tight">
              dobeu
            </span>
          </Link>
          <ThemeToggle />
        </div>

        {/* Nav */}
        <nav
          aria-label="Portal navigation"
          className="flex-1 px-2 py-3 flex md:block gap-1 overflow-x-auto"
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              aria-label={item.label}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors whitespace-nowrap"
            >
              <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">{item.label}</span>
            </Link>
          ))}

          {isAdmin && (
            <Link
              href="/admin"
              title="Admin panel"
              aria-label="Admin panel"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold text-accent hover:bg-accent/10 transition-colors whitespace-nowrap mt-1"
            >
              <Settings className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="hidden sm:inline">Admin</span>
            </Link>
          )}

          <div className="hidden md:block mt-2">
            <LogoutButton />
          </div>
        </nav>

        {/* User strip — desktop only */}
        <div className="hidden md:flex items-center gap-2.5 px-4 py-3 border-t border-border/60">
          <span
            className="h-7 w-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold shrink-0"
            aria-hidden="true"
          >
            {initials}
          </span>
          <p className="text-xs text-muted-foreground truncate leading-tight">{user.email}</p>
        </div>
      </aside>

      {/* ── Main ───────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        <main className="p-5 md:p-8 max-w-5xl">{children}</main>
      </div>
    </div>
  );
}
