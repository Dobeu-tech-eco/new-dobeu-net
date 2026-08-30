"use client";

import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { TypeformEmbed } from "@/components/typeform/TypeformEmbed";
import { track } from "@/lib/analytics";

/**
 * Full-page host for the scope & estimate intake.
 *
 * Distinct from `components/landing/TypeformTab.tsx`, which offers a quick
 * LeadForm plus a link to this canonical `/estimate` surface.
 */
export function EstimateIntake() {
  const formId = process.env.NEXT_PUBLIC_TYPEFORM_FORM_ID;

  if (!formId) {
    return (
      <div className="rounded-lg border border-border bg-muted/40 p-8 text-center space-y-4">
        <p className="text-sm text-muted-foreground">
          The estimate form isn&apos;t configured yet. Send the project details over and
          we&apos;ll scope it by hand.
        </p>
        <Button variant="outline" asChild>
          <a href="mailto:jeremyw@dobeu.net?subject=Project%20estimate">
            jeremyw@dobeu.net <ExternalLink className="ml-1 h-3 w-3" />
          </a>
        </Button>
      </div>
    );
  }

  return (
    <TypeformEmbed
      formId={formId}
      style={{ height: "min(78vh, 820px)" }}
      onReady={() => track("estimate_form_loaded", { form_id: formId })}
      onSubmit={() => track("estimate_form_submitted", { form_id: formId })}
    />
  );
}
