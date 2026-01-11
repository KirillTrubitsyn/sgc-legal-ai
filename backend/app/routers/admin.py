"""
Admin router for managing invite codes and usage statistics
"""
import secrets
from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from app.config import settings
from app.database import (
    get_all_invite_codes,
    create_invite_code,
    delete_invite_code,
    update_invite_code_uses,
    get_invite_codes_with_users,
    reset_invite_code,
    get_usage_stats
)

router = APIRouter(prefix="/api/admin", tags=["admin"])
security = HTTPBearer()

# Store admin tokens in memory (in production, use Redis or DB)
admin_tokens = set()


class AdminLoginRequest(BaseModel):
    password: str


class AdminLoginResponse(BaseModel):
    success: bool
    token: Optional[str] = None
    message: Optional[str] = None


class InviteCodeCreate(BaseModel):
    code: Optional[str] = None  # If not provided, will be auto-generated
    name: str
    uses: int = 1
    description: Optional[str] = None  # Who is this person / notes


class InviteCodeUpdate(BaseModel):
    uses: int


class UserInfo(BaseModel):
    id: str
    name: str
    created_at: str


class InviteCodeResponse(BaseModel):
    id: str
    code: str
    name: str
    uses_remaining: int
    created_at: str
    description: Optional[str] = None


class InviteCodeWithUsersResponse(BaseModel):
    id: str
    code: str
    name: str
    uses_remaining: int
    created_at: str
    description: Optional[str] = None
    last_used_at: Optional[str] = None
    users: List[UserInfo] = []


class ResetCodeRequest(BaseModel):
    uses: int = 1


class UsageStatsResponse(BaseModel):
    total_requests: int
    successful_requests: int
    failed_requests: int
    by_model: Dict[str, Any]
    by_type: Dict[str, int]
    by_user: Dict[str, int]
    recent: List[Dict[str, Any]]
    period_days: int
    error: Optional[str] = None


def verify_admin_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify admin token"""
    token = credentials.credentials
    if token not in admin_tokens:
        raise HTTPException(status_code=401, detail="Invalid admin token")
    return token


@router.post("/login", response_model=AdminLoginResponse)
async def admin_login(request: AdminLoginRequest):
    """Admin login with password"""
    if request.password != settings.admin_password:
        raise HTTPException(status_code=401, detail="Неверный пароль")

    # Generate admin token
    token = secrets.token_urlsafe(32)
    admin_tokens.add(token)

    return AdminLoginResponse(
        success=True,
        token=token
    )


@router.post("/logout")
async def admin_logout(token: str = Depends(verify_admin_token)):
    """Admin logout"""
    admin_tokens.discard(token)
    return {"success": True}


@router.get("/invite-codes", response_model=List[InviteCodeResponse])
async def list_invite_codes(token: str = Depends(verify_admin_token)):
    """Get all invite codes"""
    codes = get_all_invite_codes()
    return [
        InviteCodeResponse(
            id=c["id"],
            code=c["code"],
            name=c["name"],
            uses_remaining=c["uses_remaining"],
            created_at=c["created_at"]
        )
        for c in codes
    ]


@router.post("/invite-codes", response_model=InviteCodeResponse)
async def create_new_invite_code(
    request: InviteCodeCreate,
    token: str = Depends(verify_admin_token)
):
    """Create a new invite code"""
    # Generate code if not provided
    code = request.code or secrets.token_urlsafe(8).upper()[:8]

    result = create_invite_code(code, request.name, request.uses, request.description)

    if not result:
        raise HTTPException(status_code=500, detail="Не удалось создать инвайт-код")

    return InviteCodeResponse(
        id=result["id"],
        code=result["code"],
        name=result["name"],
        uses_remaining=result["uses_remaining"],
        created_at=result["created_at"],
        description=result.get("description")
    )


@router.delete("/invite-codes/{code_id}")
async def remove_invite_code(
    code_id: str,
    token: str = Depends(verify_admin_token)
):
    """Delete an invite code"""
    success = delete_invite_code(code_id)

    if not success:
        raise HTTPException(status_code=500, detail="Не удалось удалить инвайт-код")

    return {"success": True}


@router.patch("/invite-codes/{code_id}")
async def update_invite_code(
    code_id: str,
    request: InviteCodeUpdate,
    token: str = Depends(verify_admin_token)
):
    """Update invite code uses"""
    success = update_invite_code_uses(code_id, request.uses)

    if not success:
        raise HTTPException(status_code=500, detail="Не удалось обновить инвайт-код")

    return {"success": True}


@router.get("/invite-codes-detailed", response_model=List[InviteCodeWithUsersResponse])
async def list_invite_codes_with_users(token: str = Depends(verify_admin_token)):
    """Get all invite codes with user information"""
    codes = get_invite_codes_with_users()
    return [
        InviteCodeWithUsersResponse(
            id=c["id"],
            code=c["code"],
            name=c["name"],
            uses_remaining=c["uses_remaining"],
            created_at=c["created_at"],
            description=c.get("description"),
            last_used_at=c.get("last_used_at"),
            users=[
                UserInfo(
                    id=u["id"],
                    name=u["name"],
                    created_at=u["created_at"]
                )
                for u in c.get("users", [])
            ]
        )
        for c in codes
    ]


@router.post("/invite-codes/{code_id}/reset")
async def reset_code(
    code_id: str,
    request: ResetCodeRequest,
    token: str = Depends(verify_admin_token)
):
    """Reset an invite code - restore uses and clear associated users"""
    success = reset_invite_code(code_id, request.uses)

    if not success:
        raise HTTPException(status_code=500, detail="Не удалось сбросить инвайт-код")

    return {"success": True, "message": "Код сброшен, пользователи удалены"}


@router.get("/stats", response_model=UsageStatsResponse)
async def get_stats(
    days: int = Query(default=30, ge=1, le=365),
    token: str = Depends(verify_admin_token)
):
    """Get usage statistics for the admin panel"""
    stats = get_usage_stats(days=days)
    return UsageStatsResponse(**stats)
