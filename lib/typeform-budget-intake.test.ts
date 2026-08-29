import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Json } from "@/lib/database.types";

const h = vi.hoisted(() => ({ client: null as unknown }));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(() => h.client),
}));

import {
  extractTypeformBudgetIntake,
  isTypeformBudgetFormConfigurationConsistent,
  persistTypeformBudgetIntake,
  TYPEFORM_BUDGET_BAND_REFS,
  TYPEFORM_BUDGET_FIELD_IDS,
  TYPEFORM_BUDGET_FORM_ID,
  TypeformBudgetIntakeStorageError,
  TypeformBudgetIntakeValidationError,
  type TypeformAnswer,
  type TypeformBudgetWebhookPayload,
} from "@/lib/typeform-budget-intake";

function answer(
  ref: keyof typeof TYPEFORM_BUDGET_FIELD_IDS,
  body: Omit<TypeformAnswer, "field">,
): TypeformAnswer {
  return {
    ...body,
    field: { ref, id: TYPEFORM_BUDGET_FIELD_IDS[ref] },
  };
}

function fullPayload(): TypeformBudgetWebhookPayload {
  return {
    event_id: "evt_budget_1",
    event_type: "form_response",
    form_response: {
      form_id: TYPEFORM_BUDGET_FORM_ID,
      token: "response_budget_1",
      submitted_at: "2026-08-29T14:15:16Z",
      answers: [
        answer("work_email", { type: "email", email: " dana@example.com " }),
        answer("contact_name", { type: "text", text: " Dana Reyes " }),
        answer("company_name", {
          type: "text",
          text: " Northshore Logistics ",
        }),
        answer("service_family", {
          type: "choice",
          choice: { ref: "website-build", label: "Website build" },
        }),
        answer("budget_band", {
          type: "choice",
          choice: { ref: "25000-50000", label: "$25,000-$50,000" },
        }),
        answer("project_summary", {
          type: "text",
          text: "Replace our spreadsheet dispatch process.",
        }),
      ],
    },
  };
}

interface StoredRow {
  id: string;
  mapping_status: "mapped" | "needs_review";
  mapping_warnings: string[];
}

interface DbResult {
  data: StoredRow | null;
  error: { message: string; code?: string } | null;
}

function buildAdminStub(options?: { insert?: DbResult; lookup?: DbResult }) {
  const inserted: unknown[] = [];
  const insertResult = options?.insert ?? {
    data: { id: "intake_1", mapping_status: "mapped", mapping_warnings: [] },
    error: null,
  };
  const lookupResult = options?.lookup ?? {
    data: {
      id: "intake_existing",
      mapping_status: "mapped",
      mapping_warnings: [],
    },
    error: null,
  };

  const insertSingle = vi.fn(async () => insertResult);
  const insertSelect = vi.fn(() => ({ single: insertSingle }));
  const insert = vi.fn((row: unknown) => {
    inserted.push(row);
    return { select: insertSelect };
  });

  const lookupBuilder = {
    eq: vi.fn(),
    single: vi.fn(async () => lookupResult),
  };
  lookupBuilder.eq.mockReturnValue(lookupBuilder);
  const select = vi.fn(() => lookupBuilder);
  const from = vi.fn((table: string) => {
    expect(table).toBe("typeform_budget_intakes");
    return { insert, select };
  });

  return {
    client: { from },
    from,
    insert,
    inserted,
    lookupBuilder,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.client = buildAdminStub().client;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Typeform budget form configuration", () => {
  it("accepts only the database-bound public form ID", () => {
    vi.stubEnv("NEXT_PUBLIC_TYPEFORM_FORM_ID", TYPEFORM_BUDGET_FORM_ID);
    expect(isTypeformBudgetFormConfigurationConsistent()).toBe(true);

    vi.stubEnv("NEXT_PUBLIC_TYPEFORM_FORM_ID", "replacement-form");
    expect(isTypeformBudgetFormConfigurationConsistent()).toBe(false);

    vi.stubEnv("NEXT_PUBLIC_TYPEFORM_FORM_ID", ` ${TYPEFORM_BUDGET_FORM_ID} `);
    expect(isTypeformBudgetFormConfigurationConsistent()).toBe(false);

    vi.stubEnv("NEXT_PUBLIC_TYPEFORM_FORM_ID", "");
    expect(isTypeformBudgetFormConfigurationConsistent()).toBe(false);
  });
});

describe("extractTypeformBudgetIntake", () => {
  it("extracts the review snapshot by field ref and maps an allowed budget", () => {
    const extracted = extractTypeformBudgetIntake(fullPayload());

    expect(extracted).toEqual({
      formId: TYPEFORM_BUDGET_FORM_ID,
      responseToken: "response_budget_1",
      eventId: "evt_budget_1",
      submittedAt: "2026-08-29T14:15:16.000Z",
      mappingStatus: "mapped",
      mappingWarnings: [],
      email: "dana@example.com",
      name: "Dana Reyes",
      company: "Northshore Logistics",
      serviceFamilyRef: "website-build",
      serviceFamilyLabel: "Website build",
      budgetBandRef: "25000-50000",
      budgetBandLabel: "$25,000-$50,000",
      projectSummary: "Replace our spreadsheet dispatch process.",
    });
  });

  it("falls back to stable field IDs when Typeform rewrites refs", () => {
    const payload = fullPayload();
    const answers = payload.form_response?.answers?.map((item) => ({
      ...item,
      field: { ...item.field, ref: `rewritten-${item.field?.id}` },
    }));
    const rewritten: TypeformBudgetWebhookPayload = {
      ...payload,
      form_response: { ...payload.form_response, answers },
    };

    const extracted = extractTypeformBudgetIntake(rewritten);
    expect(extracted.email).toBe("dana@example.com");
    expect(extracted.serviceFamilyRef).toBe("website-build");
    expect(extracted.budgetBandRef).toBe("25000-50000");
    expect(extracted.mappingStatus).toBe("mapped");
  });

  it("persists unknown budget refs for review without echoing them in warning codes", () => {
    const payload = fullPayload();
    const answers = payload.form_response?.answers?.map((item) =>
      item.field?.ref === "budget_band"
        ? { ...item, choice: { ref: "bespoke-enterprise", label: "Bespoke" } }
        : item,
    );

    const extracted = extractTypeformBudgetIntake({
      ...payload,
      form_response: { ...payload.form_response, answers },
    });

    expect(extracted.budgetBandRef).toBe("bespoke-enterprise");
    expect(extracted.budgetBandLabel).toBe("Bespoke");
    expect(extracted.mappingStatus).toBe("needs_review");
    expect(extracted.mappingWarnings).toEqual(["unknown_budget_band_ref"]);
  });

  it.each(TYPEFORM_BUDGET_BAND_REFS)(
    "maps the allowed budget ref %s without an unknown-budget warning",
    (budgetRef) => {
      const payload = fullPayload();
      const answers = payload.form_response?.answers?.map((item) =>
        item.field?.ref === "budget_band"
          ? {
              ...item,
              choice: { ref: budgetRef, label: `Budget ${budgetRef}` },
            }
          : item,
      );

      const extracted = extractTypeformBudgetIntake({
        ...payload,
        form_response: { ...payload.form_response, answers },
      });

      expect(extracted.budgetBandRef).toBe(budgetRef);
      expect(extracted.mappingStatus).toBe("mapped");
      expect(extracted.mappingWarnings).not.toContain(
        "unknown_budget_band_ref",
      );
    },
  );

  it("keeps a structurally valid empty answer set and lists every missing mapping", () => {
    const extracted = extractTypeformBudgetIntake({
      event_type: "form_response",
      form_response: {
        form_id: TYPEFORM_BUDGET_FORM_ID,
        token: "response_empty",
        answers: [],
      },
    });

    expect(extracted.mappingStatus).toBe("needs_review");
    expect(extracted.mappingWarnings).toEqual([
      "missing_email",
      "missing_name",
      "missing_company",
      "missing_service_family_ref",
      "missing_budget_band_ref",
      "missing_project_summary",
      "missing_submitted_at",
    ]);
    expect(extracted.budgetBandRef).toBeNull();
  });

  it("treats malformed entries inside an answer array as missing mappings", () => {
    const extracted = extractTypeformBudgetIntake({
      event_type: "form_response",
      form_response: {
        form_id: TYPEFORM_BUDGET_FORM_ID,
        token: "response_malformed_answers",
        submitted_at: "2026-08-29T14:15:16Z",
        answers: [null] as unknown as readonly TypeformAnswer[],
      },
    });

    expect(extracted.mappingStatus).toBe("needs_review");
    expect(extracted.mappingWarnings).toContain("missing_budget_band_ref");
  });

  it("marks an invalid submitted timestamp for review and uses the header event fallback", () => {
    const payload = fullPayload();
    const extracted = extractTypeformBudgetIntake(
      {
        ...payload,
        event_id: undefined,
        form_response: { ...payload.form_response, submitted_at: "not-a-date" },
      },
      "evt_from_header",
    );

    expect(extracted.eventId).toBe("evt_from_header");
    expect(extracted.submittedAt).toBeNull();
    expect(extracted.mappingWarnings).toEqual(["invalid_submitted_at"]);
  });

  it("bounds extracted display strings while raw payload remains separate", () => {
    const payload = fullPayload();
    const answers = payload.form_response?.answers?.map((item) =>
      item.field?.ref === "project_summary"
        ? { ...item, text: `  ${"x".repeat(10_100)}  ` }
        : item,
    );
    const extracted = extractTypeformBudgetIntake({
      ...payload,
      form_response: { ...payload.form_response, answers },
    });

    expect(extracted.projectSummary).toHaveLength(10_000);
  });

  it("bounds extracted text without splitting an astral Unicode character", () => {
    const payload = fullPayload();
    const answers = payload.form_response?.answers?.map((item) =>
      item.field?.ref === "contact_name"
        ? { ...item, text: `${"a".repeat(239)}😀tail` }
        : item,
    );
    const extracted = extractTypeformBudgetIntake({
      ...payload,
      form_response: { ...payload.form_response, answers },
    });

    expect(extracted.name).toBe(`${"a".repeat(239)}😀`);
    expect(Array.from(extracted.name ?? "")).toHaveLength(240);
  });

  it.each([
    [
      "unexpected form",
      { form_response: { form_id: "other-form", token: "token", answers: [] } },
      "unexpected_form_id",
    ],
    [
      "missing token",
      { form_response: { form_id: TYPEFORM_BUDGET_FORM_ID, answers: [] } },
      "missing_response_token",
    ],
    [
      "missing answers",
      { form_response: { form_id: TYPEFORM_BUDGET_FORM_ID, token: "token" } },
      "missing_answers",
    ],
  ])(
    "rejects a structurally invalid payload: %s",
    (_label, payload, message) => {
      expect(() =>
        extractTypeformBudgetIntake(payload as TypeformBudgetWebhookPayload),
      ).toThrowError(new TypeformBudgetIntakeValidationError(message));
    },
  );
});

describe("persistTypeformBudgetIntake", () => {
  it("inserts the raw event and extracted snapshot through the admin client", async () => {
    const db = buildAdminStub();
    h.client = db.client;
    const payload = fullPayload();
    const rawPayload = {
      ...payload,
      retained: { extra: true },
    } as unknown as Json;

    const result = await persistTypeformBudgetIntake(
      payload,
      rawPayload,
      "evt_header",
    );

    expect(result).toEqual({
      id: "intake_1",
      duplicate: false,
      mappingStatus: "mapped",
      mappingWarnings: [],
    });
    expect(db.inserted).toHaveLength(1);
    expect(db.inserted[0]).toMatchObject({
      form_id: TYPEFORM_BUDGET_FORM_ID,
      response_token: "response_budget_1",
      event_id: "evt_budget_1",
      status: "new",
      mapping_status: "mapped",
      mapping_warnings: [],
      email: "dana@example.com",
      name: "Dana Reyes",
      company: "Northshore Logistics",
      service_family_ref: "website-build",
      budget_band_ref: "25000-50000",
      raw_payload: rawPayload,
    });
  });

  it("returns the original row ID when the unique form/response key is replayed", async () => {
    const db = buildAdminStub({
      insert: {
        data: null,
        error: { message: "duplicate key", code: "23505" },
      },
      lookup: {
        data: {
          id: "intake_original",
          mapping_status: "needs_review",
          mapping_warnings: ["missing_company"],
        },
        error: null,
      },
    });
    h.client = db.client;

    const result = await persistTypeformBudgetIntake(
      fullPayload(),
      fullPayload() as unknown as Json,
    );

    expect(result).toEqual({
      id: "intake_original",
      duplicate: true,
      mappingStatus: "needs_review",
      mappingWarnings: ["missing_company"],
    });
    expect(db.lookupBuilder.eq).toHaveBeenNthCalledWith(
      1,
      "form_id",
      TYPEFORM_BUDGET_FORM_ID,
    );
    expect(db.lookupBuilder.eq).toHaveBeenNthCalledWith(
      2,
      "response_token",
      "response_budget_1",
    );
  });

  it("throws a storage error when the insert fails", async () => {
    h.client = buildAdminStub({
      insert: {
        data: null,
        error: { message: "database unavailable", code: "08006" },
      },
    }).client;

    await expect(
      persistTypeformBudgetIntake(
        fullPayload(),
        fullPayload() as unknown as Json,
      ),
    ).rejects.toBeInstanceOf(TypeformBudgetIntakeStorageError);
  });

  it("throws a storage error when a duplicate cannot be resolved", async () => {
    h.client = buildAdminStub({
      insert: {
        data: null,
        error: { message: "duplicate key", code: "23505" },
      },
      lookup: {
        data: null,
        error: { message: "lookup unavailable", code: "08006" },
      },
    }).client;

    await expect(
      persistTypeformBudgetIntake(
        fullPayload(),
        fullPayload() as unknown as Json,
      ),
    ).rejects.toMatchObject({ message: "lookup unavailable" });
  });
});
