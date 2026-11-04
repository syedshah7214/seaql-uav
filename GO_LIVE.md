# SEAQL V9 — Going live

## A) Full app with live detection (free, no account)
```powershell
cd "C:\Users\Admin\Downloads\FYP PANGAY\V9\seaql-uav-main"
powershell -ExecutionPolicy Bypass -File .\deploy\go_live.ps1
```
Prints a public `https://xxxx.trycloudflare.com/dashboard.html` link (copied to the clipboard).
The link works while that window is open and the PC is online. Each run gives a new link.

## B) Permanent website (GitHub -> Vercel, seaql-uav.vercel.app)
```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\replace_github_repo.ps1
```
Old version kept on branch `backup-before-v9`. Vercel rebuilds automatically.
The Vercel site has every page. For live predictions it connects to the PC backend through
`https://seaql-uav.vercel.app/dashboard.html?api=<tunnel link>` (printed by go_live.ps1).
Without a running backend the Detection Lab says "backend not reachable"; no results are faked.
`?api=off` makes the browser forget the saved backend link.
