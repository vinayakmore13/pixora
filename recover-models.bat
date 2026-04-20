@echo off
REM Clean and download face-api models
echo.
echo ============================================
echo Face API Model Recovery Script
echo ============================================
echo.

REM Step 1: Delete old models
echo Step 1: Removing corrupted model files...
if exist "public\models" (
    rmdir /s /q public\models
    echo ✓ Deleted public\models
) else (
    echo (Directory doesn't exist, creating new one)
)

REM Create directory
mkdir public\models
echo ✓ Created public\models directory
echo.

REM Step 2: Download fresh models
echo Step 2: Downloading fresh models...
echo (This may take 2-5 minutes, please be patient)
echo.
call npm run download:models

if errorlevel 1 (
    echo.
    echo ✗ Download failed!
    echo.
    echo Troubleshooting:
    echo - Check your internet connection
    echo - Try again in a few moments
    echo - If it keeps failing, the CDN may be temporarily down
    echo.
    pause
    exit /b 1
)

echo.
echo ============================================
echo ✓ Models downloaded successfully!
echo ============================================
echo.
echo Step 3: Now restart your dev server
echo   Press Ctrl+C to stop the current server
echo   Then run: npm run dev
echo.
pause
