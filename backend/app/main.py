from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import auth

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


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "version": "1.0.0",
        "service": "SGC Legal AI Backend"
    }


@app.get("/")
async def root():
    return {"message": "SGC Legal AI API", "docs": "/docs"}
