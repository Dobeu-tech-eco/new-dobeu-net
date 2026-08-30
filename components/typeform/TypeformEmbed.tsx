"use client";

import { useMemo } from "react";
import { Widget } from "@typeform/embed-react";
import { cn } from "@/lib/utils";

export interface TypeformEmbedProps {
  /** Defaults to `NEXT_PUBLIC_TYPEFORM_FORM_ID`. */
  formId?: string;
  style?: React.CSSProperties;
  className?: string;
  onReady?: () => void;
  onSubmit?: () => void;
}

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
] as const;

function collectHiddenUtms(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const out: Record<string, string> = {};
  const sp = new URLSearchParams(window.location.search);
  for (const key of UTM_KEYS) {
    const value = sp.get(key);
    if (value) out[key] = value;
  }
  return out;
}

/**
 * Shared Typeform inline widget — one config surface for embed options.
 *
 * Matches the BookingTab wrapper styling and centralizes SDK flags so
 * `/estimate` and any future embeds stay consistent.
 */
export function TypeformEmbed({
  formId = process.env.NEXT_PUBLIC_TYPEFORM_FORM_ID,
  style,
  className,
  onReady,
  onSubmit,
}: TypeformEmbedProps) {
  const hidden = useMemo(() => collectHiddenUtms(), []);

  if (!formId) return null;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-background",
        className
      )}
    >
      <Widget
        id={formId}
        style={style}
        className="w-full"
        hideHeaders
        hideFooter
        autoResize
        inlineOnMobile
        opacity={0}
        redirectTarget="_top"
        hidden={hidden}
        onReady={onReady}
        onSubmit={onSubmit}
        iframeProps={{ title: "Project scope and planning estimate form" }}
      />
    </div>
  );
}
