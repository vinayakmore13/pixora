# Load environment
if (Test-Path "../.env") {
    Write-Host "Loading environment from .env"
    Get-Content "../.env" | ForEach-Object {
        if ($_ -and -not $_.StartsWith("#")) {
            $key, $value = $_ -split "=", 2
            [Environment]::SetEnvironmentVariable($key, $value)
        }
    }
}

# Verify Supabase config
$url = $env:VITE_SUPABASE_URL -or $env:SUPABASE_URL
$key = $env:SUPABASE_SERVICE_ROLE_KEY
Write-Host "Supabase URL: $($url.Substring(0,30))..."
Write-Host "Service Role Key: $(if ($key) { 'SET' } else { 'NOT SET' })"

# Setup venv
if (-not (Test-Path "venv")) {
    python -m venv venv
}
& ".\venv\Scripts\Activate.ps1"

# Install/update deps
pip install -q -r requirements.txt

# Start backend
Write-Host "Starting backend on http://127.0.0.1:8000"
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
