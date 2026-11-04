# SEAQL - publish this project (V9) to the existing GitHub repo (syedshah7214/seaql-uav).
# The previous version is kept on a backup branch and git history is preserved (no force-push).
# Pushing to "main" also redeploys the connected Vercel site (seaql-uav.vercel.app) automatically.
#
# Usage (PowerShell, from the project folder):
#   powershell -ExecutionPolicy Bypass -File .\deploy\replace_github_repo.ps1
param(
    [string]$RepoUrl = "https://github.com/syedshah7214/seaql-uav.git",
    [string]$Message = "SEAQL v9: Command Center homepage + per-module rooms (backend and models unchanged)"
)
$ErrorActionPreference = "Continue"
function Die($t) { Write-Host "[SEAQL] $t" -ForegroundColor Red; exit 1 }
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Die "Git is not installed. Run:  winget install --id Git.Git -e   then open a NEW PowerShell and try again." }

$project = Split-Path $PSScriptRoot -Parent
$work = Join-Path (Split-Path $project -Parent) "seaql-uav-github"

if (Test-Path (Join-Path $work ".git")) {
    Write-Host "[SEAQL] Using existing clone $work ..." -ForegroundColor Cyan
    Set-Location $work
    git checkout main; git pull origin main
    if ($LASTEXITCODE -ne 0) { Die "git pull failed." }
} else {
    if (Test-Path $work) { Die "Folder $work exists but is not a git clone - rename or delete it first." }
    Write-Host "[SEAQL] Cloning $RepoUrl ..." -ForegroundColor Cyan
    git clone $RepoUrl $work
    if ($LASTEXITCODE -ne 0) { Die "git clone failed (check internet / GitHub sign-in)." }
    Set-Location $work
}

$backup = "backup-before-v9"
git rev-parse --verify --quiet $backup *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[SEAQL] Saving the current site to branch $backup ..." -ForegroundColor Cyan
    git branch $backup
    git push origin $backup
    if ($LASTEXITCODE -ne 0) { Die "Could not push the backup branch (sign in as the repo owner)." }
}

Write-Host "[SEAQL] Replacing all files with the V9 project ..." -ForegroundColor Cyan
git rm -r -q --ignore-unmatch . | Out-Null
# Skipped: local Python env, caches, old zips, the old non-portable model copy (the portable one is used).
robocopy $project $work /E /XD .venv .git __pycache__ legacy /XF *.pyc *.zip stack.joblib /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { Die "Copy failed (robocopy code $LASTEXITCODE)." }

git add -A
$who = git config user.name
if (-not $who) { git config user.name "Syed Measum Shah"; git config user.email "syedshah7214@users.noreply.github.com" }
git commit -m $Message
Write-Host "[SEAQL] Pushing to main (a GitHub sign-in window may open) ..." -ForegroundColor Cyan
git push origin main
if ($LASTEXITCODE -ne 0) { Die "git push failed. Sign in with the GitHub account that owns the repo and run again." }
Write-Host "[SEAQL] Done. GitHub: $($RepoUrl -replace '\.git$','')" -ForegroundColor Green
Write-Host "        Vercel rebuilds in 1-2 minutes: https://seaql-uav.vercel.app/dashboard.html" -ForegroundColor Green
