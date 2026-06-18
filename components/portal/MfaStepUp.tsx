"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

/** Code-only AAL2 challenge against the user's existing verified TOTP factor. */
export function MfaStepUp({ next }: { next: string }) {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const [code, setCode] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const factor = (factors?.totp ?? []).find((f) => f.status === "verified");
    if (!factor) {
      setBusy(false);
      toast.error("No verified authenticator found. Enroll in Settings first.");
      return;
    }
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: factor.id });
    if (chErr || !ch) {
      setBusy(false);
      toast.error(chErr?.message ?? "Could not start challenge.");
      return;
    }
    const { error } = await supabase.auth.mfa.verify({ factorId: factor.id, challengeId: ch.id, code });
    setBusy(false);
    if (error) {
      toast.error("Invalid code. Try again.");
      setCode("");
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-border bg-card p-6 space-y-4">
      <label htmlFor="stepup-code" className="block text-sm font-medium">
        Authentication code
      </label>
      <input
        id="stepup-code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono tracking-widest"
        placeholder="123456"
        autoFocus
      />
      <button
        type="submit"
        disabled={busy || code.length !== 6}
        className="w-full rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition"
      >
        {busy ? "Verifying…" : "Continue to admin"}
      </button>
    </form>
  );
}
