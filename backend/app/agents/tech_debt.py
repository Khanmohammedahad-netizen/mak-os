"""
TechDebtAgent - Triggers n8n workflow for website technical analysis

This agent:
1. Finds approved leads that haven't been enriched
2. Sends their websites to n8n for analysis
3. n8n analyzes: page speed, SEO, security, tech stack
4. n8n calls back to update lead with findings
"""
from typing import Dict, Any
from sqlalchemy import select, and_
from app.agents.base import BaseAgent, AgentResult
from app.database import AsyncSessionLocal
from app.models import Lead
from app.services import n8n_bridge

class TechDebtAgent(BaseAgent):
    """
    Triggers tech debt analysis for approved leads
    """
    
    def __init__(self):
        super().__init__(
            name="Tech Debt Agent",
            description="Triggers n8n workflow to analyze websites for technical issues"
        )
    
    async def execute(self, context: Dict[str, Any] | None = None) -> AgentResult:
        """
        Find approved leads needing enrichment and trigger analysis.
        
        Context (optional):
        {
            "limit": 10  # Max number of leads to process per run
        }
        """
        limit = 10
        if context and "limit" in context:
            limit = context["limit"]
        
        async with AsyncSessionLocal() as db:
            # Find approved leads without enrichment
            # (leads with no pain_points or score = 0)
            result = await db.execute(
                select(Lead).where(
                    and_(
                        Lead.vetting_status == "approved",
                        Lead.website.isnot(None),
                        # Not yet enriched (either no pain_points or score is 0)
                        (Lead.pain_points.is_(None)) | (Lead.score == 0)
                    )
                ).limit(limit)
            )
            leads_to_enrich = result.scalars().all()
            
            success_count = 0
            failed_count = 0
            errors = []
            
            for lead in leads_to_enrich:
                # Trigger n8n workflow
                success, error = await n8n_bridge.trigger_tech_debt_analysis(
                    lead_id=lead.id,
                    website=lead.website
                )
                
                if success:
                    # Mark lead as "enriching" (processing)
                    lead.status = "enriching"
                    success_count += 1
                else:
                    failed_count += 1
                    errors.append(f"Lead {lead.id}: {error}")
            
            await db.commit()
        
        # Determine overall status
        if failed_count == 0:
            status = 'success'
        elif success_count > 0:
            status = 'partial'
        else:
            status = 'failed'
        
        error_message = None
        if errors:
            error_message = "; ".join(errors[:3])  # First 3 errors
        
        return AgentResult(
            status=status,
            leads_processed=success_count,
            error_message=error_message,
            metadata={
                "success": success_count,
                "failed": failed_count,
                "total_candidates": len(leads_to_enrich)
            }
        )
