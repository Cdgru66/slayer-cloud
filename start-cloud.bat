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
echo Keep this window open. If the server stops it restarts by itself.
echo.
:run
node server.js
if errorlevel 2 if not errorlevel 3 (
  echo.
  echo Port 8800 is already in use - another server window is already running.
  pause
  exit /b
)
echo.
echo Server stopped. Restarting in 3 seconds... (close this window to stop)
timeout /t 3 /nobreak >nul
goto run
