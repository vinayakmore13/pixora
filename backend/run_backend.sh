#!/bin/bash
set -e

# Load environment from the project root
if [ -f "../.env" ]; then
    echo "Loading environment from ../.env"
    export $(cat ../.env | grep -v '#' | xargs)
fi

# Log the configuration
echo "Supabase URL: ${SUPABASE_URL:-${VITE_SUPABASE_URL:-NOT SET}}"
echo "Service role key: ${SUPABASE_SERVICE_ROLE_KEY:+SET}/${SUPABASE_SERVICE_ROLE_KEY:-NOT SET}"

# Install dependencies if needed
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python -m venv venv
fi

# Activate venv and install requirements
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
elif [ -f "venv/Scripts/activate" ]; then
    source venv/Scripts/activate
fi

pip install -q -r requirements.txt

# Start the backend on port 8000
echo "Starting backend on port 8000..."
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
