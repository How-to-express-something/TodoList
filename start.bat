@echo off
title TodoList App

echo ========================================
echo        TodoList App - Local Task Manager
echo ========================================
echo.

if not exist "server\node_modules" (
    echo Installing server dependencies...
    pushd server
    call npm install
    popd
)

if not exist "client\node_modules" (
    echo Installing client dependencies...
    pushd client
    call npm install
    popd
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
