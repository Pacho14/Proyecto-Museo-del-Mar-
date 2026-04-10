@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo Limpiando procesos...
taskkill /IM node.exe /F 2>nul

timeout /t 2

echo Iniciando Escáner Dinámico...
start "Escáner Dinámico" cmd /k "cd /d "%~dp0ESCANNER_DINAMICO" && npm install && npm start"

timeout /t 3

echo Abriendo navegador...
start http://localhost:3002/

pause
