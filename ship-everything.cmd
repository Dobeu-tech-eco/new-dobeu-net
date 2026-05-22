@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"
echo === Shipping everything: env vars + commits + redeploy ===
echo.

REM ---------- Step 1: Add env vars via Vercel CLI ----------
echo.
echo --- Adding NEXT_PUBLIC_SUPABASE_URL ---
echo https://qdwvcrmdqweojverdmmz.supabase.co | call npx --yes vercel@latest env add NEXT_PUBLIC_SUPABASE_URL production preview development --force

echo.
echo --- Adding NEXT_PUBLIC_SUPABASE_ANON_KEY ---
echo eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkd3Zjcm1kcXdlb2p2ZXJkbW16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MzM3MTUsImV4cCI6MjA5MTAwOTcxNX0.dm1jVqqyQ44j3-Ckr2-NQ7ZsA_6wRUCnaE1Gl0Rr2g4 | call npx --yes vercel@latest env add NEXT_PUBLIC_SUPABASE_ANON_KEY production preview development --force

echo.
echo --- Adding NEXT_PUBLIC_MIXPANEL_TOKEN ---
echo f5596f8dbfc32267e58b767dd1ede3ea | call npx --yes vercel@latest env add NEXT_PUBLIC_MIXPANEL_TOKEN production preview development --force

echo.
echo --- Adding NEXT_PUBLIC_POSTHOG_HOST ---
echo https://us.i.posthog.com | call npx --yes vercel@latest env add NEXT_PUBLIC_POSTHOG_HOST production preview development --force

echo.
echo --- Adding RESEND_FROM_EMAIL ---
echo hello@dobeu.net | call npx --yes vercel@latest env add RESEND_FROM_EMAIL production preview development --force

echo.
echo --- Adding RESEND_REPLY_TO ---
echo jeremyw@dobeu.net | call npx --yes vercel@latest env add RESEND_REPLY_TO production preview development --force

REM ---------- Step 1.5: Attach dobeu.net + www.dobeu.net domains ----------
echo.
echo --- Adding dobeu.net to the project ---
call npx --yes vercel@latest domains add dobeu.net new-dobeu-net --scope dobeutechnology --yes 2>&1 | findstr /v "node_modules"
echo.
echo --- Adding www.dobeu.net to the project ---
call npx --yes vercel@latest domains add www.dobeu.net new-dobeu-net --scope dobeutechnology --yes 2>&1 | findstr /v "node_modules"

REM ---------- Step 2: Commit + push everything pending ----------
echo.
echo === Committing and pushing all local changes ===
if exist ".git\index.lock" del /f /q ".git\index.lock"
if exist ".git\HEAD.lock" del /f /q ".git\HEAD.lock"

git add -A
git commit -m "feat(observability+launch): Datadog RUM+Logs, Vercel Analytics+Speed Insights, Intercom Messenger, verification report" -m "- lib/datadog.ts: client RUM + browser-logs (consent-gated)" -m "- lib/intercom.ts: Messenger boot via @intercom/messenger-js-sdk" -m "- @vercel/analytics + @vercel/speed-insights mounted in app/layout.tsx" -m "- next.config.ts CSP extended for Datadog/Intercom/Vercel insights" -m "- docs/verification/2026-05-22-live-deploy.md: full Playwright walk + PSI scores"

git push
if errorlevel 1 (
    echo Push failed. See error above.
    pause
    exit /b 1
)

echo.
echo === DONE ===
echo Vercel will auto-redeploy in ^~60s with all env vars set.
echo Watch: https://vercel.com/dobeutechnology/new-dobeu-net
echo.
echo Still required (manual one-step):
echo   1. Get SUPABASE_SERVICE_ROLE_KEY from
echo      https://supabase.com/dashboard/project/qdwvcrmdqweojverdmmz/settings/api
echo      and add it to Vercel env vars as SUPABASE_SERVICE_ROLE_KEY (sensitive).
echo.
echo   2. Connect dobeu.net domain in Vercel:
echo      https://vercel.com/dobeutechnology/new-dobeu-net/settings/domains
echo      Add `dobeu.net` and `www.dobeu.net`, then update Cloudflare DNS.
echo.
git log --oneline -6
pause
