import secrets
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, Field
from typing import Optional
from app.core.config import settings

router = APIRouter(prefix="/api/admin", tags=["Admin Auth"])

class AdminLoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=64)
    password: str = Field(..., min_length=1, max_length=128)

class AdminLoginResponse(BaseModel):
    success: bool
    token: str
    username: str
    role: str = "government_admin"
    message: str

# Token storage in memory for local session validation
ACTIVE_ADMIN_TOKENS = set()

def verify_admin_token(authorization: Optional[str] = Header(None)) -> str:
    """Dependency to protect administration endpoints."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Admin authorization header missing")
    token = authorization.replace("Bearer ", "").strip()
    if token not in ACTIVE_ADMIN_TOKENS:
        raise HTTPException(status_code=401, detail="Invalid or expired admin session token")
    return token

@router.post("/login", response_model=AdminLoginResponse)
def admin_login(payload: AdminLoginRequest):
    """
    Authenticate government officer using credentials set in .env.
    Returns session token on success.
    """
    if (payload.username == settings.ADMIN_USERNAME and 
        payload.password == settings.ADMIN_PASSWORD):
        token = f"adm_sec_{secrets.token_hex(24)}"
        ACTIVE_ADMIN_TOKENS.add(token)
        return AdminLoginResponse(
            success=True,
            token=token,
            username=settings.ADMIN_USERNAME,
            message="Government officer session authenticated successfully."
        )
    raise HTTPException(status_code=401, detail="Invalid admin username or password.")

@router.get("/verify")
def verify_session(token: str = Depends(verify_admin_token)):
    """Verifies whether the current admin session is valid."""
    return {"valid": True, "username": settings.ADMIN_USERNAME, "role": "government_admin"}

@router.post("/logout")
def admin_logout(token: str = Depends(verify_admin_token)):
    """Logs out and invalidates the session token."""
    ACTIVE_ADMIN_TOKENS.discard(token)
    return {"success": True, "message": "Logged out successfully."}
