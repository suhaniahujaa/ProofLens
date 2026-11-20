@echo off
setlocal
cd /d "%~dp0"
echo ==========================================
echo ProofLens - FREE LOCAL AI SETUP
echo ==========================================
echo.
where ollama >nul 2>nul
if errorlevel 1 (
  echo Installing Ollama with Windows Package Manager...
  winget install --id Ollama.Ollama -e --accept-source-agreements --accept-package-agreements
  if errorlevel 1 (
    echo.
    echo Ollama installation did not finish automatically.
    echo Install Ollama from https://ollama.com/download/windows then run this file again.
    pause
    exit /b 1
  )
  set "PATH=%PATH%;%LOCALAPPDATA%\Programs\Ollama"
)
echo Starting Ollama...
start "" /min ollama serve
ping 127.0.0.1 -n 4 >nul
echo Downloading the local text + image model. This is a ONE-TIME download...
ollama pull gemma3:4b
if errorlevel 1 goto :fail
echo Downloading the RAG meaning-search model...
ollama pull nomic-embed-text
if errorlevel 1 goto :fail
echo.
echo Saving ProofLens free-local provider settings...
> .prooflens_local_settings.tmp echo PROOFLENS_AI_PROVIDER="ollama"
>> .prooflens_local_settings.tmp echo PROOFLENS_MODEL="gemma3:4b"
>> .prooflens_local_settings.tmp echo PROOFLENS_EMBEDDING_MODEL="nomic-embed-text"
if exist .env (
  findstr /v /b /c:"PROOFLENS_AI_PROVIDER=" /c:"PROOFLENS_MODEL=" /c:"PROOFLENS_EMBEDDING_MODEL=" .env > .prooflens_existing.tmp
  type .prooflens_existing.tmp > .env
  del .prooflens_existing.tmp
)
type .prooflens_local_settings.tmp >> .env
del .prooflens_local_settings.tmp
echo DONE. ProofLens can now use AI without API credits.
echo Start it with: py -3.12 start.py
pause
exit /b 0
:fail
echo.
echo Setup stopped before all models were ready. Check internet connection and run this file again.
pause
exit /b 1
