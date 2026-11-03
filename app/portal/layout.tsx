import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { DobeuMark } from "@/components/brand/DobeuMark";
import { ThemeToggle } from "@/components/theme-toggle";
import { PortalNav } from "@/components/portal/PortalNav";
import { AnalyticsIdentify } from "@/components/portal/AnalyticsIdentify";
import { isAdminEmail } from "@/lib/utils";

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

        <PortalNav isAdmin={isAdmin} />

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
