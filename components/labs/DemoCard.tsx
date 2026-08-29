"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LabDemoEntry } from "@/lib/labs-data";
import { AgentLoopDemo, LeadPipelineDemo, ShaderDemo } from "@/components/labs/demos";

const DEMO_COMPONENTS = {
  "agent-loop": AgentLoopDemo,
  shader: ShaderDemo,
  "lead-pipeline": LeadPipelineDemo,
} as const;

export function DemoCard({ demo }: { demo: LabDemoEntry }) {
  const [open, setOpen] = useState(false);
  const DemoPanel = DEMO_COMPONENTS[demo.id];

  return (
    <article className="rounded-2xl border border-border/50 bg-card overflow-hidden">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-4 p-6 text-left hover:bg-muted/30 transition-colors"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-2">{demo.tag}</p>
          <h2 className="font-display text-xl font-bold tracking-tight">{demo.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{demo.summary}</p>
        </div>
        <ChevronDown
          className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="border-t border-border/40 px-6 pb-6 pt-4">
          <DemoPanel />
        </div>
      )}
    </article>
  );
}
