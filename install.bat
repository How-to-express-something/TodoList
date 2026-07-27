@echo off
chcp 65001 >nul
title TodoList Install

echo ========================================
echo      TodoList - Setup
echo ========================================
echo.

where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js not found!
    echo Please download from: https://nodejs.org/ (LTS version)
    pause
    exit /b 1
)

echo Node.js version:
node -v
echo.

echo [1/3] Installing root dependencies...
call npm install --silent
if %ERRORLEVEL% NEQ 0 ( echo [ERROR] Failed & pause & exit /b 1 )

echo [2/3] Installing server dependencies...
cd server
call npm install --silent
cd ..
if %ERRORLEVEL% NEQ 0 ( echo [ERROR] Failed & pause & exit /b 1 )

echo [3/3] Installing client dependencies...
cd client
call npm install --silent
cd ..
if %ERRORLEVEL% NEQ 0 ( echo [ERROR] Failed & pause & exit /b 1 )

echo.
echo ========================================
echo      Setup complete!
echo.
echo  To start: double-click start.bat
echo  Or run:   npm run dev
echo.
echo  Frontend: http://localhost:5173
echo  Backend:  http://localhost:3001
echo.
echo  Sample data and default white noise
echo  will be created on first launch.
echo ========================================
echo.
pause
