"""
SGC Legal AI - Database module
Direct REST API calls to Supabase (avoids HTTP/2 issues)
"""
import secrets
import httpx
from typing import Optional, Dict, Any
from app.config import settings

# Global HTTP client with HTTP/2 disabled
_client: Optional[httpx.Client] = None


def get_client() -> httpx.Client:
    """Get or create httpx client with HTTP/1.1"""
    global _client
    if _client is None:
        _client = httpx.Client(
            base_url=f"{settings.supabase_url}/rest/v1",
            headers={
                "apikey": settings.supabase_service_key,
                "Authorization": f"Bearer {settings.supabase_service_key}",
                "Content-Type": "application/json",
                "Prefer": "return=representation"
            },
            http2=False,
            timeout=30.0
        )
    return _client


def validate_invite_code(code: str) -> Optional[Dict]:
    """Validate invite code and return data"""
    try:
        client = get_client()
        response = client.get(
            "/invite_codes",
            params={"code": f"eq.{code}", "select": "*"}
        )
        response.raise_for_status()
        data = response.json()

        if not data:
            return None

        invite = data[0]

        if invite.get("uses_remaining", 0) <= 0:
            return None

        return invite
    except Exception as e:
        print(f"validate_invite_code error: {e}")
        return None


def create_session(invite_code_id: str, user_name: str) -> Optional[str]:
    """Create session for user"""
    try:
        client = get_client()

        # Create user
        user_response = client.post(
            "/users",
            json={
                "invite_code_id": invite_code_id,
                "name": user_name
            }
        )
        user_response.raise_for_status()
        user_data = user_response.json()
        user_id = user_data[0]["id"]

        # Generate token
        token = secrets.token_urlsafe(32)

        # Create session
        session_response = client.post(
            "/sessions",
            json={
                "user_id": user_id,
                "token": token
            }
        )
        session_response.raise_for_status()

        # Get current uses_remaining
        invite_response = client.get(
            "/invite_codes",
            params={"id": f"eq.{invite_code_id}", "select": "uses_remaining"}
        )
        invite_response.raise_for_status()
        current_uses = invite_response.json()[0]["uses_remaining"]

        # Decrement uses_remaining
        update_response = client.patch(
            "/invite_codes",
            params={"id": f"eq.{invite_code_id}"},
            json={"uses_remaining": current_uses - 1}
        )
        update_response.raise_for_status()

        return token
    except Exception as e:
        print(f"create_session error: {e}")
        return None


def validate_session(token: str) -> Optional[Dict]:
    """Validate session token"""
    try:
        client = get_client()

        # Get session with user data
        response = client.get(
            "/sessions",
            params={
                "token": f"eq.{token}",
                "select": "*,users(*)"
            }
        )
        response.raise_for_status()
        data = response.json()

        if not data:
            return None

        return data[0]
    except Exception as e:
        print(f"validate_session error: {e}")
        return None


# Admin functions for invite codes management

def get_all_invite_codes() -> list:
    """Get all invite codes"""
    try:
        client = get_client()
        response = client.get(
            "/invite_codes",
            params={"select": "*", "order": "created_at.desc"}
        )
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"get_all_invite_codes error: {e}")
        return []


def create_invite_code(code: str, name: str, uses: int) -> Optional[Dict]:
    """Create a new invite code"""
    try:
        client = get_client()
        response = client.post(
            "/invite_codes",
            json={
                "code": code,
                "name": name,
                "uses_remaining": uses
            }
        )
        response.raise_for_status()
        data = response.json()
        return data[0] if data else None
    except Exception as e:
        print(f"create_invite_code error: {e}")
        return None


def delete_invite_code(code_id: str) -> bool:
    """Delete an invite code"""
    try:
        client = get_client()
        response = client.delete(
            "/invite_codes",
            params={"id": f"eq.{code_id}"}
        )
        response.raise_for_status()
        return True
    except Exception as e:
        print(f"delete_invite_code error: {e}")
        return False


def update_invite_code_uses(code_id: str, uses: int) -> bool:
    """Update uses remaining for an invite code"""
    try:
        client = get_client()
        response = client.patch(
            "/invite_codes",
            params={"id": f"eq.{code_id}"},
            json={"uses_remaining": uses}
        )
        response.raise_for_status()
        return True
    except Exception as e:
        print(f"update_invite_code_uses error: {e}")
        return False


# Chat history functions

def save_chat_message(user_id: str, role: str, content: str, model: str = None) -> Optional[Dict]:
    """Save a chat message to database"""
    try:
        client = get_client()
        data = {
            "user_id": user_id,
            "role": role,
            "content": content
        }
        if model:
            data["model"] = model

        response = client.post("/chat_messages", json=data)
        response.raise_for_status()
        result = response.json()
        return result[0] if result else None
    except Exception as e:
        print(f"save_chat_message error: {e}")
        return None


def get_chat_history(user_id: str, limit: int = 50) -> list:
    """Get chat history for a user"""
    try:
        client = get_client()
        response = client.get(
            "/chat_messages",
            params={
                "user_id": f"eq.{user_id}",
                "select": "*",
                "order": "created_at.asc",
                "limit": str(limit)
            }
        )
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"get_chat_history error: {e}")
        return []


def clear_chat_history(user_id: str) -> bool:
    """Clear chat history for a user"""
    try:
        client = get_client()
        response = client.delete(
            "/chat_messages",
            params={"user_id": f"eq.{user_id}"}
        )
        response.raise_for_status()
        return True
    except Exception as e:
        print(f"clear_chat_history error: {e}")
        return False
