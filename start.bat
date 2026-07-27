@echo off
chcp 65001 >nul
title TodoList App

echo ========================================
echo        TodoList App - Local Task Manager
echo ========================================
echo.

if not exist "server\node_modules" (
    echo [1/2] Installing server dependencies...
    cd server
    call npm install --silent
    cd ..
) else (
    echo [1/2] Server dependencies ready
)

if not exist "client\node_modules" (
    echo [2/2] Installing client dependencies...
    cd client
    call npm install --silent
    cd ..
) else (
    echo [2/2] Client dependencies ready
)

echo.
echo Starting...
echo   Backend  : http://localhost:3001
echo   Frontend : http://localhost:5173
echo.
echo Press Ctrl+C to stop
echo ========================================
echo.

npm run dev

pause
