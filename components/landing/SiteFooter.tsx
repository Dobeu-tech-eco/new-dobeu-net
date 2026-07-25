"use client";

import Link from "next/link";
import { DobeuMark } from "@/components/brand/DobeuMark";

const FOOTER_LINKS = {
  Site: [
    { label: "Work", href: "/#work" },
    { label: "Process", href: "/#how" },
    { label: "About", href: "/#about" },
    { label: "FAQ", href: "/#faq" },
    { label: "Repos", href: "/repos" },
  ],
  Account: [
    { label: "Log in", href: "/login" },
    { label: "Client portal", href: "/portal" },
  ],
  Contact: [
    { label: "jeremyw@dobeu.net", href: "mailto:jeremyw@dobeu.net", external: true },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/jeremy-williams", external: true },
    { label: "Status", href: "https://status.dobeu.net", external: true },
  ],
  Legal: [
    { label: "Terms", href: "/terms" },
    { label: "Privacy", href: "/privacy" },
    { label: "Cookies", href: "/cookies" },
    { label: "SMS Opt-In", href: "/optin/sms" },
    { label: "Marketing Opt-Out", href: "/marketing-opt-out" },
  ],
};

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border/30 bg-background">
      <div className="container max-w-6xl py-14 md:py-16">

        {/* Top row: brand identity + nav columns */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-10 md:gap-16 mb-12">
          {/* Brand identity */}
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5 mb-4">
              <DobeuMark className="h-8 w-8 shrink-0" />
              <div>
                <p className="font-display text-base font-extrabold text-[hsl(var(--brand-indigo-slate))] leading-tight lowercase">
                  dobeu.net
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Ship the agent. Ship the app. Ship the brand. One operator, modern stack.
            </p>
            <p className="mt-2 text-xs text-muted-foreground/50">
              dobeu.net &middot; dobeu.cloud &middot; dobeutech.com
            </p>
          </div>

          {/* Nav grid */}
          <nav
            className="grid grid-cols-2 sm:grid-cols-4 gap-8"
            aria-label="Footer navigation"
          >
            {Object.entries(FOOTER_LINKS).map(([group, links]) => (
              <div key={group}>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                  {group}
                </p>
                <ul className="space-y-2">
                  {links.map((link) => (
                    <li key={link.label}>
                      {"external" in link && link.external ? (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {link.label}
                        </a>
                      ) : (
                        <Link
                          href={link.href}
                          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {link.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-border/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-muted-foreground/50">
          <p>
            &copy; {year} Dobeu Tech Solutions LLC. All rights reserved.
          </p>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="hover:text-muted-foreground transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-muted-foreground transition-colors">Terms</Link>
            <button
              type="button"
              className="hover:text-muted-foreground transition-colors"
              onClick={() => {
                if (
                  typeof window !== "undefined" &&
                  (window as Window & { openCookiePreferences?: () => void }).openCookiePreferences
                ) {
                  (window as Window & { openCookiePreferences?: () => void }).openCookiePreferences!();
                }
              }}
            >
              Cookie preferences
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
