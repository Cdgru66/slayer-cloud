@echo off
setlocal
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "F=%STARTUP%\slayer-fleet-cloud.bat"
if /i "%~1"=="remove" (
  del "%F%" >nul 2>nul
  echo Auto start removed.
  pause
  exit /b
)
> "%F%" echo @echo off
>> "%F%" echo start "Slayer Fleet Cloud" /min "%~dp0start-cloud.bat"
echo Done. The server will start by itself when you log in to Windows.
echo To undo: run  install-autostart.bat remove
pause
