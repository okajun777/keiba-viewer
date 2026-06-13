$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Write-Host "出馬表ビューアを起動します..."
Start-Process python -ArgumentList "app.py" -WorkingDirectory $root -WindowStyle Minimized
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "ngrok でインターネット公開します。"
Write-Host "表示された https://xxxx.ngrok-free.app をスマホで開いてください。"
Write-Host "停止するにはこの画面で Ctrl+C を押してください。"
Write-Host ""

ngrok http 5000
