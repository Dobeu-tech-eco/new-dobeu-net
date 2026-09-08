"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useLightbox } from "@/components/landing/LightboxProvider";

export function ConversionBridge({ label = "Want this for your product?" }: { label?: string }) {
  const { open } = useLightbox();

  return (
    <div className="mt-6 flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="rounded-full" onClick={() => open("book")}>
          Book a call
        </Button>
        <Button size="sm" variant="outline" className="rounded-full" onClick={() => open("form")}>
          Tell me about your project
        </Button>
      </div>
    </div>
  );
}

export function AgentLoopDemo() {
  const [step, setStep] = useState(0);
  const steps = ["Plan unit scope", "Dispatch tools", "Verify diff", "Commit"];

  return (
    <div className="space-y-4">
      <ol className="space-y-2 text-sm">
        {steps.map((s, i) => (
          <li
            key={s}
            className={`rounded-lg border px-3 py-2 ${i <= step ? "border-primary/40 bg-primary/5" : "border-border/50 text-muted-foreground"}`}
          >
            {i + 1}. {s}
          </li>
        ))}
      </ol>
      <Button
        size="sm"
        variant="secondary"
        className="rounded-full"
        onClick={() => setStep((n) => (n + 1) % steps.length)}
      >
        Advance loop
      </Button>
      <ConversionBridge />
    </div>
  );
}

export function ShaderDemo() {
  const [intensity, setIntensity] = useState(58);

  return (
    <div className="space-y-4">
      <div
        className="relative h-32 overflow-hidden rounded-xl border border-border/50"
        style={{
          background: `radial-gradient(circle at 30% 40%, rgba(139,92,246,${intensity / 100}) 0%, transparent 55%), radial-gradient(circle at 70% 20%, rgba(245,158,11,${intensity / 120}) 0%, transparent 50%), var(--background)`,
        }}
      />
      <label className="flex items-center gap-3 text-sm">
        <span className="text-muted-foreground shrink-0">Intensity</span>
        <input
          type="range"
          min={20}
          max={90}
          value={intensity}
          onChange={(e) => setIntensity(Number(e.target.value))}
          className="w-full accent-primary"
        />
        <span className="tabular-nums w-8 text-right">{intensity}</span>
      </label>
      <ConversionBridge />
    </div>
  );
}

export function LeadPipelineDemo() {
  const [events, setEvents] = useState<string[]>([]);
  const stages = ["Lead captured", "Apollo upsert", "Customer.io event", "Resend notify"];

  function runPipeline() {
    setEvents([]);
    stages.forEach((stage, i) => {
      window.setTimeout(() => setEvents((prev) => [...prev, stage]), (i + 1) * 400);
    });
  }

  return (
    <div className="space-y-4">
      <Button size="sm" className="rounded-full" onClick={runPipeline}>
        Run mocked pipeline
      </Button>
      <ul className="space-y-2 text-sm font-mono">
        {events.map((ev) => (
          <li key={ev} className="rounded-md border border-border/50 bg-elevated/50 px-3 py-2 text-primary/90">
            ✓ {ev}
          </li>
        ))}
      </ul>
      <ConversionBridge />
    </div>
  );
}
