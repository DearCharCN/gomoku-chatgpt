@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 22 or later from https://nodejs.org
  pause
  exit /b 1
)
if not exist node_modules\jose (
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
PowerShell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1"
if errorlevel 1 pause
