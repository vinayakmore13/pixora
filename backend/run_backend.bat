@echo off
setlocal enabledelayedexpansion

echo Loading environment...
if exist "..\." (
    for /f "delims=" %%a in ('type ..\. 2^>nul ^| findstr /v "^#" ^| findstr "="') do (
        set "%%a"
    )
)

if exist "../.env" (
    echo Loading from ..\.env
    for /f "delims=" %%a in ('type ..\. 2^>nul ^| findstr /v "^#" ^| findstr "="') do (
        set "%%a"
    )
)

if not "!SUPABASE_URL!!VITE_SUPABASE_URL!"=="" (
    echo Supabase URL: !SUPABASE_URL!!VITE_SUPABASE_URL!
) else (
    echo WARNING: Supabase URL not set
)

if exist venv (
    echo Activating virtual environment...
    call venv\Scripts\activate.bat
) else (
    echo Creating virtual environment...
    python -m venv venv
    call venv\Scripts\activate.bat
)

echo Installing dependencies...
pip install -q -r requirements.txt 2>nul

echo Starting backend on http://127.0.0.1:8000
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload

pause
