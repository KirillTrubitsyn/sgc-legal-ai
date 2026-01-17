from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import auth, query, consilium, files, admin, chats

app = FastAPI(
    title="SGC Legal AI",
    description="AI-ассистент юридической службы Сибирской генерирующей компании",
    version="1.0.0"
)

# CORS
origins = settings.allowed_origins.split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Роутеры
app.include_router(auth.router)
app.include_router(query.router)
app.include_router(consilium.router)
app.include_router(files.router)
app.include_router(admin.router)
app.include_router(chats.router)


@app.get("/health")
async def health():
    """Healthcheck - не зависит от внешних сервисов"""
    return {
        "status": "ok",
        "version": "1.0.0",
        "service": "SGC Legal AI Backend"
    }


@app.get("/health/ready")
async def health_ready():
    """Readiness check - проверяет подключение к сервисам"""
    from app.database import get_client

    checks = {"supabase": False}

    try:
        client = get_client()
        # Простой запрос для проверки соединения
        response = client.get("/invite_codes", params={"select": "id", "limit": "1"})
        response.raise_for_status()
        checks["supabase"] = True
    except Exception as e:
        checks["supabase_error"] = str(e)

    all_healthy = all(v for k, v in checks.items() if not k.endswith("_error"))

    return {
        "status": "ready" if all_healthy else "degraded",
        "checks": checks
    }


@app.get("/")
async def root():
    return {"message": "SGC Legal AI API", "docs": "/docs"}
