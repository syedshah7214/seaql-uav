# SEAQL - put the FULL working dashboard (with live Hybrid model detection) online from this PC.
# Free, no account needed: uses a Cloudflare "quick tunnel". The link works while this window stays open
# and the PC is on/online. Every run gives a NEW link.
#
# Usage (PowerShell, from the project folder):
#   powershell -ExecutionPolicy Bypass -File .\deploy\go_live.ps1
param([int]$Port = 8000)
$ErrorActionPreference = "Continue"
$project = Split-Path $PSScriptRoot -Parent
Set-Location $project

# 1) Python that already has the ML packages: the V7 .venv (already proven), else this folder's .venv, else Python 3.12
$candidates = @(
    (Join-Path $project "..\..\V7\seaql-uav-main\.venv\Scripts\python.exe"),
    (Join-Path $project ".venv\Scripts\python.exe"),
    "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe"
)
$py = $null
foreach ($c in $candidates) {
    if (Test-Path $c) {
        & $c -c "import sklearn, xgboost, lightgbm, pandas" 2>$null
        if ($LASTEXITCODE -eq 0) { $py = (Resolve-Path $c).Path; break }
    }
}
if (-not $py) { Write-Host "[SEAQL] No Python with the ML packages found. Run the normal setup steps first." -ForegroundColor Red; exit 1 }
Write-Host "[SEAQL] Python: $py" -ForegroundColor Cyan

# 2) cloudflared (Cloudflare tunnel program)
$cf = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
if (-not $cf) {
    foreach ($p in @("${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe", "$env:ProgramFiles\cloudflared\cloudflared.exe")) { if (Test-Path $p) { $cf = $p } }
}
if (-not $cf) {
    Write-Host "[SEAQL] Installing cloudflared (one time)..." -ForegroundColor Cyan
    winget install --id Cloudflare.cloudflared -e --accept-source-agreements --accept-package-agreements
    foreach ($p in @("${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe", "$env:ProgramFiles\cloudflared\cloudflared.exe")) { if (Test-Path $p) { $cf = $p } }
    if (-not $cf) { $cf = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source }
}
if (-not $cf) { Write-Host "[SEAQL] cloudflared not found. Close PowerShell, open a new one and run this script again." -ForegroundColor Red; exit 1 }

# 3) start the SEAQL server (hidden, no browser)
Write-Host "[SEAQL] Starting the SEAQL server on port $Port ..." -ForegroundColor Cyan
$srv = Start-Process -FilePath $py -ArgumentList "-u", "backend\server.py", "--no-browser", "--port", "$Port" -PassThru -WindowStyle Hidden
$ok = $false
for ($i = 0; $i -lt 90; $i++) {
    Start-Sleep -Seconds 2
    try { $h = Invoke-RestMethod "http://localhost:$Port/api/health" -TimeoutSec 3; if ($h.models.hybrid.status -eq "ready") { $ok = $true; break } } catch {}
}
if (-not $ok) { Write-Host "[SEAQL] Server did not become ready (is another server already using port $Port? close it)." -ForegroundColor Red; Stop-Process -Id $srv.Id -ErrorAction SilentlyContinue; exit 1 }
Write-Host "[SEAQL] Server ready - Hybrid model loaded." -ForegroundColor Green

# 4) open the tunnel and read the public link
$log = Join-Path $env:TEMP "seaql_tunnel.log"
Remove-Item $log -ErrorAction SilentlyContinue
$tun = Start-Process -FilePath $cf -ArgumentList "tunnel", "--no-autoupdate", "--url", "http://localhost:$Port" -PassThru -WindowStyle Hidden -RedirectStandardError $log
$url = $null
for ($i = 0; $i -lt 60 -and -not $url; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Path $log) { $m = Select-String -Path $log -Pattern "https://[a-z0-9-]+\.trycloudflare\.com" | Select-Object -First 1; if ($m) { $url = $m.Matches[0].Value } }
}
if (-not $url) { Write-Host "[SEAQL] Tunnel link not received. Log: $log" -ForegroundColor Red; Stop-Process -Id $srv.Id, $tun.Id -ErrorAction SilentlyContinue; exit 1 }

Write-Host ""
Write-Host "==================== SEAQL IS LIVE ====================" -ForegroundColor Green
Write-Host " Full dashboard + live detection : $url/dashboard.html" -ForegroundColor Yellow
Write-Host " Vercel site using this backend  : https://seaql-uav.vercel.app/dashboard.html?api=$url" -ForegroundColor Yellow
Write-Host " (The link may need ~30 seconds before it opens for the first time.)"
Write-Host " Keep this window open. Press Ctrl+C to stop everything."
Write-Host "=======================================================" -ForegroundColor Green
try { Set-Clipboard "$url/dashboard.html"; Write-Host " Dashboard link copied to clipboard." } catch {}

try { while (-not $srv.HasExited -and -not $tun.HasExited) { Start-Sleep -Seconds 2 } }
finally {
    Stop-Process -Id $srv.Id, $tun.Id -ErrorAction SilentlyContinue
    Write-Host "[SEAQL] Stopped. Link is offline now."
}
