@echo off
cd /d "%~dp0"
echo === Pushing Vercel build fixes + Mixpanel + transcript ===
echo.

REM Clear any stale git locks
if exist ".git\index.lock" del /f /q ".git\index.lock"
if exist ".git\HEAD.lock" del /f /q ".git\HEAD.lock"
if exist ".git\config.lock" del /f /q ".git\config.lock"

git status --short
echo.

git add -A
git commit -m "fix(vercel-build): mark portal/admin/login routes as force-dynamic" -m "Root cause: Vercel tried to pre-render server components that call createAdminClient() / createClient(), which throw without env vars (VERCEL_SUPABASE_SERVICE_ROLE_KEY etc.) — failing the build before the user ever hits the page." -m "Fixes:" -m "- app/portal/layout.tsx: export const dynamic = 'force-dynamic'" -m "- app/admin/layout.tsx: same — all admin pages require service-role + cookies" -m "- app/login/page.tsx: same — LoginForm uses useSearchParams under Suspense" -m "" -m "Also includes:" -m "- Mixpanel autocapture + 100%% session replay (token in .env via NEXT_PUBLIC_MIXPANEL_TOKEN)" -m "- CSP allow-list extended for api-js.mixpanel.com + *.mixpanel.com" -m "- docs/CHAT-TRANSCRIPT-2026-05-21.md: structured digest of the build session" -m "- STATUS.md: full handoff with every env var value pre-filled"

echo.
echo --- Pushing to origin/main (will trigger Vercel redeploy automatically) ---
git push
if errorlevel 1 (
    echo Push failed. See error above.
    pause
    exit /b 1
)

echo.
echo === DONE ===
echo Vercel will redeploy automatically. Watch:
echo   https://vercel.com/dobeutechnology/new-dobeu-net
echo.
git log --oneline -5
echo.
pause
