"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { MfaEnroll } from "@/components/portal/MfaEnroll";

type Factor = { id: string; status: string; friendly_name?: string | null };

/**
 * Reads the user's TOTP factors and shows either an "enabled ✓" row with a
 * disable button, or the MfaEnroll widget. Client-side; uses the browser
 * Supabase client (the MFA APIs operate on the user's own session).
 */
export function MfaStatus() {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const [factors, setFactors] = React.useState<Factor[] | null>(null);

  const load = React.useCallback(async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors((data?.totp ?? []) as Factor[]);
  }, [supabase]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function disable(factorId: string) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Two-factor authentication disabled.");
    await load();
    router.refresh();
  }

  if (factors === null) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const verified = factors.filter((f) => f.status === "verified");
  if (verified.length > 0) {
    return (
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm">
          <span className="font-medium text-green-600 dark:text-green-400">Enabled ✓</span>{" "}
          <span className="text-muted-foreground">— a code is required for admin access.</span>
        </p>
        <button
          onClick={() => disable(verified[0].id)}
          className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted transition"
        >
          Disable
        </button>
      </div>
    );
  }

  return <MfaEnroll onEnrolled={load} />;
}
