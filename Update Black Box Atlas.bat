@echo off
title Update Black Box Atlas
cd /d "%~dp0"

echo.
echo  Downloading the newest Black Box Atlas from GitHub...
set "ZIP=%TEMP%\crashatlas-update.zip"
set "TMPDIR=%TEMP%\crashatlas-update"
if exist "%TMPDIR%" rmdir /s /q "%TMPDIR%"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "Invoke-WebRequest -UseBasicParsing 'https://codeload.github.com/espnlol/map/zip/refs/heads/claude/zen-maxwell-46802a' -OutFile $env:ZIP;" ^
  "Expand-Archive -Force $env:ZIP $env:TMPDIR"
if errorlevel 1 (
  echo.
  echo  Download failed. Check your internet connection and try again.
  pause
  exit /b 1
)

for /d %%D in ("%TMPDIR%\*") do set "SRC=%%D"
rem Copy new files over this folder (keeps node_modules).
robocopy "%SRC%" "%~dp0." /E /XD node_modules /XF "Update Black Box Atlas.bat" /NFL /NDL /NJH /NJS /NP >nul
rmdir /s /q "%TMPDIR%"
del "%ZIP%" >nul 2>nul

echo.
echo  Black Box Atlas is up to date.
echo  Close any Black Box Atlas window that is already running, then double-click "Start Black Box Atlas".
echo.
pause
