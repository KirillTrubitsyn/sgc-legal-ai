from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Supabase
    supabase_url: str
    supabase_service_key: str

    # Redis
    redis_url: str = ""

    # OpenRouter
    openrouter_api_key: str

    # LLM Models (renamed from model_ to llm_ to avoid Pydantic v2 namespace conflict)
    llm_chairman: str = "anthropic/claude-opus-4.5"
    llm_expert_1: str = "openai/gpt-5-2"
    llm_expert_2: str = "google/gemini-3-pro-preview"
    llm_verification: str = "perplexity/sonar-pro"

    # File upload
    max_file_size: int = 25 * 1024 * 1024  # 25 MB
    max_audio_duration: int = 300  # 5 minutes in seconds

    # App
    environment: str = "production"
    allowed_origins: str = "http://localhost:3000"
    jwt_secret: str

    class Config:
        env_file = ".env"


settings = Settings()
