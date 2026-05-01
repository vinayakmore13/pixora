import os
import requests
from dotenv import load_dotenv

load_dotenv()
url = os.environ.get("VITE_SUPABASE_URL")
key = os.environ.get("VITE_SUPABASE_ANON_KEY")

rest_url = f"{url}/rest/v1/events?select=id&limit=1"
headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}"
}

print(f"Testing connection with requests to {rest_url}")
try:
    res = requests.get(rest_url, headers=headers, timeout=10)
    print(f"Status: {res.status_code}")
    print(res.json())
except Exception as e:
    print(f"Failed! Error: {e}")
