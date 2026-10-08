# Slayer Fleet Cloud: ตัวอัปเดต ดึงไฟล์ล่าสุดจาก GitHub (ถ้าไม่ได้ ใช้ Downloads\slayer-cloud*.zip แทน)
# โฟลเดอร์ data จะถูกสำรองก่อนเสมอ และไม่ถูกเขียนทับ
param([string]$App = (Split-Path -Parent $MyInvocation.MyCommand.Path))
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}
$Repo = 'Cdgru66/slayer-cloud'
$Branch = 'main'
Set-Location $App
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
function Say($t, $c = 'Gray') { Write-Host $t -ForegroundColor $c }

Say '===== Slayer Fleet Cloud: อัปเดต =====' 'Cyan'
$tmp = Join-Path $env:TEMP 'slayer-update'
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
$zip = Join-Path $tmp 'update.zip'

try {
  # 1) ดาวน์โหลดจาก GitHub (repo ส่วนตัวต้องมี token ใน data\github_token.txt)
  $got = $false
  $tokenFile = Join-Path $App 'data\github_token.txt'
  $headers = @{ 'User-Agent' = 'slayer-updater'; 'Accept' = 'application/vnd.github+json' }
  if (Test-Path $tokenFile) { $headers['Authorization'] = 'Bearer ' + (Get-Content $tokenFile -Raw).Trim() }
  try {
    Say "กำลังดาวน์โหลดเวอร์ชันล่าสุดจาก GitHub ($Repo)..."
    Invoke-WebRequest -UseBasicParsing -Headers $headers -Uri "https://api.github.com/repos/$Repo/zipball/$Branch" -OutFile $zip
    $got = $true
    Say 'ดาวน์โหลดสำเร็จ' 'Green'
  } catch {
    $code = $null; try { $code = [int]$_.Exception.Response.StatusCode } catch {}
    if ($code -eq 404 -or $code -eq 401) {
      if (Test-Path $tokenFile) { Say "GitHub ไม่ให้ดาวน์โหลด (รหัส $code): token ผิดหรือหมดอายุ ให้สร้างใหม่แล้ววางทับใน data\github_token.txt" 'Yellow' }
      else { Say "GitHub ไม่ให้ดาวน์โหลด (รหัส $code): repo เป็นแบบส่วนตัว ต้องสร้างไฟล์ data\github_token.txt ก่อน (ดู README.txt)" 'Yellow' }
    } else { Say ('ดาวน์โหลดจาก GitHub ไม่สำเร็จ: ' + $_.Exception.Message) 'Yellow' }
  }

  # 2) สำรอง: ใช้ไฟล์ slayer-cloud*.zip ล่าสุดในโฟลเดอร์ Downloads
  if (-not $got) {
    $dl = Get-ChildItem (Join-Path $env:USERPROFILE 'Downloads') -Filter 'slayer-cloud*.zip' -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $dl) { throw 'ไม่มีไฟล์อัปเดต: ดึงจาก GitHub ไม่ได้ และไม่เจอ slayer-cloud*.zip ใน Downloads' }
    Say ('ใช้ไฟล์ ' + $dl.FullName + ' แทน')
    Copy-Item $dl.FullName $zip
  }

  # 3) แตกไฟล์ แล้วหาโฟลเดอร์ที่มี server.js
  $x = Join-Path $tmp 'x'
  Expand-Archive -LiteralPath $zip -DestinationPath $x -Force
  $srv = Get-ChildItem $x -Recurse -Filter 'server.js' -File | Where-Object { $_.DirectoryName -notmatch '\\(public|data|node_modules)(\\|$)' } | Sort-Object { $_.FullName.Length } | Select-Object -First 1
  if (-not $srv) { throw 'ไม่เจอ server.js ในไฟล์อัปเดต' }
  $src = $srv.DirectoryName

  # 4) สำรอง data แล้วคัดลอกทุกอย่าง ยกเว้น data / backups / cloudflared.exe
  if (Test-Path 'data') {
    $b = Join-Path 'backups' ('data-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
    New-Item -ItemType Directory -Force -Path 'backups' | Out-Null
    Copy-Item 'data' $b -Recurse
    Say "สำรองข้อมูลไว้ที่ $b"
  }
  Get-ChildItem $src -Force | Where-Object { @('data', 'backups', '.git', 'cloudflared.exe') -notcontains $_.Name } | ForEach-Object {
    Copy-Item $_.FullName $App -Recurse -Force
  }
  Remove-Item $tmp -Recurse -Force
  Say 'อัปเดตไฟล์เรียบร้อย' 'Green'
} catch {
  Say ''
  Say ('อัปเดตไม่สำเร็จ: ' + $_.Exception.Message) 'Red'
  Say 'ข้อมูลใน data ไม่ได้ถูกแก้ไข ถ่ายภาพหน้าต่างนี้ส่งมาได้เลย' 'Red'
  exit 1
}

# 5) เปิดเซิร์ฟเวอร์ใหม่ (หน้าต่างอุโมงค์ไม่ต้องปิด)
Say 'กำลังเปิดเซิร์ฟเวอร์ใหม่...'
try {
  Get-NetTCPConnection -LocalPort 8800 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
} catch {}
Start-Sleep -Seconds 1
Start-Process -FilePath (Join-Path $App 'start-cloud.bat') -WorkingDirectory $App
Say 'เสร็จแล้ว เปิดหน้าต่างเซิร์ฟเวอร์ใหม่ให้แล้ว (หน้าต่างเซิร์ฟเวอร์อันเก่าปิดทิ้งได้)' 'Green'
