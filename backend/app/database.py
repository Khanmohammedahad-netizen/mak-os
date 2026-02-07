"""
Database configuration with async SQLAlchemy
Handles SSL mode properly for asyncpg
"""
import os
import re
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

# Database URL from environment or default to SQLite
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "sqlite+aiosqlite:///./mak_os.db"
)

def fix_postgres_url(url: str) -> tuple[str, dict]:
    """
    Fix PostgreSQL URL for asyncpg compatibility
    - Replace postgresql:// with postgresql+asyncpg://
    - Extract sslmode from URL and move to connect_args
    """
    connect_args = {}
    
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://")
    
    # asyncpg doesn't accept sslmode in URL, needs it in connect_args
    if 'sslmode=' in url:
        match = re.search(r'[?&]sslmode=([^&]+)', url)
        if match:
            sslmode = match.group(1)
            # Remove sslmode from URL
            url = re.sub(r'[?&]sslmode=[^&]+', '', url)
            url = re.sub(r'\?&', '?', url)  # Clean up ?&
            url = re.sub(r'[?&]$', '', url)  # Clean up trailing ? or &
            
            # Set SSL properly for asyncpg
            if sslmode in ('require', 'verify-ca', 'verify-full'):
                connect_args['ssl'] = 'require'
            elif sslmode == 'disable':
                connect_args['ssl'] = False
    
    return url, connect_args

# Fix URL and get connect_args
if DATABASE_URL.startswith("postgresql"):
    DATABASE_URL, connect_args = fix_postgres_url(DATABASE_URL)
else:
    connect_args = {}

# Create async engine
engine = create_async_engine(
    DATABASE_URL,
    echo=os.getenv("ENVIRONMENT") == "development",
    connect_args=connect_args,
    pool_pre_ping=True,  # Verify connections before using
)

# Session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# Base class for models
class Base(DeclarativeBase):
    pass

# Dependency for FastAPI routes
async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
