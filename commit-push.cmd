@echo off
cd /d "%~dp0"
git add .
git commit -m "feat: Customer.io connector wired into lead pipeline" -m "- lib/customerio.ts: server-side track API wrapper (identify + track via siteId+apiKey auth)" -m "- /api/lead: on every lead submission, identify the contact in Customer.io and fire `lead_captured` event with source/utm — kicks off welcome sequence" -m "- .env.example already lists CUSTOMERIO_SITE_ID + CUSTOMERIO_API_KEY (server-only)"
git push
pause
