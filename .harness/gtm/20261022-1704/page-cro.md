# Step 4 — Page CRO

Installed marketing-skills 2.13.0 `cro` 2.0.3, including form reference. Inputs: end-state Topology/P1-P2/P6 criteria, marketing-surface, confirmed product context, competitor and SEO reports. Source audit only: visual hierarchy, mobile behavior and completion rates are not freshly measured.

## Diagnosis
Personal portfolio homepage; primary conversion is a relevant collaboration inquiry, secondary action a project visit. Traffic source and baseline rates are unknown. Preserve the exact approved headline and first-person introduction. Existing Hero opens the idea form, and LeadForm requires email plus an idea for source=form; name/company remain optional. Success follows a successful API response; loading/error states exist. This is not a signup funnel.

## Quick wins proposed
- P1: Clarify the invitation near the CTA: “Tell me what you’re thinking about making and where our interests overlap.” No response-time or acceptance promise.
- P1: Make the optional nature of Company visible in the form label; the current email placeholder you@company.com can suggest a business account is required. Proposed placeholder you@example.com; keep email validation contract.
- P2: Keep the project descriptions and destination labels concrete. Product links demonstrate work; do not replace them with invented testimonials.

## High-impact priorities
1. Align /website-package with the personal collaboration context. Its fixed $2,995/three-week offer currently implies a different relationship. Decide whether the optional offer is current before changing the contract; noindex does not make it invisible to direct visitors.
2. Keep /pricing as secondary optional paid work. Check that /services, process and page-level CTAs consistently explain how a conversation becomes an agreed scope.
3. Verify existing dialog focus, keyboard navigation, field errors and mobile layout on the resulting code before launch. These source observations are not a rendered usability pass.

## Form audit
| Issue | Impact hypothesis | Proposed action | Priority |
|---|---|---|---|
| Company label lacks optional qualifier | Individual collaborators may perceive business-only eligibility | Label Company (optional); retain nullable payload | Medium |
| Business email example | May discourage personal email use | Neutral example address | Low |
| Privacy line says email is used to reply only | Potential mismatch with enrichment/integration processing in lib/leads.ts | Review exact processing and published privacy disclosure before affirming wording | High |

Recommended required fields remain email and idea for collaboration mode. Retain message purpose rather than removing it for an unmeasured completion-rate gain. Preserve loading, error and durable acceptance behavior. Never send form message/email to analytics properties.

## Alternatives and rationale
Keep “Explore a collaboration” as primary. “Share an idea” is a possible future test for lower perceived commitment; “Tell me what you’re making” is a warmer alternative but less explicit. Keep the current wording until evidence justifies replacement. The exact headline is locked by the user, not an experiment variable.

## Measurement hypotheses
After valid instrumentation and sufficient traffic, test a short next-step explanation or optional-field labels. Measure qualified inquiries alongside successful forms, using comparable observation windows and consent-aware denominators. No effect-size or sample-size claim is established. Do not launch an A/B test during this audit.
