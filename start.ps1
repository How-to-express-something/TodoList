#Requires -Version 5.0
$host.UI.RawUI.WindowTitle = "TodoList App"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  TodoList App - 本地代办事项系统" -ForegroundColor White
Write-Host "========================================`n" -ForegroundColor Cyan

# 检查依赖
if (-not (Test-Path "server\node_modules")) {
    Write-Host "[1/3] 安装后端依赖..." -ForegroundColor Yellow
    Push-Location server
    npm install
    Pop-Location
} else {
    Write-Host "[1/3] 后端依赖已就绪" -ForegroundColor Green
}

if (-not (Test-Path "client\node_modules")) {
    Write-Host "[2/3] 安装前端依赖..." -ForegroundColor Yellow
    Push-Location client
    npm install
    Pop-Location
} else {
    Write-Host "[2/3] 前端依赖已就绪" -ForegroundColor Green
}

Write-Host "[3/3] 启动服务...`n" -ForegroundColor Yellow
Write-Host "后端: http://localhost:3001" -ForegroundColor Blue
Write-Host "前端: http://localhost:5173" -ForegroundColor Blue
Write-Host "日志: server\logs\app.log`n" -ForegroundColor Gray
Write-Host "按 Ctrl+C 停止所有服务" -ForegroundColor Red
Write-Host "========================================`n" -ForegroundColor Cyan

# 同时启动前后端
$serverJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD\server
    npx tsx src/index.ts
}

$clientJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD\client
    npx vite --host
}

# 显示实时输出
try {
    while ($serverJob.State -eq 'Running' -and $clientJob.State -eq 'Running') {
        Receive-Job $serverJob -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "  [SERVER] $_" -ForegroundColor Blue }
        Receive-Job $clientJob -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "  [CLIENT] $_" -ForegroundColor Green }
        Start-Sleep -Milliseconds 500
    }
} finally {
    Write-Host "`n正在停止服务..." -ForegroundColor Yellow
    Stop-Job $serverJob -ErrorAction SilentlyContinue
    Stop-Job $clientJob -ErrorAction SilentlyContinue
    Remove-Job $serverJob -ErrorAction SilentlyContinue
    Remove-Job $clientJob -ErrorAction SilentlyContinue
    Write-Host "服务已停止" -ForegroundColor Green
    Read-Host "按 Enter 退出"
}
