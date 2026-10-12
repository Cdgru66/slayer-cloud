@echo off
cd /d "%~dp0"
chcp 65001 >nul
title Fleet Launcher - install app
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-app.ps1" -App "%~dp0."
pause
