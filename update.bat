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
echo ===== Slayer Fleet Cloud: update =====
copy /y "%APP%\update.ps1" "%TEMP%\slayer-update.ps1" >nul
powershell -NoProfile -ExecutionPolicy Bypass -File "%TEMP%\slayer-update.ps1" -App "%APP%"
if errorlevel 1 (
  echo.
  echo Update FAILED. Your data was not changed. Send a screenshot of this window.
  pause
  exit /b
)
echo.
echo Restarting server...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /r /c:":8800 .*LISTENING"') do taskkill /PID %%P /F >nul 2>nul
timeout /t 1 /nobreak >nul
start "Slayer Fleet Cloud" "%APP%\start-cloud.bat"
echo Done. The server window was reopened. The tunnel window does not need a restart.
pause
