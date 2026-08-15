@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-refurbished-syntax-tree.ps1" %*
exit /b %ERRORLEVEL%

