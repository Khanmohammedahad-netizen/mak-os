"""
Webhooks API - Endpoints for n8n integration
"""
from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.agents import DiscoveryAgent
from app.models import Lead
from pydantic import BaseModel
from typing import List

router = APIRouter()

class DiscoveryWebhookPayload(BaseModel):
    """Payload from n8n discovery workflow"""
    leads: List[dict]

async def process_discovery_leads(payload: dict):
    """Background task to process discovery leads"""
    agent = DiscoveryAgent()
    await agent.run(context=payload)

@router.post("/discovery")
async def discovery_webhook(
    payload: DiscoveryWebhookPayload,
    background_tasks: BackgroundTasks
):
    """
    Receive leads from n8n discovery workflows.
    Triggers DiscoveryAgent in background.
    """
    # Schedule agent execution
    background_tasks.add_task(
        process_discovery_leads,
        {"leads": payload.leads}
    )
    
    return {
        "received": len(payload.leads),
        "message": "Leads queued for processing"
    }

@router.patch("/enrichment/{lead_id}")
async def enrichment_callback(
    lead_id: int,
    payload: dict,
    db: AsyncSession = Depends(get_db)
):
    """
    Receive enrichment data from n8n (tech debt, reviews, etc.)
    Updates the lead's pain_points and score.
    """
    result = await db.execute(
        select(Lead).where(Lead.id == lead_id)
    )
    lead = result.scalar_one_or_none()
    
    if not lead:
        return {"error": "Lead not found"}, 404
    
    # Update lead with enrichment data
    if "pain_points" in payload:
        lead.pain_points = payload["pain_points"]
    if "score" in payload:
        lead.score = payload["score"]
    if "status" in payload:
        lead.status = payload["status"]
    
    await db.commit()
    
    return {
        "lead_id": lead_id,
        "message": "Enrichment data applied"
    }
