"""
DiscoveryAgent - Ingests leads from n8n discovery workflows

This agent receives bulk lead data from n8n and:
1. Deduplicates by website
2. Creates new leads in the database
3. Returns count of processed leads
"""
from typing import Dict, Any, List
from sqlalchemy import select
from app.agents.base import BaseAgent, AgentResult
from app.database import AsyncSessionLocal
from app.models import Lead

class DiscoveryAgent(BaseAgent):
    """
    Ingests leads from external discovery sources (n8n workflows)
    """
    
    def __init__(self):
        super().__init__(
            name="Discovery Agent",
            description="Ingests and deduplicates leads from n8n discovery workflows"
        )
    
    async def execute(self, context: Dict[str, Any] | None = None) -> AgentResult:
        """
        Process a batch of leads from discovery.
        
        Expected context:
        {
            "leads": [
                {
                    "company_name": "Example Corp",
                    "website": "https://example.com",
                    "region": "UAE"
                },
                ...
            ]
        }
        """
        if not context or "leads" not in context:
            return AgentResult(
                status='failed',
                leads_processed=0,
                error_message="No leads provided in context"
            )
        
        lead_data = context["leads"]
        
        async with AsyncSessionLocal() as db:
            new_count = 0
            duplicate_count = 0
            
            for item in lead_data:
                # Extract website for deduplication
                website = item.get("website")
                
                # Check if lead already exists
                if website:
                    result = await db.execute(
                        select(Lead).where(Lead.website == website)
                    )
                    existing = result.scalar_one_or_none()
                    
                    if existing:
                        duplicate_count += 1
                        continue
                
                # Create new lead
                lead = Lead(
                    company_name=item.get("company_name", "Unknown"),
                    website=website,
                    region=item.get("region"),
                    status="new",
                    vetting_status="pending"
                )
                
                db.add(lead)
                new_count += 1
            
            await db.commit()
        
        return AgentResult(
            status='success',
            leads_processed=new_count,
            metadata={
                "new_leads": new_count,
                "duplicates_skipped": duplicate_count,
                "total_received": len(lead_data)
            }
        )
