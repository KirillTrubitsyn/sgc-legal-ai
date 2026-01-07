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
