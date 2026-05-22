@echo off
cd /d "%~dp0"
echo === Clearing stale git locks and pushing all changes ===
echo.

REM 1. Remove the stale index.lock that's blocking git ops
if exist ".git\index.lock" (
    echo Removing .git\index.lock (stale)
    del /f /q ".git\index.lock"
)
if exist ".git\HEAD.lock" del /f /q ".git\HEAD.lock"
if exist ".git\config.lock" del /f /q ".git\config.lock"

echo.
git status --short
echo.

git add -A
git commit -m "feat+docs: Customer.io connector + STATUS handoff + helpers" -m "- lib/customerio.ts: server-side identify+track wrapper" -m "- /api/lead: parallel cioIdentify + cioTrack(lead_captured) alongside Apollo + Supabase + Resend" -m "- STATUS.md: complete finishing recipe with every env var value pre-filled" -m "- commit-all.cmd, unstick-and-push.cmd: helper batch scripts"

echo.
echo --- Pushing to origin/main ---
git push
if errorlevel 1 (
    echo Push failed. Try: git pull --rebase ^&^& git push
    pause
    exit /b 1
)

echo.
echo === DONE ===
git log --oneline -5
echo.
pause
