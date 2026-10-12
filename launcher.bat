@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install it from https://nodejs.org
  pause
  exit /b
)
chcp 65001 >nul
title Fleet Launcher
node launcher\fleet-launcher.js %*
pause
