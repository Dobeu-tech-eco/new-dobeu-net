/**
 * Preliminary project estimator for the Typeform scope intake.
 *
 * Pure and synchronous by design: no I/O, no clock reads except the caller-
 * supplied `now`, no env access. That keeps it exhaustively testable and means
 * a stored estimate can always be recomputed and audited later against the
 * `rateCardVersion` it was produced under.
 *
 * Nothing here invents a price. Every figure comes from `./rate-card`.
 *
 * The output is deliberately a RANGE plus a confidence label. A single number
 * from a 20-question form would be false precision, and the form's own
 * acknowledgement question tells the client this is a planning estimate.
 */
import {
  AGENT_SURFACE_HOURS,
  AUTH_HOURS,
  BRAND_READINESS_HOURS,
  BUDGET_BANDS,
  CAPABILITY_HOURS,
  COMPLIANCE_UPLIFT,
  COMPLIANCE_UPLIFT_CAP,
  CONFIDENCE_BANDS,
  CONTENT_READINESS_HOURS,
  CUSTOM_MODEL_HOURS,
  DATA_MIGRATION_HOURS,
  DATA_SENSITIVITY_HOURS,
  DELIVERY_UPLIFTS,
  DESIGN_READINESS_HOURS,
  DISCOVERY_FORCES_ROUGH,
  DISCOVERY_HOURS,
  ENGAGEMENT_HOURS,
  FIXED_DEADLINE_RUSH,
  FLAG_HOURS,
  HOURS_PER_AUTOMATION,
  HOURS_PER_DASHBOARD,
  HOURS_PER_EXTRA_CHANNEL,
  HOURS_PER_EXTRA_PAGE,
  HOURS_PER_EXTRA_ROLE,
  HOURS_PER_INTEGRATION,
  HOURS_PER_WORKSHOP,
  HUMAN_APPROVAL_HOURS,
  MARKETING_DELIVERABLE_HOURS,
  MINIMUM_ENGAGEMENT,
  MONTHLY_RETAINER,
  PAYMENT_HOURS,
  RATE_CARD_VERSION,
  RATES,
  RESCUE_MULTIPLIER,
  ROUNDING_INCREMENT,
  RUSH_MULTIPLIER,
  SUPPORT_HOURS,
  TRAINING_HOURS,
  VOLUME_HOURS,
  WEB_SURFACE_HOURS,
  type ConfidenceLabel,
  type Discipline,
  type RetainerBand
} from "./rate-card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Normalized intake answers. Every field is optional — the form branches. */
export interface EstimateInput {
  readonly serviceFamily: string | null;
  readonly projectStage?: string | null;
  readonly webSurface?: string | null;
  readonly requestedCapabilities?: readonly string[];
  readonly pageCount?: number | null;
  readonly authRequired?: string | null;
  readonly roleCount?: number | null;
  readonly dashboardCount?: number | null;
  readonly fileUploads?: boolean | null;
  readonly paymentsRequired?: string | null;
  readonly esignRequired?: boolean | null;
  readonly cmsRequired?: boolean | null;
  readonly dataMigration?: string | null;
  readonly automationCount?: number | null;
  readonly agentSurface?: string | null;
  readonly humanApproval?: string | null;
  readonly dataSensitivity?: string | null;
  readonly expectedVolume?: string | null;
  readonly evaluationRequired?: boolean | null;
  readonly customModelWork?: string | null;
  readonly integrationCount?: number | null;
  readonly marketingDeliverables?: readonly string[];
  readonly marketingChannels?: readonly string[];
  readonly brandAssetsReady?: string | null;
  readonly designReadiness?: string | null;
  readonly contentReadiness?: string | null;
  readonly campaignDuration?: string | null;
  readonly engagementType?: string | null;
  readonly reportingRequired?: boolean | null;
  readonly workshopCount?: number | null;
  readonly targetLaunch?: string | null;
  /** ISO date (YYYY-MM-DD) when `targetLaunch` is `fixed-date`. */
  readonly requestedDeadline?: string | null;
  readonly budgetBand?: string | null;
  readonly decisionReadiness?: string | null;
  readonly complianceRequirements?: readonly string[];
  readonly trainingRequired?: string | null;
  readonly supportLevel?: string | null;
}

export type EstimateTrack = "web" | "automation" | "ai" | "marketing" | "advisory";

export interface EstimateLineItem {
  readonly key: string;
  readonly label: string;
  readonly discipline: Discipline;
  readonly hours: number;
  /** Whole dollars, before uplifts and multipliers. */
  readonly amount: number;
}

export interface EstimateFactor {
  readonly key: string;
  readonly label: string;
  readonly factor: number;
}

export type BudgetFit = "within" | "below" | "above" | "unstated";

export interface EstimateResult {
  readonly rateCardVersion: string;
  readonly track: EstimateTrack;
  readonly lineItems: readonly EstimateLineItem[];
  readonly totalHours: number;
  /** Sum of line items, whole dollars, before uplifts. */
  readonly subtotal: number;
  readonly uplifts: readonly EstimateFactor[];
  readonly multipliers: readonly EstimateFactor[];
  /** Rounded, floored at the minimum engagement. */
  readonly low: number;
  readonly midpoint: number;
  readonly high: number;
  readonly confidence: ConfidenceLabel;
  readonly spread: number;
  readonly unknownCount: number;
  readonly monthlyRetainer: RetainerBand | null;
  readonly retainerKind: string | null;
  readonly budgetFit: BudgetFit;
  /** Internal review flags — surfaced to Jeremy, never to the client. */
  readonly reviewFlags: readonly string[];
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** Choice refs across the form that all mean "we don't know yet". */
const UNKNOWN_REFS: ReadonlySet<string> = new Set(["unknown", "other", "not-sure"]);

const TRACK_BY_SERVICE: Readonly<Record<string, EstimateTrack>> = {
  "website-revamp": "web",
  "website-build": "web",
  "web-application": "web",
  "workflow-automation": "automation",
  "systems-integration": "automation",
  "ai-enablement": "ai",
  "marketing-design": "marketing",
  analytics: "advisory",
  consulting: "advisory",
  "support-retainer": "advisory"
};

const MS_PER_DAY = 86_400_000;

function lookup(table: Readonly<Record<string, number>>, key: string | null | undefined): number {
  if (!key) return 0;
  return table[key] ?? 0;
}

function count(value: number | null | undefined, fallback = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return fallback;
  return value;
}

function roundToIncrement(amount: number): number {
  return Math.round(amount / ROUNDING_INCREMENT) * ROUNDING_INCREMENT;
}

/** Builds a line item, returning null when it contributes nothing. */
function item(
  key: string,
  label: string,
  discipline: Discipline,
  hours: number
): EstimateLineItem | null {
  if (hours <= 0) return null;
  const rounded = Math.round(hours * 10) / 10;
  return { key, label, discipline, hours: rounded, amount: rounded * RATES[discipline] };
}

function compact(items: readonly (EstimateLineItem | null)[]): readonly EstimateLineItem[] {
  return items.filter((entry): entry is EstimateLineItem => entry !== null);
}

// ---------------------------------------------------------------------------
// Track builders — each returns the line items unique to that service family
// ---------------------------------------------------------------------------

function webLineItems(input: EstimateInput): readonly (EstimateLineItem | null)[] {
  const surfaceKey = input.webSurface ?? "marketing-site";
  const surface = WEB_SURFACE_HOURS[surfaceKey] ?? WEB_SURFACE_HOURS["marketing-site"]!;
  const extraPages = Math.max(0, count(input.pageCount, surface.includedPages) - surface.includedPages);
  const extraRoles = Math.max(0, count(input.roleCount, 1) - 1);
  const capabilityHours = (input.requestedCapabilities ?? []).reduce(
    (sum, ref) => sum + lookup(CAPABILITY_HOURS, ref),
    0
  );
  // `file-uploads` can arrive from the capability list or the dedicated
  // yes/no question. Charge it once.
  const uploadsAlreadyCounted = (input.requestedCapabilities ?? []).includes("file-uploads");
  const uploadHours = input.fileUploads && !uploadsAlreadyCounted ? FLAG_HOURS.fileUploads : 0;

  return [
    item("web_base_design", `${labelForSurface(surfaceKey)} — UX and UI`, "design", surface.design),
    item("web_base_build", `${labelForSurface(surfaceKey)} — build`, "engineering", surface.engineering),
    item("web_extra_pages", `${extraPages} additional page(s) or screen(s)`, "engineering", extraPages * HOURS_PER_EXTRA_PAGE),
    item("web_auth", "Authentication and account handling", "engineering", lookup(AUTH_HOURS, input.authRequired)),
    item("web_roles", `${extraRoles} additional role(s) or permission level(s)`, "engineering", extraRoles * HOURS_PER_EXTRA_ROLE),
    item("web_dashboards", "Dashboards and operational workspaces", "engineering", count(input.dashboardCount) * HOURS_PER_DASHBOARD),
    item("web_capabilities", "Selected feature capabilities", "engineering", capabilityHours),
    item("web_uploads", "File upload and document storage", "engineering", uploadHours),
    item("web_payments", "Payment handling", "engineering", lookup(PAYMENT_HOURS, input.paymentsRequired)),
    item("web_esign", "Electronic signature workflow", "engineering", input.esignRequired ? FLAG_HOURS.esign : 0),
    item("web_cms", "Content management for non-technical staff", "engineering", input.cmsRequired ? FLAG_HOURS.cms : 0),
    item("web_brand", "Brand preparation", "design", lookup(BRAND_READINESS_HOURS, input.brandAssetsReady)),
    item("web_design_definition", "Design definition", "design", lookup(DESIGN_READINESS_HOURS, input.designReadiness)),
    item("web_content", "Content production", "content", lookup(CONTENT_READINESS_HOURS, input.contentReadiness))
  ];
}

function labelForSurface(key: string): string {
  const labels: Readonly<Record<string, string>> = {
    "marketing-site": "Marketing site",
    "cms-site": "Content-managed site",
    "customer-portal": "Customer portal",
    "employee-admin": "Employee application",
    "saas-app": "SaaS application",
    ecommerce: "E-commerce",
    mixed: "Combined web platform"
  };
  return labels[key] ?? "Web build";
}

function automationLineItems(input: EstimateInput): readonly (EstimateLineItem | null)[] {
  return [
    item("auto_workflows", "Workflow and automation build", "engineering", count(input.automationCount, 1) * HOURS_PER_AUTOMATION),
    item("auto_approval", "Human-in-the-loop approval design", "engineering", lookup(HUMAN_APPROVAL_HOURS, input.humanApproval)),
    item("auto_sensitivity", "Data protection and access control", "engineering", lookup(DATA_SENSITIVITY_HOURS, input.dataSensitivity)),
    item("auto_volume", "Scale and reliability engineering", "engineering", lookup(VOLUME_HOURS, input.expectedVolume))
  ];
}

function aiLineItems(input: EstimateInput): readonly (EstimateLineItem | null)[] {
  return [
    ...automationLineItems(input),
    item("ai_surface", "AI surface build", "engineering", lookup(AGENT_SURFACE_HOURS, input.agentSurface)),
    item("ai_model_work", "Model and retrieval configuration", "engineering", lookup(CUSTOM_MODEL_HOURS, input.customModelWork)),
    item("ai_evaluation", "Evaluation harness and reference set", "strategy", input.evaluationRequired ? FLAG_HOURS.evaluationHarness : 0)
  ];
}

function marketingLineItems(input: EstimateInput): readonly (EstimateLineItem | null)[] {
  const deliverables = input.marketingDeliverables ?? [];
  // A readiness gap is only a cost when the fix is NOT already a purchased
  // deliverable. Buying `brand-identity` IS the answer to "no brand assets";
  // charging brand preparation on top would bill the same work twice.
  const buysBrand = deliverables.includes("brand-identity");
  const buysDesign = deliverables.includes("website-design");
  const buysContent = deliverables.includes("content");
  const designHours = deliverables.reduce(
    (sum, ref) => sum + (MARKETING_DELIVERABLE_HOURS[ref]?.design ?? 0),
    0
  );
  const contentHours = deliverables.reduce(
    (sum, ref) => sum + (MARKETING_DELIVERABLE_HOURS[ref]?.content ?? 0),
    0
  );
  const extraChannels = Math.max(0, (input.marketingChannels ?? []).length - 1);

  return [
    item("mkt_design", "Marketing and design deliverables", "design", designHours),
    item("mkt_content", "Copy and content production", "content", contentHours),
    item("mkt_channels", `${extraChannels} additional channel(s)`, "content", extraChannels * HOURS_PER_EXTRA_CHANNEL),
    item("mkt_brand", "Brand preparation", "design", buysBrand ? 0 : lookup(BRAND_READINESS_HOURS, input.brandAssetsReady)),
    item("mkt_design_definition", "Design definition", "design", buysDesign ? 0 : lookup(DESIGN_READINESS_HOURS, input.designReadiness)),
    item("mkt_content_readiness", "Content gap fill", "content", buysContent ? 0 : lookup(CONTENT_READINESS_HOURS, input.contentReadiness))
  ];
}

function advisoryLineItems(input: EstimateInput): readonly (EstimateLineItem | null)[] {
  const engagement = ENGAGEMENT_HOURS[input.engagementType ?? "audit"] ?? ENGAGEMENT_HOURS["audit"]!;
  return [
    item("adv_strategy", "Analysis, strategy, and recommendations", "strategy", engagement.strategy),
    item("adv_build", "Hands-on implementation support", "engineering", engagement.engineering),
    item("adv_reporting", "Dashboard or KPI framework", "engineering", input.reportingRequired ? FLAG_HOURS.reportingFramework : 0),
    item("adv_workshops", "Workshops and stakeholder sessions", "strategy", count(input.workshopCount) * HOURS_PER_WORKSHOP),
    item("adv_sensitivity", "Data protection and access control", "engineering", lookup(DATA_SENSITIVITY_HOURS, input.dataSensitivity))
  ];
}

function trackLineItems(track: EstimateTrack, input: EstimateInput): readonly (EstimateLineItem | null)[] {
  if (track === "web") return webLineItems(input);
  if (track === "automation") return automationLineItems(input);
  if (track === "ai") return aiLineItems(input);
  if (track === "marketing") return marketingLineItems(input);
  return advisoryLineItems(input);
}

/** Line items every track shares. */
function universalLineItems(input: EstimateInput): readonly (EstimateLineItem | null)[] {
  return [
    item("discovery", "Discovery and scope definition", "strategy", lookup(DISCOVERY_HOURS, input.projectStage)),
    item("migration", "Data and content migration", "engineering", lookup(DATA_MIGRATION_HOURS, input.dataMigration)),
    item("integrations", "External system integrations", "engineering", count(input.integrationCount) * HOURS_PER_INTEGRATION),
    item("training", "Training and handoff", "content", lookup(TRAINING_HOURS, input.trainingRequired)),
    item("support", "Post-launch support window", "engineering", lookup(SUPPORT_HOURS, input.supportLevel))
  ];
}

// ---------------------------------------------------------------------------
// Multipliers
// ---------------------------------------------------------------------------

function rushFactor(input: EstimateInput, now: Date): EstimateFactor | null {
  const fromDeadline = fixedDeadlineFactor(input, now);
  if (fromDeadline !== null) return fromDeadline;

  const factor = RUSH_MULTIPLIER[input.targetLaunch ?? "flexible"] ?? 1;
  if (factor === 1) return null;
  return { key: "rush", label: "Schedule compression", factor };
}

function fixedDeadlineFactor(input: EstimateInput, now: Date): EstimateFactor | null {
  if (input.targetLaunch !== "fixed-date" || !input.requestedDeadline) return null;
  const deadline = new Date(input.requestedDeadline);
  if (Number.isNaN(deadline.getTime())) return null;

  const days = Math.ceil((deadline.getTime() - now.getTime()) / MS_PER_DAY);
  const tier = FIXED_DEADLINE_RUSH.find((entry) => days <= entry.withinDays);
  if (!tier) return null;
  return { key: "rush", label: `Fixed deadline in ${days} day(s)`, factor: tier.multiplier };
}

function complianceFactor(input: EstimateInput): EstimateFactor | null {
  const refs = (input.complianceRequirements ?? []).filter((ref) => ref !== "none");
  if (refs.length === 0) return null;

  const raw = refs.reduce((sum, ref) => sum + lookup(COMPLIANCE_UPLIFT, ref), 0);
  const capped = Math.min(raw, COMPLIANCE_UPLIFT_CAP);
  if (capped <= 0) return null;
  return {
    key: "compliance",
    label: `Compliance and security requirements (${refs.length})`,
    factor: 1 + capped
  };
}

function rescueFactor(input: EstimateInput): EstimateFactor | null {
  if (input.projectStage !== "rescue") return null;
  return { key: "rescue", label: "Recovery of an in-flight project", factor: RESCUE_MULTIPLIER };
}

// ---------------------------------------------------------------------------
// Confidence, retainers, budget fit
// ---------------------------------------------------------------------------

function countUnknowns(input: EstimateInput): number {
  const singles = [
    input.authRequired,
    input.dataMigration,
    input.paymentsRequired,
    input.humanApproval,
    input.dataSensitivity,
    input.expectedVolume,
    input.customModelWork,
    input.trainingRequired,
    input.supportLevel
  ];
  const singleUnknowns = singles.filter((value) => value !== null && value !== undefined && UNKNOWN_REFS.has(value)).length;

  const listUnknowns = [
    ...(input.requestedCapabilities ?? []),
    ...(input.complianceRequirements ?? []),
    ...(input.marketingDeliverables ?? [])
  ].filter((ref) => UNKNOWN_REFS.has(ref)).length;

  const budgetUnknown = input.budgetBand === "guidance-needed" ? 1 : 0;

  return singleUnknowns + listUnknowns + budgetUnknown;
}

function resolveConfidence(unknowns: number, input: EstimateInput): { label: ConfidenceLabel; spread: number } {
  if (DISCOVERY_FORCES_ROUGH && input.projectStage === "discovery") {
    const widest = CONFIDENCE_BANDS[CONFIDENCE_BANDS.length - 1]!;
    return { label: widest.label, spread: widest.spread };
  }
  const band = CONFIDENCE_BANDS.find((entry) => unknowns <= entry.maxUnknowns) ?? CONFIDENCE_BANDS[CONFIDENCE_BANDS.length - 1]!;
  return { label: band.label, spread: band.spread };
}

function resolveRetainer(input: EstimateInput): { kind: string | null; band: RetainerBand | null } {
  if (input.engagementType === "retainer") return { kind: "fractional", band: MONTHLY_RETAINER["fractional"]! };
  if (input.supportLevel === "retainer") return { kind: "advisory", band: MONTHLY_RETAINER["advisory"]! };
  if (input.campaignDuration === "ongoing") return { kind: "marketing", band: MONTHLY_RETAINER["marketing"]! };
  if (input.supportLevel === "monthly") return { kind: "maintenance", band: MONTHLY_RETAINER["maintenance"]! };
  return { kind: null, band: null };
}

function resolveBudgetFit(midpoint: number, budgetBand: string | null | undefined): BudgetFit {
  if (!budgetBand || budgetBand === "guidance-needed") return "unstated";
  const band = BUDGET_BANDS[budgetBand];
  if (!band) return "unstated";
  if (band.high !== null && midpoint > band.high) return "above";
  if (midpoint < band.low) return "below";
  return "within";
}

function buildReviewFlags(args: {
  input: EstimateInput;
  budgetFit: BudgetFit;
  unknowns: number;
}): readonly string[] {
  const { input, budgetFit, unknowns } = args;
  const flags: string[] = [];

  if (budgetFit === "above") flags.push("Estimate exceeds the stated budget band — reframe scope or reset expectations before quoting.");
  if (budgetFit === "below") flags.push("Estimate sits below the stated budget band — there may be unstated scope worth uncovering.");
  if (budgetFit === "unstated") flags.push("No budget stated — client asked for guidance.");
  if (input.projectStage === "discovery") flags.push("Discovery-only intake — lead with a paid discovery, not a build price.");
  if (input.projectStage === "rescue") flags.push("Project rescue — audit the existing codebase before committing to the range.");
  if (unknowns >= 4) flags.push(`${unknowns} unknown answers — the range is wide on purpose.`);
  if (input.dataSensitivity === "regulated") flags.push("Regulated data in scope — confirm the specific regime before quoting.");
  if (input.decisionReadiness === "collecting-bids") flags.push("Client is collecting multiple bids — expect price comparison.");
  if (input.decisionReadiness === "ready") flags.push("Client is ready to start — prioritise this response.");

  return flags;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Computes a banded planning estimate from normalized intake answers.
 *
 * @param input Normalized answers. Unrecognized or missing values contribute
 *   zero rather than throwing — a partial response still yields a usable
 *   number, with the uncertainty reflected in the confidence band.
 * @param now Reference date for fixed-deadline rush detection. Injected so
 *   tests are deterministic.
 */
export function computeEstimate(input: EstimateInput, now: Date = new Date()): EstimateResult {
  const track = TRACK_BY_SERVICE[input.serviceFamily ?? ""] ?? "advisory";

  const lineItems = compact([...universalLineItems(input), ...trackLineItems(track, input)]);
  const subtotal = lineItems.reduce((sum, entry) => sum + entry.amount, 0);
  const totalHours = Math.round(lineItems.reduce((sum, entry) => sum + entry.hours, 0) * 10) / 10;

  const uplifts: readonly EstimateFactor[] = [
    { key: "pm", label: "Project management and coordination", factor: 1 + DELIVERY_UPLIFTS.projectManagement },
    { key: "qa", label: "QA, accessibility, and launch", factor: 1 + DELIVERY_UPLIFTS.qaAndLaunch }
  ];

  const multipliers = compact2([rushFactor(input, now), complianceFactor(input), rescueFactor(input)]);

  const afterUplifts = uplifts.reduce((total, entry) => total * entry.factor, subtotal);
  const rawMidpoint = multipliers.reduce((total, entry) => total * entry.factor, afterUplifts);

  const unknownCount = countUnknowns(input);
  const { label: confidence, spread } = resolveConfidence(unknownCount, input);

  const midpoint = Math.max(MINIMUM_ENGAGEMENT, roundToIncrement(rawMidpoint));
  const low = Math.max(MINIMUM_ENGAGEMENT, roundToIncrement(rawMidpoint * (1 - spread)));
  const high = Math.max(midpoint, roundToIncrement(rawMidpoint * (1 + spread)));

  const { kind: retainerKind, band: monthlyRetainer } = resolveRetainer(input);
  const budgetFit = resolveBudgetFit(midpoint, input.budgetBand);

  return {
    rateCardVersion: RATE_CARD_VERSION,
    track,
    lineItems,
    totalHours,
    subtotal: Math.round(subtotal),
    uplifts,
    multipliers,
    low,
    midpoint,
    high,
    confidence,
    spread,
    unknownCount,
    monthlyRetainer,
    retainerKind,
    budgetFit,
    reviewFlags: buildReviewFlags({ input, budgetFit, unknowns: unknownCount })
  };
}

function compact2(entries: readonly (EstimateFactor | null)[]): readonly EstimateFactor[] {
  return entries.filter((entry): entry is EstimateFactor => entry !== null);
}
