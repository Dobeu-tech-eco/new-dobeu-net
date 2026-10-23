# Step 8 — Analytics tracking (read-only)

Installed analytics 2.2.1. User explicitly included this read-only review. Inputs: approved end-state, scout surface, confirmed context and completed steps 2–7. Examined source only; no analytics queries, test events, form submissions, tracking edits or data sent.

## Decision to support
Which portfolio interests bring relevant collaboration conversations? Separate an inquiry from a qualified collaboration, booked conversation or revenue. A client click is not a completed partnership.

## Existing instrumentation
| Event | Properties / trigger | Meaning and limitation |
|---|---|---|
| cta_click | cta_location, cta_label, target in Hero | Intent to open collaboration form; not a conversion |
| lead_captured | source, has_message after successful /api/lead response | Compatibility event; shares the same success with lead_submitted |
| lead_submitted | source, has_message after successful /api/lead response | Candidate primary inquiry event; choose one success event for reporting |
| lead_capture_failed | source in error handler | Error indicator; not unique failed people |
| booking_started | BookingTab event-type viewed | Booking exploration, not scheduled |
| booking_scheduled | Calendly scheduled callback | Booking intent/completion signal; provider-side reconciliation not inspected |
| $pageview | lib/analytics.ts pageView | Provider behavior differs; Amplitude synthetic event deliberately excluded |

Sources: components/landing/Hero.tsx; LeadForm.tsx:86–108; BookingTab.tsx; lib/analytics.ts. Do not rename compatibility events solely to match a preferred naming convention.

## Fan-out and consent
lib/analytics.ts fans out to configured PostHog, Mixpanel, Amplitude, GA4 and dataLayer. Source gates track/init on analytics consent, supports withdrawal and defers verified-user identity. Browser imports are lazy. Current source includes autocapture/session replay for some providers; remote settings, masking and actual collection were not inspected. This is not a privacy-compliance certification.

Lead success events explicitly pass source and a boolean, not form message/email. Separately, server-side lib/leads.ts persists contact details then invokes configured Apollo, Customer.io and Resend integrations. Do not conflate browser analytics consent with all server-side processing or claim “reply only” solely from browser event payloads.

## Priority findings
1. Select one primary inquiry event in reports; do not sum lead_captured and lead_submitted as two conversions. Verify dashboard definitions before changing code.
2. Resolve LeadForm's “Your email is used to reply only” against actual integration purpose and current privacy disclosure. No legal conclusion or processing change is made here.
3. Reconcile scheduled callbacks with provider records before treating them as unique bookings. No live provider evidence retrieved.
4. Audit replay/autocapture masking and consent behavior with synthetic local data before release; do not send private form text as test data.
5. Confirm project outbound-click instrumentation before making project-interest comparisons. No reliable cross-domain attribution is established by this review.

## Measurement plan (proposal)
Primary: successful relevant inquiries, followed by manually qualified collaborations. Secondary: project visits and booked conversations, each separately deduplicated. Report consented browser samples as samples, not all visitors. Use matching closed date windows; do not divide all leads by consented-only sessions without explaining coverage. Baseline volume, conversion rates, campaign attribution and provider delivery remain unavailable.

Suggested UTM convention for an approved launch post: source=linkedin, medium=social, campaign=dobeu-rebrand; no personal identifiers. Nothing tagged or published in this audit.

## Validation still required
Safe local tests for denied/granted/withdrawn consent; single success-count mapping; desktop/mobile callback behavior; provider DebugView or equivalent only with explicit permission to send events. No new analytics installation or paid tool required by this report.
