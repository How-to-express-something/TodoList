@echo off
cd /d "%~dp0"
echo TodoList - Update
echo.
echo This will pull latest code.
echo Your data is preserved.
echo.
set /p confirm="Continue? (y/n): "
if /i not "%confirm%"=="y" goto cancel
echo.
echo Step 1/3: Pulling code...
git pull
if errorlevel 1 goto err
echo Step 2/3: Installing deps...
call npm install
cd server
call npm install
cd ..
cd client
call npm install
cd ..
echo.
echo ====== Update complete! ======
echo Run start.bat to launch
pause
exit /b 0
:err
echo ====== ERROR ======
pause
exit /b 1
:cancel
echo Cancelled
pause
exit /b 0
