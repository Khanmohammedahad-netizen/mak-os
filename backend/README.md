# MAK OS V2 - Backend

Modern FastAPI backend with Async SQLAlchemy.

## Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Copy environment template
cp .env.example .env

# Run the server
uvicorn app.main:app --reload
```

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Database

The system supports both SQLite (development) and PostgreSQL (production).

To migrate to PostgreSQL, update the `DATABASE_URL` in `.env`:
```
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/mak_os
```
