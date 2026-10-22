"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  Receipt,
  Ticket,
  Package,
  Settings,
} from "lucide-react";
import { LogoutButton } from "@/components/portal/LogoutButton";

const NAV = [
  { href: "/portal", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portal/projects", label: "Projects", icon: FolderKanban },
  { href: "/portal/tickets", label: "Tickets", icon: Ticket },
  { href: "/portal/files", label: "Files", icon: FileText },
  { href: "/portal/invoices", label: "Invoices", icon: Receipt },
  { href: "/portal/assets", label: "Assets", icon: Package },
  { href: "/portal/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/portal") return pathname === "/portal";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PortalNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Portal navigation"
      className="flex-1 px-2 py-3 flex md:block gap-1 overflow-x-auto"
    >
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            className={
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap " +
              (active
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground")
            }
          >
            <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">{item.label}</span>
          </Link>
        );
      })}

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

      <div className="md:mt-2">
        <LogoutButton />
      </div>
    </nav>
  );
}
