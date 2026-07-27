@echo off
chcp 65001 >nul
title TodoList Install

echo ========================================
echo      TodoList - 安装程序
echo ========================================
echo.

:: Check Node.js
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [错误] 未检测到 Node.js！
    echo 请先下载安装: https://nodejs.org/  (LTS 版本)
    echo 安装完成后重新运行本脚本。
    pause
    exit /b 1
)

echo Node.js 版本:
node -v
echo.

echo [1/3] 安装根目录依赖...
call npm install --silent
if %ERRORLEVEL% NEQ 0 ( echo [错误] 安装失败 & pause & exit /b 1 )

echo [2/3] 安装后端依赖...
cd server
call npm install --silent
cd ..
if %ERRORLEVEL% NEQ 0 ( echo [错误] 安装失败 & pause & exit /b 1 )

echo [3/3] 安装前端依赖...
cd client
call npm install --silent
cd ..
if %ERRORLEVEL% NEQ 0 ( echo [错误] 安装失败 & pause & exit /b 1 )

echo.
echo ========================================
echo      安装完成！
echo.
echo  启动方式：双击 start.bat
echo  或运行：   npm run dev
echo.
echo  前端：http://localhost:5173
echo  后端：http://localhost:3001
echo.
echo  ※ 首次启动时会自动创建示例数据和默认白噪声
echo ========================================
echo.
pause
