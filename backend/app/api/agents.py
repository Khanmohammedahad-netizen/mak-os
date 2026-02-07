"""
Agents API Routes - Control and monitor agents
"""
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import AgentLog
from app.schemas import AgentExecuteRequest, AgentLogResponse
from app.agents import DiscoveryAgent, VettingAgent, TechDebtAgent
from typing import List

router = APIRouter()

# Agent registry
AGENTS = {
    "discovery": DiscoveryAgent,
    "vetting": VettingAgent,
    "tech_debt": TechDebtAgent,
}

async def run_agent_background(agent_name: str, context: dict | None):
    """Background task to run an agent"""
    agent_class = AGENTS.get(agent_name.lower())
    if not agent_class:
        return
    
    agent = agent_class()
    await agent.run(context)

@router.post("/execute")
async def execute_agent(
    request: AgentExecuteRequest,
    background_tasks: BackgroundTasks,
):
    """
    Trigger an agent to execute in the background
    """
    agent_name = request.agent_name.lower()
    
    if agent_name not in AGENTS:
        raise HTTPException(
            status_code=404,
            detail=f"Agent '{request.agent_name}' not found. Available: {list(AGENTS.keys())}"
        )
    
    # Schedule agent execution in background
    background_tasks.add_task(
        run_agent_background,
        agent_name,
        request.context
    )
    
    return {
        "status": "scheduled",
        "agent_name": request.agent_name,
        "message": f"Agent {request.agent_name} scheduled for execution"
    }

@router.get("/logs", response_model=List[AgentLogResponse])
async def get_agent_logs(
    skip: int = 0,
    limit: int = 50,
    agent_name: str | None = None,
    db: AsyncSession = Depends(get_db)
):
    """Get agent execution logs"""
    query = select(AgentLog).order_by(AgentLog.created_at.desc())
    
    if agent_name:
        query = query.where(AgentLog.agent_name == agent_name)
    
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    logs = result.scalars().all()
    return logs
