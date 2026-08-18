import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "./LoginForm";
import { DobeuMark } from "@/components/brand/DobeuMark";
import { ArrowLeft, ShieldCheck, Zap, Lock } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Log in — Dobeu",
  description: "Sign in to your Dobeu Tech Solutions client portal.",
  robots: { index: false, follow: false },
};

const TRUST_POINTS = [
  {
    icon: ShieldCheck,
    label: "Passwordless by default",
    body: "Magic links expire in 15 minutes and are single-use.",
  },
  {
    icon: Lock,
    label: "MFA available",
    body: "Enable TOTP or hardware keys from your settings page.",
  },
  {
    icon: Zap,
    label: "Direct access",
    body: "Portal gives you live project status, files, and invoices.",
  },
];

export default function LoginPage() {
  return (
    <div className="min-h-screen flex">
      {/* ─── Left panel — decorative brand side ───────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[46%] flex-col justify-between p-12 bg-card border-r border-border relative overflow-hidden"
        aria-hidden="true"
      >
        {/* Subtle glow blob */}
        <div className="pointer-events-none absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-primary/6 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-0 h-[400px] w-[400px] rounded-full bg-accent/6 blur-3xl" />

        {/* Wordmark */}
        <div className="flex items-center gap-2.5 relative z-10">
          <DobeuMark className="h-9 w-9" />
          <span className="font-display text-xl font-bold lowercase tracking-tight">dobeu</span>
        </div>

        {/* Middle content */}
        <div className="relative z-10 space-y-8">
          <blockquote className="space-y-3">
            <p className="font-display text-2xl font-bold leading-snug text-balance">
              Your project. Your files. Your invoices. All in one place.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              The client portal keeps you in sync without email threads or status-update calls.
            </p>
          </blockquote>

          <ul className="space-y-4">
            {TRUST_POINTS.map(({ icon: Icon, label, body }) => (
              <li key={label} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <p className="text-xs text-muted-foreground relative z-10">
          &copy; {new Date().getFullYear()} Dobeu Tech Solutions LLC &middot; New York, NY
        </p>
      </div>

      {/* ─── Right panel — form ───────────────────────────────────────────── */}
      <main
        id="main"
        className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative"
      >
        {/* Back link — mobile */}
        <div className="absolute top-5 left-5">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Back to site
          </Link>
        </div>

        <div className="w-full max-w-sm">
          {/* Mobile wordmark */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <DobeuMark className="h-8 w-8" />
            <span className="font-display text-lg font-bold lowercase tracking-tight">dobeu</span>
          </div>

          <div className="mb-7">
            <h1 className="font-display text-2xl font-bold tracking-tight">
              Welcome back
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              Enter your email — we&apos;ll send a magic link.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <Suspense fallback={null}>
              <LoginForm />
            </Suspense>
          </div>

          <p className="mt-5 text-xs text-center text-muted-foreground">
            New here?{" "}
            <Link href="/#work" className="underline underline-offset-3 hover:text-foreground transition-colors">
              See what I build
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
