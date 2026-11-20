@echo off
cd /d "%~dp0"
if not exist .env copy .env.example .env >nul
echo Paste your API key after OPENAI_API_KEY=, save the file, and restart ProofLens.
echo Your key belongs only in this file, not in screenshots or GitHub.
start /wait notepad.exe .env
