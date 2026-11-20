@echo off
title ProofLens
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel% equ 0 (
    goto python_launcher
)
where python >nul 2>nul
if %errorlevel% equ 0 (
    python start.py
    goto finished
)
echo Please install Python 3.12 from https://www.python.org/downloads/windows/
echo During installation, tick "Add python.exe to PATH".
goto finished
:python_launcher
py -3.12 -c "import sys" >nul 2>nul
if errorlevel 1 goto launcher_default
py -3.12 start.py
goto finished
:launcher_default
py -3 start.py
:finished
echo.
pause
