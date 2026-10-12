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
    $name = "electron-v$Ver-win32-x64.zip"
    $okZip = { param($f) (Test-Path $f) -and ((Get-FileHash $f -Algorithm SHA256).Hash.ToLower() -eq $Sha) }
    $got = $false
    # 1) ไฟล์ที่ส่งมาไว้ให้แล้ว: ไฟล์เต็ม หรือแบ่งเป็นส่วน (.part1, .part2, ...) ใน %LOCALAPPDATA%\FleetLauncher หรือ Downloads
    $dirs = @((Join-Path $env:LOCALAPPDATA 'FleetLauncher'), (Join-Path $env:USERPROFILE 'Downloads'))
    foreach ($d in $dirs) {
      if ($got) { break }
      $full = Join-Path $d $name
      if (& $okZip $full) { Copy-Item $full $zip; $got = $true; Say "ใช้ไฟล์ที่มีอยู่แล้ว: $full"; break }
      $parts = @(Get-ChildItem -Path $d -Filter "$name.part*" -File -ErrorAction SilentlyContinue | Sort-Object { [int]($_.Name -replace '.*\.part', '') })
      # ชื่อที่ร้านส่งในแชท: slayer-cloud-app.part1, .part2, ... (ไม่มี .zip ในชื่อ จะได้ไม่สับสนกับไฟล์อัปเดต slayer-cloud*.zip)
      if ($parts.Count -eq 0) { $parts = @(Get-ChildItem -Path $d -Filter 'slayer-cloud-app.part*' -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '\.part\d+$' } | Sort-Object { [int]($_.Name -replace '.*\.part', '') }) }
      if ($parts.Count -gt 0) {
        $out = [IO.File]::Create($zip)
        try { foreach ($pt in $parts) { $in = [IO.File]::OpenRead($pt.FullName); try { $in.CopyTo($out) } finally { $in.Close() } } } finally { $out.Close() }
        if (& $okZip $zip) { $got = $true; Say "รวมไฟล์ $($parts.Count) ส่วนจาก $d แล้ว" } else { Remove-Item $zip -Force; Say "ไฟล์ส่วนใน $d ไม่ครบหรือเสีย ข้ามไป" 'Yellow' }
      }
    }
    # 2) ดาวน์โหลด (GitHub ก่อน ถ้าไม่ได้ใช้ mirror · ไม่ว่ามาจากไหนต้องผ่านการตรวจ SHA256 เท่านั้น)
    $urls = @($Url, "https://npmmirror.com/mirrors/electron/$Ver/$name")
    foreach ($u in $urls) {
      if ($got) { break }
      Say ('กำลังดาวน์โหลดตัวแอป (~110 MB) จาก ' + ([Uri]$u).Host + ' ...')
      try { Invoke-WebRequest -UseBasicParsing -Uri $u -OutFile $zip } catch { Say ('  โหลดไม่ได้: ' + $_.Exception.Message) 'Yellow' }
      if (& $okZip $zip) { $got = $true; break }
      & curl.exe -sS -L -f -o $zip $u 2>$null
      if (& $okZip $zip) { $got = $true; break }
      Remove-Item $zip -Force -ErrorAction SilentlyContinue
    }
    if (-not $got) { throw ("ดาวน์โหลดไม่ได้ (โปรแกรมแอนตี้ไวรัส/VPN/เน็ตบ้านดักการเชื่อมต่อ HTTPS อยู่) · โหลดไฟล์ $name ด้วยเบราว์เซอร์จาก $Url ไว้ในโฟลเดอร์ Downloads แล้วรัน install-app.bat ใหม่") }
    Say 'ตรวจไฟล์ผ่าน กำลังแตกไฟล์...'
    if (Test-Path $Dest) { Remove-Item $Dest -Recurse -Force }
    Expand-Archive -LiteralPath $zip -DestinationPath $Dest -Force
    Rename-Item (Join-Path $Dest 'electron.exe') 'FleetLauncher.exe'
    Remove-Item (Join-Path $Dest 'resources\default_app.asar') -Force -ErrorAction SilentlyContinue
    Set-Content -Path (Join-Path $Dest "electron-$Ver.txt") -Value $Ver
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
    Get-ChildItem -Path (Join-Path $env:LOCALAPPDATA 'FleetLauncher') -Filter "$name*" -File -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
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
