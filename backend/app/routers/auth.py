from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.database import validate_invite_code, create_session, create_admin_session, validate_session
from app.config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])


class InviteRequest(BaseModel):
    code: str


class InviteResponse(BaseModel):
    success: bool
    token: str = None
    user_name: str = None
    message: str = None


class ValidateRequest(BaseModel):
    token: str


@router.post("/login", response_model=InviteResponse)
async def login_with_invite(request: InviteRequest):
    """Вход по инвайт-коду или паролю администратора"""

    # Check if this is admin password login
    if request.code == settings.admin_password:
        token = create_admin_session()
        if not token:
            raise HTTPException(status_code=500, detail="Ошибка создания сессии администратора")
        return InviteResponse(
            success=True,
            token=token,
            user_name="Администратор"
        )

    # Regular invite code login
    invite = validate_invite_code(request.code)

    if not invite:
        raise HTTPException(status_code=401, detail="Неверный или истёкший инвайт-код")

    token = create_session(invite["id"], invite["name"])

    return InviteResponse(
        success=True,
        token=token,
        user_name=invite["name"]
    )


@router.post("/validate")
async def validate_token(request: ValidateRequest):
    """Проверить токен сессии"""
    session = validate_session(request.token)

    if not session:
        raise HTTPException(status_code=401, detail="Недействительная сессия")

    return {
        "valid": True,
        "user_name": session["users"]["name"]
    }
