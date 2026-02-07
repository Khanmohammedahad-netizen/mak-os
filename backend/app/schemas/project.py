"""
Project Pydantic Schemas
"""
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
from decimal import Decimal

class ProjectBase(BaseModel):
    lead_id: Optional[int] = None
    stage: str = "discovery"
    value: Optional[Decimal] = None

class ProjectCreate(ProjectBase):
    """Schema for creating a new project"""
    pass

class ProjectUpdate(BaseModel):
    """Schema for updating a project"""
    stage: Optional[str] = None
    value: Optional[Decimal] = None

class ProjectResponse(ProjectBase):
    """Schema for project responses"""
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
