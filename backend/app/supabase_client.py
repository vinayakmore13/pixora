import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# Accept both SUPABASE_URL (Render) and VITE_SUPABASE_URL (local dev)
supabase_url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not supabase_url or not supabase_key:
    raise ValueError("Missing Supabase configuration (VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)")

supabase: Client = create_client(supabase_url, supabase_key)
