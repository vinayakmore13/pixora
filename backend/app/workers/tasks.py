import os
import time
import logging
import tempfile
from celery import Celery
from dotenv import load_dotenv
from deepface import DeepFace
from app.supabase_client import supabase

# Load env vars from backend or root
load_dotenv()
load_dotenv(os.path.join(os.getcwd(), '..', '.env'))

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
            
            # Phase 3: Guest Matching (NEW)
            # Find all guests registered for this event and check for matches
            try:
                registrations = supabase.table("guest_registrations").select("*").eq("event_id", event_id).execute()
                for reg in registrations.data:
                    if reg.get("selfie_embedding"):
                        # Calculate similarity using pgvector (or manual fallback if needed)
                        # For now, we perform a manual distance check or use an RPC if available
                        # Since we are in the worker, we can just call the RPC match_embeddings but specifically for this guest
                        # However, it's easier to just do it here or trigger another task
                        
                        # Let's use the match_embeddings RPC with the guest's embedding to see if it matches this photo
                        rpc_res = supabase.rpc("match_embeddings", {
                            "query_embedding": reg["selfie_embedding"],
                            "match_threshold": 0.6,
                            "match_count": 1,
                            "target_event_id": event_id
                        }).execute()
                        
                        # If the current photo_id is in the match list, this guest is in the photo
                        matches = rpc_res.data or []
                        if any(m["photo_id"] == photo_id for m in matches):
                            logger.info(f"MATCH FOUND: Guest {reg['full_name']} found in photo {photo_id}")
                            supabase.table("guest_matches").insert({
                                "guest_id": reg["id"],
                                "photo_id": photo_id,
                                "event_id": event_id,
                                "similarity": matches[0]["similarity"]
                            }).execute()
                            
                            # Optional: Send Email/Notification trigger here
                            # send_guest_notification.delay(reg["id"], photo_id)
            except Exception as e:
                logger.error(f"Error during guest matching for photo {photo_id}: {e}")

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
