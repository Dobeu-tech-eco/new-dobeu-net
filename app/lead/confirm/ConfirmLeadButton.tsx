"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";

type State = "idle" | "submitting" | "success" | "expired" | "invalid" | "error" | "busy" | "limited";

export function ConfirmLeadButton({ token: initialToken }: { token: string }) {
  const [token] = React.useState(initialToken);
  const [state, setState] = React.useState<State>("idle");

  // Keep the secret token out of the address bar, history, and analytics.
  React.useEffect(() => {
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  async function confirm() {
    setState("submitting");
    try {
      const res = await fetch("/api/lead/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        setState("success");
        const done = await res.json().catch(() => ({}));
        track("lead_captured", {
          ...(typeof done?.source === "string" ? { source: done.source } : {}),
          ...(typeof done?.has_message === "boolean"
            ? { has_message: done.has_message }
            : {}),
          confirmed: true,
        });
        return;
      }
      const body = await res.json().catch(() => ({}));
      if (res.status === 400 && body?.error === "expired") setState("expired");
      else if (res.status === 400) setState("invalid");
      else if (res.status === 409) setState("busy");
      else if (res.status === 429) setState("limited");
      else setState("error");
    } catch {
      setState("error");
    }
  }

  const retry = state === "idle" || state === "submitting" ||
    state === "error" ||
    state === "busy" ||
    state === "limited";

  return (
    <div className="mt-6 space-y-4">
      {retry && (
        <Button size="lg" onClick={confirm} disabled={state === "submitting"}>
          {state === "submitting" ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Confirming…
            </>
          ) : state === "error" || state === "busy" || state === "limited" ? (
            "Try again"
          ) : (
            "Confirm and send"
          )}
        </Button>
      )}
      <div role="status" aria-live="polite">
        {state === "success" && (
          <p className="font-medium">
            Thanks — your message is on its way. I&rsquo;ll read it personally and get
            back to you.
          </p>
        )}
        {state === "expired" && (
          <p>
            This link has expired. Please{" "}
            <Link href="/#contact" className="underline underline-offset-4">
              send the form again
            </Link>
            .
          </p>
        )}
        {state === "invalid" && (
          <p>
            This link isn&rsquo;t valid. Please{" "}
            <Link href="/#contact" className="underline underline-offset-4">
              send the form again
            </Link>
            .
          </p>
        )}
        {state === "busy" && <p>Still sending — give it a moment and try again.</p>}
        {state === "limited" && <p>Too many attempts. Wait a minute and try again.</p>}
        {state === "error" && (
          <p>Something went wrong on our side. Please try again.</p>
        )}
      </div>
    </div>
  );
}
