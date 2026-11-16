@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist .venv\installed.ok (
  echo Setting up Kashuv for the first time, this takes a few minutes...
  if not exist .venv ( py -3 -m venv .venv 2>nul || python -m venv .venv )
  .venv\Scripts\python -m pip install --upgrade pip
  .venv\Scripts\python -m pip install -r requirements.txt || ( echo Install failed. Check your internet and try again. & pause & exit /b 1 )
  echo ok> .venv\installed.ok
)
.venv\Scripts\python app.py
pause
