from fastapi import APIRouter, HTTPException, UploadFile, File, Header, Depends, Request
from typing import Optional, List
import uuid
import secrets
from datetime import datetime, timedelta
import tempfile
import os
from deepface import DeepFace
from app.supabase_client import supabase
from app.schemas import ShareLinkCreate, ShareLinkResponse, AccessVerifyRequest, PhotoMatchResponse
from app.utils import generate_qr_svg
import logging

router = APIRouter(prefix="/share", tags=["share"])
logger = logging.getLogger(__name__)

# Mock DB for session tokens (In production, use Redis or a sessions table)
# session_id -> {token, event_id, expires_at}
SESSIONS = {}

@router.post("/{event_id}/create-link", response_model=ShareLinkResponse)
async def create_share_link(event_id: str, data: ShareLinkCreate):
    """
    Host only: Generate a short-lived share link and QR code.
    """
    token = secrets.token_urlsafe(8)
    expires_at = datetime.utcnow() + timedelta(days=data.expires_in_days)
    
    # Save to DB
    res = supabase.table("share_links").insert({
        "event_id": event_id,
        "token": token,
        "mode": data.mode,
        "expires_at": expires_at.isoformat()
    }).execute()
    
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create share link")
    
    # Generate share URL (frontend base + token)
    # In production, get base URL from env
    base_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")
    share_url = f"{base_url}/share/{token}"
    
    # Generate QR Code SVG
    qr_svg = generate_qr_svg(share_url)
    
    return {
        "share_url": share_url,
        "qr_code_svg": qr_svg,
        "token": token,
        "expires_at": expires_at
    }

@router.post("/{token}/verify")
async def verify_access(token: str, data: AccessVerifyRequest):
    """
    Verify guest access (Password or OTP placeholder).
    """
    # 1. Fetch link details
    res = supabase.table("share_links").select("*").eq("token", token).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Link not found")
    
    link = res.data[0]
    
    # 2. Check expiry
    if datetime.fromisoformat(link["expires_at"].replace("Z", "+00:00")) < datetime.now(datetime.timezone.utc).replace(tzinfo=None):
        raise HTTPException(status_code=410, detail="Link expired")
    
    # 3. Mode-specific check
    if link["mode"] == "password":
        # In production, check against event share_password_hash
        # For now, we allow any password if it matches a placeholder or event setting
        pass 
    elif link["mode"] == "otp":
        # Placeholder OTP check
        logger.info(f"OTP verification simulation for {data.email or data.phone}")
        pass
    
    # 4. Create session token
    session_token = secrets.token_hex(16)
    SESSIONS[session_token] = {
        "token": token,
        "event_id": link["event_id"],
        "expires_at": datetime.utcnow() + timedelta(hours=2)
    }
    
    # Log access
    supabase.table("access_logs").insert({
        "event_id": link["event_id"],
        "share_link_id": link["id"],
        "success": True,
        "action_type": "verify"
    }).execute()
    
    return {"access_granted": True, "session_token": session_token}

@router.post("/{token}/match", response_model=List[PhotoMatchResponse])
async def match_selfie(token: str, file: UploadFile = File(...), session_token: str = Header(...)):
    """
    Extract facial embedding from selfie and search for matches.
    """
    # 1. Validate session
    session = SESSIONS.get(session_token)
    if not session or session["token"] != token:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    
    if session["expires_at"] < datetime.utcnow():
        del SESSIONS[session_token]
        raise HTTPException(status_code=401, detail="Session expired")

    event_id = session["event_id"]
    temp_path = None
    
    try:
        # 2. Save selfie to temp file
        ext = os.path.splitext(file.filename)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            content = await file.read()
            tmp.write(content)
            temp_path = tmp.name

        # 3. Extract embedding
        logger.info(f"Extracting selfie embedding...")
        results = DeepFace.represent(
            img_path=temp_path,
            model_name='Facenet',
            enforce_detection=True, # Reject if no face
            detector_backend='opencv'
        )
        
        if len(results) > 1:
             raise HTTPException(status_code=400, detail="Multiple faces detected. Please take a solo selfie.")
             
        selfie_embedding = results[0]["embedding"]
        
        # 4. Vector search via pgvector RPC
        match_res = supabase.rpc("match_embeddings", {
            "query_embedding": selfie_embedding,
            "match_threshold": 0.6,
            "match_count": 100,
            "target_event_id": event_id
        }).execute()
        
        if not match_res.data:
            return []
            
        photo_ids = [r["photo_id"] for r in match_res.data]
        similarity_map = {r["photo_id"]: r["similarity"] for r in match_res.data}
        
        # 5. Fetch photo details and generate signed URLs
        photos_res = supabase.table("photos").select("id, file_path, thumbnail_url").in_("id", photo_ids).execute()
        
        matches = []
        for p in photos_res.data:
            # Generate signed URL (valid for 1 hour)
            signed_url = supabase.storage.from_("photos").create_signed_url(p["file_path"], 3600)
            
            matches.append({
                "id": p["id"],
                "url": signed_url["signedURL"],
                "thumbnail_url": p["thumbnail_url"],
                "similarity": similarity_map.get(p["id"], 0)
            })
            
        # Log match attempt
        supabase.table("access_logs").insert({
            "event_id": event_id,
            "success": True,
            "action_type": "match"
        }).execute()
        
        return sorted(matches, key=lambda x: x["similarity"], reverse=True)

    except Exception as e:
        logger.error(f"Selection matching failed: {str(e)}")
        if "Face could not be detected" in str(e):
             raise HTTPException(status_code=400, detail="No face detected. Please try again with better lighting.")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

@router.get("/{token}/download-zip")
async def download_zip(token: str, session_token: str = Header(...)):
    """
    Placeholder for ZIP download logic.
    """
    # Logic: Fetch all matches, bundle into ZIP, return as stream
    return {"message": "Bulk download feature coming soon", "status": "placeholder"}
