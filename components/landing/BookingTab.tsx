"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { InlineWidget, useCalendlyEventListener } from "react-calendly";
import { CalendarClock, ExternalLink } from "lucide-react";
import { LeadForm } from "@/components/landing/LeadForm";
import { track } from "@/lib/analytics";

/**
 * Booking tab — Calendly inline widget.
 *
 * Uses the existing Calendly free-tier account at jeremyw@dobeu.net
 * (https://calendly.com/jeremyw-dobeu-r_el). Fires PostHog/Mixpanel/GA4
 * events at each stage of the booking funnel and POSTs the final
 * confirmation to /api/lead so the contact lands in Supabase + Apollo too.
 *
 * Falls back to a LeadForm if NEXT_PUBLIC_CALENDLY_URL is not set.
 */
export function BookingTab({ onClose }: { onClose: () => void }) {
  const calendlyUrl = process.env.NEXT_PUBLIC_CALENDLY_URL;
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Track funnel events
  useCalendlyEventListener({
    onProfilePageViewed: () => track("calendly_profile_viewed"),
    onEventTypeViewed: () => track("calendly_event_type_viewed"),
    onDateAndTimeSelected: () => track("calendly_date_selected"),
    onEventScheduled: (e) => {
      track("booking_scheduled", {
        source: "calendly",
        event_uri: e.data.payload.event.uri,
        invitee_uri: e.data.payload.invitee.uri
      });
      // NOTE: Calendly's client-side scheduled-event payload only exposes the
      // invitee/event *URIs*, not the invitee email or name. Mirroring the booking
      // into Supabase + Apollo + Resend therefore can't happen here — it needs a
      // server-side Calendly webhook (or an authenticated Calendly API call that
      // resolves invitee_uri) to enrich + upsert the contact. Tracked as a follow-up;
      // the booking itself is already captured by Calendly and our analytics event.
      // Close the lightbox after a beat so the confirmation screen flashes briefly.
      setTimeout(onClose, 1500);
    }
  });

  if (!calendlyUrl) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-border bg-muted/40 p-4 flex gap-3">
          <CalendarClock className="h-5 w-5 text-primary mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="font-semibold text-sm">Calendly not yet wired.</p>
            <p className="text-xs text-muted-foreground">
              Drop your details and I&apos;ll send time options within a few hours.
            </p>
          </div>
        </div>
        <LeadForm source="book" onSuccess={onClose} />
      </div>
    );
  }

  // Calendly inline widget config — branded with Dobeu palette
  const pageSettings = {
    backgroundColor: mounted && resolvedTheme === "dark" ? "1A1A2E" : "FAFAFC",
    primaryColor: "6B5CE7",
    textColor: mounted && resolvedTheme === "dark" ? "FAFAFC" : "1A1A2E",
    hideEventTypeDetails: false,
    hideLandingPageDetails: false,
    hideGdprBanner: true
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl overflow-hidden border border-border bg-background -mx-1">
        {mounted && (
          <InlineWidget
            url={calendlyUrl}
            pageSettings={pageSettings}
            styles={{ height: 680, width: "100%" }}
          />
        )}
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Powered by Calendly · 30-minute discovery call ·{" "}
        <a
          href={calendlyUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 underline"
        >
          Open in new tab <ExternalLink className="h-3 w-3" />
        </a>
      </p>
    </div>
  );
}
