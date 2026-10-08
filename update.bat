@echo off
setlocal
rem Run from a temp copy so this file can be replaced during the update
if /i not "%~1"=="--run" (
  copy /y "%~f0" "%TEMP%\slayer-update.bat" >nul
  call "%TEMP%\slayer-update.bat" --run "%~dp0"
  exit /b
)
set "APP=%~2"
cd /d "%APP%"
echo ===== Slayer Fleet Cloud: update =====
set "ZIP="
for /f "delims=" %%F in ('dir /b /a-d /o-d "%USERPROFILE%\Downloads\slayer-cloud*.zip" 2^>nul') do if not defined ZIP set "ZIP=%USERPROFILE%\Downloads\%%F"
if not defined ZIP (
  echo Not found: Downloads\slayer-cloud*.zip
  echo Download the new slayer-cloud.zip first, then run this again.
  pause
  exit /b
)
echo Using: %ZIP%
echo Your data folder will be backed up and kept.
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
 "$ErrorActionPreference='Stop';" ^
 "$dst=(Resolve-Path '.').Path;" ^
 "if(Test-Path 'data'){ $b=Join-Path 'backups' ('data-'+(Get-Date -Format 'yyyyMMdd-HHmmss')); New-Item -ItemType Directory -Force -Path 'backups' | Out-Null; Copy-Item 'data' $b -Recurse; Write-Host ('Backup: '+$b) }" ^
 "$t=Join-Path $env:TEMP 'slayer-update'; if(Test-Path $t){Remove-Item $t -Recurse -Force};" ^
 "Expand-Archive -LiteralPath $env:ZIP -DestinationPath $t -Force;" ^
 "$src=Join-Path $t 'slayer-cloud'; if(!(Test-Path $src)){ $src=$t };" ^
 "Get-ChildItem $src -Force | Where-Object { $_.Name -ne 'data' -and $_.Name -ne 'backups' } | ForEach-Object { Copy-Item $_.FullName $dst -Recurse -Force };" ^
 "Remove-Item $t -Recurse -Force; Write-Host 'Files updated.'"
if errorlevel 1 (
  echo.
  echo Update FAILED. Nothing was changed in data. Send a screenshot of this window.
  pause
  exit /b
)
echo.
echo Restarting server...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /r /c:":8800 .*LISTENING"') do taskkill /PID %%P /F >nul 2>nul
timeout /t 1 /nobreak >nul
start "Slayer Fleet Cloud" "%APP%start-cloud.bat"
echo Done. The server window was reopened. The tunnel window does not need a restart.
echo You can delete %ZIP% now.
pause
