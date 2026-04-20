import os
import time
import logging
import tempfile
from celery import Celery
from dotenv import load_dotenv
from deepface import DeepFace
from app.supabase_client import supabase

# Load env vars
load_dotenv()

# Initialize Celery explicitly pointing to Redis
celery_app = Celery(
    "ai_workers",
    broker=os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0"),
    backend=os.environ.get("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

logger = logging.getLogger(__name__)

@celery_app.task(max_retries=3)
def process_photo_task(photo_id: str, event_id: str, file_path: str):
    """
    Celery Background Task:
    1. Downloads Image from Supabase using file_path
    2. Runs local DeepFace extracting 128D Embeddings (Facenet)
    3. Updates Postgres Vector database (embeddings table)
    4. Sets `processing_status`='ready' in Photos table
    """
    logger.info(f"Starting async processing for photo {photo_id} in event {event_id}")
    
    temp_file_path = None
    try:
        # Step 1: Update status to 'processing'
        supabase.table("photos").update({"processing_status": "processing"}).eq("id", photo_id).execute()
        
        # Step 2: Download image from Supabase Storage
        logger.info(f"Downloading image: {file_path}")
        response = supabase.storage.from_("photos").download(file_path)
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file_path)[1]) as tmp:
            tmp.write(response)
            temp_file_path = tmp.name

        # Step 3: Run DeepFace extraction
        logger.info(f"Extracting embeddings using FaceNet...")
        # represent returns a list of dictionaries, one for each face
        # model_name='Facenet' produces 128D embeddings
        results = DeepFace.represent(
            img_path=temp_file_path, 
            model_name='Facenet', 
            enforce_detection=False,
            detector_backend='opencv' # Faster for bulk processing
        )
        
        face_count = 0
        for res in results:
            embedding = res["embedding"]
            # DeepFace might detect very small or low-confidence faces if enforce_detection=False
            # We index all found faces
            supabase.table("embeddings").insert({
                "photo_id": photo_id,
                "vector": embedding,
                "face_count": len(results)
            }).execute()
            face_count += 1
            
        # Step 4: Update status to 'ready'
        supabase.table("photos").update({
            "processing_status": "ready"
        }).eq("id", photo_id).execute()
        
        logger.info(f"Successfully processed photo {photo_id}. Found {face_count} faces.")
        return {"status": "success", "photo_id": photo_id, "faces_detected": face_count}
        
    except Exception as exc:
        logger.error(f"Failed processing photo {photo_id}: {exc}")
        supabase.table("photos").update({"processing_status": "failed"}).eq("id", photo_id).execute()
        raise exc
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)
