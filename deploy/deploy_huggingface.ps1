# SEAQL - publish the model server + full dashboard to a Hugging Face Docker Space.
# Usage (PowerShell, from the project folder):
#   powershell -ExecutionPolicy Bypass -File .\deploy\deploy_huggingface.ps1 -User YOUR_HF_USERNAME
param(
    [Parameter(Mandatory = $true)][string]$User,
    [string]$Space = "seaql-api"
)
$ErrorActionPreference = "Stop"
Set-Location -Path (Split-Path $PSScriptRoot -Parent)
$repo = "$User/$Space"

python -m pip install --quiet -U huggingface_hub
Write-Host "[SEAQL] Log in with your Hugging Face access token (WRITE permission)..." -ForegroundColor Cyan
hf auth login

Write-Host "[SEAQL] Creating Docker Space $repo (skipped if it already exists)..." -ForegroundColor Cyan
hf repos create $repo --repo-type space --space-sdk docker --exist-ok

Write-Host "[SEAQL] Uploading Space README (Docker settings)..." -ForegroundColor Cyan
hf upload $repo deploy/huggingface/README.md README.md --repo-type space --commit-message "Space README"

Write-Host "[SEAQL] Uploading project (models ~80 MB, this can take a few minutes)..." -ForegroundColor Cyan
hf upload $repo . . --repo-type space --commit-message "SEAQL v6 dashboard + Hybrid AE-Stack API" `
    --exclude ".venv/*" --exclude "*.zip" --exclude "legacy/*" --exclude "*__pycache__*" `
    --exclude "docs/screenshots_v5/*" --exclude "docs/screenshots_v6/*" --exclude ".git/*" --exclude "README_DASHBOARD.md"

$slug = ("$User-$Space").ToLower() -replace "[^a-z0-9-]", "-"
Write-Host ""
Write-Host "[SEAQL] Done. The Space now builds the Docker image (about 5-10 minutes)." -ForegroundColor Green
Write-Host "        Build log : https://huggingface.co/spaces/$repo"
Write-Host "        Dashboard : https://$slug.hf.space/dashboard.html"
Write-Host "        API check : https://$slug.hf.space/api/health"
Write-Host "        For Vercel put this in app/js/config.js:  window.SEAQL_API_BASE = 'https://$slug.hf.space/';"
