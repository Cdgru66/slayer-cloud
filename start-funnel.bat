@echo off
setlocal
set "TS=tailscale"
where tailscale >nul 2>nul
if errorlevel 1 (
  if exist "%ProgramFiles%\Tailscale\tailscale.exe" (
    set "TS=%ProgramFiles%\Tailscale\tailscale.exe"
  ) else (
    echo Tailscale is not installed.
    echo 1. Install it from https://tailscale.com/download/windows
    echo 2. Sign in when it asks
    echo 3. Run this file again
    pause
    exit /b
  )
)
echo ===== Slayer Fleet: permanent link (Tailscale Funnel) =====
echo If a browser page asks you to enable Funnel / HTTPS, click Enable / Approve.
echo.
"%TS%" funnel --bg 8800
echo.
"%TS%" funnel status
echo.
echo The https://....ts.net address above is your permanent link.
echo It keeps working after restarts. You only need to run this file once.
echo (The old start-tunnel.bat / cloudflared window is no longer needed.)
pause
