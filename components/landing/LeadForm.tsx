"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { track } from "@/lib/analytics";

type Source = "book" | "form" | "email";

interface Props {
  source: Source;
  onSuccess?: () => void;
  compact?: boolean;
}

export function LeadForm({ source, onSuccess, compact = false }: Props) {
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      email: String(fd.get("email") ?? "").trim(),
      name: String(fd.get("name") ?? "").trim() || null,
      company: String(fd.get("company") ?? "").trim() || null,
      message: String(fd.get("message") ?? "").trim() || null,
      source,
      utm: collectUtmFromUrl(),
      referrer: typeof document !== "undefined" ? document.referrer : "",
    };

    if (!payload.email || !payload.email.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }
      // Keep `lead_captured` for backwards-compat with PostHog/Mixpanel funnels.
      track("lead_captured", { source, has_message: !!payload.message });
      track("lead_submitted", {
        source,
        has_message: !!payload.message
      });
      setSubmitted(true);
      toast.success("Got it. I'll reply within 24 hours.");
      onSuccess?.();
    } catch (err) {
      track("lead_capture_failed", { source });
      toast.error(
        err instanceof Error ? err.message : "Something went wrong. Try again?",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="py-8 text-center">
        <p className="text-lg font-semibold">
          Thanks — you&apos;re on the list.
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          I personally read every message. Expect a reply within 24 hours.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor={`email-${source}`}>Email</Label>
        <Input
          id={`email-${source}`}
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@company.com"
        />
      </div>

      {!compact && (
        <>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor={`name-${source}`}>Name</Label>
              <Input
                id={`name-${source}`}
                name="name"
                autoComplete="name"
                placeholder="Your name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`company-${source}`}>Company</Label>
              <Input
                id={`company-${source}`}
                name="company"
                autoComplete="organization"
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`message-${source}`}>
              What&apos;s on your mind?
            </Label>
            <Textarea
              id={`message-${source}`}
              name="message"
              rows={4}
              placeholder="Briefly describe the project, deadline, or what you want to explore."
            />
          </div>
        </>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="animate-spin" /> Sending…
          </>
        ) : compact ? (
          "Get in touch"
        ) : (
          "Send it"
        )}
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        Your email is used to reply only. No newsletter unless you opt in.
      </p>
    </form>
  );
}

function collectUtmFromUrl(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const out: Record<string, string> = {};
  const sp = new URLSearchParams(window.location.search);
  for (const key of [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "gclid",
    "fbclid",
  ]) {
    const v = sp.get(key);
    if (v) out[key] = v;
  }
  return out;
}
