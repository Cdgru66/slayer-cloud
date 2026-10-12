# Fleet Launcher: ติดตั้งแอปเดสก์ท็อป FleetLauncher.exe ลงโฟลเดอร์ FleetLauncher (ข้างในโฟลเดอร์ร้าน)
# ดาวน์โหลดตัวแอป Electron ทางการจาก GitHub ตรวจลายนิ้วมือ (SHA256) ให้ตรงต้นฉบับ แล้วใส่โค้ดแอปจากโฟลเดอร์ desktop
# รันซ้ำได้: ครั้งต่อไปไม่ดาวน์โหลดใหม่ แค่อัปเดตโค้ดแอปและทางลัด
param([string]$App = (Split-Path -Parent $MyInvocation.MyCommand.Path))
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ProgressPreference = 'SilentlyContinue'
function Say($t, $c = 'Gray') { Write-Host $t -ForegroundColor $c }
Set-Location $App

$Ver = '33.2.1'
$Sha = 'c325a6d905c67107e166267813ea2151ae7fd316c0a88de0081db0b9851a9946'
$Url = "https://github.com/electron/electron/releases/download/v$Ver/electron-v$Ver-win32-x64.zip"
$Dest = Join-Path $App 'FleetLauncher'
$Src = Join-Path $App 'desktop'
$Exe = Join-Path $Dest 'FleetLauncher.exe'

Say '===== Fleet Launcher: ติดตั้งแอป =====' 'Cyan'
try {
  if (-not (Test-Path (Join-Path $Src 'main.js'))) { throw 'ไม่เจอโฟลเดอร์ desktop · รัน update.bat ให้เป็นเวอร์ชันล่าสุดก่อน' }

  # ปิดตัวเปิดเกมที่ทำงานอยู่ (ทั้งแบบแอปและแบบเก่าที่รันด้วย node) จะได้ไม่ชนพอร์ต
  Get-Process FleetLauncher -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  try { Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*fleet-launcher.js*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue } } catch {}
  Start-Sleep -Seconds 1

  if (-not ((Test-Path $Exe) -and (Test-Path (Join-Path $Dest "electron-$Ver.txt")))) {
    $tmp = Join-Path $env:TEMP ('fleet-app-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Force -Path $tmp | Out-Null
    $zip = Join-Path $tmp 'app.zip'
    Say 'กำลังดาวน์โหลดตัวแอป (~110 MB ครั้งเดียว) ...'
    $got = $false
    try { Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $zip; $got = $true } catch {}
    if (-not $got) {
      Say 'ดาวน์โหลดแบบแรกไม่ได้ ลองอีกวิธี...' 'Yellow'
      & curl.exe -sS -L -f --ssl-no-revoke -o $zip $Url
      if ($LASTEXITCODE -ne 0) { throw 'ดาวน์โหลดไม่สำเร็จ (เช็คเน็ต แล้วลองใหม่)' }
    }
    $h = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLower()
    if ($h -ne $Sha) { throw 'ไฟล์ที่โหลดมาไม่ตรงกับต้นฉบับ (อาจเสียระหว่างโหลด) ลองใหม่อีกครั้ง' }
    Say 'ตรวจไฟล์ผ่าน กำลังแตกไฟล์...'
    if (Test-Path $Dest) { Remove-Item $Dest -Recurse -Force }
    Expand-Archive -LiteralPath $zip -DestinationPath $Dest -Force
    Rename-Item (Join-Path $Dest 'electron.exe') 'FleetLauncher.exe'
    Remove-Item (Join-Path $Dest 'resources\default_app.asar') -Force -ErrorAction SilentlyContinue
    Set-Content -Path (Join-Path $Dest "electron-$Ver.txt") -Value $Ver
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
  } else { Say 'มีตัวแอปอยู่แล้ว อัปเดตเฉพาะโค้ดแอป' }

  # ใส่โค้ดแอป (main.js, ไอคอน) จากโฟลเดอร์ desktop
  $ra = Join-Path $Dest 'resources\app'
  if (Test-Path $ra) { Remove-Item $ra -Recurse -Force }
  New-Item -ItemType Directory -Force -Path $ra | Out-Null
  Copy-Item (Join-Path $Src '*') $ra -Recurse -Force

  # ทางลัดบนเดสก์ท็อป + เมนู Start (ไอคอนของแอป)
  $ws = New-Object -ComObject WScript.Shell
  foreach ($d in @([Environment]::GetFolderPath('Desktop'), (Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'))) {
    try {
      $l = $ws.CreateShortcut((Join-Path $d 'Fleet Launcher.lnk'))
      $l.TargetPath = $Exe; $l.WorkingDirectory = $Dest; $l.IconLocation = (Join-Path $ra 'icon.ico'); $l.Description = 'Fleet Launcher'
      $l.Save()
    } catch {}
  }
  Say ''
  Say 'ติดตั้งเสร็จแล้ว · มีไอคอน Fleet Launcher บนหน้าจอ (Desktop) และในเมนู Start' 'Green'
  Say 'กำลังเปิดแอป...' 'Green'
  Start-Process -FilePath $Exe -WorkingDirectory $Dest
} catch {
  Say ''
  Say ('ติดตั้งไม่สำเร็จ: ' + $_.Exception.Message) 'Red'
  Say 'ถ่ายภาพหน้าต่างนี้ส่งมาได้เลย' 'Red'
  exit 1
}
