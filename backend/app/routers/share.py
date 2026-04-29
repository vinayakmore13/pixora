from fastapi import APIRouter, HTTPException, UploadFile, File, Header, Depends, Request
from typing import Optional, List
import uuid
import secrets
from datetime import datetime, timedelta, timezone
import tempfile
import os
from deepface import DeepFace
from app.supabase_client import supabase
from app.schemas import ShareLinkCreate, ShareLinkResponse, AccessVerifyRequest, PhotoMatchResponse
from app.utils import generate_qr_svg
import logging
import jwt
import bcrypt
import redis.asyncio as redis

router = APIRouter(prefix="/share", tags=["share"])
logger = logging.getLogger(__name__)

JWT_SECRET = os.environ.get("JWT_SECRET", "super-secret-jwt-key")
JWT_ALGORITHM = "HS256"

async def get_redis():
    redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379")
    return redis.from_url(redis_url, encoding="utf-8", decode_responses=True)


@router.post("/{event_id}/create-link", response_model=ShareLinkResponse)
async def create_share_link(event_id: str, data: ShareLinkCreate):
    """
    Host only: Generate a short-lived share link and QR code.
    """
    token = secrets.token_urlsafe(8)
    # Ensure UTC timezone aware datetime
    expires_at = datetime.now(timezone.utc) + timedelta(days=data.expires_in_days)
    
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
    # Note: supabase might return string, parse securely
    try:
        expires_at_str = link["expires_at"].replace("Z", "+00:00")
        if datetime.fromisoformat(expires_at_str) < datetime.now(timezone.utc):
            raise HTTPException(status_code=410, detail="Link expired")
    except ValueError:
        logger.warning("Failed to parse expires_at date")
    
    # 3. Mode-specific check
    if link["mode"] == "password":
        # Check against event upload_password_hash
        event_res = supabase.table("events").select("upload_password_hash").eq("id", link["event_id"]).execute()
        if event_res.data and event_res.data[0].get("upload_password_hash"):
            hashed_pw = event_res.data[0]["upload_password_hash"]
            provided_pw = (data.password or "").encode('utf-8')
            
            # Support both basic SHA256 (legacy) and bcrypt for robust auth
            is_valid = False
            try:
                is_valid = bcrypt.checkpw(provided_pw, hashed_pw.encode('utf-8'))
            except ValueError:
                import hashlib
                if hashlib.sha256(provided_pw).hexdigest() == hashed_pw:
                    is_valid = True
            
            if not is_valid:
                raise HTTPException(status_code=401, detail="Invalid password")
    elif link["mode"] == "otp":
        if not data.email and not data.phone:
             raise HTTPException(status_code=400, detail="Email or phone required for OTP")
        logger.info(f"OTP verification simulation for {data.email or data.phone}")
    
    # 4. Create stateless JWT session token
    session_payload = {
        "token": token,
        "event_id": link["event_id"],
        "exp": datetime.utcnow() + timedelta(hours=2)
    }
    session_token = jwt.encode(session_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    
    # Store session in Redis for revocation checks
    try:
        r = await get_redis()
        # Key: session:{token}, Value: event_id. Expiry: 2 hours
        await r.setex(f"session:{session_token}", 7200, link["event_id"])
    except Exception as e:
        logger.warning(f"Failed to store session in Redis: {e}")
    
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
    # 1. Validate session statelessly via JWT and check Redis revocation
    try:
        session = jwt.decode(session_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid session token")

    if session["token"] != token:
        raise HTTPException(status_code=401, detail="Session does not match link token")

    try:
        r = await get_redis()
        # Try testing if redis is actually alive, since exists() might fail silently and return False
        await r.ping()
        is_active = await r.exists(f"session:{session_token}")
        if not is_active:
            raise HTTPException(status_code=401, detail="Session revoked or expired")
    except Exception as e:
        logger.warning(f"Failed to check Redis session revocation (Redis likely offline, skipping): {e}")

    event_id = session["event_id"]
    temp_path = None
    
    try:
        # 2. Save selfie to temp file
        ext = os.path.splitext(file.filename)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            content = await file.read()
            tmp.write(content)
            temp_path = tmp.name

        # Extract embedding with constraints
        logger.info(f"Extracting selfie embedding...", extra={"user_agent": "system"})
        
        # Enforce max file size (e.g. 10MB) to prevent memory abuse
        if os.path.getsize(temp_path) > 10 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="File too large")
            
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

