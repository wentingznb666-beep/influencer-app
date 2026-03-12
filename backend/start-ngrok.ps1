# 外网访问：启动 ngrok 并更新前端接口地址
# 使用前请先执行一次：ngrok config add-authtoken <你的token>
# 获取 token：https://dashboard.ngrok.com/get-started/your-authtoken

$ErrorActionPreference = "Stop"
$backendDir = $PSScriptRoot
$frontendEnv = Join-Path (Split-Path $backendDir -Parent) "frontend\.env"

$ngrokExe = Get-Command ngrok -ErrorAction SilentlyContinue
if (-not $ngrokExe) {
    Write-Host "未找到 ngrok，请先安装：winget install ngrok.ngrok" -ForegroundColor Yellow
    exit 1
}

$configPath = Join-Path $backendDir "ngrok.yml"
Write-Host "正在启动 ngrok（backend + frontend）..."
$p = Start-Process -FilePath "ngrok" -ArgumentList "start", "--config", $configPath, "backend", "frontend" -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 5

$tunnels = $null
$tunnels = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -Method Get -ErrorAction SilentlyContinue

if (-not $tunnels -or -not $tunnels.tunnels) {
    Write-Host "无法读取 ngrok 隧道信息。请确认已执行：ngrok config add-authtoken <你的token>" -ForegroundColor Red
    Write-Host "然后手动在第三个终端执行：cd D:\backend; ngrok start --config ngrok.yml backend frontend" -ForegroundColor Yellow
    $p | Stop-Process -Force -ErrorAction SilentlyContinue
    exit 1
}

$backendUrl = $null
$frontendUrl = $null
foreach ($t in $tunnels.tunnels) {
    if ($t.name -eq "backend") {
        $backendUrl = $t.public_url
    }
    if ($t.name -eq "frontend") {
        $frontendUrl = $t.public_url
    }
}

if (-not $backendUrl -or -not $frontendUrl) {
    Write-Host "未获取到隧道地址，请稍等几秒后访问 http://127.0.0.1:4040 查看。" -ForegroundColor Yellow
    $p | Stop-Process -Force -ErrorAction SilentlyContinue
    exit 1
}

$content = Get-Content $frontendEnv -Raw
$content = $content -replace "VITE_API_BASE_URL=.*", "VITE_API_BASE_URL=$backendUrl"
Set-Content -Path $frontendEnv -Value $content.TrimEnd() -NoNewline
Write-Host "已写入后端公网地址到 frontend\.env：$backendUrl" -ForegroundColor Green
Write-Host ""
Write-Host "外网访问地址（在手机或任意浏览器打开）：" -ForegroundColor Cyan
Write-Host "  $frontendUrl" -ForegroundColor White
Write-Host ""
Write-Host "请在前端所在终端按 Ctrl+C 停止后重新执行：cd D:\frontend; npm run dev" -ForegroundColor Yellow
Write-Host "ngrok 正在后台运行，关闭本窗口会结束隧道。" -ForegroundColor Gray
