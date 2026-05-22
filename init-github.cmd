@echo off
setlocal
cd /d "%~dp0"
echo === Initializing GitHub repo: dobeutech/new-dobeu-net ===
echo.

REM Step 1: git init if not already a repo
if not exist ".git" (
    echo --- git init ---
    git init -b main
    if errorlevel 1 goto :fail
) else (
    echo --- .git already exists, skipping git init ---
)

REM Step 2: confirm gh is logged in to dobeutech
echo.
echo --- gh auth status ---
gh auth status
if errorlevel 1 (
    echo.
    echo gh CLI is not authenticated. Run: gh auth login
    goto :fail
)

REM Step 3: stage + commit
echo.
echo --- git add . ---
git add .
if errorlevel 1 goto :fail

echo.
echo --- git commit ---
git commit -m "feat: initial scaffold (Phase 1 complete) — Next.js 15 + Supabase + Calendly + design system v2"
REM commit can fail if nothing to commit; that's fine, keep going
if errorlevel 1 (
    echo Nothing to commit, or commit failed — continuing.
)

REM Step 4: create the GitHub repo if it doesn't exist and push
echo.
echo --- gh repo create dobeutech/new-dobeu-net ---
gh repo view dobeutech/new-dobeu-net >nul 2>&1
if errorlevel 1 (
    gh repo create dobeutech/new-dobeu-net --private --source=. --remote=origin --push --description "dobeu.net v3 — Next.js 15 marketing + minimal client portal"
    if errorlevel 1 goto :fail
) else (
    echo Repo already exists. Setting origin and pushing.
    git remote remove origin 2>nul
    git remote add origin https://github.com/dobeutech/new-dobeu-net.git
    git push -u origin main
    if errorlevel 1 goto :fail
)

echo.
echo === DONE ===
echo Repo: https://github.com/dobeutech/new-dobeu-net
echo.
pause
exit /b 0

:fail
echo.
echo === FAILED — see error above ===
pause
exit /b 1
