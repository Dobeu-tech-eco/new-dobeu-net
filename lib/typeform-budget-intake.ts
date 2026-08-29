import type { Json } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/server";

export const TYPEFORM_BUDGET_FORM_ID = "wKVKIBe7";

export function isTypeformBudgetFormConfigurationConsistent(): boolean {
  return process.env.NEXT_PUBLIC_TYPEFORM_FORM_ID === TYPEFORM_BUDGET_FORM_ID;
}

export const TYPEFORM_BUDGET_FIELD_IDS = {
  work_email: "it3xkO0dMRYU",
  contact_name: "EqWBLTvWqmnC",
  company_name: "gMuRz1jn9E4z",
  service_family: "ce0A2L845o8X",
  budget_band: "CL1VxBC3LVkE",
  project_summary: "u5gXxhwmPCDO",
} as const;

export const TYPEFORM_BUDGET_BAND_REFS = [
  "under-2500",
  "2500-5000",
  "5000-10000",
  "10000-25000",
  "25000-50000",
  "50000-plus",
  "guidance-needed",
] as const;

export type TypeformBudgetBandRef = (typeof TYPEFORM_BUDGET_BAND_REFS)[number];

export const TYPEFORM_BUDGET_MAPPING_WARNINGS = [
  "missing_email",
  "missing_name",
  "missing_company",
  "missing_service_family_ref",
  "missing_budget_band_ref",
  "unknown_budget_band_ref",
  "missing_project_summary",
  "missing_submitted_at",
  "invalid_submitted_at",
] as const;

export type TypeformBudgetMappingWarning =
  (typeof TYPEFORM_BUDGET_MAPPING_WARNINGS)[number];

export interface TypeformAnswer {
  readonly type?: string;
  readonly text?: string;
  readonly email?: string;
  readonly choice?: {
    readonly id?: string;
    readonly label?: string;
    readonly ref?: string;
  };
  readonly field?: {
    readonly id?: string;
    readonly ref?: string;
    readonly type?: string;
  };
}

export interface TypeformBudgetWebhookPayload {
  readonly event_id?: string;
  readonly event_type?: string;
  readonly form_response?: {
    readonly form_id?: string;
    readonly token?: string;
    readonly submitted_at?: string;
    readonly hidden?: Readonly<Record<string, string | undefined>>;
    readonly answers?: readonly TypeformAnswer[];
  };
}

export interface ExtractedTypeformBudgetIntake {
  readonly formId: typeof TYPEFORM_BUDGET_FORM_ID;
  readonly responseToken: string;
  readonly eventId: string | null;
  readonly submittedAt: string | null;
  readonly mappingStatus: "mapped" | "needs_review";
  readonly mappingWarnings: readonly TypeformBudgetMappingWarning[];
  readonly email: string | null;
  readonly name: string | null;
  readonly company: string | null;
  readonly serviceFamilyRef: string | null;
  readonly serviceFamilyLabel: string | null;
  readonly budgetBandRef: string | null;
  readonly budgetBandLabel: string | null;
  readonly projectSummary: string | null;
}

export interface PersistedTypeformBudgetIntake {
  readonly id: string;
  readonly duplicate: boolean;
  readonly mappingStatus: "mapped" | "needs_review";
  readonly mappingWarnings: readonly TypeformBudgetMappingWarning[];
}

export class TypeformBudgetIntakeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TypeformBudgetIntakeValidationError";
  }
}

export class TypeformBudgetIntakeStorageError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "TypeformBudgetIntakeStorageError";
  }
}

const MAX_LENGTH = {
  eventId: 255,
  responseToken: 512,
  email: 320,
  name: 240,
  company: 240,
  choiceRef: 160,
  choiceLabel: 500,
  projectSummary: 10_000,
} as const;

function boundedString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? Array.from(trimmed).slice(0, maxLength).join("") : null;
}

function findAnswer(
  answers: readonly TypeformAnswer[],
  ref: keyof typeof TYPEFORM_BUDGET_FIELD_IDS,
): TypeformAnswer | undefined {
  const byRef = answers.find((answer) => answer?.field?.ref === ref);
  if (byRef) return byRef;
  const fieldId = TYPEFORM_BUDGET_FIELD_IDS[ref];
  return answers.find((answer) => answer?.field?.id === fieldId);
}

function readText(
  answers: readonly TypeformAnswer[],
  ref: keyof typeof TYPEFORM_BUDGET_FIELD_IDS,
  maxLength: number,
): string | null {
  const answer = findAnswer(answers, ref);
  return boundedString(answer?.email ?? answer?.text, maxLength);
}

function readChoice(
  answers: readonly TypeformAnswer[],
  ref: "service_family" | "budget_band",
): { choiceRef: string | null; label: string | null } {
  const choice = findAnswer(answers, ref)?.choice;
  return {
    choiceRef: boundedString(choice?.ref, MAX_LENGTH.choiceRef),
    label: boundedString(choice?.label, MAX_LENGTH.choiceLabel),
  };
}

function normalizeSubmittedAt(value: unknown): {
  value: string | null;
  warning: "missing_submitted_at" | "invalid_submitted_at" | null;
} {
  const raw = boundedString(value, 100);
  if (!raw) return { value: null, warning: "missing_submitted_at" };

  const timestamp = Date.parse(raw);
  if (!Number.isFinite(timestamp)) {
    return { value: null, warning: "invalid_submitted_at" };
  }

  return { value: new Date(timestamp).toISOString(), warning: null };
}

function isKnownBudgetBand(value: string): value is TypeformBudgetBandRef {
  return (TYPEFORM_BUDGET_BAND_REFS as readonly string[]).includes(value);
}

/**
 * Extracts the small, reviewable snapshot used by the admin queue. The raw
 * webhook remains the source of truth; bounded columns are only a convenience
 * for listing and triage.
 */
export function extractTypeformBudgetIntake(
  payload: TypeformBudgetWebhookPayload,
  eventIdFallback: string | null = null,
): ExtractedTypeformBudgetIntake {
  const response = payload.form_response;
  const formId = boundedString(response?.form_id, 64);
  if (formId !== TYPEFORM_BUDGET_FORM_ID) {
    throw new TypeformBudgetIntakeValidationError("unexpected_form_id");
  }

  const rawToken = boundedString(response?.token, MAX_LENGTH.responseToken + 1);
  if (!rawToken) {
    throw new TypeformBudgetIntakeValidationError("missing_response_token");
  }
  if (Array.from(rawToken).length > MAX_LENGTH.responseToken) {
    throw new TypeformBudgetIntakeValidationError("response_token_too_long");
  }
  if (!Array.isArray(response?.answers)) {
    throw new TypeformBudgetIntakeValidationError("missing_answers");
  }

  const answers = response.answers;
  const email = readText(answers, "work_email", MAX_LENGTH.email);
  const name = readText(answers, "contact_name", MAX_LENGTH.name);
  const company = readText(answers, "company_name", MAX_LENGTH.company);
  const serviceFamily = readChoice(answers, "service_family");
  const budgetBand = readChoice(answers, "budget_band");
  const projectSummary = readText(
    answers,
    "project_summary",
    MAX_LENGTH.projectSummary,
  );
  const submittedAt = normalizeSubmittedAt(response.submitted_at);

  const warnings: TypeformBudgetMappingWarning[] = [];
  if (!email) warnings.push("missing_email");
  if (!name) warnings.push("missing_name");
  if (!company) warnings.push("missing_company");
  if (!serviceFamily.choiceRef) warnings.push("missing_service_family_ref");
  if (!budgetBand.choiceRef) {
    warnings.push("missing_budget_band_ref");
  } else if (!isKnownBudgetBand(budgetBand.choiceRef)) {
    warnings.push("unknown_budget_band_ref");
  }
  if (!projectSummary) warnings.push("missing_project_summary");
  if (submittedAt.warning) warnings.push(submittedAt.warning);

  return {
    formId: TYPEFORM_BUDGET_FORM_ID,
    responseToken: rawToken,
    eventId:
      boundedString(payload.event_id, MAX_LENGTH.eventId) ??
      boundedString(eventIdFallback, MAX_LENGTH.eventId),
    submittedAt: submittedAt.value,
    mappingStatus: warnings.length === 0 ? "mapped" : "needs_review",
    mappingWarnings: warnings,
    email,
    name,
    company,
    serviceFamilyRef: serviceFamily.choiceRef,
    serviceFamilyLabel: serviceFamily.label,
    budgetBandRef: budgetBand.choiceRef,
    budgetBandLabel: budgetBand.label,
    projectSummary,
  };
}

function coerceWarnings(
  value: Json | undefined,
): TypeformBudgetMappingWarning[] | null {
  if (!Array.isArray(value)) return null;
  const warnings = value.filter(
    (item): item is TypeformBudgetMappingWarning =>
      typeof item === "string" &&
      (TYPEFORM_BUDGET_MAPPING_WARNINGS as readonly string[]).includes(item),
  );
  return warnings.length === value.length ? warnings : null;
}

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

/**
 * Persists before acknowledging the webhook. A unique-constraint replay is
 * resolved back to the original row so callers can return the same durable ID.
 */
export async function persistTypeformBudgetIntake(
  payload: TypeformBudgetWebhookPayload,
  rawPayload: Json,
  eventIdFallback: string | null = null,
): Promise<PersistedTypeformBudgetIntake> {
  const intake = extractTypeformBudgetIntake(payload, eventIdFallback);

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (error) {
    throw new TypeformBudgetIntakeStorageError("admin_client_unavailable", {
      cause: error,
    });
  }

  const { data, error } = await admin
    .from("typeform_budget_intakes")
    .insert({
      form_id: intake.formId,
      response_token: intake.responseToken,
      event_id: intake.eventId,
      submitted_at: intake.submittedAt,
      status: "new",
      mapping_status: intake.mappingStatus,
      mapping_warnings: [...intake.mappingWarnings],
      email: intake.email,
      name: intake.name,
      company: intake.company,
      service_family_ref: intake.serviceFamilyRef,
      service_family_label: intake.serviceFamilyLabel,
      budget_band_ref: intake.budgetBandRef,
      budget_band_label: intake.budgetBandLabel,
      project_summary: intake.projectSummary,
      raw_payload: rawPayload,
    })
    .select("id,mapping_status,mapping_warnings")
    .single();

  if (!error && data) {
    return {
      id: data.id,
      duplicate: false,
      mappingStatus: data.mapping_status,
      mappingWarnings: coerceWarnings(data.mapping_warnings) ?? [
        ...intake.mappingWarnings,
      ],
    };
  }

  if (!isUniqueViolation(error)) {
    throw new TypeformBudgetIntakeStorageError(
      error?.message ?? "budget_intake_insert_failed",
    );
  }

  const { data: existing, error: lookupError } = await admin
    .from("typeform_budget_intakes")
    .select("id,mapping_status,mapping_warnings")
    .eq("form_id", intake.formId)
    .eq("response_token", intake.responseToken)
    .single();

  if (lookupError || !existing) {
    throw new TypeformBudgetIntakeStorageError(
      lookupError?.message ?? "duplicate_budget_intake_lookup_failed",
    );
  }

  return {
    id: existing.id,
    duplicate: true,
    mappingStatus: existing.mapping_status,
    mappingWarnings: coerceWarnings(existing.mapping_warnings) ?? [],
  };
}
