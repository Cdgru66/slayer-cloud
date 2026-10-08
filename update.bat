@echo off
setlocal
rem Run from a temp copy so this file can be replaced during the update
if /i not "%~1"=="--run" (
  copy /y "%~f0" "%TEMP%\slayer-update.bat" >nul
  call "%TEMP%\slayer-update.bat" --run "%~dp0"
  exit /b
)
set "APP=%~2"
if "%APP:~-1%"=="\" set "APP=%APP:~0,-1%"
cd /d "%APP%"
chcp 65001 >nul
copy /y "%APP%\update.ps1" "%TEMP%\slayer-update.ps1" >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%TEMP%\slayer-update.ps1" -App "%APP%"
pause
