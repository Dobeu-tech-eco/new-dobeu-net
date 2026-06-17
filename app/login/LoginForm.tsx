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
import { buildAuthCallbackUrl, sanitizeNextPath } from "@/lib/utils";

/** Align with Supabase Auth per-user OTP cooldown (default ~60s). */
const OTP_COOLDOWN_SECONDS = 60;
const OTP_COOLDOWN_MS = OTP_COOLDOWN_SECONDS * 1000;
const OTP_COOLDOWN_STORAGE_KEY = "dobeu_login_otp_cooldown";

function readCooldownUntil(email: string): number {
  if (typeof sessionStorage === "undefined") return 0;
  try {
    const raw = sessionStorage.getItem(OTP_COOLDOWN_STORAGE_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { email?: string; until?: number };
    if (parsed.email?.toLowerCase() !== email.toLowerCase()) return 0;
    return typeof parsed.until === "number" ? parsed.until : 0;
  } catch {
    return 0;
  }
}

function writeCooldownUntil(email: string, until: number): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(
    OTP_COOLDOWN_STORAGE_KEY,
    JSON.stringify({ email: email.toLowerCase(), until })
  );
}

function isAuthRateLimitError(err: unknown): boolean {
  const message =
    err instanceof Error ? err.message : typeof err === "string" ? err : "";
  const normalized = message.toLowerCase();
  return normalized.includes("rate limit") || normalized.includes("429");
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const nextPath = sanitizeNextPath(searchParams.get("next"), "/portal");
  const errorParam = searchParams.get("error");
  const inFlightRef = React.useRef(false);
  const [email, setEmail] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [sent, setSent] = React.useState(false);
  const [cooldownUntil, setCooldownUntil] = React.useState(0);
  const [cooldownSecondsLeft, setCooldownSecondsLeft] = React.useState(0);

  React.useEffect(() => {
    if (errorParam === "not_authorized") {
      toast.error("You don't have access to that page.");
    } else if (errorParam === "supabase_not_configured") {
      toast.error("Auth isn't wired up yet — provision Supabase first.");
    }
  }, [errorParam]);

  React.useEffect(() => {
    if (!email) return;
    const stored = readCooldownUntil(email);
    if (stored > Date.now()) {
      setCooldownUntil(stored);
      setSent(true);
    }
  }, [email]);

  React.useEffect(() => {
    if (cooldownUntil <= Date.now()) {
      setCooldownSecondsLeft(0);
      return;
    }

    const tick = () => {
      const remainingMs = cooldownUntil - Date.now();
      if (remainingMs <= 0) {
        setCooldownSecondsLeft(0);
        return;
      }
      setCooldownSecondsLeft(Math.ceil(remainingMs / 1000));
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [cooldownUntil]);

  const onCooldown = cooldownSecondsLeft > 0;

  async function sendMagicLink(targetEmail: string) {
    const normalized = targetEmail.trim();
    if (!normalized) {
      toast.error("Email required.");
      return;
    }

    const existingCooldown = readCooldownUntil(normalized);
    if (existingCooldown > Date.now()) {
      setEmail(normalized);
      setSent(true);
      setCooldownUntil(existingCooldown);
      toast.message(
        `Please wait ${Math.ceil((existingCooldown - Date.now()) / 1000)}s before requesting another link.`
      );
      return;
    }

    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setSubmitting(true);
    try {
      const supabase = createClient();
      const redirect = buildAuthCallbackUrl(nextPath);
      const { error } = await supabase.auth.signInWithOtp({
        email: normalized,
        options: { emailRedirectTo: redirect },
      });
      if (error) throw error;

      const until = Date.now() + OTP_COOLDOWN_MS;
      writeCooldownUntil(normalized, until);
      setEmail(normalized);
      setSent(true);
      setCooldownUntil(until);
      track("login_magic_link_sent", { destination: nextPath });
      toast.success("Magic link sent — check your email.");
    } catch (err) {
      if (isAuthRateLimitError(err)) {
        toast.error(
          "Email rate limit reached. Wait a minute, then try again — or ask an operator to raise Supabase Auth rate limits / enable Resend SMTP."
        );
      } else {
        toast.error(err instanceof Error ? err.message : "Could not send link.");
      }
    } finally {
      inFlightRef.current = false;
      setSubmitting(false);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await sendMagicLink(email);
  }

  if (sent) {
    return (
      <div className="text-center space-y-4">
        <div className="space-y-2">
          <p className="font-semibold">Check your inbox.</p>
          <p className="text-sm text-muted-foreground">
            We sent a magic link to <span className="font-medium">{email}</span>.
            Click it to log in — link expires in 15 minutes.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={submitting || onCooldown}
          onClick={() => sendMagicLink(email)}
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending…
            </>
          ) : onCooldown ? (
            `Resend available in ${cooldownSecondsLeft}s`
          ) : (
            "Resend magic link"
          )}
        </Button>
        <button
          type="button"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => {
            setSent(false);
            setEmail("");
            setCooldownUntil(0);
          }}
        >
          Use a different email
        </button>
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
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={submitting || onCooldown}
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending…
          </>
        ) : onCooldown ? (
          `Wait ${cooldownSecondsLeft}s`
        ) : (
          "Send magic link"
        )}
      </Button>
    </form>
  );
}
