"""
Query router for Single Query mode
"""
from fastapi import APIRouter, HTTPException, Header
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
import json

from app.database import validate_session
from app.services.openrouter import (
    get_available_models,
    chat_completion,
    chat_completion_stream
)

router = APIRouter(prefix="/api/query", tags=["query"])


class Message(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class QueryRequest(BaseModel):
    model: str
    messages: List[Message]
    stream: bool = True


class QueryResponse(BaseModel):
    success: bool
    content: str = None
    model: str = None
    tokens_used: int = None
    error: str = None


def get_session_from_token(authorization: str):
    """Extract and validate session from Authorization header"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing authorization token")

    token = authorization.replace("Bearer ", "")
    session = validate_session(token)

    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")

    return session


@router.get("/models")
async def list_models(authorization: str = Header(None)):
    """Get list of available models"""
    get_session_from_token(authorization)
    return {"models": get_available_models()}


@router.post("/single")
async def single_query(
    request: QueryRequest,
    authorization: str = Header(None)
):
    """Execute single query to selected model"""
    session = get_session_from_token(authorization)

    # Convert messages to dict format
    messages = [{"role": m.role, "content": m.content} for m in request.messages]

    if request.stream:
        # Streaming response
        async def generate():
            try:
                for chunk in chat_completion_stream(request.model, messages):
                    yield f"data: {chunk}\n\n"
                yield "data: [DONE]\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"

        return StreamingResponse(
            generate(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            }
        )
    else:
        # Non-streaming response
        try:
            result = chat_completion(request.model, messages, stream=False)
            content = result["choices"][0]["message"]["content"]
            tokens = result.get("usage", {}).get("total_tokens", 0)

            return QueryResponse(
                success=True,
                content=content,
                model=request.model,
                tokens_used=tokens
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
