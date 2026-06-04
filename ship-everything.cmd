@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"
echo === Shipping everything: env vars + domains + commits + redeploy ===
echo.

REM ---------- Step 0: Relink the project (in case .vercel was deleted) ----------
echo --- Relinking project to dobeutechnology/new-dobeu-net ---
call npx --yes vercel@latest link --project new-dobeu-net --scope dobeutechnology --yes

goto :start

REM Adds one env var to all three Vercel environments via echo|set /p (no trailing newline)
:add_env
  set NAME=%~1
  set VALUE=%~2
  echo.
  echo --- %NAME% (production) ---
  echo|set /p=%VALUE%| call npx --yes vercel@latest env add %NAME% production --force
  echo --- %NAME% (preview) ---
  echo|set /p=%VALUE%| call npx --yes vercel@latest env add %NAME% preview --force
  echo --- %NAME% (development) ---
  echo|set /p=%VALUE%| call npx --yes vercel@latest env add %NAME% development --force
  goto :eof

:start

REM ---------- Step 1: Add env vars ----------
REM Note: VERCEL_SUPABASE_* are provisioned automatically by the Vercel
REM Marketplace Supabase integration. The only one we add manually is the
REM NEXT_PUBLIC_VERCEL_SUPABASE_URL alias (Marketplace ships URL server-only).
call :add_env NEXT_PUBLIC_VERCEL_SUPABASE_URL https://ipmjokuezeuukhrilduq.supabase.co
call :add_env NEXT_PUBLIC_MIXPANEL_TOKEN f5596f8dbfc32267e58b767dd1ede3ea
call :add_env NEXT_PUBLIC_POSTHOG_HOST https://us.i.posthog.com
call :add_env RESEND_FROM_EMAIL hello@dobeu.net
call :add_env RESEND_REPLY_TO jeremyw@dobeu.net

REM ---------- Step 2: Attach dobeu.net + www.dobeu.net ----------
echo.
echo --- Adding dobeu.net to the project ---
call npx --yes vercel@latest domains add dobeu.net new-dobeu-net --scope dobeutechnology --yes
echo --- Adding www.dobeu.net to the project ---
call npx --yes vercel@latest domains add www.dobeu.net new-dobeu-net --scope dobeutechnology --yes

REM ---------- Step 3: Commit + push everything pending ----------
echo.
echo === Committing and pushing all pending local changes ===
if exist ".git\index.lock" del /f /q ".git\index.lock"
if exist ".git\HEAD.lock" del /f /q ".git\HEAD.lock"

git add -A
git commit -m "feat(observability+launch): Datadog RUM+Logs + Vercel Analytics+Speed Insights + Intercom + verification report" -m "All client-side observability behind the same cookie-consent gate as PostHog/Mixpanel. CSP extended. Live verification matrix captured."

git push
if errorlevel 1 (
    git pull --rebase 2>nul
    git push
)

echo.
echo === DONE ===
echo Vercel will auto-redeploy in ~60s with all env vars set.
echo Watch: https://vercel.com/dobeutechnology/new-dobeu-net/deployments
echo.
echo Note:
echo   VERCEL_SUPABASE_SERVICE_ROLE_KEY (and the rest of the VERCEL_SUPABASE_*
echo   set) are auto-provisioned by the Vercel Marketplace Supabase integration.
echo   No manual paste needed.
echo.
git log --oneline -5
pause
