import { resolveSatelliteSite, type SatelliteEnv } from "@/lib/satellite-sites";

export type LabDemoId = "work-order" | "shader" | "lead-pipeline";

export interface LabDemoEntry {
  id: LabDemoId;
  title: string;
  summary: string;
  tag: string;
}

export interface LabExperimentEntry {
  id: string;
  title: string;
  summary: string;
  status: "live" | "coming-soon";
}

export const LAB_DEMOS: LabDemoEntry[] = [
  {
    id: "work-order",
    title: "Work order tracker",
    summary: "Follow a request from intake to quote, build, and delivery in a sample client workflow.",
    tag: "Operations",
  },
  {
    id: "shader",
    title: "Shader atmosphere",
    summary: "Tune grain gradient parameters and see how the hero background responds in real time.",
    tag: "Visual",
  },
  {
    id: "lead-pipeline",
    title: "Lead pipeline",
    summary: "Step through capture → enrich → notify with sandboxed, mocked fan-out events.",
    tag: "Growth",
  },
];

/** Swappable featured experiment — edit this entry to rotate the slot. */
export const FEATURED_EXPERIMENT: LabExperimentEntry = {
  id: "immersive-hero",
  title: "Immersive Canvas hero",
  summary: "Full-viewport atmosphere with floating capability cards — now live on the landing.",
  status: "live",
};

export interface LabSatelliteLink {
  id: "tutor";
  label: string;
  href: string;
}

/**
 * Discovery links to separately deployed satellite sites, listed on /labs.
 * Tutor only: an entry exists only when the registry in lib/satellite-sites.ts
 * validates the configured origin. Callers pass literal process.env reads (see
 * resolveSatelliteSites) so Next.js can inline them.
 */
export function resolveLabSatelliteLinks(env: SatelliteEnv): LabSatelliteLink[] {
  const tutor = resolveSatelliteSite("tutor", env);
  return tutor ? [{ id: "tutor", label: "Tutor", href: tutor.origin }] : [];
}
