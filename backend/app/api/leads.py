"""
Leads API Routes
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import Lead
from app.schemas import LeadCreate, LeadUpdate, LeadResponse
from typing import List
import httpx

router = APIRouter()

@router.post("/", response_model=LeadResponse, status_code=201)
async def create_lead(
    lead: LeadCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new lead"""
    db_lead = Lead(**lead.model_dump())
    db.add(db_lead)
    await db.flush()
    await db.refresh(db_lead)
    return db_lead

@router.get("/", response_model=List[LeadResponse])
async def list_leads(
    skip: int = 0,
    limit: int = 100,
    status: str | None = None,
    db: AsyncSession = Depends(get_db)
):
    """List all leads with optional filtering"""
    query = select(Lead)
    
    if status:
        query = query.where(Lead.status == status)
    
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    leads = result.scalars().all()
    return leads

@router.get("/{lead_id}", response_model=LeadResponse)
async def get_lead(
    lead_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific lead by ID"""
    result = await db.execute(select(Lead).where(Lead.id == lead_id))
    lead = result.scalar_one_or_none()
    
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    return lead

@router.patch("/{lead_id}", response_model=LeadResponse)
async def update_lead(
    lead_id: int,
    lead_update: LeadUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update a lead"""
    result = await db.execute(select(Lead).where(Lead.id == lead_id))
    lead = result.scalar_one_or_none()
    
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Update only provided fields
    update_data = lead_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(lead, field, value)
    
    await db.flush()
    await db.refresh(lead)
    return lead


@router.delete("/{lead_id}", status_code=204)
async def delete_lead(
    lead_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete a lead"""
    result = await db.execute(select(Lead).where(Lead.id == lead_id))
    lead = result.scalar_one_or_none()
    
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    await db.delete(lead)
    return None

@router.post("/discover")
async def discover_leads():
    """Trigger n8n workflow to discover new leads"""
    n8n_webhook_url = "https://mak-n8n.onrender.com/webhook/discover-leads"
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(n8n_webhook_url)
            response.raise_for_status()
            return {"status": "success", "message": "Lead discovery triggered"}
    except httpx.HTTPError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to trigger n8n workflow: {str(e)}"
        )
