@echo off
setlocal enabledelayedexpansion

echo ============================================
echo  Bandit Level Guide - one-click setup
echo ============================================
echo.

set "PROJECT_DIR=C:\Users\abdul\bandit-guide"
set "DOWNLOAD_FILE=%PROJECT_DIR%\Bandit_Level_Guide.html"

if not exist "%DOWNLOAD_FILE%" (
    echo Could not find:
    echo   %DOWNLOAD_FILE%
    pause
    exit /b 1
)

echo [1/4] Renaming and preparing file as index.html...
copy /Y "%DOWNLOAD_FILE%" "%PROJECT_DIR%\index.html" >nul

cd /d "%PROJECT_DIR%"

echo [2/4] Setting up Git and updating repo...
git init >nul 2>&1
git add index.html
git commit -m "Add real Claude heavy design" >nul 2>&1
git branch -M main

echo [3/4] Connecting to GitHub repo...
git remote remove origin >nul 2>&1
git remote add origin https://github.com/abdulrehman-oss/bandit-guide.git

echo [4/4] Pushing real file to GitHub...
git push -u origin main --force

echo.
echo ============================================
echo  Done! Real heavy file has been uploaded.
echo  Your live site will update in 1 minute:
echo    https://abdulrehman-oss.github.io/bandit-guide/
echo ============================================
pause