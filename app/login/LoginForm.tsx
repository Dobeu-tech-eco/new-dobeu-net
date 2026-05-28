"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/analytics";

export function LoginForm() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/portal";
  const errorParam = searchParams.get("error");
  const [submitting, setSubmitting] = React.useState(false);
  const [sent, setSent] = React.useState(false);

  React.useEffect(() => {
    if (errorParam === "not_authorized") {
      toast.error("You don't have access to that page.");
    } else if (errorParam === "supabase_not_configured") {
      toast.error("Auth isn't wired up yet — provision Supabase first.");
    }
  }, [errorParam]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    if (!email) {
      toast.error("Email required.");
      return;
    }
    setSubmitting(true);
    try {
      const supabase = createClient();
      const redirect = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirect }
      });
      if (error) throw error;
      track("login_magic_link_sent", { destination: nextPath });
      setSent(true);
      toast.success("Magic link sent — check your email.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send link.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="text-center space-y-2">
        <p className="font-semibold">Check your inbox.</p>
        <p className="text-sm text-muted-foreground">
          A magic link is on its way. Click it to log in — link expires in 15 minutes.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          autoFocus
        />
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="animate-spin" /> Sending…
          </>
        ) : (
          "Send magic link"
        )}
      </Button>
    </form>
  );
}
