@echo off
REM Boots the Next.js dev server. node_modules already populated from previous install.
cd /d "%~dp0"
echo === dobeu.net v3 dev launcher ===
echo.
echo Project: %CD%
echo.

REM Run native postinstall scripts that pnpm needs (idempotent — fast if done)
REM Use --no-frozen-lockfile so it tolerates the workspace.yaml change
call pnpm rebuild sharp esbuild core-js protobufjs unrs-resolver 2>nul

echo.
echo === Booting pnpm dev ===
echo Open http://localhost:3000 once "Ready" appears.
echo Press Ctrl+C to stop.
echo.
call pnpm dev
echo.
echo Dev server exited. Press any key to close.
pause >nul
