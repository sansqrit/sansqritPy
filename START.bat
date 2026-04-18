@echo off
setlocal enabledelayedexpansion
title Sanskrit Visual Builder v3.2.1

:: ═══════════════════════════════════════════════════════════════════
::  Sanskrit Visual Builder v3.2.1 — Windows Launcher
::  ETL + Data Science + Quantum Computing
:: ═══════════════════════════════════════════════════════════════════

color 0B
echo.
echo   ==============================================
echo    SANSKRIT VISUAL BUILDER v3.2.1
echo    ETL ^| Data Science ^| Quantum Computing
echo   ==============================================
echo.

:: ── Check Node.js is installed ────────────────────────────────────
node --version >nul 2>&1
if errorlevel 1 (
    color 0C
    echo   ERROR: Node.js is not installed or not in PATH.
    echo.
    echo   Please install Node.js from: https://nodejs.org
    echo   Minimum version required: v18.0.0
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node --version') do set NODE_VER=%%v
echo   Node.js %NODE_VER% detected
echo.

:: ── Check if port 3000 is already in use ──────────────────────────
set PORT=3000
set EXISTING_PID=
netstat -ano | findstr ":%PORT%" | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 (
    color 0E
    echo   ┌─────────────────────────────────────────────────┐
    echo   │  WARNING: Port %PORT% is already in use!              │
    echo   │  Another Sanskrit server may still be running.  │
    echo   └─────────────────────────────────────────────────┘
    echo.

    :: Try to find the PID using port 3000
    for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
        set EXISTING_PID=%%p
    )

    if defined EXISTING_PID (
        echo   Found existing process: PID !EXISTING_PID!
        echo.
    )

    echo   What would you like to do?
    echo.
    echo   [1] Kill the existing session and start fresh  ^(recommended^)
    echo   [2] Open the existing session in browser  ^(don't restart^)
    echo   [3] Use a different port ^(3001^)
    echo   [4] Exit
    echo.
    set /p CHOICE="  Your choice [1/2/3/4]: "
    echo.

    if "!CHOICE!"=="1" goto :KILL_AND_START
    if "!CHOICE!"=="2" goto :OPEN_EXISTING
    if "!CHOICE!"=="3" goto :USE_ALT_PORT
    if "!CHOICE!"=="4" goto :EXIT_CLEAN
    :: Default: kill and restart
    goto :KILL_AND_START
)

goto :START_SERVER

:: ── Option 1: Kill existing and start fresh ────────────────────────
:KILL_AND_START
color 0E
echo   Stopping existing server...
if defined EXISTING_PID (
    taskkill /PID !EXISTING_PID! /F >nul 2>&1
    if errorlevel 1 (
        :: Try killing all node processes
        echo   Trying to kill all Node.js processes on port %PORT%...
        for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":%PORT%"') do (
            taskkill /PID %%p /F >nul 2>&1
        )
    ) else (
        echo   [OK] Killed PID !EXISTING_PID!
    )
) else (
    :: Kill by image name if PID not found
    taskkill /IM node.exe /F >nul 2>&1
    echo   [OK] Stopped Node.js processes
)
echo.
:: Wait for port to free up
echo   Waiting for port %PORT% to free...
timeout /t 2 /nobreak >nul
color 0B
goto :START_SERVER

:: ── Option 2: Open existing session ────────────────────────────────
:OPEN_EXISTING
echo   Opening existing session at http://localhost:%PORT%
start "" "http://localhost:%PORT%"
echo.
echo   The existing server is still running.
echo   Close this window when you are done.
echo.
pause
exit /b 0

:: ── Option 3: Use alternate port ───────────────────────────────────
:USE_ALT_PORT
set PORT=3001
color 0B
echo   Using port %PORT% instead.
echo.
goto :START_SERVER

:: ── Start the server ───────────────────────────────────────────────
:START_SERVER
color 0B
echo   Starting Sanskrit Visual Builder on port %PORT%...
echo.

:: Set PORT env var so server.js picks it up
set PORT=%PORT%

:: Run the server — it will handle any remaining EADDRINUSE itself
node src\server\server.js

:: If server exits unexpectedly, offer to restart
if errorlevel 1 (
    color 0E
    echo.
    echo   ┌────────────────────────────────────────┐
    echo   │  Server exited with an error.          │
    echo   └────────────────────────────────────────┘
    echo.
    set /p RESTART="  Restart? [Y/N]: "
    if /i "!RESTART!"=="Y" goto :START_SERVER
)

goto :EXIT_CLEAN

:: ── Exit ───────────────────────────────────────────────────────────
:EXIT_CLEAN
echo.
echo   Sanskrit Visual Builder stopped. Goodbye!
echo.
pause
exit /b 0
