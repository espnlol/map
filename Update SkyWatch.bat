@echo off
title Update SkyWatch
cd /d "%~dp0"

echo.
echo  Downloading the newest SkyWatch from GitHub...
set "ZIP=%TEMP%\skywatch-update.zip"
set "TMPDIR=%TEMP%\skywatch-update"
if exist "%TMPDIR%" rmdir /s /q "%TMPDIR%"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "Invoke-WebRequest -UseBasicParsing 'https://codeload.github.com/espnlol/map/zip/refs/heads/claude/eager-mayer-5evp1u' -OutFile $env:ZIP;" ^
  "Expand-Archive -Force $env:ZIP $env:TMPDIR"
if errorlevel 1 (
  echo.
  echo  Download failed. Check your internet connection and try again.
  pause
  exit /b 1
)

for /d %%D in ("%TMPDIR%\*") do set "SRC=%%D"
rem Copy new files over this folder (keeps node_modules and your downloads).
robocopy "%SRC%" "%~dp0." /E /XD node_modules /XF "Update SkyWatch.bat" /NFL /NDL /NJH /NJS /NP >nul
rmdir /s /q "%TMPDIR%"
del "%ZIP%" >nul 2>nul

echo.
echo  SkyWatch is up to date.
echo  Close any SkyWatch window that is already running, then double-click "Start SkyWatch".
echo.
pause
