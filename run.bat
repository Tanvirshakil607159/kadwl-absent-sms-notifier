@echo off
setlocal
title ANTY ABB - Dispatch Management System

:: Navigate to the script's directory regardless of where it was launched from
cd /d "%~dp0"

echo =========================================================
echo       ANTY ABB - SMS & Dispatch Management System
echo =========================================================
echo.

:: 1. Verify Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not detected on your system!
    echo Please install Node.js from https://nodejs.org/ and try again.
    echo.
    pause
    exit /b 1
)

:: 2. Check and install dependencies if node_modules folder is missing
if not exist "node_modules\" (
    echo [INFO] First-time setup detected. Installing dependencies...
    echo Please wait while npm packages are installed...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo.
        echo [ERROR] Dependency installation failed. Check your internet connection.
        pause
        exit /b 1
    )
    echo.
    echo [INFO] Dependencies installed successfully!
    echo.
)

:: 3. Start development server and automatically launch browser
echo [INFO] Starting Vite development server...
echo [INFO] Your browser will open automatically at http://localhost:5173
echo [INFO] (Press Ctrl+C or close this window to stop the server)
echo =========================================================
echo.

call npm run dev -- --open

if %errorlevel% neq 0 (
    echo.
    echo [NOTICE] Server process closed.
    pause
)
