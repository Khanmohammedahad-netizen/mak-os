"""
Test TechDebtAgent with mock n8n responses

This script:
1. Creates approved leads with websites
2. Runs TechDebtAgent (which will try to call n8n)
3. Since n8n won't respond, we'll see the agent's behavior
"""
import asyncio
from app.agents import DiscoveryAgent, VettingAgent, TechDebtAgent

async def test_tech_debt_agent():
    print("🧪 Testing TechDebtAgent\n")
    
    # Step 1: Create some leads
    print("=" * 60)
    print("STEP 1: Creating Sample Leads")
    print("=" * 60)
    
    discovery = DiscoveryAgent()
    
    sample_leads = {
        "leads": [
            {
                "company_name": "Tech Startup Inc",
                "website": "https://example-startup.com",
                "region": "UAE"
            },
            {
                "company_name": "Digital Agency LLC",
                "website": "https://digital-agency.com",
                "region": "UAE"
            },
        ]
    }
    
    result = await discovery.run(context=sample_leads)
    print(f"✅ Created {result.leads_processed} leads")
    
    # Step 2: Vet the leads
    print("\n" + "=" * 60)
    print("STEP 2: Vetting Leads")
    print("=" * 60)
    
    vetting = VettingAgent()
    result = await vetting.run()
    print(f"✅ Vetted {result.leads_processed} leads")
    if result.metadata:
        print(f"   - Approved: {result.metadata.get('approved', 0)}")
    
    # Step 3: Run Tech Debt Agent
    print("\n" + "=" * 60)
    print("STEP 3: Tech Debt Analysis (n8n Integration)")
    print("=" * 60)
    
    tech_debt = TechDebtAgent()
    
    print("🔍 Looking for approved leads to enrich...")
    result = await tech_debt.run(context={"limit": 5})
    
    print(f"\n✅ Status: {result.status}")
    print(f"📊 Leads processed: {result.leads_processed}")
    if result.metadata:
        print(f"   - Success: {result.metadata.get('success', 0)}")
        print(f"   - Failed: {result.metadata.get('failed', 0)}")
        print(f"   - Total candidates: {result.metadata.get('total_candidates', 0)}")
    
    if result.error_message:
        print(f"\n⚠️  Errors encountered:")
        print(f"   {result.error_message}")
        print(f"\n💡 This is expected if n8n is not running or configured.")
        print(f"   The agent tried to reach: {tech_debt_agent_example_url}")
    
    print("\n" + "=" * 60)
    print("✨ Test Complete!")
    print("=" * 60)
    
    print("\n📝 Notes:")
    print("   - TechDebtAgent tried to send webhooks to n8n")
    print("   - In production, n8n would analyze the websites")
    print("   - n8n would call back to PATCH /api/webhooks/enrichment/{lead_id}")
    print("   - This would update the lead's pain_points and score")

tech_debt_agent_example_url = "https://mak-n8n.onrender.com/webhook/enrichment-tech"

if __name__ == "__main__":
    asyncio.run(test_tech_debt_agent())
