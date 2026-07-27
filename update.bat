@echo off
chcp 65001 >nul
title TodoList Update

echo ========================================
echo      TodoList - 更新程序
echo ========================================
echo.
echo 此操作将从 Git 拉取最新代码并重新安装依赖。
echo 你的数据（事务、分类、音频文件）不会丢失。
echo.

:: Confirm
set /p confirm="继续更新？(y/n): "
if /i not "%confirm%"=="y" (
    echo 已取消
    pause
    exit /b 0
)

:: Check git
where git >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [错误] 未检测到 Git
    echo 请手动下载最新源码包替换本目录（保留 server/data 文件夹即可）
    pause
    exit /b 1
)

echo.
echo [1/3] 拉取最新代码...
git pull
if %ERRORLEVEL% NEQ 0 (
    echo [错误] 拉取失败，可能有本地冲突
    echo 请手动解决冲突后重试
    pause
    exit /b 1
)

echo [2/3] 更新依赖...
call npm install --silent
cd server
call npm install --silent
cd ..
cd client
call npm install --silent
cd ..

echo [3/3] 更新完成！
echo.
echo ========================================
echo      更新成功！
echo.
echo  你的数据和音频文件已保留。
echo  如果提示有新功能，首次启动时自动生效。
echo.
echo  启动方式：双击 start.bat
echo ========================================
echo.
pause
