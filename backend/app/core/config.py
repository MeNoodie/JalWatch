import os
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    APP_NAME: str = "JalWatch Delhi"
    APP_ENV: str = "local"
    DEBUG: bool = True
    DATABASE_URL: str = "sqlite:///./jalwatch.db"
    FRONTEND_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # LLM Settings (LangChain: Groq & Google Gemini)
    LLM_PROVIDER: str = "groq"
    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    GOOGLE_API_KEY: Optional[str] = None
    GOOGLE_MODEL: str = "gemini-1.5-flash"

    # AWS Deployment Settings
    AWS_REGION: str = "ap-south-1"
    S3_BUCKET: Optional[str] = None

    @property
    def cors_origins(self) -> List[str]:
        return [origin.strip() for origin in self.FRONTEND_ORIGINS.split(",") if origin.strip()]

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
