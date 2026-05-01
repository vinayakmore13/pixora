import logging
import os
from dotenv import load_dotenv

from pathlib import Path

# Load env vars from root directory relative to this file
env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(env_path)

from fastapi import BackgroundTasks, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pythonjsonlogger import jsonlogger

from app.routers.share import router as share_router
from app.workers.tasks import process_photo_task


logger = logging.getLogger()
log_handler = logging.StreamHandler()
formatter = jsonlogger.JsonFormatter("%(asctime)s %(levelname)s %(name)s %(message)s")
log_handler.setFormatter(formatter)
logger.addHandler(log_handler)
logger.setLevel(logging.INFO)

app = FastAPI(title="Pixvora AI Processing Backend", version="1.0.0")

# Dynamic CORS setup
environment = os.environ.get("APP_ENV", "production").lower()
is_dev = environment in {"dev", "development", "local"}

origins_env = os.environ.get("ALLOWED_ORIGINS") or os.environ.get("FRONTEND_URL")
if not origins_env and is_dev:
    origins_env = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:3000"

if not origins_env:
    # In production, we MUST have origins defined
    if not is_dev:
        raise RuntimeError("Set FRONTEND_URL or ALLOWED_ORIGINS before starting the backend in production.")
    else:
        allow_origins = ["*"] # Absolute fallback for dev
else:
    allow_origins = [origin.strip() for origin in origins_env.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(share_router)


@app.on_event("startup")
async def startup_event():
    """Eagerly cache the Facenet model on server boot unless skipped."""
    if os.environ.get("SKIP_AI_PRELOAD") == "true":
        logger.info("SKIP_AI_PRELOAD is set. Skipping DeepFace initialization.")
        return

    print("Initializing AI Backend (this may take up to 2 minutes)...")
    try:
        from deepface import DeepFace
        logger.info("Pre-loading DeepFace Facenet model...")
        DeepFace.build_model("Facenet")
        logger.info("DeepFace model loaded.")
    except Exception as e:
        logger.error("Failed to pre-load DeepFace model: %s", e)


@app.get("/")
def read_root():
    return {"status": "Pixvora AI Backend is running"}


@app.get("/health")
def health_check():
    """Render uses this to verify the service is alive."""
    return {
        "status": "healthy",
        "ai_provider": "LOCAL (DeepFace/Facenet)",
        "version": "1.0.0",
    }


@app.post("/webhooks/photos/pending")
async def handle_new_photo(request: Request, background_tasks: BackgroundTasks):
    """Receive Supabase photo insert webhooks and queue processing."""
    try:
        payload = await request.json()
        record = payload.get("record")
        if not record:
            raise HTTPException(status_code=400, detail="Missing record in payload")

        photo_id = record.get("id")
        file_path = record.get("file_path")
        event_id = record.get("event_id")

        logger.info("Received webhook for photo %s. Queuing task...", photo_id)
        background_tasks.add_task(process_photo_task, photo_id, event_id, file_path)

        return {"success": True, "status": "Task enqueued", "photo_id": photo_id}

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Error enqueuing webhook: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=True)
