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
    """Create session for user (reuse existing user if found)"""
    try:
        client = get_client()

        # Check if user already exists for this invite code
        existing_user_response = client.get(
            "/users",
            params={
                "invite_code_id": f"eq.{invite_code_id}",
                "select": "id,name"
            }
        )
        existing_user_response.raise_for_status()
        existing_users = existing_user_response.json()

        if existing_users:
            # Reuse existing user
            user_id = existing_users[0]["id"]
        else:
            # Create new user (first login with this invite code)
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

            # Decrement uses_remaining only on first login
            invite_response = client.get(
                "/invite_codes",
                params={"id": f"eq.{invite_code_id}", "select": "uses_remaining"}
            )
            invite_response.raise_for_status()
            current_uses = invite_response.json()[0]["uses_remaining"]

            update_response = client.patch(
                "/invite_codes",
                params={"id": f"eq.{invite_code_id}"},
                json={"uses_remaining": current_uses - 1}
            )
            update_response.raise_for_status()

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


# Saved responses functions

def save_response(user_id: str, question: str, answer: str, model: str = None) -> Optional[Dict]:
    """Save a response to favorites"""
    try:
        client = get_client()
        data = {
            "user_id": user_id,
            "question": question,
            "answer": answer
        }
        if model:
            data["model"] = model

        response = client.post("/saved_responses", json=data)
        response.raise_for_status()
        result = response.json()
        return result[0] if result else None
    except Exception as e:
        print(f"save_response error: {e}")
        return None


def get_saved_responses(user_id: str) -> list:
    """Get saved responses for a user"""
    try:
        client = get_client()
        response = client.get(
            "/saved_responses",
            params={
                "user_id": f"eq.{user_id}",
                "select": "*",
                "order": "created_at.desc"
            }
        )
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"get_saved_responses error: {e}")
        return []


def delete_saved_response(response_id: str, user_id: str) -> bool:
    """Delete a saved response"""
    try:
        client = get_client()
        response = client.delete(
            "/saved_responses",
            params={
                "id": f"eq.{response_id}",
                "user_id": f"eq.{user_id}"
            }
        )
        response.raise_for_status()
        return True
    except Exception as e:
        print(f"delete_saved_response error: {e}")
        return False


# Admin functions for invite codes with users

def get_invite_codes_with_users() -> list:
    """Get all invite codes with associated users"""
    try:
        client = get_client()
        # Get invite codes
        codes_response = client.get(
            "/invite_codes",
            params={"select": "*", "order": "created_at.desc"}
        )
        codes_response.raise_for_status()
        codes = codes_response.json()

        # Get users for each code
        for code in codes:
            users_response = client.get(
                "/users",
                params={
                    "invite_code_id": f"eq.{code['id']}",
                    "select": "id,name,created_at"
                }
            )
            users_response.raise_for_status()
            code["users"] = users_response.json()

        return codes
    except Exception as e:
        print(f"get_invite_codes_with_users error: {e}")
        return []


def reset_invite_code(code_id: str, uses: int = 1) -> bool:
    """Reset an invite code - restore uses and optionally clear users"""
    try:
        client = get_client()

        # Update uses_remaining and last_used_at
        response = client.patch(
            "/invite_codes",
            params={"id": f"eq.{code_id}"},
            json={"uses_remaining": uses, "last_used_at": None}
        )
        response.raise_for_status()

        # Delete associated users and their sessions
        users_response = client.get(
            "/users",
            params={"invite_code_id": f"eq.{code_id}", "select": "id"}
        )
        users_response.raise_for_status()
        users = users_response.json()

        for user in users:
            # Delete sessions
            client.delete(
                "/sessions",
                params={"user_id": f"eq.{user['id']}"}
            )
            # Delete chat messages
            client.delete(
                "/chat_messages",
                params={"user_id": f"eq.{user['id']}"}
            )
            # Delete saved responses
            client.delete(
                "/saved_responses",
                params={"user_id": f"eq.{user['id']}"}
            )

        # Delete users
        client.delete(
            "/users",
            params={"invite_code_id": f"eq.{code_id}"}
        )

        return True
    except Exception as e:
        print(f"reset_invite_code error: {e}")
        return False


# Usage stats functions

def save_usage_stat(
    user_id: Optional[str],
    user_name: str,
    invite_code: Optional[str],
    model: str,
    request_type: str,
    response_time_ms: int = 0,
    tokens_used: int = 0,
    success: bool = True,
    error_message: Optional[str] = None
) -> Optional[Dict]:
    """Save usage statistic"""
    try:
        client = get_client()
        data = {
            "user_name": user_name or "Аноним",
            "model": model,
            "request_type": request_type,
            "response_time_ms": response_time_ms,
            "tokens_used": tokens_used,
            "success": success
        }
        if user_id:
            data["user_id"] = user_id
        if invite_code:
            data["invite_code"] = invite_code
        if error_message:
            data["error_message"] = error_message

        response = client.post("/usage_stats", json=data)
        response.raise_for_status()
        result = response.json()
        return result[0] if result else None
    except Exception as e:
        print(f"save_usage_stat error: {e}")
        return None


def get_usage_stats(days: int = 30, limit: int = 1000) -> Dict[str, Any]:
    """Get usage statistics summary"""
    try:
        client = get_client()

        # Get all stats for the period
        from datetime import datetime, timedelta
        start_date = (datetime.now() - timedelta(days=days)).isoformat()

        response = client.get(
            "/usage_stats",
            params={
                "created_at": f"gte.{start_date}",
                "select": "*",
                "order": "created_at.desc",
                "limit": str(limit)
            }
        )
        response.raise_for_status()
        stats = response.json()

        # Calculate aggregates
        total_requests = len(stats)
        successful_requests = len([s for s in stats if s.get("success")])
        failed_requests = total_requests - successful_requests

        # Group by model
        by_model = {}
        for s in stats:
            model = s.get("model", "unknown")
            if model not in by_model:
                by_model[model] = {"count": 0, "tokens": 0}
            by_model[model]["count"] += 1
            by_model[model]["tokens"] += s.get("tokens_used", 0)

        # Group by request type
        by_type = {}
        for s in stats:
            req_type = s.get("request_type", "unknown")
            if req_type not in by_type:
                by_type[req_type] = 0
            by_type[req_type] += 1

        # Group by user
        by_user = {}
        for s in stats:
            user_name = s.get("user_name", "Аноним")
            if user_name not in by_user:
                by_user[user_name] = 0
            by_user[user_name] += 1

        # Recent activity (last 10)
        recent = stats[:10]

        return {
            "total_requests": total_requests,
            "successful_requests": successful_requests,
            "failed_requests": failed_requests,
            "by_model": by_model,
            "by_type": by_type,
            "by_user": by_user,
            "recent": recent,
            "period_days": days
        }
    except Exception as e:
        print(f"get_usage_stats error: {e}")
        return {
            "total_requests": 0,
            "successful_requests": 0,
            "failed_requests": 0,
            "by_model": {},
            "by_type": {},
            "by_user": {},
            "recent": [],
            "period_days": days,
            "error": str(e)
        }
