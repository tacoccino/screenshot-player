@echo off
:: ──────────────────────────────────────────────
::  Screenshot Player — Launch Script (Windows)
:: ──────────────────────────────────────────────
title Screenshot Player - Precision Capture
color 0E

echo Screenshot Player

:: ── Check for Node.js ──────────────────────────────────────────────────────
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo   [ERROR] Node.js not found.
    echo   Please install it from https://nodejs.org and re-run this script.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo   [OK] Node.js found: %NODE_VER%

:: ── Check for npm ──────────────────────────────────────────────────────────
where npm >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo   [ERROR] npm not found. Please reinstall Node.js.
    pause
    exit /b 1
)

:: ── First-time setup ───────────────────────────────────────────────────────
if not exist "node_modules\" (
    echo.
    echo   [SETUP] First run detected. Installing dependencies...
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo   [ERROR] npm install failed. Check your internet connection and try again.
        pause
        exit /b 1
    )
    echo   [OK] Dependencies installed.
) else (
    echo   [OK] Dependencies already installed.
)

:: ── Launch ─────────────────────────────────────────────────────────────────
echo.
echo   [LAUNCH] Starting Screenshot Player dev server...
echo   Open http://localhost:5173 in your browser.
echo   Press Ctrl+C to stop the server.
echo.

:: Attempt to open browser automatically
timeout /t 2 /nobreak >nul
start "" "http://localhost:5173"

call npm run dev

if %ERRORLEVEL% neq 0 (
    echo.
    echo   [ERROR] Server exited with an error.
    pause
)
