# SEAQL v6 - one-click launcher for Windows PowerShell
# Usage (from this folder):  powershell -ExecutionPolicy Bypass -File .\run_seaql.ps1
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

# The saved models need Python 3.12 or 3.13 (pinned scikit-learn / XGBoost / LightGBM wheels)
$py = "python"
$ver = & $py -c "import sys; print('%d.%d' % sys.version_info[:2])"
if ($ver -ne "3.12" -and $ver -ne "3.13") {
    if (Get-Command py -ErrorAction SilentlyContinue) {
        foreach ($v in @("3.13", "3.12")) { & py -$v -c "pass" 2>$null; if ($LASTEXITCODE -eq 0) { $py = "py -$v"; $ver = $v; break } }
    }
}
if ($ver -ne "3.12" -and $ver -ne "3.13") {
    Write-Host "[SEAQL] Python $ver found. Please install Python 3.12 or 3.13 from python.org (64-bit) and run again." -ForegroundColor Red
    exit 1
}
if (-not (Test-Path ".\.venv")) {
    Write-Host "[SEAQL] Creating virtual environment (.venv) with Python $ver ..." -ForegroundColor Cyan
    Invoke-Expression "$py -m venv .venv"
}
Write-Host "[SEAQL] Installing backend packages ..." -ForegroundColor Cyan
& .\.venv\Scripts\python.exe -m pip install --upgrade pip --quiet
& .\.venv\Scripts\python.exe -m pip install -r .\backend\requirements.txt --quiet
Write-Host "[SEAQL] Starting server on http://localhost:8000/dashboard.html (Ctrl+C to stop)" -ForegroundColor Green
& .\.venv\Scripts\python.exe .\backend\server.py
