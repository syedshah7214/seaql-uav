@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0run_seaql.ps1"
pause
