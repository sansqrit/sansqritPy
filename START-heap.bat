@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Sanskrit Visual Builder — Heap Launcher

if not defined PORT set "PORT=3000"

echo.
echo  Sanskrit Visual Builder launcher
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo  Node.js is not installed or not in PATH.
  exit /b 1
)

for /f "delims=" %%v in ('node --version') do set "NODE_VER=%%v"
for /f "delims=" %%a in ('node -p "process.arch"') do set "NODE_ARCH=%%a"
echo  Node.js !NODE_VER! (!NODE_ARCH!) detected
echo.

if /i "!NODE_ARCH!"=="ia32" (
  echo  Warning: 32-bit Node.js has a lower practical heap ceiling.
  echo.
)

echo  Select Node heap size:
echo    [1] 512 MB
echo    [2] 1024 MB
echo    [3] 2048 MB
echo    [4] 4096 MB
echo    [5] 6144 MB
echo    [6] Custom
echo    [0] Leave unchanged
echo.
set "HEAP_MB="
:HEAP_PROMPT
set /p CHOICE=  Choice [0-6]:
if "%CHOICE%"=="1" set "HEAP_MB=512"
if "%CHOICE%"=="2" set "HEAP_MB=1024"
if "%CHOICE%"=="3" set "HEAP_MB=2048"
if "%CHOICE%"=="4" set "HEAP_MB=4096"
if "%CHOICE%"=="5" set "HEAP_MB=6144"
if "%CHOICE%"=="0" goto :START
if "%CHOICE%"=="6" goto :CUSTOM
if not defined HEAP_MB (
  echo  Invalid choice.
  goto :HEAP_PROMPT
)

goto :START

:START
if defined HEAP_MB (
  set "NODE_OPTIONS=--max-old-space-size=!HEAP_MB! !NODE_OPTIONS!"
  echo  Using max old space size: !HEAP_MB! MB
) else (
  echo  Leaving Node heap settings unchanged.
)
echo  Starting on port %PORT%...
echo.
set "PORT=%PORT%"
node src\server\server.js
exit /b %errorlevel%

:CUSTOM
set "HEAP_MB="
set /p CUSTOM_MB=  Enter custom max old space size in MB (example: 8192):
if not defined CUSTOM_MB goto :CUSTOM
for /f "delims=0123456789" %%A in ("!CUSTOM_MB!") do (
  echo  Please enter a whole number of MB.
  goto :CUSTOM
)
set "HEAP_MB=!CUSTOM_MB!"
goto :START
