import Link from "next/link";
import { redirect } from "next/navigation";

// All /portal/* pages depend on the authed user, so never pre-render.
export const dynamic = "force-dynamic";

import { LayoutDashboard, FolderKanban, FileText, Receipt, MessagesSquare, Settings, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DobeuMark } from "@/components/brand/DobeuMark";
import { ThemeToggle } from "@/components/theme-toggle";
import { LogoutButton } from "@/components/portal/LogoutButton";
import { isAdminEmail } from "@/lib/utils";

const NAV = [
  { href: "/portal", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portal/projects", label: "Projects", icon: FolderKanban },
  { href: "/portal/files", label: "Files", icon: FileText },
  { href: "/portal/invoices", label: "Invoices", icon: Receipt },
  { href: "/portal/messages", label: "Messages", icon: MessagesSquare },
  { href: "/portal/settings", label: "Settings", icon: Settings }
];

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/portal");
  }

  const isAdmin = isAdminEmail(user.email);

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="md:w-64 md:min-h-screen border-b md:border-b-0 md:border-r border-border bg-card/40">
        <div className="p-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <DobeuMark className="h-8 w-8" />
            <span className="font-display text-lg font-bold lowercase">dobeu</span>
          </Link>
          <ThemeToggle />
        </div>
        <nav aria-label="Portal" className="px-2 pb-2 md:pb-6 flex md:block gap-1 overflow-x-auto">
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
          {isAdmin && (
            <Link
              href="/admin"
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-accent hover:bg-accent/10 transition-colors whitespace-nowrap"
            >
              <Settings className="h-4 w-4" /> <span className="hidden sm:inline">Admin</span>
            </Link>
          )}
          <LogoutButton />
        </nav>
        <div className="hidden md:block px-4 py-3 mt-auto text-xs text-muted-foreground border-t border-border">
          Signed in as <span className="font-medium text-foreground">{user.email}</span>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0">
        <main className="p-4 md:p-8 max-w-5xl">{children}</main>
      </div>
    </div>
  );
}
