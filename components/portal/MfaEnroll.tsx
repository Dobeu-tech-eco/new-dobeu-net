"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

/**
 * One-time TOTP enrollment. Shows the QR (SVG data-URL from Supabase) + a
 * manual secret fallback, then verifies a 6-digit code to mark the factor
 * 'verified'. On success refreshes so MfaStatus re-reads listFactors().
 */
export function MfaEnroll({ onEnrolled }: { onEnrolled?: () => void }) {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const [qr, setQr] = React.useState<string | null>(null);
  const [secret, setSecret] = React.useState<string | null>(null);
  const [factorId, setFactorId] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function startEnroll() {
    setBusy(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    setBusy(false);
    if (error) {
      toast.error(error.message.includes("already") ? "2FA is already enabled." : error.message);
      return;
    }
    setQr(data.totp.qr_code);
    setSecret(data.totp.secret);
    setFactorId(data.id);
  }

  async function verify() {
    if (!factorId) return;
    setBusy(true);
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
    if (chErr || !ch) {
      setBusy(false);
      toast.error(chErr?.message ?? "Could not start challenge.");
      return;
    }
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: ch.id, code });
    setBusy(false);
    if (error) {
      toast.error("Invalid code. Try again.");
      setCode("");
      return;
    }
    toast.success("Two-factor authentication enabled.");
    setQr(null);
    setSecret(null);
    setFactorId(null);
    setCode("");
    onEnrolled?.();
    router.refresh();
  }

  if (!qr) {
    return (
      <button
        onClick={startEnroll}
        disabled={busy}
        className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
      >
        {busy ? "Starting…" : "Enable two-factor authentication"}
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Scan this with an authenticator app (1Password, Authy, Google Authenticator), then enter the
        6-digit code.
      </p>
      {/* Supabase returns qr_code as an SVG data-URL */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qr} alt="TOTP enrollment QR code" className="h-44 w-44 rounded-md border border-border bg-white p-2" />
      {secret && (
        <p className="text-xs text-muted-foreground break-all">
          Or enter this secret manually: <code className="font-mono">{secret}</code>
        </p>
      )}
      <div className="flex items-center gap-2">
        <label htmlFor="totp-code" className="sr-only">
          6-digit code
        </label>
        <input
          id="totp-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="w-28 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-mono tracking-widest"
          placeholder="123456"
        />
        <button
          onClick={verify}
          disabled={busy || code.length !== 6}
          className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
        >
          {busy ? "Verifying…" : "Verify & enable"}
        </button>
      </div>
    </div>
  );
}
