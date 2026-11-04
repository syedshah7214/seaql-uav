# Deploying SEAQL (GitHub · Hugging Face · Vercel)

| Part | Where | Why |
|---|---|---|
| Source code | **GitHub** | version control, link for the thesis/viva |
| Model server (Python, Hybrid AE-Stack + RF) **and** the full dashboard | **Hugging Face Docker Space** (free CPU, 16 GB RAM) | the backend needs ~0.8–0.9 GB RAM and ~350 MB of ML libraries |
| Website (all pages) | **Vercel** | fast static hosting; calls the Hugging Face API for the AI Detection Lab |

Vercel cannot run the model server itself (Python function size limit 250 MB; the ML stack is larger).
Render's free tier (512 MB RAM) is also too small for the loaded model (~810 MB).

All commands below are for **Windows PowerShell**. Install first: Git for Windows (https://git-scm.com),
Python 3.12/3.13, and for the Vercel CLI option Node.js LTS (https://nodejs.org).

---

## Step 1 — GitHub

1. On github.com click **New repository** → name e.g. `seaql-uav-dashboard` → Public → **do not** add a README → Create.
2. In PowerShell:

```powershell
cd "C:\Users\Admin\Downloads\FYP PANGAY\seaql-uav-main"
git init
git add .
git commit -m "SEAQL v6: Mission Control dashboard + Hybrid AE-Stacked Ensemble detection"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/seaql-uav-dashboard.git
git push -u origin main
```

`backend/models/hybrid/stack.joblib` is 67 MB — GitHub accepts it (limit 100 MB per file) but shows a size warning; that is fine.
When `git push` asks for a password, use a GitHub **Personal Access Token** (Settings → Developer settings → Tokens), not your password.

---

### Replacing the existing repo `syedshah7214/seaql-uav` instead
```powershell
cd "C:\Users\Admin\Downloads\FYP PANGAY\seaql-uav-main"
powershell -ExecutionPolicy Bypass -File .\deploy\replace_github_repo.ps1
```
This clones the repo next to the project, saves the old version on branch `backup-old-site`, replaces every file
with v6, commits and pushes to `main` (no force-push, history kept). Vercel (`seaql-uav.vercel.app`) redeploys automatically.

---

## Step 2 — Hugging Face Space (model server + full working dashboard)

1. Create a free account at https://huggingface.co and a token with **Write** access:
   https://huggingface.co/settings/tokens
2. Run the helper script (creates the Space and uploads the project):

```powershell
cd "C:\Users\Admin\Downloads\FYP PANGAY\seaql-uav-main"
powershell -ExecutionPolicy Bypass -File .\deploy\deploy_huggingface.ps1 -User YOUR_HF_USERNAME
```

   Manual equivalent:

```powershell
python -m pip install -U huggingface_hub
hf auth login
hf repos create YOUR_HF_USERNAME/seaql-api --repo-type space --space-sdk docker --exist-ok
hf upload YOUR_HF_USERNAME/seaql-api deploy/huggingface/README.md README.md --repo-type space
hf upload YOUR_HF_USERNAME/seaql-api . . --repo-type space --exclude ".venv/*" --exclude "*.zip" --exclude "legacy/*" --exclude "*__pycache__*" --exclude "docs/screenshots_v5/*" --exclude "docs/screenshots_v6/*" --exclude "README_DASHBOARD.md"
```

3. Wait for the build (5–10 min, watch https://huggingface.co/spaces/YOUR_HF_USERNAME/seaql-api).
4. Check:
   * `https://YOUR_HF_USERNAME-seaql-api.hf.space/api/health` → `"hybrid": {"status": "ready"}`
   * `https://YOUR_HF_USERNAME-seaql-api.hf.space/dashboard.html` → the **complete** dashboard with live detection

The Space alone is already a complete live demo. Free Spaces sleep after ~48 h without visits; open the
link a few minutes before the viva so it wakes up.

---

## Step 3 — Vercel (website)

1. Point the website at your Space: edit `app/js/config.js`

```js
window.SEAQL_API_BASE = 'https://YOUR_HF_USERNAME-seaql-api.hf.space/';
```

   then commit and push:

```powershell
git add app/js/config.js
git commit -m "Connect dashboard to Hugging Face model server"
git push
```

2. Deploy — **either** with the website (easiest):
   https://vercel.com → *Sign up with GitHub* → **Add New… → Project** → import `seaql-uav-dashboard` →
   Framework Preset **Other**, Build Command **empty**, Output Directory **`.`** → **Deploy**.
   Every later `git push` redeploys automatically.

   **or** with the CLI:

```powershell
npm install -g vercel
cd "C:\Users\Admin\Downloads\FYP PANGAY\seaql-uav-main"
vercel login
vercel --prod
```

3. Open `https://YOUR-PROJECT.vercel.app/dashboard.html` (or `/dashboard`). The research website stays at `/`.

Optional hardening: in the Space **Settings → Variables**, add `SEAQL_ALLOW_ORIGIN = https://YOUR-PROJECT.vercel.app`
so only your Vercel site may call the API.

---

## What was tested before delivery
* Vercel bundle (files left after `.vercelignore`, 28 MB) served by a static server: all pages load; Detection Lab shows
  an honest "backend not reachable" note when no API is configured.
* Same bundle with `SEAQL_API_BASE` pointing to a model server on another origin: CORS works, Hybrid detection on the
  held-out sample returns 94.5% accuracy, no console errors.
* Container-equivalent run (clean Python 3.12 + `backend/requirements.txt`, `HOST=0.0.0.0 PORT=7860`): both models load,
  all 6,621 held-out rows → 94.41% acc · 93.36% macro F1 · 98.39% AUC, CORS headers present, dashboard served.
* Not tested here: the actual Docker image build (no Docker daemon available) and the real GitHub / Hugging Face /
  Vercel accounts.
