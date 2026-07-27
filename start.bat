@echo off
cd /d "%~dp0"
echo TodoList - Starting...
echo.
if not exist "server\node_modules" (
    cd server
    call npm install
    cd ..
)
if not exist "client\node_modules" (
    cd client
    call npm install
    cd ..
)
echo.
echo Backend:  http://localhost:3001
echo Frontend: http://localhost:5173
echo.
npm run dev
pause
