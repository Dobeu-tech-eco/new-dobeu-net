/**
 * Maps a Typeform `form_response` payload onto the estimator's input shape.
 *
 * Kept separate from `estimate.ts` so the pricing model stays a pure function
 * of normalized data and never learns Typeform's wire format. If the intake
 * ever moves off Typeform, only this file changes.
 *
 * ## Answer addressing
 *
 * Answers are located by field REF first (stable, human-readable slugs such as
 * `service_family`) and by field ID second. Typeform can rewrite refs to UUIDs
 * on republish, so the ID map in `FIELD_IDS` is the safety net — it was
 * captured from form `wKVKIBe7` on 2026-08-29 and IDs survive republishing.
 *
 * If BOTH lookups miss, the value is simply absent and the estimator treats it
 * as zero-contribution. A renamed field degrades the estimate; it never throws.
 */

/** Typeform answer as delivered by the `form_response` webhook. */
export interface TypeformAnswer {
  readonly type?: string;
  readonly text?: string;
  readonly email?: string;
  readonly url?: string;
  readonly phone_number?: string;
  readonly number?: number;
  readonly boolean?: boolean;
  readonly date?: string;
  readonly choice?: { readonly label?: string; readonly ref?: string; readonly id?: string };
  readonly choices?: {
    readonly labels?: readonly string[];
    readonly refs?: readonly string[];
    readonly ids?: readonly string[];
  };
  readonly field?: { readonly id?: string; readonly ref?: string; readonly type?: string };
}

/**
 * Field ref -> field id, captured from form wKVKIBe7 on 2026-08-29.
 * Used only when a ref lookup misses (i.e. after a republish rewrote refs).
 */
export const FIELD_IDS: Readonly<Record<string, string>> = {
  contact_name: "EqWBLTvWqmnC",
  work_email: "it3xkO0dMRYU",
  phone: "kc7SxENtmCHJ",
  company_name: "gMuRz1jn9E4z",
  company_website: "ZwYUS6qUjsLW",
  service_family: "ce0A2L845o8X",
  project_stage: "QN9QC5fosVOq",
  current_platform: "679wamWhikET",
  current_site_url: "6kojwIofcs6R",
  web_surface: "SVFn8mwFogx9",
  requested_capabilities: "6jlF07cC8oBI",
  page_count: "ePaxG9H5VMgi",
  auth_required: "bUFPbbmL8Po6",
  role_count: "bXs4DlZlTo7F",
  dashboard_count: "6uzsEUgPTrMH",
  file_uploads: "ntzuWzQpmv6J",
  payments_required: "MW2WFG0BthT0",
  esign_required: "siqBwrEQyOKP",
  cms_required: "2ATGby3x9mJ7",
  data_migration: "isyB0xV4gRNp",
  automation_count: "G3wQHFdp9Nvo",
  systems_involved: "P7kGkPZv0UTF",
  agent_surface: "0jsnGEMItVUI",
  human_approval: "m3uQPrQXgRTK",
  data_sensitivity: "4uOMpJkBkdPe",
  expected_volume: "qhOj38bE4iS4",
  evaluation_required: "ceVXoDGnes6d",
  custom_model_work: "TT8jJYCIdR3z",
  integration_count: "w3ALypLwgLWh",
  integration_names: "obRaGZ83McPw",
  marketing_deliverables: "FHcQKWk56jLh",
  marketing_channels: "kh6SiHdTqJHu",
  brand_assets_ready: "uFtlmw3EArT9",
  design_readiness: "LOpWRmFTCdWw",
  content_readiness: "nmvB9eiWLqJM",
  campaign_duration: "SI9OVqOEq33Q",
  engagement_type: "0bcLhIFe44iO",
  current_problem: "EyFe2adjeVWO",
  data_sources: "y0eqNV8J2PnF",
  reporting_required: "BTgfTrrDbLvU",
  workshop_count: "XfaAdflvbJ7U",
  target_launch: "zEOh3OAdGsH3",
  requested_deadline: "ATTaOkYMl4kJ",
  budget_band: "CL1VxBC3LVkE",
  decision_readiness: "3BfUk0d3NFiy",
  project_summary: "u5gXxhwmPCDO",
  reference_links: "mjq1RoONIL3w",
  compliance_requirements: "gqQk01dEjQTC",
  training_required: "E89DF1BP1n17",
  support_level: "piB23Mim8EmN",
  additional_details: "AIfF9haxrBtr",
  estimate_acknowledgement: "VmR1xl4j8nJw"
};

/** Indexes answers by ref and by id for O(1) lookup. */
export interface AnswerIndex {
  readonly byRef: ReadonlyMap<string, TypeformAnswer>;
  readonly byId: ReadonlyMap<string, TypeformAnswer>;
}

export function indexAnswers(answers: readonly TypeformAnswer[]): AnswerIndex {
  const byRef = new Map<string, TypeformAnswer>();
  const byId = new Map<string, TypeformAnswer>();
  for (const answer of answers) {
    const ref = answer.field?.ref;
    const id = answer.field?.id;
    if (ref) byRef.set(ref, answer);
    if (id) byId.set(id, answer);
  }
  return { byRef, byId };
}

function find(index: AnswerIndex, ref: string): TypeformAnswer | undefined {
  const direct = index.byRef.get(ref);
  if (direct) return direct;
  const fallbackId = FIELD_IDS[ref];
  return fallbackId ? index.byId.get(fallbackId) : undefined;
}

// ---- typed readers -------------------------------------------------------

export function readText(index: AnswerIndex, ref: string): string | null {
  const answer = find(index, ref);
  const value = answer?.text ?? answer?.url ?? answer?.email ?? answer?.phone_number;
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function readEmail(index: AnswerIndex, ref: string): string | null {
  const answer = find(index, ref);
  const value = (answer?.email ?? answer?.text)?.trim();
  return value ? value : null;
}

export function readNumber(index: AnswerIndex, ref: string): number | null {
  const value = find(index, ref)?.number;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function readBoolean(index: AnswerIndex, ref: string): boolean | null {
  const value = find(index, ref)?.boolean;
  return typeof value === "boolean" ? value : null;
}

export function readDate(index: AnswerIndex, ref: string): string | null {
  const value = find(index, ref)?.date;
  return value ? value : null;
}

/** Single-select: returns the choice REF (a stable slug), not the label. */
export function readChoiceRef(index: AnswerIndex, ref: string): string | null {
  const choice = find(index, ref)?.choice;
  return choice?.ref ?? null;
}

/** Multi-select: returns the choice REFs. Empty array when unanswered. */
export function readChoiceRefs(index: AnswerIndex, ref: string): readonly string[] {
  return find(index, ref)?.choices?.refs ?? [];
}

/** Human-readable label(s), for the admin email and stored snapshot. */
export function readChoiceLabels(index: AnswerIndex, ref: string): readonly string[] {
  const answer = find(index, ref);
  if (answer?.choices?.labels) return answer.choices.labels;
  if (answer?.choice?.label) return [answer.choice.label];
  return [];
}
