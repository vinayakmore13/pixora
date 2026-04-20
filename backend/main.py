from fastapi import FastAPI, BackgroundTasks, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.workers.tasks import process_photo_task
from app.routers.share import router as share_router
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Pixora AI Processing Backend", version="1.0.0")

# Allow all CORS for development MVP
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(share_router)

@app.get("/")
def read_root():
    return {"status": "Pixora AI Backend is running"}

@app.post("/webhooks/photos/pending")
async def handle_new_photo(request: Request, background_tasks: BackgroundTasks):
    """
    Webhook endpoint to receive 'INSERT' triggers from Supabase Postgres.
    """
    try:
        payload = await request.json()
        record = payload.get("record")
        if not record:
            raise HTTPException(status_code=400, detail="Missing record in payload")

        photo_id = record.get("id")
        file_path = record.get("file_path")
        event_id = record.get("event_id")
        
        logger.info(f"Received webhook for photo {photo_id}. Queuing task...")
        
        # Determine if Celery is connected, else use built-in BackgroundTasks
        # For simplicity without Redis running immediately, we use FastAPI background tasks:
        # process_photo_task.delay(photo_id, event_id, file_path) -> For Celery
        
        # Unwrapped call since BackgroundTasks doesn't pass 'self'
        from app.workers.tasks import process_photo_task
        background_tasks.add_task(process_photo_task, photo_id, event_id, file_path)



        return {"success": True, "status": "Task enqueued", "photo_id": photo_id}
    
    except Exception as e:
        logger.error(f"Error enqueuing webhook: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
