@echo off
cd /d "%~dp0"
echo === Pushing Datadog + Vercel Analytics + Intercom integration ===
echo.

if exist ".git\index.lock" del /f /q ".git\index.lock"

git status --short
echo.

git add -A
git commit -m "feat(observability): wire Datadog RUM+Logs, Vercel Analytics + Speed Insights, Intercom Messenger" -m "Client-side observability stack now lives behind the same cookie-consent gate as PostHog/Mixpanel:" -m "- lib/datadog.ts: RUM + browser-logs init (sessionSampleRate 100, sessionReplaySampleRate 20, forwardErrorsToLogs, mask-user-input). Helpers: ddIdentify, ddAction, ddError." -m "- lib/intercom.ts: Intercom Messenger boot via @intercom/messenger-js-sdk. Anonymous on marketing pages; identifyIntercom called from /portal after Supabase session loads (HMAC verification ready behind INTERCOM_IDENTITY_VERIFICATION_SECRET when enabled)." -m "- components/analytics-provider.tsx: chained initDatadog() and initIntercom() into the same consent useEffect — they only fire after 'Accept' click." -m "- app/layout.tsx: mounted @vercel/analytics and @vercel/speed-insights — Vercel's free Web Vitals + page-view counter (the 'vercel-plugin' equivalent)." -m "- next.config.ts CSP extended: Datadog browser-intake (browser-intake-datadoghq.com + *.browser-intake-datadoghq.com + us5 variant), Intercom (api-iam.intercom.io, nexus-websocket, widget.intercom.io, *.intercomcdn.com), Vercel insights (va.vercel-scripts.com, vitals.vercel-insights.com)." -m "- .env.example + .env.local: NEXT_PUBLIC_DATADOG_APPLICATION_ID/CLIENT_TOKEN/SITE/SERVICE/ENV + NEXT_PUBLIC_INTERCOM_APP_ID." -m "" -m "Setup once on the service side:" -m "1. Datadog: UX Monitoring -> Applications -> New 'Browser' -> name 'dobeu.net' -> copy applicationId + clientToken." -m "2. Datadog Vercel integration (Vercel Marketplace) -> connect for server-side log forwarding." -m "3. Intercom: Settings -> Installation -> For Web -> copy workspace App ID." -m "4. Paste all 6 values into Vercel env vars (Production + Preview + Development), redeploy."

echo.
echo --- Pushing (will trigger Vercel auto-redeploy) ---
git push
if errorlevel 1 (
    echo Push failed. See error above.
    pause
    exit /b 1
)
echo.
echo === DONE ===
echo Watch: https://vercel.com/dobeutechnology/new-dobeu-net
git log --oneline -6
pause
