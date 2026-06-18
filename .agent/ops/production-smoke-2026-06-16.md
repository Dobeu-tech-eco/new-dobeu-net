# Production smoke — Section A (curl)

**Run:** 2026-06-16 against `https://dobeu.net`  
**Source:** `scripts/post-merge-smoke.md` §A

| Check | Expected | Actual |
|-------|----------|--------|
| `GET /` | 200 | **200** |
| `GET /robots.txt` | 200 | **200** |
| `GET /sitemap.xml` | contains `https://dobeu.net` | **pass** |
| `GET /portal/tickets` | redirect → login | **redirect → `/login?next=/portal/tickets`** |
| `GET /admin/tickets` | redirect → login | **307 → `/login?next=/admin/tickets`** |
| `GET /portal/settings/mfa` | redirect → login | **307 → `/login?next=/portal/settings/mfa`** |
| `POST /api/webhooks/stripe` (no signature) | 400 | **400** |
| `GET /api/intercom/jwt` | 200 + JWT | **200** + `{"token":"eyJ..."}` (visitor JWT when unauthenticated) |

**Section B (manual E2E):** not run — requires signed-in client + admin accounts and live Stripe payment. See `scripts/post-merge-smoke.md` §B.
