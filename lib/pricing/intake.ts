/**
 * Turns a Typeform `form_response` into the two things the webhook needs:
 * the lead's contact details and the estimator's normalized input.
 *
 * This is the seam between "what the form asked" and "what the model prices".
 * Both halves are derived in one pass so a field is read exactly once.
 */
import type { EstimateInput } from "./estimate";
import {
  indexAnswers,
  readBoolean,
  readChoiceLabels,
  readChoiceRef,
  readChoiceRefs,
  readDate,
  readEmail,
  readNumber,
  readText,
  type AnswerIndex,
  type TypeformAnswer
} from "./typeform-mapping";

export interface IntakeContact {
  readonly email: string | null;
  readonly name: string | null;
  readonly company: string | null;
  readonly phone: string | null;
  readonly companyWebsite: string | null;
}

/** Free-text context that shapes no price but that Jeremy must read. */
export interface IntakeNarrative {
  readonly projectSummary: string | null;
  readonly currentProblem: string | null;
  readonly currentPlatform: string | null;
  readonly currentSiteUrl: string | null;
  readonly systemsInvolved: string | null;
  readonly integrationNames: string | null;
  readonly dataSources: string | null;
  readonly referenceLinks: string | null;
  readonly additionalDetails: string | null;
}

export interface ParsedIntake {
  readonly contact: IntakeContact;
  readonly estimateInput: EstimateInput;
  readonly narrative: IntakeNarrative;
  /** Human-readable answer labels, keyed by field ref, for the admin email. */
  readonly labels: Readonly<Record<string, readonly string[]>>;
  /** False when the client declined the planning-estimate acknowledgement. */
  readonly acknowledged: boolean;
}

const LABEL_FIELDS = [
  "service_family",
  "project_stage",
  "web_surface",
  "requested_capabilities",
  "auth_required",
  "payments_required",
  "data_migration",
  "agent_surface",
  "human_approval",
  "data_sensitivity",
  "expected_volume",
  "custom_model_work",
  "marketing_deliverables",
  "marketing_channels",
  "brand_assets_ready",
  "design_readiness",
  "content_readiness",
  "campaign_duration",
  "engagement_type",
  "target_launch",
  "budget_band",
  "decision_readiness",
  "compliance_requirements",
  "training_required",
  "support_level"
] as const;

function collectLabels(index: AnswerIndex): Readonly<Record<string, readonly string[]>> {
  return Object.fromEntries(
    LABEL_FIELDS.map((ref) => [ref, readChoiceLabels(index, ref)]).filter(
      ([, labels]) => (labels as readonly string[]).length > 0
    )
  );
}

function toContact(index: AnswerIndex): IntakeContact {
  return {
    email: readEmail(index, "work_email"),
    name: readText(index, "contact_name"),
    company: readText(index, "company_name"),
    phone: readText(index, "phone"),
    companyWebsite: readText(index, "company_website")
  };
}

function toNarrative(index: AnswerIndex): IntakeNarrative {
  return {
    projectSummary: readText(index, "project_summary"),
    currentProblem: readText(index, "current_problem"),
    currentPlatform: readText(index, "current_platform"),
    currentSiteUrl: readText(index, "current_site_url"),
    systemsInvolved: readText(index, "systems_involved"),
    integrationNames: readText(index, "integration_names"),
    dataSources: readText(index, "data_sources"),
    referenceLinks: readText(index, "reference_links"),
    additionalDetails: readText(index, "additional_details")
  };
}

function toEstimateInput(index: AnswerIndex): EstimateInput {
  return {
    serviceFamily: readChoiceRef(index, "service_family"),
    projectStage: readChoiceRef(index, "project_stage"),
    webSurface: readChoiceRef(index, "web_surface"),
    requestedCapabilities: readChoiceRefs(index, "requested_capabilities"),
    pageCount: readNumber(index, "page_count"),
    authRequired: readChoiceRef(index, "auth_required"),
    roleCount: readNumber(index, "role_count"),
    dashboardCount: readNumber(index, "dashboard_count"),
    fileUploads: readBoolean(index, "file_uploads"),
    paymentsRequired: readChoiceRef(index, "payments_required"),
    esignRequired: readBoolean(index, "esign_required"),
    cmsRequired: readBoolean(index, "cms_required"),
    dataMigration: readChoiceRef(index, "data_migration"),
    automationCount: readNumber(index, "automation_count"),
    agentSurface: readChoiceRef(index, "agent_surface"),
    humanApproval: readChoiceRef(index, "human_approval"),
    dataSensitivity: readChoiceRef(index, "data_sensitivity"),
    expectedVolume: readChoiceRef(index, "expected_volume"),
    evaluationRequired: readBoolean(index, "evaluation_required"),
    customModelWork: readChoiceRef(index, "custom_model_work"),
    integrationCount: readNumber(index, "integration_count"),
    marketingDeliverables: readChoiceRefs(index, "marketing_deliverables"),
    marketingChannels: readChoiceRefs(index, "marketing_channels"),
    brandAssetsReady: readChoiceRef(index, "brand_assets_ready"),
    designReadiness: readChoiceRef(index, "design_readiness"),
    contentReadiness: readChoiceRef(index, "content_readiness"),
    campaignDuration: readChoiceRef(index, "campaign_duration"),
    engagementType: readChoiceRef(index, "engagement_type"),
    reportingRequired: readBoolean(index, "reporting_required"),
    workshopCount: readNumber(index, "workshop_count"),
    targetLaunch: readChoiceRef(index, "target_launch"),
    requestedDeadline: readDate(index, "requested_deadline"),
    budgetBand: readChoiceRef(index, "budget_band"),
    decisionReadiness: readChoiceRef(index, "decision_readiness"),
    complianceRequirements: readChoiceRefs(index, "compliance_requirements"),
    trainingRequired: readChoiceRef(index, "training_required"),
    supportLevel: readChoiceRef(index, "support_level")
  };
}

/** Parses a Typeform answer array into contact, estimator input, and context. */
export function parseIntake(answers: readonly TypeformAnswer[]): ParsedIntake {
  const index = indexAnswers(answers);
  return {
    contact: toContact(index),
    estimateInput: toEstimateInput(index),
    narrative: toNarrative(index),
    labels: collectLabels(index),
    // Absent (a legacy response, or a form edit) counts as acknowledged —
    // the client still asked for an estimate. Only an explicit No opts out.
    acknowledged: readBoolean(index, "estimate_acknowledgement") !== false
  };
}
