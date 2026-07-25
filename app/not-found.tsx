import type { Metadata } from "next";
import Link from "next/link";
import { DobeuMark } from "@/components/brand/DobeuMark";
import { ArrowLeft, Search } from "lucide-react";

export const metadata: Metadata = {
  title: "Page not found — Dobeu",
  description: "This page doesn't exist or has been moved.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main
      id="main"
      className="min-h-screen flex items-center justify-center px-6 py-20 bg-background"
    >
      {/* Decorative glow */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
        aria-hidden="true"
      >
        <div className="h-[600px] w-[600px] rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-md w-full text-center space-y-8">
        {/* Mark */}
        <Link href="/" aria-label="Back to Dobeu homepage">
          <DobeuMark className="h-12 w-12 mx-auto" />
        </Link>

        {/* Code */}
        <div className="space-y-2">
          <p className="font-mono text-6xl font-bold tabular-nums text-primary/30 select-none">
            404
          </p>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Page not found
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
            This URL doesn&apos;t exist or has been moved. If you followed a link, it may be outdated.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to home
          </Link>
          <Link
            href="/repos"
            className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            Explore tools
          </Link>
        </div>

        <p className="text-xs text-muted-foreground/60">
          Need help?{" "}
          <a
            href="mailto:jeremyw@dobeu.net"
            className="underline underline-offset-3 hover:text-muted-foreground transition-colors"
          >
            jeremyw@dobeu.net
          </a>
        </p>
      </div>
    </main>
  );
}
