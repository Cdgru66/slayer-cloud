@echo off
cd /d "%~dp0"
set CF=cloudflared
if exist "%~dp0cloudflared.exe" set CF="%~dp0cloudflared.exe"
where cloudflared >nul 2>nul
if errorlevel 1 if not exist "%~dp0cloudflared.exe" (
  echo cloudflared.exe not found.
  echo 1. Download cloudflared-windows-amd64.exe from the cloudflared releases page on GitHub
  echo    ^(github.com/cloudflare/cloudflared^)
  echo 2. Rename it to cloudflared.exe and put it in this folder
  echo 3. Run this file again
  pause
  exit /b
)
echo Start start-cloud.bat FIRST in another window.
echo.
echo Look for a line like  https://something-random.trycloudflare.com
echo That is your public address. Use it in admin.bat when adding a customer.
echo The address changes every time this window is restarted.
echo.
%CF% tunnel --url http://127.0.0.1:8800
pause
