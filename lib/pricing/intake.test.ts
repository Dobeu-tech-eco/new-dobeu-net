import { describe, expect, it } from "vitest";
import { parseIntake } from "./intake";
import { FIELD_IDS, indexAnswers, readChoiceRefs, readNumber, type TypeformAnswer } from "./typeform-mapping";

function answer(ref: string, body: Partial<TypeformAnswer>): TypeformAnswer {
  return { field: { ref, id: FIELD_IDS[ref] }, ...body };
}

const FULL_RESPONSE: readonly TypeformAnswer[] = [
  answer("contact_name", { type: "text", text: "Dana Reyes" }),
  answer("work_email", { type: "email", email: "dana@northshore.example" }),
  answer("phone", { type: "phone_number", phone_number: "+17325550142" }),
  answer("company_name", { type: "text", text: "Northshore Logistics" }),
  answer("company_website", { type: "url", url: "https://northshore.example" }),
  answer("service_family", { type: "choice", choice: { label: "New website", ref: "website-build" } }),
  answer("project_stage", { type: "choice", choice: { label: "New build", ref: "new" } }),
  answer("web_surface", { type: "choice", choice: { label: "Customer portal", ref: "customer-portal" } }),
  answer("requested_capabilities", {
    type: "choices",
    choices: { labels: ["Database", "Admin dashboard"], refs: ["database", "admin-dashboard"] }
  }),
  answer("page_count", { type: "number", number: 18 }),
  answer("auth_required", { type: "choice", choice: { label: "Both", ref: "both" } }),
  answer("role_count", { type: "number", number: 3 }),
  answer("file_uploads", { type: "boolean", boolean: true }),
  answer("esign_required", { type: "boolean", boolean: false }),
  answer("target_launch", { type: "choice", choice: { label: "Fixed", ref: "fixed-date" } }),
  answer("requested_deadline", { type: "date", date: "2026-11-01" }),
  answer("budget_band", { type: "choice", choice: { label: "$25,000–$50,000", ref: "25000-50000" } }),
  answer("project_summary", { type: "text", text: "Replace the spreadsheet dispatch process." }),
  answer("compliance_requirements", {
    type: "choices",
    choices: { labels: ["Accessibility"], refs: ["accessibility"] }
  }),
  answer("estimate_acknowledgement", { type: "boolean", boolean: true })
];

describe("parseIntake — contact", () => {
  it("extracts the contact block", () => {
    const { contact } = parseIntake(FULL_RESPONSE);
    expect(contact).toEqual({
      email: "dana@northshore.example",
      name: "Dana Reyes",
      company: "Northshore Logistics",
      phone: "+17325550142",
      companyWebsite: "https://northshore.example"
    });
  });

  it("reads company from company_name — the ref the old webhook missed", () => {
    expect(parseIntake(FULL_RESPONSE).contact.company).toBe("Northshore Logistics");
  });

  it("returns null rather than an empty string for a blank answer", () => {
    const blank = parseIntake([answer("company_name", { type: "text", text: "   " })]);
    expect(blank.contact.company).toBeNull();
  });

  it("survives a response with no answers at all", () => {
    const empty = parseIntake([]);
    expect(empty.contact.email).toBeNull();
    expect(empty.estimateInput.serviceFamily).toBeNull();
  });
});

describe("parseIntake — narrative", () => {
  it("reads project_summary — the other ref the old webhook missed", () => {
    expect(parseIntake(FULL_RESPONSE).narrative.projectSummary).toBe(
      "Replace the spreadsheet dispatch process."
    );
  });
});

describe("parseIntake — estimator input", () => {
  it("maps choice answers to their refs, not their labels", () => {
    const { estimateInput } = parseIntake(FULL_RESPONSE);
    expect(estimateInput.serviceFamily).toBe("website-build");
    expect(estimateInput.webSurface).toBe("customer-portal");
    expect(estimateInput.requestedCapabilities).toEqual(["database", "admin-dashboard"]);
  });

  it("maps numbers, booleans, and dates to their native types", () => {
    const { estimateInput } = parseIntake(FULL_RESPONSE);
    expect(estimateInput.pageCount).toBe(18);
    expect(estimateInput.fileUploads).toBe(true);
    expect(estimateInput.esignRequired).toBe(false);
    expect(estimateInput.requestedDeadline).toBe("2026-11-01");
  });

  it("returns null for fields the branch never asked", () => {
    const { estimateInput } = parseIntake(FULL_RESPONSE);
    expect(estimateInput.agentSurface).toBeNull();
    expect(estimateInput.engagementType).toBeNull();
  });

  it("returns an empty array for unanswered multi-selects", () => {
    const { estimateInput } = parseIntake(FULL_RESPONSE);
    expect(estimateInput.marketingDeliverables).toEqual([]);
  });
});

describe("parseIntake — acknowledgement", () => {
  it("treats an explicit No as declining the estimate", () => {
    const declined = parseIntake([answer("estimate_acknowledgement", { type: "boolean", boolean: false })]);
    expect(declined.acknowledged).toBe(false);
  });

  it("treats an explicit Yes as acknowledged", () => {
    expect(parseIntake(FULL_RESPONSE).acknowledged).toBe(true);
  });

  it("treats a missing acknowledgement as acknowledged", () => {
    expect(parseIntake([]).acknowledged).toBe(true);
  });
});

describe("parseIntake — labels for the admin email", () => {
  it("collects human-readable labels for the choice fields", () => {
    const { labels } = parseIntake(FULL_RESPONSE);
    expect(labels["service_family"]).toEqual(["New website"]);
    expect(labels["requested_capabilities"]).toEqual(["Database", "Admin dashboard"]);
  });

  it("omits fields the respondent never saw", () => {
    const { labels } = parseIntake(FULL_RESPONSE);
    expect(labels["agent_surface"]).toBeUndefined();
  });
});

describe("typeform-mapping — addressing", () => {
  it("falls back to the field id when a republish rewrote the ref to a uuid", () => {
    const rewritten: readonly TypeformAnswer[] = [
      {
        type: "number",
        number: 42,
        field: { ref: "01M15SZH0GN1RTAFBAW4E80X3J", id: FIELD_IDS["page_count"] }
      }
    ];
    expect(readNumber(indexAnswers(rewritten), "page_count")).toBe(42);
  });

  it("returns an empty list when a multi-select is absent", () => {
    expect(readChoiceRefs(indexAnswers([]), "marketing_channels")).toEqual([]);
  });

  it("ignores a non-finite number rather than passing NaN into the model", () => {
    const bad: readonly TypeformAnswer[] = [
      { type: "number", number: Number.NaN, field: { ref: "page_count" } }
    ];
    expect(readNumber(indexAnswers(bad), "page_count")).toBeNull();
  });
});
