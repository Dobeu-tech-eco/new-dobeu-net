"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { DobeuMark } from "@/components/brand/DobeuMark";
import { useLightbox } from "@/components/landing/LightboxProvider";

const NAV_LINKS = [
  { href: "#work", label: "Work" },
  { href: "#how", label: "How" },
  { href: "#about", label: "About" },
  { href: "#faq", label: "FAQ" }
];

export function SiteNav() {
  const { open } = useLightbox();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full">
      <div className="glass border-b border-border/60">
        <nav
          aria-label="Primary"
          className="container flex h-16 items-center justify-between gap-4"
        >
          <Link href="/" className="flex items-center gap-2" aria-label="Dobeu home">
            <DobeuMark className="h-8 w-8" />
            <span className="font-display text-xl tracking-tight lowercase leading-none">
              <span className="font-extrabold text-[hsl(var(--brand-indigo-slate))]">dobeu</span>
              <span className="font-medium text-muted-foreground">.net</span>
            </span>
          </Link>

          <ul className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/login"
              className="hidden sm:inline-flex rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Log in
            </Link>
            <Button onClick={() => open("book")} size="default" className="hidden sm:inline-flex">
              Book a call
            </Button>
            <button
              type="button"
              className="md:hidden inline-flex items-center justify-center rounded-md p-2 text-foreground hover:bg-muted"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>

        {mobileOpen && (
          <div className="md:hidden border-t border-border/60 px-4 py-3">
            <ul className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="block rounded-md px-3 py-2 text-base font-medium text-muted-foreground hover:bg-muted"
                    onClick={() => setMobileOpen(false)}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/login"
                  className="block rounded-md px-3 py-2 text-base font-medium text-muted-foreground hover:bg-muted"
                >
                  Log in
                </Link>
              </li>
              <li className="pt-2">
                <Button
                  onClick={() => {
                    setMobileOpen(false);
                    open("book");
                  }}
                  className="w-full"
                  size="lg"
                >
                  Book a call
                </Button>
              </li>
            </ul>
          </div>
        )}
      </div>
    </header>
  );
}
