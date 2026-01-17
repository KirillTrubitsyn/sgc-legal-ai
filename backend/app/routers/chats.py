"""
Chat Sessions router for managing chat history
Привязка к инвайт-коду, максимум 20 чатов
"""
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel
from typing import Optional

from app.database import (
    validate_session,
    get_invite_code_id_by_user,
    create_chat_session,
    get_chat_sessions,
    get_chat_session,
    update_chat_session_title,
    delete_chat_session,
    delete_all_chat_sessions,
    get_chat_sessions_count,
    get_chat_session_messages,
    MAX_CHAT_SESSIONS
)

router = APIRouter(prefix="/api/chats", tags=["chats"])


def get_session_from_token(authorization: str):
    """Extract and validate session from Authorization header"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization token")

    token = authorization.replace("Bearer ", "")
    session = validate_session(token)

    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")

    return session


def get_invite_code_id_from_session(session: dict) -> str:
    """Extract invite_code_id from session, raise if not found"""
    user_id = session["user_id"]
    invite_code_id = get_invite_code_id_by_user(user_id)

    if not invite_code_id:
        raise HTTPException(status_code=400, detail="User has no invite code")

    return invite_code_id


class CreateChatRequest(BaseModel):
    title: Optional[str] = "Новый чат"


class UpdateChatTitleRequest(BaseModel):
    title: str


@router.get("")
async def list_chats(authorization: str = Header(None)):
    """Get all chat sessions for current invite code"""
    session = get_session_from_token(authorization)
    invite_code_id = get_invite_code_id_from_session(session)

    chats = get_chat_sessions(invite_code_id)
    count = len(chats)

    return {
        "chats": chats,
        "count": count,
        "limit": MAX_CHAT_SESSIONS,
        "can_create": count < MAX_CHAT_SESSIONS
    }


@router.post("")
async def create_chat(
    request: CreateChatRequest = CreateChatRequest(),
    authorization: str = Header(None)
):
    """Create a new chat session"""
    session = get_session_from_token(authorization)
    invite_code_id = get_invite_code_id_from_session(session)

    # Check limit
    count = get_chat_sessions_count(invite_code_id)
    if count >= MAX_CHAT_SESSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Достигнут лимит чатов ({MAX_CHAT_SESSIONS}). Удалите старые чаты для создания новых."
        )

    chat = create_chat_session(invite_code_id, request.title)
    if not chat:
        raise HTTPException(status_code=500, detail="Failed to create chat session")

    return {
        "chat": chat,
        "count": count + 1,
        "limit": MAX_CHAT_SESSIONS
    }


@router.get("/{chat_id}")
async def get_chat(chat_id: str, authorization: str = Header(None)):
    """Get a specific chat session with its messages"""
    session = get_session_from_token(authorization)
    invite_code_id = get_invite_code_id_from_session(session)

    chat = get_chat_session(chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    # Verify chat belongs to this invite code
    if chat.get("invite_code_id") != invite_code_id:
        raise HTTPException(status_code=403, detail="Access denied")

    messages = get_chat_session_messages(chat_id)

    return {
        "chat": chat,
        "messages": messages
    }


@router.patch("/{chat_id}")
async def rename_chat(
    chat_id: str,
    request: UpdateChatTitleRequest,
    authorization: str = Header(None)
):
    """Rename a chat session"""
    session = get_session_from_token(authorization)
    invite_code_id = get_invite_code_id_from_session(session)

    chat = get_chat_session(chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    # Verify chat belongs to this invite code
    if chat.get("invite_code_id") != invite_code_id:
        raise HTTPException(status_code=403, detail="Access denied")

    success = update_chat_session_title(chat_id, request.title)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to rename chat")

    return {"success": True}


@router.delete("/{chat_id}")
async def remove_chat(chat_id: str, authorization: str = Header(None)):
    """Delete a chat session and all its messages"""
    session = get_session_from_token(authorization)
    invite_code_id = get_invite_code_id_from_session(session)

    chat = get_chat_session(chat_id)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    # Verify chat belongs to this invite code
    if chat.get("invite_code_id") != invite_code_id:
        raise HTTPException(status_code=403, detail="Access denied")

    success = delete_chat_session(chat_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete chat")

    return {"success": True}


@router.delete("")
async def clear_all_chats(authorization: str = Header(None)):
    """Delete all chat sessions for current invite code"""
    session = get_session_from_token(authorization)
    invite_code_id = get_invite_code_id_from_session(session)

    success = delete_all_chat_sessions(invite_code_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to clear chat history")

    return {"success": True}
