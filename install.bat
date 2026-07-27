@echo off
title TodoList Install

echo ========================================
echo      TodoList - Setup
echo ========================================
echo.

where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js not found!
    echo Download from: https://nodejs.org/ (LTS version)
    pause
    exit /b 1
)

echo Node.js version:
node -v
echo.

echo [1/3] Installing root dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 ( echo [ERROR] Failed & pause & exit /b 1 )
echo OK
echo.

echo [2/3] Installing server dependencies...
pushd server
call npm install
popd
if %ERRORLEVEL% NEQ 0 ( echo [ERROR] Failed & pause & exit /b 1 )
echo OK
echo.

echo [3/3] Installing client dependencies...
pushd client
call npm install
popd
if %ERRORLEVEL% NEQ 0 ( echo [ERROR] Failed & pause & exit /b 1 )
echo OK
echo.

echo ========================================
echo      Setup complete!
echo.
echo  Start: double-click start.bat
echo  Or:    npm run dev
echo.
echo  Frontend: http://localhost:5173
echo  Backend:  http://localhost:3001
echo ========================================
echo.
pause
