@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install it from https://nodejs.org
  pause
  exit /b
)
chcp 65001 >nul
set TRUST_PROXY=1
echo ===== Slayer Fleet Cloud =====
echo Server: http://127.0.0.1:8800
echo Closing this window stops the server.
echo This is for local testing. Use a VPS for real use - see README.txt
echo.
node server.js
pause
