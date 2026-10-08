# Slayer Fleet Cloud updater: pulls the latest files from GitHub (falls back to Downloads\slayer-cloud*.zip)
# Your data folder is backed up first and never overwritten.
param([string]$App = (Split-Path -Parent $MyInvocation.MyCommand.Path))
$ErrorActionPreference = 'Stop'
$Repo = 'Cdgru66/slayer-cloud'
$Branch = 'main'
Set-Location $App
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$tmp = Join-Path $env:TEMP 'slayer-update'
if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
$zip = Join-Path $tmp 'update.zip'

# 1) download from GitHub (token needed for a private repo: put it in data\github_token.txt)
$got = $false
$tokenFile = Join-Path $App 'data\github_token.txt'
$headers = @{ 'User-Agent' = 'slayer-updater'; 'Accept' = 'application/vnd.github+json' }
if (Test-Path $tokenFile) { $headers['Authorization'] = 'Bearer ' + (Get-Content $tokenFile -Raw).Trim() }
try {
  Write-Host "Downloading latest version from GitHub ($Repo)..."
  Invoke-WebRequest -UseBasicParsing -Headers $headers -Uri "https://api.github.com/repos/$Repo/zipball/$Branch" -OutFile $zip
  $got = $true
} catch {
  $code = $null; try { $code = [int]$_.Exception.Response.StatusCode } catch {}
  if ($code -eq 404 -or $code -eq 401) {
    Write-Host "GitHub refused the download (code $code)." -ForegroundColor Yellow
    if (Test-Path $tokenFile) { Write-Host 'Your token is wrong or expired. Make a new one and replace data\github_token.txt' }
    else { Write-Host 'The repo is private: create a token and save it as data\github_token.txt (see README.txt)' }
  } else { Write-Host ('GitHub download failed: ' + $_.Exception.Message) -ForegroundColor Yellow }
}

# 2) fallback: newest slayer-cloud*.zip in Downloads
if (-not $got) {
  $dl = Get-ChildItem (Join-Path $env:USERPROFILE 'Downloads') -Filter 'slayer-cloud*.zip' -File -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $dl) { throw 'No update source: GitHub failed and no Downloads\slayer-cloud*.zip found.' }
  Write-Host ('Using ' + $dl.FullName)
  Copy-Item $dl.FullName $zip
}

# 3) unpack and find the folder that holds server.js
$x = Join-Path $tmp 'x'
Expand-Archive -LiteralPath $zip -DestinationPath $x -Force
$srv = Get-ChildItem $x -Recurse -Filter 'server.js' -File | Where-Object { $_.DirectoryName -notmatch '\\(public|data|node_modules)(\\|$)' } | Sort-Object { $_.FullName.Length } | Select-Object -First 1
if (-not $srv) { throw 'server.js not found in the update package.' }
$src = $srv.DirectoryName

# 4) backup data, then copy everything except data/backups/cloudflared
if (Test-Path 'data') {
  $b = Join-Path 'backups' ('data-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
  New-Item -ItemType Directory -Force -Path 'backups' | Out-Null
  Copy-Item 'data' $b -Recurse
  Write-Host "Backup: $b"
}
Get-ChildItem $src -Force | Where-Object { @('data', 'backups', '.git', 'cloudflared.exe') -notcontains $_.Name } | ForEach-Object {
  Copy-Item $_.FullName $App -Recurse -Force
}
Remove-Item $tmp -Recurse -Force
Write-Host 'Files updated.' -ForegroundColor Green
