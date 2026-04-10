@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo Limpiando procesos...
taskkill /IM node.exe /F 2>nul
taskkill /IM ngrok.exe /F 2>nul

timeout /t 2

echo Iniciando Acuario...
start "🐢 Acuario" cmd /k "cd /d "%~dp0ACUARIO_MUSEO_MAR" && npm start"

timeout /t 3

echo Iniciando Proxy...
start "🔄 Proxy" cmd /k "cd /d "%~dp0" && node proxy.js"

timeout /t 3

echo Iniciando ngrok...
start "🔒 ngrok" cmd /k "cd /d "%~dp0" && ngrok http 8000 --log=stdout"

timeout /t 5

echo Abriendo aplicaciones...
start http://localhost:8000/
timeout /t 1
start http://localhost:3000/

pause
