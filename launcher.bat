@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install it from https://nodejs.org
  pause
  exit /b
)
rem launcher.bat console = show the black window (for troubleshooting) / launcher.bat menu = text menu
if /i "%~1"=="console" goto console
if /i "%~1"=="menu" goto console
rem Normal: run in the background with no black window. The control window opens by itself.
rem Running it again while it is already running just opens the control window.
powershell -NoProfile -WindowStyle Hidden -Command "Start-Process -FilePath 'node' -ArgumentList 'launcher\fleet-launcher.js' -WindowStyle Hidden"
exit /b

:console
chcp 65001 >nul
title Fleet Launcher
node launcher\fleet-launcher.js %*
pause
