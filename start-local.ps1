Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " Starting Sales AI Coach (Local Development)" -ForegroundColor Green
Write-Host " BackendTTS : http://localhost:5001" -ForegroundColor Yellow
Write-Host " Backend    : http://localhost:5000" -ForegroundColor Yellow
Write-Host " Frontend   : http://localhost:3000" -ForegroundColor Yellow
Write-Host "====================================================" -ForegroundColor Cyan

$root = $PSScriptRoot
Start-Process cmd -ArgumentList "/k title Sales AI Coach - BackendTTS (:5001) && cd /d `"$root\BackendTTS`" && .\venv\Scripts\python.exe main.py"
Start-Sleep -Seconds 1
Start-Process cmd -ArgumentList "/k title Sales AI Coach - Backend (:5000) && cd /d `"$root\Backend`" && npm run dev"
Start-Sleep -Seconds 2
Start-Process cmd -ArgumentList "/k title Sales AI Coach - Frontend (:3000) && cd /d `"$root\Frontend`" && npm run dev"

Write-Host "`nBackend, BackendTTS, dan Frontend telah dijalankan di jendela terminal terpisah!" -ForegroundColor Green
