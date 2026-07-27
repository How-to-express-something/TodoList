@echo off
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
    echo Download the latest source manually and extract
    echo over this directory (keep the server/data folder).
    pause
    exit /b 1
)

echo.
echo [1/3] Pulling latest code...
git pull
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Pull failed - local conflicts may exist.
    pause
    exit /b 1
)
echo OK
echo.

echo [2/3] Updating dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 ( echo [ERROR] Failed & pause & exit /b 1 )

pushd server
call npm install
popd

pushd client
call npm install
popd
echo OK
echo.

echo ========================================
echo      Update successful!
echo.
echo  Your data and audio files are preserved.
echo.
echo  Start: double-click start.bat
echo ========================================
echo.
pause
