:: Windows批处理文件 - 保存为 start_app.bat
@echo off
title 城市记忆平台启动器
echo ================================
echo    城市记忆平台启动器
echo ================================
echo.
echo 正在启动服务器...

:: 检查Node.js是否安装
node --version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未找到Node.js！
    echo 请先安装Node.js: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: 启动服务器并在后台运行
start /b node server.js

:: 等待服务器启动
echo 等待服务器启动中...
timeout /t 3 /nobreak >nul

:: 检查服务器是否启动成功
echo 检查服务器状态...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:3000' -TimeoutSec 5; if($response.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1

if errorlevel 1 (
    echo 正在重试连接服务器...
    timeout /t 2 /nobreak >nul
    powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:3000' -TimeoutSec 5; if($response.StatusCode -eq 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
)

if errorlevel 1 (
    echo 警告: 服务器可能未正常启动
    echo 请检查是否有错误信息
    echo.
) else (
    echo 服务器启动成功！
)

:: 打开浏览器
echo 正在打开浏览器...
start "" "http://localhost:3000"

echo.
echo ================================
echo 应用已启动！浏览器将自动打开
echo 地址: http://localhost:3000
echo 
echo 要停止服务器，请关闭此窗口
echo ================================
echo.

:: 保持窗口打开，监控服务器
echo 服务器运行中... (按 Ctrl+C 停止)
:loop
timeout /t 5 /nobreak >nul
goto loop