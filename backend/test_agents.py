"""
Test script for agent execution

This script tests the agent system end-to-end:
1. Creates sample leads via DiscoveryAgent
2. Runs VettingAgent to approve/reject
3. Displays results
"""
import asyncio
from app.agents import DiscoveryAgent, VettingAgent

async def test_agents():
    print("🧪 Testing MAK OS V2 Agent System\n")
    
    # Test 1: Discovery Agent
    print("=" * 60)
    print("TEST 1: Discovery Agent (Lead Ingestion)")
    print("=" * 60)
    
    discovery = DiscoveryAgent()
    
    sample_leads = {
        "leads": [
            {
                "company_name": "Sakura Sushi Dubai",
                "website": "https://sakurasushi.ae",
                "region": "UAE"
            },
            {
                "company_name": "Tokyo Ramen House",
                "website": "https://tokyoramen.com",
                "region": "UAE"
            },
            {
                "company_name": "Bad Lead Co",  # Will be rejected (no website)
                "website": None,
                "region": "UAE"
            },
            {
                "company_name": "AB",  # Will be rejected (name too short)
                "website": "https://ab.com",
                "region": "UAE"
            },
        ]
    }
    
    print(f"📤 Submitting {len(sample_leads['leads'])} leads...")
    result = await discovery.run(context=sample_leads)
    
    print(f"\n✅ Status: {result.status}")
    print(f"📊 Leads processed: {result.leads_processed}")
    if result.metadata:
        print(f"   - New leads: {result.metadata.get('new_leads', 0)}")
        print(f"   - Duplicates skipped: {result.metadata.get('duplicates_skipped', 0)}")
    
    # Test 2: Vetting Agent
    print("\n" + "=" * 60)
    print("TEST 2: Vetting Agent (Business Rules)")
    print("=" * 60)
    
    vetting = VettingAgent()
    
    print("🔍 Running vetting on all pending leads...")
    result = await vetting.run()
    
    print(f"\n✅ Status: {result.status}")
    print(f"📊 Leads processed: {result.leads_processed}")
    if result.metadata:
        print(f"   - Approved: {result.metadata.get('approved', 0)}")
        print(f"   - Rejected: {result.metadata.get('rejected', 0)}")
    
    print("\n" + "=" * 60)
    print("✨ Test Complete!")
    print("=" * 60)
    print("\n💡 Check the database to see the created leads and agent logs.")
    print("   Run: sqlite3 mak_os.db 'SELECT * FROM leads;'")
    print("   Run: sqlite3 mak_os.db 'SELECT * FROM agent_logs;'")

if __name__ == "__main__":
    asyncio.run(test_agents())
