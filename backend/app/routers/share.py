from datetime import datetime, timedelta, timezone
import hashlib
import io
import logging
import os
import secrets
import tempfile
import zipfile
from typing import List, Optional

import bcrypt
from deepface import DeepFace
from fastapi import APIRouter, File, Header, HTTPException, Request, UploadFile
from fastapi.responses import StreamingResponse
import httpx
import jwt

from app.schemas import AccessVerifyRequest, PhotoMatchResponse, ShareLinkCreate, ShareLinkResponse
from app.supabase_client import supabase
from app.utils import generate_qr_svg

router = APIRouter(prefix="/share", tags=["share"])
logger = logging.getLogger(__name__)

JWT_SECRET = os.environ.get("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable is not set!")

JWT_ALGORITHM = "HS256"
SESSION_TTL_SECONDS = int(os.environ.get("SHARE_SESSION_TTL_SECONDS", "7200"))
ALLOWED_SHARE_MODES = {"password", "otp"}


def _parse_datetime(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _hash_token(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_secret(provided: str, stored_hash: str) -> bool:
    provided_bytes = provided.encode("utf-8")

    try:
        if bcrypt.checkpw(provided_bytes, stored_hash.encode("utf-8")):
            return True
    except ValueError:
        pass

    return hashlib.sha256(provided_bytes).hexdigest() == stored_hash


def _request_metadata(request: Request) -> dict:
    forwarded_for = request.headers.get("x-forwarded-for", "")
    ip_address = forwarded_for.split(",")[0].strip()
    if not ip_address and request.client:
        ip_address = request.client.host

    return {
        "ip_address": ip_address or None,
        "user_agent": request.headers.get("user-agent"),
    }


def _fetch_share_link(token: str) -> dict:
    res = supabase.table("share_links").select("*").eq("token", token).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Link not found")

    link = res.data[0]
    try:
        if _parse_datetime(link["expires_at"]) < datetime.now(timezone.utc):
            raise HTTPException(status_code=410, detail="Link expired")
    except KeyError:
        logger.error("Share link is missing expires_at", extra={"token": token})
        raise HTTPException(status_code=500, detail="Share link is misconfigured")
    except ValueError:
        logger.error("Share link has invalid expires_at", extra={"token": token})
        raise HTTPException(status_code=500, detail="Share link is misconfigured")

    return link


def _log_access(event_id: str, success: bool, action_type: str, share_link_id: Optional[str] = None) -> None:
    try:
        payload = {
            "event_id": event_id,
            "success": success,
            "action_type": action_type,
        }
        if share_link_id:
            payload["share_link_id"] = share_link_id
        supabase.table("access_logs").insert(payload).execute()
    except Exception as exc:
        logger.warning("Failed to write access log: %s", exc)


def _verify_password_access(link: dict, password: Optional[str]) -> None:
    if not password:
        raise HTTPException(status_code=401, detail="Password required")

    event_res = (
        supabase.table("events")
        .select("share_password_hash, upload_password_hash")
        .eq("id", link["event_id"])
        .execute()
    )
    event = event_res.data[0] if event_res.data else {}
    stored_hash = (
        link.get("password_hash")
        or event.get("share_password_hash")
        or event.get("upload_password_hash")
    )

    if not stored_hash:
        raise HTTPException(status_code=403, detail="Password access is not configured")

    if not _verify_secret(password, stored_hash):
        raise HTTPException(status_code=401, detail="Invalid password")


def _verify_otp_access(link: dict, data: AccessVerifyRequest) -> None:
    contact = (data.email or data.phone or "").strip().lower()
    if not contact:
        raise HTTPException(status_code=400, detail="Email or phone required for OTP")
    if not data.otp_code:
        raise HTTPException(status_code=400, detail="OTP code required")

    try:
        query = supabase.table("share_otps").select("*").eq("share_link_id", link["id"])
        if data.email:
            query = query.eq("email", contact)
        else:
            query = query.eq("phone", contact)
        otp_res = query.execute()
    except Exception as exc:
        logger.error("OTP lookup failed: %s", exc)
        raise HTTPException(status_code=503, detail="OTP verification is not configured")

    now = datetime.now(timezone.utc)
    for otp in otp_res.data or []:
        if otp.get("consumed_at"):
            continue
        try:
            if _parse_datetime(otp["expires_at"]) < now:
                continue
        except (KeyError, ValueError):
            continue

        if _verify_secret(data.otp_code, otp.get("code_hash", "")):
            supabase.table("share_otps").update({
                "consumed_at": now.isoformat(),
            }).eq("id", otp["id"]).execute()
            return

    raise HTTPException(status_code=401, detail="Invalid or expired OTP code")


def _create_share_session(link: dict, request: Request) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=SESSION_TTL_SECONDS)
    payload = {
        "token": link["token"],
        "event_id": link["event_id"],
        "jti": secrets.token_urlsafe(16),
        "exp": expires_at,
    }
    session_token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    metadata = _request_metadata(request)

    try:
        supabase.table("share_sessions").insert({
            "share_link_id": link.get("id"),
            "event_id": link["event_id"],
            "session_token_hash": _hash_token(session_token),
            "expires_at": expires_at.isoformat(),
            "ip_address": metadata["ip_address"],
            "user_agent": metadata["user_agent"],
        }).execute()
    except Exception as exc:
        logger.error("Failed to persist share session: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to create session")

    return session_token


def _validate_share_session(link_token: str, session_token: str) -> str:
    try:
        session = jwt.decode(session_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid session token")

    if session.get("token") != link_token:
        raise HTTPException(status_code=401, detail="Session does not match link token")

    event_id = session.get("event_id")
    if not event_id:
        raise HTTPException(status_code=401, detail="Invalid session token")

    try:
        res = (
            supabase.table("share_sessions")
            .select("event_id, expires_at, revoked_at")
            .eq("session_token_hash", _hash_token(session_token))
            .execute()
        )
    except Exception as exc:
        logger.error("Failed to validate share session: %s", exc)
        raise HTTPException(status_code=503, detail="Session store unavailable")

    if not res.data:
        raise HTTPException(status_code=401, detail="Session revoked or expired")

    persisted = res.data[0]
    if persisted.get("event_id") != event_id or persisted.get("revoked_at"):
        raise HTTPException(status_code=401, detail="Session revoked or expired")

    try:
        if _parse_datetime(persisted["expires_at"]) < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Session expired")
    except (KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid session record")

    return event_id


@router.post("/{event_id}/create-link", response_model=ShareLinkResponse)
async def create_share_link(event_id: str, data: ShareLinkCreate):
    """Host only: generate a short-lived share link and QR code."""
    if not event_id or event_id == "undefined":
        raise HTTPException(status_code=400, detail="Invalid event ID")
        
    if data.mode not in ALLOWED_SHARE_MODES:
        raise HTTPException(status_code=400, detail="Unsupported share mode")

    # Business Model: Check photographer credits
    event_res = supabase.table("events").select("user_id").eq("id", event_id).execute()
    if not event_res.data:
        raise HTTPException(status_code=404, detail="Event not found")
    
    owner_id = event_res.data[0]["user_id"]
    
    # Get profile and check credits
    profile_res = supabase.table("profiles").select("smart_shares_remaining, plan_type").eq("id", owner_id).execute()
    if not profile_res.data:
        raise HTTPException(status_code=404, detail="Photographer profile not found")
    
    photographer = profile_res.data[0]
    
    # Professional plan has unlimited shares
    if photographer.get("plan_type") != 'professional':
        remaining = photographer.get("smart_shares_remaining") or 0
        if remaining <= 0:
            raise HTTPException(status_code=403, detail="No Smart Shares remaining. Please purchase a pack or upgrade to Professional.")
        
        # Decrement credits
        supabase.table("profiles").update({
            "smart_shares_remaining": remaining - 1
        }).eq("id", owner_id).execute()

    insert_payload = {
        "event_id": event_id,
        "token": secrets.token_urlsafe(8),
        "mode": data.mode,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=data.expires_in_days)).isoformat(),
    }

    if data.mode == "password" and data.password:
        insert_payload["password_hash"] = _hash_password(data.password)

    try:
        res = supabase.table("share_links").insert(insert_payload).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Failed to create share link")
    except Exception as exc:
        exc_str = str(exc)
        logger.error("Database error during share link creation: %s", exc, exc_info=True)

        if "column" in exc_str and "password_hash" in exc_str:
            raise HTTPException(
                status_code=500,
                detail="Database schema out of sync. Please apply migration 029 (missing password_hash column)."
            )

        # Check for connection/timeout errors
        if any(x in exc_str.lower() for x in ["timeout", "connection", "refused", "10060", "winerror"]):
            raise HTTPException(
                status_code=503,
                detail="Database connection failed. Backend may not have Supabase credentials configured."
            )

        raise HTTPException(status_code=500, detail=f"Database error: {exc_str}")

    link = res.data[0]
    frontend_urls = os.environ.get("FRONTEND_URL", "http://localhost:5173").split(",")
    base_url = frontend_urls[0].strip()
    share_url = f"{base_url}/share/{link['token']}"

    return {
        "share_url": share_url,
        "qr_code_svg": generate_qr_svg(share_url),
        "token": link["token"],
        "expires_at": link["expires_at"],
    }


@router.post("/{token}/verify")
async def verify_access(token: str, data: AccessVerifyRequest, request: Request):
    """Verify guest access and persist a durable session."""
    link = _fetch_share_link(token)
    mode = link.get("mode")

    if mode == "password":
        _verify_password_access(link, data.password)
    elif mode == "otp":
        _verify_otp_access(link, data)
    else:
        raise HTTPException(status_code=403, detail="Share link mode is not supported")

    session_token = _create_share_session(link, request)
    _log_access(link["event_id"], True, "verify", link.get("id"))

    return {"access_granted": True, "session_token": session_token}


@router.post("/{token}/match", response_model=List[PhotoMatchResponse])
async def match_selfie(token: str, file: UploadFile = File(...), session_token: str = Header(...)):
    """Extract facial embedding from selfie and search for matches."""
    event_id = _validate_share_session(token, session_token)
    temp_path = None

    try:
        ext = os.path.splitext(file.filename or "")[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            content = await file.read()
            tmp.write(content)
            temp_path = tmp.name

        if os.path.getsize(temp_path) > 10 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="File too large")

        logger.info("Extracting selfie embedding")
        results = DeepFace.represent(
            img_path=temp_path,
            model_name="Facenet",
            enforce_detection=True,
            detector_backend="opencv",
        )

        if len(results) > 1:
            raise HTTPException(status_code=400, detail="Multiple faces detected. Please take a solo selfie.")

        match_res = supabase.rpc("match_embeddings", {
            "query_embedding": results[0]["embedding"],
            "match_threshold": 0.6,
            "match_count": 100,
            "target_event_id": event_id,
        }).execute()

        if not match_res.data:
            return []

        photo_ids = [row["photo_id"] for row in match_res.data]
        similarity_map = {row["photo_id"]: row["similarity"] for row in match_res.data}
        photos_res = supabase.table("photos").select("id, file_path, thumbnail_url").in_("id", photo_ids).execute()

        matches = []
        for photo in photos_res.data:
            signed_url = supabase.storage.from_("photos").create_signed_url(photo["file_path"], 3600)
            matches.append({
                "id": photo["id"],
                "url": signed_url["signedURL"],
                "thumbnail_url": photo["thumbnail_url"],
                "similarity": similarity_map.get(photo["id"], 0),
            })

        _log_access(event_id, True, "match")
        return sorted(matches, key=lambda item: item["similarity"], reverse=True)

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Selection matching failed: %s", exc)
        if "Face could not be detected" in str(exc):
            raise HTTPException(status_code=400, detail="No face detected. Please try again with better lighting.")
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


@router.post("/{token}/download-zip")
async def download_zip(token: str, photo_ids: List[str], session_token: str = Header(...)):
    """Fetch specified photo IDs after verification and bundle them into a ZIP."""
    event_id = _validate_share_session(token, session_token)
    photos_res = supabase.table("photos").select("id, file_path").in_("id", photo_ids).eq("event_id", event_id).execute()

    if len(photos_res.data) != len(photo_ids):
        raise HTTPException(status_code=400, detail="Some photos are invalid or belong to a different event")

    zip_buffer = io.BytesIO()

    async with httpx.AsyncClient() as client:
        with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
            for photo in photos_res.data:
                signed_url = supabase.storage.from_("photos").create_signed_url(photo["file_path"], 600)
                if not signed_url.get("signedURL"):
                    continue

                resp = await client.get(signed_url["signedURL"])
                if resp.status_code == 200:
                    filename = photo["file_path"].split("/")[-1]
                    zip_file.writestr(filename, resp.content)

    zip_buffer.seek(0)

    return StreamingResponse(
        zip_buffer,
        media_type="application/x-zip-compressed",
        headers={"Content-Disposition": f"attachment; filename=wedhub_photos_{event_id}.zip"},
    )
