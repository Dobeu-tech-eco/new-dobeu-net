@echo off
cd /d "%~dp0"
echo === Committing all pending changes ===
echo.
git status --short
echo.
git add -A
git commit -m "feat: Customer.io connector + STATUS handoff doc + next-env auto-update" -m "- lib/customerio.ts: server-side identify+track wrapper (PUT customers, POST events)" -m "- /api/lead: parallel-fire cioIdentify + cioTrack(lead_captured) alongside Apollo + Supabase + Resend" -m "- STATUS.md: full finishing recipe with all env var values pre-filled (Supabase URL + anon key from db-dobeutech-unified)" -m "- commit-push.cmd, commit-all.cmd: helper batch files for git ops" -m "- next-env.d.ts: auto-updated by next dev to include .next/types/routes.d.ts ref"
echo.
echo --- Pushing to origin/main ---
git push
if errorlevel 1 (
    echo.
    echo Push failed. See error above.
    pause
    exit /b 1
)
echo.
echo === DONE — pushed to https://github.com/dobeutech/new-dobeu-net ===
echo.
echo Latest commits:
git log --oneline -5
pause
