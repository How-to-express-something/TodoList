@echo off
cd /d "%~dp0"
echo TodoList - Setup
echo.
node -v >NUL 2>&1
if errorlevel 1 (
    echo Node.js not found.
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
)
echo Step 1/3: Root dependencies
call npm install
if errorlevel 1 goto err
echo OK
echo.
echo Step 2/3: Server dependencies
cd server
call npm install
cd ..
if errorlevel 1 goto err
echo OK
echo.
echo Step 3/3: Client dependencies
cd client
call npm install
cd ..
if errorlevel 1 goto err
echo.
echo ====== Setup complete! ======
echo Run start.bat to launch
pause
exit /b 0
:err
echo ====== ERROR ======
pause
exit /b 1
