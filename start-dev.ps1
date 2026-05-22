# Double-click this file (or right-click → Run with PowerShell) to start the dev server.
# Reinstalls deps if needed, then boots Next.js on http://localhost:3000.

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "==> dobeu.net v3 dev launcher" -ForegroundColor Cyan
Write-Host ""

Set-Location -Path $PSScriptRoot

# 1. Ensure pnpm is the pinned version
Write-Host "==> Activating pnpm 11.1.3..." -ForegroundColor Yellow
corepack prepare pnpm@11.1.3 --activate 2>$null

# 2. Install (idempotent — fast if already done)
Write-Host "==> Installing dependencies (this also runs the allowlisted native builds)..." -ForegroundColor Yellow
pnpm install

# 3. Start dev
Write-Host ""
Write-Host "==> Booting Next.js. Open http://localhost:3000 when it's ready." -ForegroundColor Green
Write-Host "==> Press Ctrl+C to stop." -ForegroundColor Green
Write-Host ""
pnpm dev
