"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import {
  ArrowUpRight,
  ChevronDown,
  ExternalLink,
  Menu,
  Pause,
  Play,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DobeuMark } from "@/components/brand/DobeuMark";
import { ThemeToggle } from "@/components/theme-toggle";
import { useLightbox } from "./LightboxProvider";
import { useExperience } from "./ExperienceProvider";
import { PRIMARY_NAV_LINKS, SUB_BRANDS } from "@/lib/jeremy-data";
import { cn } from "@/lib/utils";

const HOME_LINKS = [
  { label: "RouteReady", href: "/#routeready" },
  { label: "Your operation", href: "/#work" },
  { label: "Our approach", href: "/#how-it-works" },
  { label: "Services", href: "/services" },
  { label: "Pricing", href: "/pricing" },
];
const MORE_LINKS = [
  { label: "About", href: "/about" },
  { label: "Process", href: "/process" },
  { label: "Case studies", href: "/case-studies" },
  { label: "Questions", href: "/#faq" },
  { label: "Labs", href: "/labs" },
  { label: "Repos", href: "/repos" },
];

export function SiteNav() {
  const { open } = useLightbox();
  const { stopped, toggleMotion } = useExperience();
  const reduced = useReducedMotion();
  const pathname = usePathname();
  const links = pathname === "/" ? HOME_LINKS : PRIMARY_NAV_LINKS;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef<HTMLButtonElement>(null);

  // The mobile menu is a full-width overlay. Any other fixed-position CTA
  // (notably StickyMobileCTA, which is a sibling under the server-rendered
  // MarketingShell and so shares no client state with this component) must
  // step aside while it is open, or the user sees two stacked "Book a call"
  // buttons. A body class is the least-coupled channel between them.
  useEffect(() => {
    document.body.classList.toggle("mobile-nav-open", mobileOpen);
    if (!mobileOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        menuRef.current?.focus();
      }
    };
    document.addEventListener("keydown", close);
    return () => {
      document.body.classList.remove("mobile-nav-open");
      document.removeEventListener("keydown", close);
    };
  }, [mobileOpen]);

  // Detect scroll for elevated nav look
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 24);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full bg-background">
      <div
        className={cn(
          "border-b transition-colors duration-300",
          scrolled || mobileOpen
            ? "border-border bg-background/95"
            : "border-transparent",
        )}
      >
        <nav
          aria-label="Primary"
          className="container flex h-20 items-center justify-between gap-4"
        >
          {/* ── Left: Logo + availability ── */}
          <Link
            href="/"
            className="dobeu-logo-lock flex shrink-0 items-center gap-3 rounded-md"
            aria-label="Dobeu home"
          >
            <DobeuMark className="size-8" />
            <span className="font-display text-xl font-extrabold tracking-tight text-fg-heading">
              dobeu.net
            </span>
          </Link>
          {/* ── Center: Nav links ── */}
          <ul className="hidden items-center gap-1 xl:flex">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={pathname === link.href ? "page" : undefined}
                  className="inline-flex min-h-11 items-center rounded-md px-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    More{" "}
                    <ChevronDown className="ml-1 size-3" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuGroup>
                    {MORE_LINKS.map((link) => (
                      <DropdownMenuItem key={link.href} asChild>
                        <Link href={link.href}>{link.label}</Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem onSelect={() => open("intake")}>
                      Project intake · Typeform
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/portal">Client portal</Link>
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    {SUB_BRANDS.map((brand) => (
                      <DropdownMenuItem key={brand.name} asChild>
                        <Link
                          href={brand.href}
                          target={
                            brand.href.startsWith("http") ? "_blank" : undefined
                          }
                          rel={
                            brand.href.startsWith("http")
                              ? "noopener noreferrer"
                              : undefined
                          }
                        >
                          {brand.label}
                          <span className="sr-only"> (opens in new tab)</span>
                          <ExternalLink
                            className="ml-auto size-3"
                            aria-hidden="true"
                          />
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          </ul>
          {/* ── Right: GitHub + toggle + CTA ── */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMotion}
              disabled={Boolean(reduced)}
              aria-label={
                reduced
                  ? "Motion reduced by system preference"
                  : stopped
                    ? "Resume animations"
                    : "Pause animations"
              }
              aria-pressed={stopped}
            >
              {stopped ? (
                <Play className="size-4" aria-hidden="true" />
              ) : (
                <Pause className="size-4" aria-hidden="true" />
              )}
            </Button>
            <ThemeToggle />
            <Button
              variant="outline"
              size="sm"
              className="hidden rounded-pill sm:inline-flex"
              onClick={() => open("book")}
            >
              Let&apos;s talk{" "}
              <ArrowUpRight className="ml-2 size-4" aria-hidden="true" />
            </Button>
            {/* Mobile toggle */}
            <Button
              ref={menuRef}
              variant="ghost"
              size="icon"
              className="xl:hidden"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
              aria-controls="mobile-navigation"
              onClick={() => setMobileOpen((value) => !value)}
            >
              {mobileOpen ? (
                <X className="size-5" aria-hidden="true" />
              ) : (
                <Menu className="size-5" aria-hidden="true" />
              )}
            </Button>
          </div>
        </nav>
        {/* ── Mobile drawer ── */}
        {mobileOpen && (
          <nav
            id="mobile-navigation"
            aria-label="Mobile navigation"
            className="max-h-[calc(100dvh-5rem)] overflow-y-auto border-t border-border xl:hidden"
          >
            <div className="container flex flex-col gap-5 py-5">
              <ul className="flex flex-col">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className="flex min-h-11 items-center rounded-md px-3 py-3 text-base text-foreground hover:bg-muted"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-border pt-4">
                {MORE_LINKS.filter(
                  (link) =>
                    !links.some((primary) => primary.href === link.href),
                ).map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="inline-flex min-h-11 items-center rounded-md text-sm text-muted-foreground hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
              <button
                type="button"
                className="min-h-11 self-start rounded-md text-sm text-primary underline underline-offset-4"
                onClick={() => {
                  setMobileOpen(false);
                  open("intake");
                }}
              >
                Project intake · Typeform
              </button>
              <Button
                className="rounded-pill"
                onClick={() => {
                  setMobileOpen(false);
                  open("book");
                }}
              >
                Book a call{" "}
                <ArrowUpRight className="ml-2 size-4" aria-hidden="true" />
              </Button>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
