import os
import logging
from supabase import create_client, Client
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Load .env from backend folder or project root
load_dotenv()
load_dotenv(os.path.join(os.getcwd(), '..', '.env'))

# Accept both SUPABASE_URL (Render) and VITE_SUPABASE_URL (local dev)
supabase_url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not supabase_url or not supabase_key:
    logger.error(f"Missing Supabase config - URL: {'set' if supabase_url else 'NOT SET'}, Key: {'set' if supabase_key else 'NOT SET'}")
    raise ValueError("Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.")

logger.info(f"Initializing Supabase client with URL: {supabase_url[:50]}...")

try:
    supabase: Client = create_client(supabase_url, supabase_key)
    logger.info("Supabase client initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize Supabase client: {e}")
    raise
