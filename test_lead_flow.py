import requests
import json

print("🔍 Checking n8n → MAK OS data flow...\n")

# Test 1: Trigger n8n workflow
print("1️⃣ Triggering n8n workflow...")
try:
    n8n_response = requests.post(
        "https://mak-n8n.onrender.com/webhook/discover-leads",
        json={"region": "UK"},
        timeout=30
    )
    print(f"   Status: {n8n_response.status_code}")
    if n8n_response.status_code == 200:
        print("   ✅ n8n workflow triggered successfully")
    else:
        print(f"   ⚠️ Response: {n8n_response.text}")
except Exception as e:
    print(f"   ❌ Error: {e}")

# Test 2: Wait for processing
print("\n2️⃣ Waiting 10 seconds for workflow to complete...")
import time
time.sleep(10)

# Test 3: Check MAK OS backend
print("\n3️⃣ Checking MAK OS backend for leads...")
try:
    leads_response = requests.get("https://mak-os.onrender.com/api/leads")
    leads = leads_response.json()
    
    if isinstance(leads, dict) and 'value' in leads:
        leads = leads['value']
    
    print(f"   Total leads in database: {len(leads)}")
    
    if len(leads) > 0:
        print("\n   📊 Recent leads:")
        for lead in leads[:3]:
            print(f"   - {lead.get('company_name')} | {lead.get('source')} | {lead.get('status')}")
    else:
        print("   ⚠️ No leads found - data not reaching backend!")
        
except Exception as e:
    print(f"   ❌ Error: {e}")

# Test 4: Manually POST a test lead
print("\n4️⃣ Testing direct POST to MAK OS...")
test_lead = {
    "company_name": "Test Restaurant",
    "location": "London, UK",
    "industry": "restaurant",
    "status": "new",
    "priority": "medium",
    "employee_count": 10,
    "source": "test",
    "notes": "Manual test lead"
}

try:
    post_response = requests.post(
        "https://mak-os.onrender.com/api/leads",
        json=test_lead,
        headers={"Content-Type": "application/json"}
    )
    print(f"   Status: {post_response.status_code}")
    print(f"   Response: {post_response.text[:200]}")
    
    if post_response.status_code in [200, 201]:
        print("   ✅ Direct POST works!")
    else:
        print("   ⚠️ POST might be failing - check response above")
        
except Exception as e:
    print(f"   ❌ Error: {e}")

print("\n" + "="*60)
print("📋 DIAGNOSIS:")
print("="*60)
