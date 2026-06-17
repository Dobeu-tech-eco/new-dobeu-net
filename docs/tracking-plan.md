# Tracking plan — dobeu.net v3

Every event captured here fires to PostHog + Mixpanel + GA4 (via GTM dataLayer) when consent is granted.

| Event name              | Fires when                           | Properties                                     | PostHog    | Mixpanel   | GA4                    |
| ----------------------- | ------------------------------------ | ---------------------------------------------- | ---------- | ---------- | ---------------------- |
| `$pageview`             | Route change                         | `path`, `referrer`, `utm_*`                    | ✓          | ✓          | ✓ (auto)               |
| `lead_captured`         | `/api/lead` returns 200              | `source` (book/form/email), `has_message`      | ✓          | ✓          | ✓ (as `generate_lead`) |
| `lead_capture_failed`   | `/api/lead` returns non-200          | `source`                                       | ✓          | ✓          | ✓                      |
| `lightbox_opened`       | User opens the CTA modal             | `tab`, `trigger` (hero/services/footer/sticky) | ✓          | ✓          | —                      |
| `lightbox_tab_changed`  | User clicks a different tab          | `from_tab`, `to_tab`                           | ✓          | —          | —                      |
| `typeform_loaded`       | Typeform widget mounted              | `form_id`                                      | ✓          | —          | —                      |
| `typeform_submitted`    | Typeform submission complete         | `form_id`                                      | ✓          | ✓          | ✓                      |
| `booking_scheduled`     | Booking confirmed (Apollo webhook)   | `lead_id`, `apollo_meeting_id`                 | ✓ (server) | ✓ (server) | ✓ (server)             |
| `booking_completed`     | Post-call status flip                | `booking_id`                                   | ✓ (server) | ✓ (server) | —                      |
| `login_magic_link_sent` | User submits login form              | `destination`                                  | ✓          | —          | —                      |
| `login_success`         | User lands at `/portal` via callback | —                                              | ✓          | ✓          | ✓ (as `login`)         |
| `file_downloaded`       | Client clicks Download               | `file_id`, `project_id`, `mime`                | ✓          | ✓          | —                      |
| `invoice_viewed`        | Client opens an invoice              | `invoice_id`, `status`                         | ✓          | —          | —                      |
| `invoice_paid`          | Stripe webhook flips status to paid  | `invoice_id`, `amount_cents`                   | ✓ (server) | ✓ (server) | ✓ (as `purchase`)      |
| `message_sent`          | Client posts a message               | `thread_id`, `body_length`                     | ✓          | —          | —                      |
| `admin_user_edited`     | Admin updates a profile              | `target_user_id`, `field`                      | ✓ (server) | —          | —                      |
| `admin_file_uploaded`   | Admin uploads to a project           | `project_id`, `mime`                           | ✓ (server) | —          | —                      |
| `admin_invoice_created` | Admin issues an invoice              | `project_id`, `amount_cents`                   | ✓ (server) | —          | —                      |

## UTM persistence

UTM params are captured on first page-view and persisted to:

- PostHog person properties (sticks to anonymous → identified merge)
- Mixpanel super properties
- Supabase `leads.utm_*` on lead capture

## Consent gating

All analytics are silent until the user explicitly accepts in the cookie banner
(see `components/analytics-provider.tsx`). On decline, all libraries remain uninitialized.

## GA4 conversion mappings

In GA4 Admin → Events, mark these as conversions:

- `generate_lead` (from `lead_captured`)
- `login`
- `purchase` (from `invoice_paid`)

## A/B test scaffold

PostHog feature flags drive variant copy. First experiment to ship: hero headline.

- Flag: `hero-headline-variant`
- Variants: `control` ("Ship the agent. Ship the app. Ship the brand.") vs `variant_a` (TBD)
- Goal metric: `lead_captured` rate
- Min sample size: 200 visitors/variant before declaring winner
