from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Supabase
    supabase_url: str
    supabase_service_key: str

    # Redis
    redis_url: str = ""

    # OpenRouter
    openrouter_api_key: str

    # Models
    model_chairman: str = "anthropic/claude-opus-4.5"
    model_expert_1: str = "openai/gpt-5-2"
    model_expert_2: str = "google/gemini-3-pro-preview"
    model_verification: str = "perplexity/sonar-pro"

    # App
    environment: str = "production"
    allowed_origins: str = "http://localhost:3000"
    jwt_secret: str

    class Config:
        env_file = ".env"


settings = Settings()
