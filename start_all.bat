@echo off
echo Starting AI Service (Backend)...
cd ai-service
start cmd /k ".\venv\Scripts\activate && py app.py"
echo AI Service started in a new window.

echo.
echo Starting Extension (Frontend)...
cd ..\extension
start cmd /k "npm run dev"
echo Extension watcher started in a new window.

echo.
echo Both services are starting in separate windows.
pause
