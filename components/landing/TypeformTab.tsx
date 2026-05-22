"use client";

import { Widget } from "@typeform/embed-react";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { track } from "@/lib/analytics";

export function TypeformTab() {
  const formId = process.env.NEXT_PUBLIC_TYPEFORM_FORM_ID;

  if (!formId) {
    return (
      <div className="rounded-lg border border-border bg-muted/40 p-6 text-center space-y-3">
        <p className="text-sm">
          Typeform isn&apos;t wired yet. Drop a note instead:
        </p>
        <Button variant="outline" asChild>
          <a href="mailto:jeremyw@dobeu.net?subject=Project%20Inquiry">
            jeremyw@dobeu.net <ExternalLink className="h-3 w-3 ml-1" />
          </a>
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Widget
        id={formId}
        style={{ height: 560 }}
        className="w-full"
        onSubmit={() => track("typeform_submitted", { form_id: formId })}
        onReady={() => track("typeform_loaded", { form_id: formId })}
      />
    </div>
  );
}
