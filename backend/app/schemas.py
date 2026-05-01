from pydantic import BaseModel, HttpUrl
from typing import Optional, List
from datetime import datetime

class ShareLinkCreate(BaseModel):
    mode: str = "password"
    expires_in_days: int = 7
    password: Optional[str] = None

class ShareLinkResponse(BaseModel):
    share_url: str
    qr_code_svg: str
    token: str
    expires_at: datetime

class AccessVerifyRequest(BaseModel):
    password: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    otp_code: Optional[str] = None

class PhotoMatchResponse(BaseModel):
    id: str
    url: str
    thumbnail_url: Optional[str] = None
    similarity: float
