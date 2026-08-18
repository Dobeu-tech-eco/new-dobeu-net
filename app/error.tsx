"use client";

import Link from "next/link";
import { useEffect } from "react";
import { DobeuMark } from "@/components/brand/DobeuMark";
import { ArrowLeft, RefreshCw } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dobeu] unhandled error:", error);
  }, [error]);

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
        <div className="h-[600px] w-[600px] rounded-full bg-destructive/5 blur-3xl" />
      </div>

      <div className="relative z-10 max-w-md w-full text-center space-y-8">
        {/* Mark */}
        <Link href="/" aria-label="Back to Dobeu homepage">
          <DobeuMark className="h-12 w-12 mx-auto" />
        </Link>

        {/* Message */}
        <div className="space-y-2">
          <p className="font-mono text-6xl font-bold tabular-nums text-destructive/25 select-none">
            500
          </p>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            Something went wrong
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
            An unexpected error occurred. The issue has been logged and we&apos;ll look into it.
          </p>
          {error.digest && (
            <p className="font-mono text-xs text-muted-foreground/50 mt-1">
              Error ID: {error.digest}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to home
          </Link>
        </div>

        <p className="text-xs text-muted-foreground/60">
          Persistent issue?{" "}
          <a
            href="mailto:jeremyw@dobeu.net"
            className="underline underline-offset-3 hover:text-muted-foreground transition-colors"
          >
            Email support
          </a>
        </p>
      </div>
    </main>
  );
}
