SEAQL v7 Security Command Center (V3 design + Hybrid AE-Stack model) - see README_DASHBOARD.md for full details.

Windows PowerShell (Python 3.12 or 3.13):
  cd "C:\Users\Admin\Downloads\FYP PANGAY\seaql-uav-main"
  python -m venv .venv
  .\.venv\Scripts\Activate.ps1
  python -m pip install -r .\backend\requirements.txt
  python .\backend\server.py
Then open http://localhost:8000/dashboard.html
