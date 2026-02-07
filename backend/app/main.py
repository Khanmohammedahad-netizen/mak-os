"""
MAK OS V2 - Modern Agency Operating System
FastAPI Backend Entry Point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import leads, projects, agents, webhooks
from app.database import engine, Base

app = FastAPI(
    title="MAK OS V2",
    description="AI-Powered Agency Management Platform",
    version="2.0.0"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(leads.router, prefix="/api/leads", tags=["leads"])
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(agents.router, prefix="/api/agents", tags=["agents"])
app.include_router(webhooks.router, prefix="/api/webhooks", tags=["webhooks"])

@app.on_event("startup")
async def startup():
    """Initialize database tables on startup"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

@app.get("/")
async def root():
    return {
        "name": "MAK OS V2",
        "status": "operational",
        "version": "2.0.0"
    }

@app.get("/health")
async def health():
    return {"status": "healthy"}
