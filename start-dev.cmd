@echo off
REM Double-click to start the dev server. No execution policy issues.
cd /d "%~dp0"
echo === dobeu.net v3 dev launcher ===
echo.
echo Project: %CD%
echo.
echo === pnpm install ===
call pnpm install
if errorlevel 1 (
    echo.
    echo pnpm install failed. Press any key to close.
    pause >nul
    exit /b 1
)
echo.
echo === Booting pnpm dev — open http://localhost:3000 ===
call pnpm dev
echo.
echo Dev server exited. Press any key to close.
pause >nul
