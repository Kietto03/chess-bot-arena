@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 22+ from https://nodejs.org/ then run this file again.
  pause
  exit /b 1
)
node scripts\launcher.js
set "ARENA_EXIT=%ERRORLEVEL%"
if not "%ARENA_EXIT%"=="0" pause
exit /b %ARENA_EXIT%
