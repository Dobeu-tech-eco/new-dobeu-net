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
call :add_env NEXT_PUBLIC_SUPABASE_URL https://qdwvcrmdqweojverdmmz.supabase.co
call :add_env NEXT_PUBLIC_SUPABASE_ANON_KEY eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkd3Zjcm1kcXdlb2p2ZXJkbW16Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MzM3MTUsImV4cCI6MjA5MTAwOTcxNX0.dm1jVqqyQ44j3-Ckr2-NQ7ZsA_6wRUCnaE1Gl0Rr2g4
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
echo One manual step left:
echo   Grab SUPABASE_SERVICE_ROLE_KEY from:
echo   https://supabase.com/dashboard/project/qdwvcrmdqweojverdmmz/settings/api
echo   Reveal service_role, paste into Vercel as SUPABASE_SERVICE_ROLE_KEY (Sensitive).
echo.
git log --oneline -5
pause
