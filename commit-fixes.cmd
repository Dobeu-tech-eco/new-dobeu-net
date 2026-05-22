@echo off
setlocal
cd /d "%~dp0"
echo === Committing hydration fixes + Calendly wiring + pnpm 11 migration ===
echo.

git add .
git commit -m "fix: hydration mismatch, switch dev off Turbopack, pnpm 11 migration, Calendly wiring" -m "- AnalyticsProvider: replace useSearchParams with window.location.search inside useEffect to avoid stuck Suspense boundary" -m "- layout.tsx: drop top-level Suspense wrapper (AnalyticsProvider now handles its own client-side gating)" -m "- package.json: switch dev script from `next dev --turbo` to `next dev` for stability in Next 15.5" -m "- pnpm-workspace.yaml: declare allowBuilds for sharp/esbuild/core-js/protobufjs/unrs-resolver" -m "- BookingTab.tsx: embed Calendly InlineWidget via react-calendly, themed against active light/dark mode, mirror confirmed bookings to /api/lead" -m "- next.config.ts: extend CSP to allow Calendly origins" -m "- next.config.ts: bump next from 15.1.4 to ^15.5.4 (patches CVE-2025-66478)" -m "- middleware/supabase: bail gracefully when Supabase env vars are missing (so marketing landing renders before Supabase is provisioned)" -m "- .env.local: seed Calendly URL and ADMIN_EMAILS for local dev"

git push
if errorlevel 1 (
    echo Push failed. See error above.
    pause
    exit /b 1
)

echo.
echo === DONE — pushed to https://github.com/dobeutech/new-dobeu-net ===
pause
