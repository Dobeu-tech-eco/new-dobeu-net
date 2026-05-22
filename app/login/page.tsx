import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./LoginForm";
import { DobeuMark } from "@/components/brand/DobeuMark";

// LoginForm uses useSearchParams under Suspense — keep this page dynamic.
export const dynamic = "force-dynamic";


export const metadata: Metadata = {
  title: "Log in",
  description: "Sign in to your Dobeu Tech Solutions client portal."
};

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12 bg-dobeu-mesh">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-glow p-8">
        <div className="flex flex-col items-center mb-6">
          <DobeuMark className="h-12 w-12 mb-3" />
          <h1 className="font-display text-2xl font-bold">Welcome back</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enter your email — we&apos;ll send a magic link.
          </p>
        </div>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
        <p className="mt-6 text-xs text-center text-muted-foreground">
          No password needed. New here?{" "}
          <a href="/#work" className="underline hover:text-foreground">
            See what I do →
          </a>
        </p>
      </div>
    </main>
  );
}
