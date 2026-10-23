import Link from "next/link";
import { CookiePreferencesButton } from "@/components/landing/CookiePreferencesButton";
import { DobeuMark } from "@/components/brand/DobeuMark";
import {
  FOOTER_SITE_LINKS,
  FOUNDER,
  NAP,
  SITE_IDENTITY,
  hasPublishablePhone,
} from "@/lib/jeremy-data";

const FOOTER_LINKS = {
  Site: [
    { label: "RouteReady", href: "/#routeready" },
    { label: "Projects", href: "/#products" },
    { label: "Building together", href: "/#how-it-works" },
    ...FOOTER_SITE_LINKS,
  ],
  Account: [
    { label: "Log in", href: "/login" },
    { label: "Client portal", href: "/portal" },
  ],
  Contact: [
    { label: NAP.email, href: `mailto:${NAP.email}`, external: true },
    ...(hasPublishablePhone()
      ? [{ label: NAP.phoneDisplay, href: `tel:${NAP.phone}`, external: true }]
      : []),
    { label: "LinkedIn", href: FOUNDER.linkedin, external: true },
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
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-10 md:gap-16 mb-12">
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5 mb-4">
              <DobeuMark className="h-8 w-8 shrink-0" />
              <div>
                <p className="font-display text-base font-extrabold text-fg-heading leading-tight lowercase">
                  dobeu.net
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Jeremy Williams builds passion projects and usable business
              technology with people who share his curiosity.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {SITE_IDENTITY.legalName} · {NAP.locality}, {NAP.region} ·{" "}
              {NAP.email}
              {hasPublishablePhone() ? ` · ${NAP.phoneDisplay}` : ""}
            </p>
          </div>

          <nav
            className="grid grid-cols-2 sm:grid-cols-4 gap-8"
            aria-label="Footer navigation"
          >
            {Object.entries(FOOTER_LINKS).map(([group, links]) => (
              <div key={group}>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                  {group}
                </p>
                <ul className="flex flex-col gap-3">
                  {links.map((link) => (
                    <li key={link.label}>
                      {"external" in link && link.external ? (
                        <a
                          href={link.href}
                          target={
                            link.href.startsWith("https://")
                              ? "_blank"
                              : undefined
                          }
                          rel={
                            link.href.startsWith("https://")
                              ? "noopener noreferrer"
                              : undefined
                          }
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

        <div className="pt-8 border-t border-border/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-muted-foreground">
          <p>
            &copy; {year} {SITE_IDENTITY.legalName}. All rights reserved.
          </p>
          <div className="flex items-center gap-5">
            <Link
              href="/privacy"
              className="hover:text-foreground transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="hover:text-foreground transition-colors"
            >
              Terms
            </Link>
            <CookiePreferencesButton />
          </div>
        </div>
      </div>
    </footer>
  );
}
