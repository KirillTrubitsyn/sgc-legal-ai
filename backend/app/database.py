import secrets

from supabase import create_client, Client

from app.config import settings

_supabase: Client | None = None


def get_supabase() -> Client:
    """Ленивая инициализация Supabase клиента"""
    global _supabase
    if _supabase is None:
        _supabase = create_client(settings.supabase_url, settings.supabase_service_key)
    return _supabase


def validate_invite_code(code: str):
    """Проверить инвайт-код и вернуть данные"""
    supabase = get_supabase()
    result = supabase.table("invite_codes").select("*").eq("code", code).execute()

    if not result.data:
        return None

    invite = result.data[0]

    if invite["uses_remaining"] <= 0:
        return None

    return invite


def create_session(invite_code_id: str, user_name: str):
    """Создать сессию для пользователя"""
    supabase = get_supabase()

    user_result = supabase.table("users").insert({
        "invite_code_id": invite_code_id,
        "name": user_name
    }).execute()

    user_id = user_result.data[0]["id"]
    token = secrets.token_urlsafe(32)

    supabase.table("sessions").insert({
        "user_id": user_id,
        "token": token
    }).execute()

    # Уменьшить счётчик использований
    current = supabase.table("invite_codes").select("uses_remaining").eq("id", invite_code_id).execute()
    supabase.table("invite_codes").update({
        "uses_remaining": current.data[0]["uses_remaining"] - 1
    }).eq("id", invite_code_id).execute()

    return token


def validate_session(token: str):
    """Проверить токен сессии"""
    supabase = get_supabase()
    result = supabase.table("sessions").select("*, users(*)").eq("token", token).execute()

    if not result.data:
        return None

    return result.data[0]
