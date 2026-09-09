/**
 * Dobeu Tech Solutions rate card — the single editable source of truth for the
 * Typeform intake estimator (`lib/pricing/estimate.ts`).
 *
 * EVERY number a client ever sees traces back to this file. Change a value
 * here and the estimator, the emailed estimate, and `/estimate/[token]` all
 * move together. Nothing else in the codebase hard-codes a price.
 *
 * ## How the model works
 *
 *   line items (hours x discipline rate)  ->  subtotal
 *   subtotal x delivery uplifts (PM, QA)  ->  adjusted
 *   adjusted x multipliers (rush, compliance, rescue)  ->  midpoint
 *   midpoint +/- confidence band          ->  the range the client sees
 *
 * Hours are the unit of estimation, not dollars, so a rate change never
 * silently rewrites the scope logic.
 *
 * ## Benchmarks behind the defaults (2026, retrieved 2026-08-29)
 *
 * - Clutch: US web-development agencies bill $100-$149/hr; average project
 *   $66.5k over ~9 months.
 * - FullStack Labs 2026 price guide: boutique/small agencies $75-$250/hr,
 *   mid-market $100-$300/hr; 65.7% of projects land in the $30k-$100k band;
 *   integrations and data migration add 20-30%, scope change 10-25%.
 * - GroovyWeb 2026 AI consulting rates: boutique consultancies $150-$300/hr;
 *   senior execution $150-$200/hr, principal strategy+build $200-$350/hr;
 *   AI PoC/MVP $20k-$50k over 4-8 weeks.
 * - Digital Marketing New Jersey 2026 guide: local SEO $1.5k-$3.5k/mo,
 *   organic social $800-$2.5k/mo, content $1.2k-$4k/mo; brochure sites
 *   $5k-$9k, conversion-optimized $12k-$25k, custom w/ integrations
 *   $35k-$60k.
 *
 * DOBEU'S POSITION: technical boutique in the NJ/NYC market. The blended
 * engineering rate sits at the top of Clutch's US band ($100-$149) and
 * mid-range for boutiques -- above commodity shops, below mid-market
 * consultancies. Strategy is priced at the boutique AI-consulting floor.
 *
 * >>> Jeremy: these are drafted defaults. Edit the numbers, not the shape. <<<
 */

/** Version stamp recorded on every estimate so old quotes stay explainable. */
export const RATE_CARD_VERSION = "2026.08-draft" as const;

/** Hourly rates in whole US dollars, by discipline. */
export const RATES = {
  /** Discovery, architecture, advisory, consulting engagements. */
  strategy: 185,
  /** Application, integration, and automation build work. */
  engineering: 150,
  /** UX, UI, brand, and visual design. */
  design: 130,
  /** Copywriting, content production, marketing execution. */
  content: 110
} as const;

export type Discipline = keyof typeof RATES;

/** Uplifts applied to the line-item subtotal, in order. */
export const DELIVERY_UPLIFTS = {
  /** Project management, coordination, status reporting. */
  projectManagement: 0.12,
  /** QA, accessibility passes, launch and deploy support. */
  qaAndLaunch: 0.1
} as const;

/** Minimum engagement Dobeu will take on, in whole dollars. */
export const MINIMUM_ENGAGEMENT = 2_500;

/** All client-facing dollar figures round to this increment. */
export const ROUNDING_INCREMENT = 500;

// ---------------------------------------------------------------------------
// Universal line items
// ---------------------------------------------------------------------------

/** Discovery and scope-definition hours, keyed by `project_stage` choice ref. */
export const DISCOVERY_HOURS: Readonly<Record<string, number>> = {
  new: 8,
  rebuild: 10,
  extension: 5,
  rescue: 16,
  discovery: 20
};

/** Post-delivery training hours, keyed by `training_required` choice ref. */
export const TRAINING_HOURS: Readonly<Record<string, number>> = {
  none: 0,
  written: 6,
  "one-session": 4,
  "multiple-sessions": 14,
  "recorded-and-written": 12,
  unknown: 6
};

/** One-time post-launch support hours, keyed by `support_level` choice ref. */
export const SUPPORT_HOURS: Readonly<Record<string, number>> = {
  "launch-only": 0,
  "14-days": 4,
  "30-days": 6,
  monthly: 6,
  retainer: 6,
  unknown: 4
};

/** Data-migration hours, keyed by `data_migration` choice ref. */
export const DATA_MIGRATION_HOURS: Readonly<Record<string, number>> = {
  none: 0,
  small: 8,
  medium: 24,
  large: 60,
  unknown: 20
};

/** Hours per external integration. Reflects the 20-30% integration premium. */
export const HOURS_PER_INTEGRATION = 10;

// ---------------------------------------------------------------------------
// Web / application track
// ---------------------------------------------------------------------------

export interface WebSurfaceSpec {
  readonly design: number;
  readonly engineering: number;
  readonly includedPages: number;
}

/** Base build hours by `web_surface`, split across design and engineering. */
export const WEB_SURFACE_HOURS: Readonly<Record<string, WebSurfaceSpec>> = {
  "marketing-site": { design: 10, engineering: 14, includedPages: 3 },
  "cms-site": { design: 12, engineering: 24, includedPages: 4 },
  "customer-portal": { design: 16, engineering: 48, includedPages: 5 },
  "employee-admin": { design: 14, engineering: 56, includedPages: 5 },
  "saas-app": { design: 26, engineering: 84, includedPages: 6 },
  ecommerce: { design: 20, engineering: 60, includedPages: 5 },
  mixed: { design: 22, engineering: 68, includedPages: 6 }
};

/** Blended hours for each page/screen beyond the surface's included count. */
export const HOURS_PER_EXTRA_PAGE = 3;

/** Authentication build hours, keyed by `auth_required` choice ref. */
export const AUTH_HOURS: Readonly<Record<string, number>> = {
  none: 0,
  customers: 16,
  staff: 16,
  both: 28,
  unknown: 20
};

/** Hours for each user role beyond the first. */
export const HOURS_PER_EXTRA_ROLE = 4;

/** Hours per distinct dashboard or operational workspace. */
export const HOURS_PER_DASHBOARD = 10;

/**
 * Capability hours, keyed by `requested_capabilities` choice ref.
 *
 * `payments` and `esign` are deliberately zero here — they are priced from
 * the dedicated `payments_required` / `esign_required` questions, which carry
 * more signal. Leaving them at zero prevents double-counting.
 */
export const CAPABILITY_HOURS: Readonly<Record<string, number>> = {
  database: 10,
  "public-intake": 8,
  "admin-dashboard": 16,
  "advanced-roles": 12,
  "file-uploads": 10,
  "email-notifications": 4,
  "sms-alerts": 6,
  "csv-export": 4,
  "customer-employer-portal": 20,
  "enhanced-search": 10,
  payments: 0,
  esign: 0,
  reporting: 14,
  other: 6
};

/** Payment-integration hours, keyed by `payments_required` choice ref. */
export const PAYMENT_HOURS: Readonly<Record<string, number>> = {
  none: 0,
  "one-time": 14,
  invoicing: 20,
  subscriptions: 30,
  marketplace: 60,
  unknown: 20
};

/** Flat hours for standalone yes/no scope questions. */
export const FLAG_HOURS = {
  esign: 14,
  cms: 18,
  fileUploads: 10,
  evaluationHarness: 30,
  reportingFramework: 30
} as const;

// ---------------------------------------------------------------------------
// Automation / integration / AI track
// ---------------------------------------------------------------------------

/** Hours per distinct workflow or automation. */
export const HOURS_PER_AUTOMATION = 12;

/** Human-in-the-loop design hours, keyed by `human_approval` choice ref. */
export const HUMAN_APPROVAL_HOURS: Readonly<Record<string, number>> = {
  "every-action": 12,
  "high-risk-only": 8,
  "review-after": 4,
  "fully-automatic": 6,
  unknown: 8
};

/**
 * Hours for handling data at a given sensitivity, keyed by `data_sensitivity`.
 * This covers implementation work (encryption, access control, audit trails).
 * Named compliance regimes are priced separately as a multiplier.
 */
export const DATA_SENSITIVITY_HOURS: Readonly<Record<string, number>> = {
  public: 0,
  internal: 4,
  confidential: 16,
  regulated: 40,
  unknown: 12
};

/** Scale and reliability hours, keyed by `expected_volume` choice ref. */
export const VOLUME_HOURS: Readonly<Record<string, number>> = {
  "under-100": 0,
  "100-1000": 4,
  "1000-10000": 10,
  "10000-100000": 24,
  "over-100000": 48,
  unknown: 10
};

/** AI surface build hours, keyed by `agent_surface` choice ref. */
export const AGENT_SURFACE_HOURS: Readonly<Record<string, number>> = {
  "internal-assistant": 40,
  "customer-agent": 70,
  "background-workflow": 30,
  "document-pipeline": 55,
  mixed: 75
};

/** Model-customization hours, keyed by `custom_model_work` choice ref. */
export const CUSTOM_MODEL_HOURS: Readonly<Record<string, number>> = {
  "prompt-workflow": 12,
  rag: 45,
  "fine-tuning": 90,
  "multiple-models": 55,
  unknown: 30
};

// ---------------------------------------------------------------------------
// Marketing / design track
// ---------------------------------------------------------------------------

export interface MarketingDeliverableSpec {
  readonly design: number;
  readonly content: number;
}

/** Deliverable hours, keyed by `marketing_deliverables` choice ref. */
export const MARKETING_DELIVERABLE_HOURS: Readonly<Record<string, MarketingDeliverableSpec>> = {
  "brand-identity": { design: 45, content: 6 },
  "website-design": { design: 55, content: 8 },
  "graphic-design": { design: 20, content: 2 },
  content: { design: 4, content: 30 },
  seo: { design: 2, content: 28 },
  campaign: { design: 14, content: 18 },
  social: { design: 12, content: 14 },
  analytics: { design: 2, content: 16 },
  other: { design: 6, content: 6 }
};

/** Hours for each marketing channel beyond the first. */
export const HOURS_PER_EXTRA_CHANNEL = 6;

/** Brand-preparation hours, keyed by `brand_assets_ready` choice ref. */
export const BRAND_READINESS_HOURS: Readonly<Record<string, number>> = {
  complete: 0,
  partial: 10,
  "logo-only": 20,
  none: 32
};

/** Design-definition hours, keyed by `design_readiness` choice ref. */
export const DESIGN_READINESS_HOURS: Readonly<Record<string, number>> = {
  final: 0,
  wireframes: 6,
  concept: 16,
  none: 28
};

/** Content-production hours, keyed by `content_readiness` choice ref. */
export const CONTENT_READINESS_HOURS: Readonly<Record<string, number>> = {
  ready: 0,
  "mostly-ready": 6,
  partial: 14,
  "not-started": 26
};

// ---------------------------------------------------------------------------
// Consulting / analytics track
// ---------------------------------------------------------------------------

export interface EngagementSpec {
  readonly strategy: number;
  readonly engineering: number;
}

/** Engagement hours, keyed by `engagement_type` choice ref. */
export const ENGAGEMENT_HOURS: Readonly<Record<string, EngagementSpec>> = {
  audit: { strategy: 40, engineering: 6 },
  strategy: { strategy: 60, engineering: 0 },
  implementation: { strategy: 24, engineering: 56 },
  analytics: { strategy: 20, engineering: 50 },
  training: { strategy: 30, engineering: 0 },
  retainer: { strategy: 16, engineering: 8 }
};

/** Hours per workshop, training session, or stakeholder meeting. */
export const HOURS_PER_WORKSHOP = 6;

// ---------------------------------------------------------------------------
// Multipliers
// ---------------------------------------------------------------------------

/** Schedule-compression multiplier, keyed by `target_launch` choice ref. */
export const RUSH_MULTIPLIER: Readonly<Record<string, number>> = {
  "under-2-weeks": 1.35,
  "2-4-weeks": 1.2,
  "1-2-months": 1.05,
  "2-4-months": 1.0,
  "4-plus-months": 1.0,
  "fixed-date": 1.0, // recomputed from `requested_deadline` when supplied
  flexible: 1.0
};

/** Rush multiplier applied when a fixed deadline lands inside this window. */
export const FIXED_DEADLINE_RUSH = [
  { withinDays: 14, multiplier: 1.35 },
  { withinDays: 30, multiplier: 1.2 },
  { withinDays: 60, multiplier: 1.05 }
] as const;

/**
 * Additive compliance uplifts, keyed by `compliance_requirements` choice ref.
 * Summed, then applied as `1 + total`, capped by COMPLIANCE_UPLIFT_CAP.
 */
export const COMPLIANCE_UPLIFT: Readonly<Record<string, number>> = {
  none: 0,
  accessibility: 0.05,
  "privacy-pii": 0.08,
  pci: 0.12,
  health: 0.15,
  financial: 0.12,
  government: 0.1,
  "soc-iso": 0.15,
  other: 0.05
};

/** Ceiling on the summed compliance uplift. */
export const COMPLIANCE_UPLIFT_CAP = 0.45;

/** Premium for taking over a stalled or broken build. */
export const RESCUE_MULTIPLIER = 1.15;

// ---------------------------------------------------------------------------
// Confidence banding
// ---------------------------------------------------------------------------

export type ConfidenceLabel = "firm" | "indicative" | "rough";

export interface ConfidenceBand {
  readonly maxUnknowns: number;
  readonly spread: number;
  readonly label: ConfidenceLabel;
}

/**
 * Half-width of the quoted range, chosen by how many answers were "unknown"
 * or "not sure". More admitted uncertainty, wider band — the honest response
 * to a vague brief is a vaguer number, not a falsely precise one.
 */
export const CONFIDENCE_BANDS: readonly ConfidenceBand[] = [
  { maxUnknowns: 1, spread: 0.15, label: "firm" },
  { maxUnknowns: 3, spread: 0.25, label: "indicative" },
  { maxUnknowns: Number.POSITIVE_INFINITY, spread: 0.35, label: "rough" }
];

/** Discovery-only intakes are always quoted at the widest band. */
export const DISCOVERY_FORCES_ROUGH = true;

// ---------------------------------------------------------------------------
// Recurring work
// ---------------------------------------------------------------------------

export interface RetainerBand {
  readonly low: number;
  readonly high: number;
}

/**
 * Monthly retainer bands in whole dollars, benchmarked to the 2026 NJ market.
 * Emitted alongside — never instead of — the one-time build estimate.
 */
export const MONTHLY_RETAINER: Readonly<Record<string, RetainerBand>> = {
  /** `support_level: monthly` — maintenance, patching, small changes. */
  maintenance: { low: 750, high: 2_000 },
  /** `support_level: retainer` — ongoing advisory plus delivery capacity. */
  advisory: { low: 2_500, high: 6_000 },
  /** `campaign_duration: ongoing` — marketing program management. */
  marketing: { low: 1_500, high: 5_000 },
  /** `engagement_type: retainer` — fractional technical leadership. */
  fractional: { low: 4_000, high: 10_000 }
};

export interface BudgetBand {
  readonly low: number;
  readonly high: number | null;
}

/** Budget bands from the form, as inclusive dollar ranges, for fit checking. */
export const BUDGET_BANDS: Readonly<Record<string, BudgetBand>> = {
  "under-2500": { low: 0, high: 2_500 },
  "2500-5000": { low: 2_500, high: 5_000 },
  "5000-10000": { low: 5_000, high: 10_000 },
  "10000-25000": { low: 10_000, high: 25_000 },
  "25000-50000": { low: 25_000, high: 50_000 },
  "50000-plus": { low: 50_000, high: null },
  "guidance-needed": { low: 0, high: null }
};
