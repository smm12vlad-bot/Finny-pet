@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install Node.js LTS and restart this file.
  pause
  exit /b 1
)
npm test
pause
