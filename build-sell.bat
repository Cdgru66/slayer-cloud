@echo off
cd /d "%~dp0"
rem Build the sellable Fleet Launcher (requires a key) into dist\FleetLauncher-sell.zip
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install it from https://nodejs.org
  pause
  exit /b
)
chcp 65001 >nul
node tools\build-sell.js %*
pause
