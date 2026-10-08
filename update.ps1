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
# บันทึกทุกอย่างที่เกิดขึ้นไว้ใน data\update.log (ส่งไฟล์นี้มาได้ถ้าอัปเดตไม่สำเร็จ)
try { New-Item -ItemType Directory -Force -Path (Join-Path $App 'data') | Out-Null; Start-Transcript -Path (Join-Path $App 'data\update.log') -Force | Out-Null } catch {}
Say ('โฟลเดอร์ที่จะอัปเดต: ' + $App)

Say '===== Slayer Fleet Cloud: อัปเดต =====' 'Cyan'
$verFile = Join-Path $App 'version.txt'
$oldVer = if (Test-Path $verFile) { (Get-Content $verFile -Raw).Trim() } else { '(ไม่ทราบ)' }
Say "เวอร์ชันในเครื่องตอนนี้: $oldVer"
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
  $url = "https://api.github.com/repos/$Repo/zipball/$Branch"
  Say "กำลังดาวน์โหลดเวอร์ชันล่าสุดจาก GitHub ($Repo)..."
  $why = ''
  try {
    Invoke-WebRequest -UseBasicParsing -Headers $headers -Uri $url -OutFile $zip
    $got = $true
  } catch {
    $code = $null; try { $code = [int]$_.Exception.Response.StatusCode } catch {}
    if ($code -eq 404 -or $code -eq 401) { $why = "token ($code)" } else { $why = $_.Exception.Message }
  }
  # วิธีที่ 2: curl ที่มากับ Windows 10/11 (ตรวจใบรับรองเหมือนเดิม แค่ไม่บังคับเช็คการเพิกถอนใบรับรองออนไลน์)
  if (-not $got -and $why -notlike 'token*') {
    $curl = Join-Path $env:SystemRoot 'System32\curl.exe'
    if (Test-Path $curl) {
      Say 'ลองดาวน์โหลดอีกวิธี (curl)...'
      $cargs = @('-sS', '-L', '-f', '--ssl-no-revoke', '-o', $zip, '-H', 'User-Agent: slayer-updater', '-H', 'Accept: application/vnd.github+json')
      if ($headers['Authorization']) { $cargs += @('-H', ('Authorization: ' + $headers['Authorization'])) }
      $cargs += $url
      $prevEap = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
      $o = & $curl @cargs 2>&1
      $ErrorActionPreference = $prevEap
      if ($LASTEXITCODE -eq 0 -and (Test-Path $zip) -and (Get-Item $zip).Length -gt 1000) { $got = $true }
      else { $why = 'curl: ' + ($o | Out-String).Trim(); if ($o -match '40[14]') { $why = 'token (curl)' } }
    }
  }
  if ($got) { Say 'ดาวน์โหลดสำเร็จ' 'Green' }
  elseif ($why -like 'token*') {
    if (Test-Path $tokenFile) { Say "GitHub ไม่ให้ดาวน์โหลด: token ผิดหรือหมดอายุ ให้สร้างใหม่แล้ววางทับใน data\github_token.txt" 'Yellow' }
    else { Say "GitHub ไม่ให้ดาวน์โหลด: repo เป็นแบบส่วนตัว ต้องสร้างไฟล์ data\github_token.txt ก่อน (ดู README.txt)" 'Yellow' }
  } else {
    Say ('ดาวน์โหลดจาก GitHub ไม่สำเร็จ: ' + $why) 'Yellow'
    if ($why -match 'trust|SSL|TLS|certificate|schannel') {
      Say 'สาเหตุมักเป็นโปรแกรมแอนตี้ไวรัสที่สแกนเว็บ HTTPS: ลองปิด "Web/HTTPS scanning" ชั่วคราว แล้วกด update.bat ใหม่' 'Yellow'
    }
  }

  # 2) สำรอง: ใช้ไฟล์ slayer-cloud*.zip ล่าสุดในโฟลเดอร์ Downloads
  if (-not $got) {
    $dl = Get-ChildItem (Join-Path $env:USERPROFILE 'Downloads') -Filter 'slayer-cloud*.zip' -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $dl) { throw 'ไม่มีไฟล์อัปเดต: ดึงจาก GitHub ไม่ได้ และไม่เจอ slayer-cloud*.zip ใน Downloads' }
    Say ''
    Say '*** ดึงจาก GitHub ไม่ได้ ***' 'Red'
    Say ('เจอไฟล์ ' + $dl.Name + ' ใน Downloads (บันทึกเมื่อ ' + $dl.LastWriteTime.ToString('d MMM yyyy HH:mm') + ')') 'Yellow'
    Say 'ไฟล์นี้อาจเป็นเวอร์ชันเก่า ถ้าไม่แน่ใจให้กด n แล้วแก้ token ก่อน' 'Yellow'
    $ans = Read-Host 'ใช้ไฟล์นี้อัปเดตแทน? (y/n)'
    if ($ans -ne 'y') { throw 'ยกเลิก: แก้ token ใน data\github_token.txt แล้วลองใหม่' }
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
  $newVer = if (Test-Path $verFile) { (Get-Content $verFile -Raw).Trim() } else { '(ไม่ทราบ)' }
  if ($newVer -eq $oldVer) { Say "อัปเดตไฟล์เรียบร้อย (เวอร์ชัน $newVer เป็นตัวล่าสุดอยู่แล้ว)" 'Green' }
  else { Say "อัปเดตเรียบร้อย: $oldVer -> $newVer" 'Green' }
} catch {
  Say ''
  Say ('อัปเดตไม่สำเร็จ: ' + $_.Exception.Message) 'Red'
  Say 'ข้อมูลใน data ไม่ได้ถูกแก้ไข ถ่ายภาพหน้าต่างนี้ หรือส่งไฟล์ data\update.log มาได้เลย' 'Red'
  try { Stop-Transcript | Out-Null } catch {}
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
try { Stop-Transcript | Out-Null } catch {}
