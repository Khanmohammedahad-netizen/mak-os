"""
Agent Pydantic Schemas
"""
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class AgentExecuteRequest(BaseModel):
    """Request to execute an agent"""
    agent_name: str
    context: Optional[dict] = None

class AgentLogResponse(BaseModel):
    """Schema for agent log responses"""
    id: int
    agent_name: str
    start_time: datetime
    end_time: Optional[datetime] = None
    status: str
    leads_processed: int
    error_message: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True
