"use client";

import { Widget } from "@typeform/embed-react";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { track } from "@/lib/analytics";

/**
 * Full-page host for the scope & estimate intake.
 *
 * Distinct from `components/landing/TypeformTab.tsx`, which embeds the same
 * form inside the lightbox at a fixed 560px. This one fills the viewport so a
 * 20-question branching form does not scroll inside a box.
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
    <div className="overflow-hidden rounded-xl border border-border">
      <Widget
        id={formId}
        style={{ height: "min(78vh, 820px)" }}
        className="w-full"
        onReady={() => track("estimate_form_loaded", { form_id: formId })}
        onSubmit={() => track("estimate_form_submitted", { form_id: formId })}
      />
    </div>
  );
}
