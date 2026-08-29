# Tracking plan — dobeu.net v3

Every event captured here fires to PostHog + Mixpanel + Amplitude + GA4 (via GTM dataLayer) when consent is granted.

## Amplitude (org `polished-sun-911894`, project `dobeu.net` #784238)

- **Naming**: raw event names stay `snake_case` in code because one `track()` call feeds GA4/PostHog/Mixpanel too. Amplitude's `[Object] [Past-tense verb]` Title Case convention is applied as **display names** in the tracking plan (`cta_click` → "CTA Clicked"), never by renaming the raw event. Properties are `snake_case` everywhere.
- **Autocapture** (no code needed): `[Amplitude] Page Viewed` (incl. Next.js route changes), `Start/End Session`, `Form Started/Submitted`, `Element Clicked`, `File Downloaded`, `Rage Click`/`Dead Click`, `Web Vitals`, plus UTM/click-id attribution on every event. Network tracking is off. `$pageview` is **not** forwarded to Amplitude (would double-count).
- **Session Replay**: sample rate from `NEXT_PUBLIC_AMPLITUDE_REPLAY_SAMPLE_RATE` (default 1); the remote setting in Amplitude → Session Replay overrides it. Inputs are masked by default; add `.amp-mask` / `.amp-block` to any element that must never appear in a replay.
- **Identity**: `user_id` = Supabase auth id, set by `components/portal/AnalyticsIdentify.tsx` after login (user properties `email`, `is_admin`). Reset on every sign-out path: `LogoutButton`, Supabase `SIGNED_OUT` (other tab / expired session), and `/login` without a session (`AnalyticsSignedOut`). Resets skip providers with no user id, so anonymous device ids survive. Anonymous visitors are device-id only — never set a user id from a form submit.
- **Consent**: nothing loads until the "analytics" category is accepted; withdrawing consent calls `setOptOut(true)`. Cookies: `AMP_<key prefix>`, `AMP_MKTG_<key prefix>` (1 year), listed on `/cookies`.

| Raw event (code)              | Amplitude display name        | Category    |
| ----------------------------- | ----------------------------- | ----------- |
| `cta_click`                   | CTA Clicked                   | Engagement  |
| `lead_submitted`              | Lead Submitted                | Lifecycle   |
| `lead_captured`               | Lead Captured                 | Lifecycle   |
| `lead_capture_failed`         | Lead Capture Failed           | System      |
| `booking_started`             | Booking Started               | Lifecycle   |
| `booking_scheduled`           | Booking Scheduled             | Lifecycle   |
| `calendly_profile_viewed`     | Calendly Profile Viewed       | Engagement  |
| `calendly_event_type_viewed`  | Calendly Event Type Viewed    | Engagement  |
| `calendly_date_selected`      | Calendly Date Selected        | Engagement  |
| `typeform_loaded`             | Typeform Loaded               | Engagement  |
| `typeform_submitted`          | Typeform Submitted            | Lifecycle   |
| `login_magic_link_sent`       | Login Magic Link Sent         | Lifecycle   |
| `login_password_success`      | Login Password Succeeded      | Lifecycle   |

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
