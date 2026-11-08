@echo off
title Black Box Atlas
cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js is not installed yet.
  echo  Opening the download page. Install the LTS version, then double-click this file again.
  echo.
  start "" https://nodejs.org
  pause
  exit /b 1
)

echo.
echo  Getting Black Box Atlas ready (the first time takes about a minute)...
call npm install --no-audit --no-fund --loglevel=error
if errorlevel 1 (
  echo.
  echo  Setup failed. Take a screenshot of this window and send it to Claude.
  pause
  exit /b 1
)

echo.
echo  ==========================================================
echo   Black Box Atlas is starting. Your browser will open by itself.
echo   KEEP THIS WINDOW OPEN while you use the app.
echo   Close this window to turn it off.
echo.
echo   Online version, no computer needed:
echo   https://espnlol.github.io/map/crashes/
echo  ==========================================================
echo.
call npm run dev -- --open
pause
