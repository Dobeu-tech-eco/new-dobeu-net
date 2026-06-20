"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { Menu, X, ChevronDown, GitBranch, ExternalLink, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DobeuMark } from "@/components/brand/DobeuMark";
import { useLightbox } from "@/components/landing/LightboxProvider";
import { AVAILABILITY, SUB_BRANDS, FOUNDER } from "@/lib/jeremy-data";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "#work", label: "Work" },
  { href: "#how", label: "How it works" },
  { href: "#about", label: "About" },
  { href: "#faq", label: "FAQ" },
];

const AVAILABILITY_STYLES = {
  open: {
    dot: "bg-green-400 shadow-[0_0_6px_2px_rgba(74,222,128,0.45)]",
    badge: "text-green-400 border-green-400/25 bg-green-400/8",
  },
  limited: {
    dot: "bg-amber-400 shadow-[0_0_6px_2px_rgba(251,191,36,0.45)]",
    badge: "text-amber-400 border-amber-400/25 bg-amber-400/8",
  },
  closed: {
    dot: "bg-muted-foreground",
    badge: "text-muted-foreground border-border bg-muted/50",
  },
} as const;

export function SiteNav() {
  const { open } = useLightbox();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [brandsOpen, setBrandsOpen] = useState(false);
  const brandsRef = useRef<HTMLLIElement>(null);
  const avStyle = AVAILABILITY_STYLES[AVAILABILITY.status];

  // Close brands dropdown on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (brandsRef.current && !brandsRef.current.contains(e.target as Node)) {
        setBrandsOpen(false);
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full">
      <div className="glass border-b border-border/50 backdrop-blur-xl">
        <nav
          aria-label="Primary"
          className="container flex h-16 items-center justify-between gap-3"
        >
          {/* ── Left: Logo + availability ── */}
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              className="flex items-center gap-2 flex-shrink-0"
              aria-label="Dobeu home"
            >
              <DobeuMark className="h-8 w-8" />
              <span className="font-display text-xl tracking-tight lowercase leading-none hidden sm:inline">
                <span className="font-extrabold text-[hsl(var(--brand-indigo-slate))]">dobeu</span>
                <span className="font-medium text-muted-foreground">.net</span>
              </span>
            </Link>

            {/* Availability badge */}
            <span
              className={cn(
                "hidden sm:inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium leading-none",
                avStyle.badge
              )}
              aria-label={`Availability: ${AVAILABILITY.label}`}
            >
              <span
                className={cn("h-1.5 w-1.5 rounded-full animate-pulse flex-shrink-0", avStyle.dot)}
                aria-hidden="true"
              />
              {AVAILABILITY.label}
            </span>
          </div>

          {/* ── Center: Nav links + sub-brands ── */}
          <ul className="hidden md:flex items-center gap-0.5" role="list">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                >
                  {link.label}
                </Link>
              </li>
            ))}

            {/* Sub-brands dropdown */}
            <li ref={brandsRef} className="relative">
              <button
                type="button"
                onClick={() => setBrandsOpen((v) => !v)}
                aria-expanded={brandsOpen}
                aria-haspopup="true"
                className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              >
                Universe
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform duration-200",
                    brandsOpen && "rotate-180"
                  )}
                  aria-hidden="true"
                />
              </button>

              {brandsOpen && (
                <div
                  role="menu"
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 rounded-xl border border-border bg-elevated shadow-xl ring-1 ring-black/10 overflow-hidden"
                >
                  <div className="px-3 py-2 border-b border-border/50">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                      The Dobeu Universe
                    </p>
                  </div>
                  {SUB_BRANDS.map((brand) => (
                    <Link
                      key={brand.name}
                      href={brand.href}
                      role="menuitem"
                      target={brand.href.startsWith("http") ? "_blank" : undefined}
                      rel={brand.href.startsWith("http") ? "noopener noreferrer" : undefined}
                      onClick={() => setBrandsOpen(false)}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors group"
                    >
                      <div className="mt-0.5 h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <GitBranch className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                          {brand.label}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{brand.description}</p>
                      </div>
                      <ExternalLink
                        className="h-3 w-3 text-muted-foreground/50 group-hover:text-muted-foreground mt-1 flex-shrink-0"
                        aria-hidden="true"
                      />
                    </Link>
                  ))}
                </div>
              )}
            </li>
          </ul>

          {/* ── Right: CTA + mobile toggle ── */}
          <div className="flex items-center gap-2">
            <Link
              href={FOUNDER.github}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden lg:flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Jeremy's GitHub"
            >
              <GitBranch className="h-3.5 w-3.5" aria-hidden="true" />
              <span>dobeutech</span>
            </Link>

            <Button
              onClick={() => open("book")}
              size="default"
              className="hidden sm:inline-flex bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
            >
              Book a call
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>

            {/* Mobile toggle */}
            <button
              type="button"
              className="md:hidden inline-flex items-center justify-center rounded-md p-2 text-foreground hover:bg-muted transition-colors"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>

        {/* ── Mobile drawer ── */}
        {mobileOpen && (
          <div className="md:hidden border-t border-border/50 bg-background/95 backdrop-blur-xl">
            {/* Availability */}
            <div className="px-4 py-3 border-b border-border/40">
              <span
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
                  avStyle.badge
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse", avStyle.dot)} aria-hidden="true" />
                {AVAILABILITY.label}
              </span>
            </div>

            <ul className="flex flex-col px-4 py-2">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="flex items-center rounded-md px-2 py-3 text-base font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}

              {/* Sub-brands in mobile */}
              <li className="pt-2 border-t border-border/40 mt-2">
                <p className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  The Dobeu Universe
                </p>
                {SUB_BRANDS.map((brand) => (
                  <Link
                    key={brand.name}
                    href={brand.href}
                    target={brand.href.startsWith("http") ? "_blank" : undefined}
                    rel={brand.href.startsWith("http") ? "noopener noreferrer" : undefined}
                    className="flex items-center justify-between rounded-md px-2 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                    onClick={() => setMobileOpen(false)}
                  >
                    <span>{brand.label}</span>
                    <ExternalLink className="h-3.5 w-3.5 opacity-50" aria-hidden="true" />
                  </Link>
                ))}
              </li>

              <li className="pt-3 pb-2">
                <Button
                  onClick={() => {
                    setMobileOpen(false);
                    open("book");
                  }}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                  size="lg"
                >
                  Book a call
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </li>
            </ul>
          </div>
        )}
      </div>
    </header>
  );
}
