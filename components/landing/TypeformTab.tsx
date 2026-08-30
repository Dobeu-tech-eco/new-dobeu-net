"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeadForm } from "@/components/landing/LeadForm";

export function TypeformTab({ onClose }: { onClose?: () => void }) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-1">
        <p className="text-sm font-semibold">Need a planning estimate?</p>
        <p className="text-xs text-muted-foreground">
          The full scope intake lives on its own page — about 7 minutes, adaptive
          questions, and a preliminary range by email.
        </p>
      </div>

      <LeadForm source="form" onSuccess={onClose} />

      <div className="border-t border-border pt-4">
        <Button asChild size="lg" className="w-full">
          <Link href="/estimate">
            Get a planning estimate (≈7 min)
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
