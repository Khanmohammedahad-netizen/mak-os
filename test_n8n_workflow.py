"""
Quick Test Script for n8n Lead Discovery Workflow
Triggers the workflow via webhook and checks results
"""
import requests
import time

def test_n8n_workflow():
    print("🧪 Testing n8n Lead Discovery Workflow\n")
    
    # Step 1: Trigger the workflow
    print("1️⃣ Triggering n8n workflow for UK region...")
    webhook_url = "https://mak-n8n.onrender.com/webhook/lead-discovery"
    
    try:
        response = requests.post(
            webhook_url,
            json={"region": "UK"},
            timeout=30
        )
        
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            print("   ✅ Workflow triggered successfully!")
        else:
            print(f"   ⚠️ Unexpected response: {response.text[:200]}")
            
    except requests.exceptions.Timeout:
        print("   ⏱️ Timeout - workflow is running in background")
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return
    
    # Step 2: Wait a bit
    print("\n2️⃣ Waiting 30 seconds for workflow to discover leads...")
    time.sleep(30)
    
    # Step 3: Check MAK OS backend for new leads
    print("\n3️⃣ Checking MAK OS backend for new leads...")
    try:
        leads_response = requests.get(
            "https://mak-os.onrender.com/api/leads",
            timeout=10
        )
        
        if leads_response.status_code == 200:
            leads = leads_response.json()
            print(f"   ✅ Found {len(leads)} total leads in database")
            
            # Check for recent leads
            recent_leads = [l for l in leads if l.get('source') in ['openstreetmap', 'serper_google', 'opencorporates']]
            
            if recent_leads:
                print(f"   🎉 Found {len(recent_leads)} leads from new workflow!")
                print("\n   Sample leads:")
                for lead in recent_leads[:3]:
                    print(f"   - {lead.get('company_name')} ({lead.get('location')}) - Source: {lead.get('source')}")
            else:
                print("   ⚠️ No new leads yet - workflow might still be running")
        else:
            print(f"   ⚠️ Could not fetch leads: {leads_response.status_code}")
            
    except Exception as e:
        print(f"   ❌ Error checking leads: {e}")
    
    print("\n" + "="*60)
    print("Test complete! Check n8n dashboard for execution logs:")
    print("https://mak-n8n.onrender.com")
    print("="*60)

if __name__ == "__main__":
    test_n8n_workflow()
