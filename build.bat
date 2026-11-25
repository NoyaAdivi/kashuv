@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Building Kashuv for Windows, this takes a few minutes...
if not exist .venv ( py -3 -m venv .venv 2>nul || python -m venv .venv )
.venv\Scripts\python -m pip install --upgrade pip
.venv\Scripts\python -m pip install -r requirements.txt pyinstaller || ( echo Install failed. Check your internet and try again. & pause & exit /b 1 )
.venv\Scripts\python -m PyInstaller --noconfirm --clean --name Kashuv --icon static\icons\kashuv.ico ^
  --add-data "templates;templates" --add-data "static;static" --add-data "sw.js;." ^
  --collect-all faster_whisper --collect-all ctranslate2 --collect-all onnxruntime --collect-all soundcard ^
  --collect-submodules kashuv app.py || ( echo Build failed. & pause & exit /b 1 )
if exist Kashuv-Windows.zip del Kashuv-Windows.zip
powershell -NoProfile -Command "Compress-Archive -Path 'dist\Kashuv' -DestinationPath 'Kashuv-Windows.zip'"
echo.
echo Done! Kashuv-Windows.zip is ready to upload to GitHub Releases.
pause
