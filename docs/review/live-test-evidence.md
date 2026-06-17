# Live Test Evidence

Date: 2026-05-23
Branch: `test/coverage`
Environment: local (`http://localhost:3000`)

## Browser MCP verification (plugin-chrome-devtools-mcp-chrome-devtools)

### Consent-gated analytics/GTM
- Opened landing page before consent.
- `list_network_requests` showed no `googletagmanager.com` requests pre-consent.
- Accepted consent banner.
- `list_network_requests` then showed:
  - `https://www.googletagmanager.com/gtm.js?id=GTM-M97GN5T7`
  - `https://va.vercel-scripts.com/v1/script.debug.js`
  - `https://va.vercel-scripts.com/v1/speed-insights/script.debug.js`

### GTM event checks
- Clicked hero CTA (`Book a call`) and opened lightbox.
- Interacted with Calendly tab and submitted the `Just email` form in lightbox.
- `evaluate_script` dataLayer evidence:
  - consent state: `granted`
  - events observed:
    - `cta_click`
    - `booking_started` (`source: "calendly"`)
    - `lead_submitted` (`source: "email"`, `has_message: true`)

### Console/CSP check
- `list_console_messages` for `error|warn|issue` returned no messages after consent and form interaction.

## Composio check
- Attempted Composio MCP call (`COMPOSIO_SEARCH_TOOLS`) for integration verification.
- Result: server unavailable in current session (`MCP server does not exist: composio`).
- Action: live verification proceeded with browser MCP + app-level runtime validation only.
