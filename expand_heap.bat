@echo off
setlocal enabledelayedexpansion
title Sanskrit Visual Builder — Heap Memory Config

echo.
echo   Sanskrit Visual Builder — Heap Memory Configuration
echo   ====================================================
echo.

REM Detect system RAM (Windows)
for /f "tokens=2 delims==" %%a in ('wmic OS get TotalVisibleMemorySize /value 2^>nul') do set TOTAL_KB=%%a
set /a TOTAL_MB=!TOTAL_KB!/1024
if "!TOTAL_MB!"=="0" set TOTAL_MB=4096
echo   System RAM: !TOTAL_MB! MB
echo.

echo   Select heap size for Node.js:
echo   [1]    64 MB  - minimal
echo   [2]   128 MB  - small
echo   [3]   256 MB  - default
echo   [4]   512 MB  - medium
echo   [5]  1024 MB  - large  (1 GB)
echo   [6]  2048 MB  - x-large (2 GB)
echo   [7]  4096 MB  - huge   (4 GB)
echo   [8]   MAX     - use all available RAM (!TOTAL_MB! MB)
echo   [9]  Custom   - enter your own value
echo.

set /p CHOICE="  Your choice [1-9]: "

if "!CHOICE!"=="1" set HEAP=64
if "!CHOICE!"=="2" set HEAP=128
if "!CHOICE!"=="3" set HEAP=256
if "!CHOICE!"=="4" set HEAP=512
if "!CHOICE!"=="5" set HEAP=1024
if "!CHOICE!"=="6" set HEAP=2048
if "!CHOICE!"=="7" set HEAP=4096
if "!CHOICE!"=="8" set HEAP=!TOTAL_MB!
if "!CHOICE!"=="9" (
  set /p HEAP="  Enter heap size in MB: "
)
if not defined HEAP set HEAP=256

echo.
echo   Starting with --max-old-space-size=!HEAP!MB
echo.
set NODE_OPTIONS=--max-old-space-size=!HEAP!
set PORT=3000
node src\server\server.js
pause
