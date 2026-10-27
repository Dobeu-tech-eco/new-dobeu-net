"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { track } from "@/lib/analytics";

type Source = "book" | "form" | "email";

function submitLabel(source: Source): string {
  switch (source) {
    case "form":
      return "Send your idea";
    case "book":
      return "Find a time to talk";
    case "email":
      return "Send your note";
    default: {
      const unreachable: never = source;
      return unreachable;
    }
  }
}

function confirmation(source: Source): { toast: string; title: string; body: string } {
  switch (source) {
    case "book":
      return {
        toast: "Thanks — I'll be in touch about a time to talk.",
        title: "Request received.",
        body: "I'll follow up personally to find a time that works.",
      };
    case "form":
      return {
        toast: "Thanks for sharing your idea.",
        title: "Idea received.",
        body: "I'll read it personally and get back to you about where we might connect.",
      };
    case "email":
      return {
        toast: "Got it — I'll reply by email.",
        title: "Note received.",
        body: "I'll read your note personally and be in touch.",
      };
    default: {
      const unreachable: never = source;
      return unreachable;
    }
  }
}

interface Props {
  source: Source;
  onSuccess?: () => void;
  compact?: boolean;
}

export function LeadForm({ source, onSuccess, compact = false }: Props) {
  const formId = React.useId();
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
    if (source === "form" && !payload.message) {
      toast.error("Tell me a little about your idea or opportunity.");
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
      toast.success(confirmation(source).toast);
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
    const copy = confirmation(source);
    return (
      <div className="py-8 text-center">
        <p className="text-lg font-semibold">
          {copy.title}
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          {copy.body}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor={`email-${formId}`}>Email</Label>
        <Input
          id={`email-${formId}`}
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
        />
      </div>

      {!compact && (
        <>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor={`name-${formId}`}>Name</Label>
              <Input
                id={`name-${formId}`}
                name="name"
                autoComplete="name"
                placeholder="Your name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`company-${formId}`}>Company (optional)</Label>
              <Input
                id={`company-${formId}`}
                name="company"
                autoComplete="organization"
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`message-${formId}`}>
              {source === "form" ? "What are you exploring?" : "What's on your mind?"}
            </Label>
            <Textarea
              id={`message-${formId}`}
              name="message"
              rows={4}
              required={source === "form"}
              placeholder={
                source === "form"
                  ? "Share the idea, your background, and what you hope we could make together."
                  : "Tell me what you're working on or what you'd like to explore."
              }
            />
          </div>
        </>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={submitting}>
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending…
          </>
        ) : (
          submitLabel(source)
        )}
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        We&rsquo;ll use your email to reply and keep your details in our CRM. No newsletter unless you opt in.
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
