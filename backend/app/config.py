"""
Configuration and environment management
"""
import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Database
    database_url: str = "sqlite+aiosqlite:///./mak_os.db"
    
    # n8n Integration
    n8n_webhook_base: str = "https://mak-n8n.onrender.com/webhook"
    n8n_basic_auth_user: str | None = None
    n8n_basic_auth_password: str | None = None
    
    # API Keys
    openai_api_key: str | None = None
    anthropic_api_key: str | None = None
    
    # Environment
    environment: str = "development"
    
    class Config:
        env_file = ".env"
        case_sensitive = False

settings = Settings()
