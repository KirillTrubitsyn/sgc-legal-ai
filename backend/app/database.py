import secrets

from supabase import create_client

from app.config import settings

supabase = create_client(settings.supabase_url, settings.supabase_service_key)


def validate_invite_code(code: str):
    """Проверить инвайт-код и вернуть данные"""
    result = supabase.table("invite_codes").select("*").eq("code", code).execute()

    if not result.data:
        return None

    invite = result.data[0]

    # Проверить лимит использований
    if invite["uses_remaining"] <= 0:
        return None

    return invite


def create_session(invite_code_id: str, user_name: str):
    """Создать сессию для пользователя"""
    # Создать или найти пользователя
    user_result = supabase.table("users").insert({
        "invite_code_id": invite_code_id,
        "name": user_name
    }).execute()

    user_id = user_result.data[0]["id"]

    # Создать токен сессии
    token = secrets.token_urlsafe(32)

    supabase.table("sessions").insert({
        "user_id": user_id,
        "token": token
    }).execute()

    # Уменьшить счётчик использований
    current_uses = supabase.table("invite_codes").select("uses_remaining").eq(
        "id", invite_code_id
    ).execute().data[0]["uses_remaining"]

    supabase.table("invite_codes").update({
        "uses_remaining": current_uses - 1
    }).eq("id", invite_code_id).execute()

    return token


def validate_session(token: str):
    """Проверить токен сессии"""
    result = supabase.table("sessions").select("*, users(*)").eq("token", token).execute()

    if not result.data:
        return None

    return result.data[0]
