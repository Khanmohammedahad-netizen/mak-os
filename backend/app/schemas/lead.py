"""
Lead Pydantic Schemas for API validation
"""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class LeadBase(BaseModel):
    company_name: str = Field(..., min_length=1, max_length=255)
    website: Optional[str] = None
    region: Optional[str] = None

class LeadCreate(LeadBase):
    """Schema for creating a new lead"""
    pass

class LeadUpdate(BaseModel):
    """Schema for updating a lead (all fields optional)"""
    company_name: Optional[str] = None
    website: Optional[str] = None
    region: Optional[str] = None
    status: Optional[str] = None
    vetting_status: Optional[str] = None
    pain_points: Optional[dict] = None
    score: Optional[int] = Field(None, ge=0, le=100)

class LeadResponse(LeadBase):
    """Schema for lead responses"""
    id: int
    status: str
    vetting_status: str
    pain_points: Optional[dict] = None
    score: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True
