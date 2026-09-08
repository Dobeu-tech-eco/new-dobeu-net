"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { Menu, X, ChevronDown, GitBranch, ExternalLink, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DobeuMark } from "@/components/brand/DobeuMark";
import { useLightbox } from "@/components/landing/LightboxProvider";
import { AVAILABILITY, FOUNDER, PRIMARY_NAV_LINKS, SUB_BRANDS } from "@/lib/jeremy-data";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV_LINKS = PRIMARY_NAV_LINKS;

const AVAILABILITY_STYLES = {
  open: {
    dot: "bg-green-400 shadow-[0_0_5px_1px_rgba(74,222,128,0.5)]",
    badge: "text-green-400 border-green-400/20 bg-green-400/6",
  },
  limited: {
    dot: "bg-amber-400 shadow-[0_0_5px_1px_rgba(251,191,36,0.5)]",
    badge: "text-amber-400 border-amber-400/20 bg-amber-400/6",
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
  const [scrolled, setScrolled] = useState(false);
  const brandsRef = useRef<HTMLLIElement>(null);
  const avStyle = AVAILABILITY_STYLES[AVAILABILITY.status];

  // Detect scroll for elevated nav look
  useEffect(() => {
    const handle = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", handle, { passive: true });
    return () => window.removeEventListener("scroll", handle);
  }, []);

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
      <div
        className={cn(
          "border-b transition-all duration-300",
          scrolled
            ? "border-border/60 bg-background/90 backdrop-blur-xl shadow-sm"
            : "border-transparent bg-background/60 backdrop-blur-md"
        )}
      >
        <nav
          aria-label="Primary"
          className="container flex h-[60px] items-center justify-between gap-4"
        >
          {/* ── Left: Logo + availability ── */}
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              className="flex items-center gap-2.5 flex-shrink-0 group"
              aria-label="Dobeu home"
            >
              <DobeuMark className="h-7 w-7" />
              <span className="font-display text-[1.1rem] tracking-tight lowercase leading-none hidden sm:inline select-none">
                <span className="font-extrabold text-[hsl(var(--brand-indigo-slate))] group-hover:text-primary transition-colors duration-200">
                  dobeu
                </span>
                <span className="font-medium text-muted-foreground">.net</span>
              </span>
            </Link>

            {/* Availability pill — restrained */}
            <span
              className={cn(
                "hidden lg:inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium leading-none",
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

          {/* ── Center: Nav links ── */}
          <ul className="hidden md:flex items-center gap-0" role="list">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="rounded-md px-3.5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-150"
                >
                  {link.label}
                </Link>
              </li>
            ))}

            {/* Universe dropdown */}
            <li ref={brandsRef} className="relative">
              <button
                type="button"
                onClick={() => setBrandsOpen((v) => !v)}
                aria-expanded={brandsOpen}
                aria-haspopup="true"
                className="flex items-center gap-1 rounded-md px-3.5 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-150"
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
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-60 rounded-xl border border-border bg-elevated shadow-lg overflow-hidden"
                >
                  <div className="px-4 py-2.5 border-b border-border/40">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                      The Dobeu Universe
                    </p>
                  </div>
                      <Link
                    href="/labs"
                    role="menuitem"
                    onClick={() => setBrandsOpen(false)}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40 transition-colors group"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                        Labs
                      </p>
                      <p className="text-xs text-muted-foreground truncate">Interactive demos</p>
                    </div>
                  </Link>
                  {SUB_BRANDS.map((brand) => (
                    <Link
                      key={brand.name}
                      href={brand.href}
                      role="menuitem"
                      target={brand.href.startsWith("http") ? "_blank" : undefined}
                      rel={brand.href.startsWith("http") ? "noopener noreferrer" : undefined}
                      onClick={() => setBrandsOpen(false)}
                      className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/40 transition-colors group"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                          {brand.label}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{brand.description}</p>
                      </div>
                      <ExternalLink
                        className="h-3 w-3 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors flex-shrink-0"
                        aria-hidden="true"
                      />
                    </Link>
                  ))}
                </div>
              )}
            </li>
          </ul>

          {/* ── Right: GitHub + toggle + CTA ── */}
          <div className="flex items-center gap-1.5">
            <Link
              href={FOUNDER.github}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden lg:flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              aria-label="Jeremy's GitHub"
            >
              <GitBranch className="h-3.5 w-3.5" aria-hidden="true" />
              <span>dobeutech</span>
            </Link>

            <ThemeToggle />

            <Button
              onClick={() => open("book")}
              size="sm"
              className="hidden sm:inline-flex bg-primary text-primary-foreground hover:bg-primary/90 font-semibold h-8 px-4 text-xs rounded-lg"
            >
              Book a call
              <ArrowRight className="ml-1.5 h-3 w-3" aria-hidden="true" />
            </Button>

            {/* Mobile toggle */}
            <button
              type="button"
              className="md:hidden inline-flex items-center justify-center rounded-lg p-2 text-foreground hover:bg-muted/60 transition-colors"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen
                ? <X className="h-5 w-5" aria-hidden="true" />
                : <Menu className="h-5 w-5" aria-hidden="true" />}
            </button>
          </div>
        </nav>

        {/* ── Mobile drawer ── */}
        {mobileOpen && (
          <div className="md:hidden border-t border-border/40 bg-background/98 backdrop-blur-xl">
            {/* Availability */}
            <div className="px-5 py-3 border-b border-border/30">
              <span
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
                  avStyle.badge
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full animate-pulse", avStyle.dot)} aria-hidden="true" />
                {AVAILABILITY.label}
              </span>
            </div>

            <nav aria-label="Mobile navigation">
              <ul className="flex flex-col px-5 py-3">
                {NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="flex items-center rounded-lg px-2 py-3 text-base font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                      onClick={() => setMobileOpen(false)}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}

                {/* Universe in mobile */}
                <li className="pt-3 mt-1 border-t border-border/30">
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                    The Dobeu Universe
                  </p>
                  <Link
                    href="/labs"
                    className="flex items-center justify-between rounded-lg px-2 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    onClick={() => setMobileOpen(false)}
                  >
                    <span>Labs</span>
                  </Link>
                  {SUB_BRANDS.map((brand) => (
                    <Link
                      key={brand.name}
                      href={brand.href}
                      target={brand.href.startsWith("http") ? "_blank" : undefined}
                      rel={brand.href.startsWith("http") ? "noopener noreferrer" : undefined}
                      className="flex items-center justify-between rounded-lg px-2 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                      onClick={() => setMobileOpen(false)}
                    >
                      <span>{brand.label}</span>
                      <ExternalLink className="h-3.5 w-3.5 opacity-40" aria-hidden="true" />
                    </Link>
                  ))}
                </li>

                <li className="pt-4 pb-3">
                  <Button
                    onClick={() => {
                      setMobileOpen(false);
                      open("book");
                    }}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                    size="lg"
                  >
                    Book a call
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </Button>
                </li>
              </ul>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
