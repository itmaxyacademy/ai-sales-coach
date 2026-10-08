@echo off
title Sales AI Coach - Local Launcher
echo ====================================================
echo  Starting Sales AI Coach (Local Development)
echo  BackendTTS : http://localhost:5001
echo  Backend    : http://localhost:5000
echo  Frontend   : http://localhost:3000
echo ====================================================

start "Sales AI Coach - BackendTTS (:5001)" cmd /k "cd /d %~dp0BackendTTS && .\venv\Scripts\python.exe main.py"
timeout /t 1 /nobreak >nul
start "Sales AI Coach - Backend (:5000)" cmd /k "cd /d %~dp0Backend && npm run dev"
timeout /t 2 /nobreak >nul
start "Sales AI Coach - Frontend (:3000)" cmd /k "cd /d %~dp0Frontend && npm run dev"

echo.
echo Ketiga service telah dibuka di jendela terpisah!
echo Tekan sembarang tombol untuk menutup jendela launcher ini...
pause >nul
