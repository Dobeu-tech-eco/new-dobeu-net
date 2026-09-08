export type LabDemoId = "agent-loop" | "shader" | "lead-pipeline";

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
    id: "agent-loop",
    title: "Agent loop",
    summary: "Watch a mocked plan → act → verify cycle with tool calls and status transitions.",
    tag: "AI",
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
