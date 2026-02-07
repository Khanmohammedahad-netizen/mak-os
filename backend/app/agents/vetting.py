"""
VettingAgent - Applies business rules to filter leads

This agent reviews pending leads and:
1. Approves leads that meet criteria
2. Rejects leads that don't (with reason)
3. Updates vetting_status accordingly

Business Rules:
- REJECT if no website
- REJECT if company_name is too short (< 3 chars)
- APPROVE otherwise
"""
from typing import Dict, Any
from sqlalchemy import select
from app.agents.base import BaseAgent, AgentResult
from app.database import AsyncSessionLocal
from app.models import Lead

class VettingAgent(BaseAgent):
    """
    Vets pending leads based on business rules
    """
    
    def __init__(self):
        super().__init__(
            name="Vetting Agent",
            description="Applies business rules to approve or reject leads"
        )
    
    async def execute(self, context: Dict[str, Any] | None = None) -> AgentResult:
        """
        Vet all pending leads.
        """
        async with AsyncSessionLocal() as db:
            # Get all pending leads
            result = await db.execute(
                select(Lead).where(Lead.vetting_status == "pending")
            )
            pending_leads = result.scalars().all()
            
            approved_count = 0
            rejected_count = 0
            
            for lead in pending_leads:
                rejection_reason = None
                
                # Rule 1: Must have a website
                if not lead.website or len(lead.website) < 4:
                    rejection_reason = "No valid website"
                
                # Rule 2: Company name must be meaningful
                elif not lead.company_name or len(lead.company_name) < 3:
                    rejection_reason = "Invalid company name"
                
                # Apply verdict
                if rejection_reason:
                    lead.vetting_status = "rejected"
                    # Store rejection reason in pain_points for now
                    # (could add dedicated column in future)
                    lead.pain_points = {"rejection_reason": rejection_reason}
                    lead.status = "rejected"
                    rejected_count += 1
                else:
                    lead.vetting_status = "approved"
                    lead.status = "vetted"
                    approved_count += 1
            
            await db.commit()
        
        return AgentResult(
            status='success',
            leads_processed=approved_count + rejected_count,
            metadata={
                "approved": approved_count,
                "rejected": rejected_count
            }
        )
