@echo off
setlocal
cd /d "%~dp0"
echo === Deploying new-dobeu-net to Vercel ===
echo.

REM Use npx to ensure the latest Vercel CLI is available
echo --- Logging into Vercel (if not already)  ---
echo If asked to login, follow the URL. If already authenticated, this passes through.
call npx --yes vercel@latest whoami
if errorlevel 1 (
    echo You need to authenticate. Running vercel login...
    call npx --yes vercel@latest login
)

echo.
echo --- Linking to dobeutechnology team (new project: new-dobeu-net) ---
call npx --yes vercel@latest link --yes --project new-dobeu-net --scope dobeutechnology

echo.
echo --- Setting environment variables ---
echo|set /p=https://calendly.com/jeremyw-dobeu-r_el | call npx --yes vercel@latest env add NEXT_PUBLIC_CALENDLY_URL production preview development --force --scope dobeutechnology
echo|set /p=jeremyw@dobeu.net | call npx --yes vercel@latest env add ADMIN_EMAILS production preview development --force --scope dobeutechnology

echo.
echo --- Triggering preview deploy ---
call npx --yes vercel@latest --scope dobeutechnology --yes

echo.
echo === DONE ===
pause
