@echo off
TITLE RaySync Automation Launcher
echo ------------------------------------------------
echo Starting RaySync Automation...
echo ------------------------------------------------

echo [1/2] Launching Backend API...
start "RaySync - Backend API" cmd /k "cd /d %~dp0server && set PORT=3030 && npm run dev"

echo [2/2] Launching Frontend Dashboard...
start "RaySync - Frontend Dashboard" cmd /k "cd /d %~dp0client && npm run dev -- --port 3080"

echo ------------------------------------------------
echo SUCCESS: Processes are initializing in new windows.
echo Dashboard: http://localhost:3080
echo API: http://localhost:3080/api
echo ------------------------------------------------
pause
