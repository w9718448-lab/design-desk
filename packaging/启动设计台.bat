@echo off
chcp 65001 >nul
cd /d "%~dp0"
"%~dp0node\win-x64\node.exe" "%~dp0launcher\windows.js"
timeout /t 6 >nul
