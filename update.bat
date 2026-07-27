@echo off
chcp 65001 >nul
title TodoList Update

echo ========================================
echo      TodoList - Update
echo ========================================
echo.
echo This will pull the latest code and reinstall dependencies.
echo Your data (tasks, categories, audio files) will be preserved.
echo.

set /p confirm="Continue? (y/n): "
if /i not "%confirm%"=="y" (
    echo Cancelled
    pause
    exit /b 0
)

where git >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Git not found.
    echo Please download the latest source manually and extract
    echo over this directory (keep the server/data folder).
    pause
    exit /b 1
)

echo.
echo [1/3] Pulling latest code...
git pull
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Pull failed. There may be local conflicts.
    echo Resolve them manually and try again.
    pause
    exit /b 1
)

echo [2/3] Updating dependencies...
call npm install --silent
cd server
call npm install --silent
cd ..
cd client
call npm install --silent
cd ..

echo [3/3] Done!
echo.
echo ========================================
echo      Update successful!
echo.
echo  Your data and audio files are preserved.
echo  New features will be available on next launch.
echo.
echo  To start: double-click start.bat
echo ========================================
echo.
pause
