import os
from supabase import create_client
from dotenv import load_dotenv
import time

load_dotenv()
url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

print(f"Testing connection to {url}")
try:
    start = time.time()
    supabase = create_client(url, key)
    res = supabase.table("events").select("id").limit(1).execute()
    print(f"Success! Fetched in {time.time() - start:.2f}s")
    print(res.data)
except Exception as e:
    print(f"Failed! Error: {e}")
