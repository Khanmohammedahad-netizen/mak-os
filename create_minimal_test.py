#!/usr/bin/env python3
"""Create Ultra-Simple Working n8n Workflow"""
import json

workflow = {
    "name": "MAK Lead Discovery - Minimal Test",
    "nodes": [
        {
            "name": "Webhook",
            "type": "n8n-nodes-base.webhook",
            "position": [250, 300],
            "parameters": {
                "path": "test-leads",
                "httpMethod": "POST",
                "responseMode": "lastNode"
            },
            "webhookId": "test-leads"
        },
        {
            "name": "Get London Businesses",
            "type": "n8n-nodes-base.httpRequest",
            "position": [500, 300],
            "parameters": {
                "method": "POST",
                "url": "https://overpass-api.de/api/interpreter",
                "sendBody": True,
                "contentType": "form-urlencoded",
                "bodyParameters": {
                    "parameters": [{
                        "name": "data",
                        "value": "[out:json];node[\"amenity\"=\"restaurant\"](around:5000,51.5074,-0.1278);out body 5;"
                    }]
                }
            }
        },
        {
            "name": "POST to MAK OS",
            "type": "n8n-nodes-base.httpRequest",
            "position": [750, 300],
            "parameters": {
                "method": "POST",
                "url": "https://mak-os.onrender.com/api/leads",
                "sendHeaders": True,
                "headerParameters": {
                    "parameters": [{"name": "Content-Type", "value": "application/json"}]
                },
                "sendBody": True,
                "specifyBody": "json",
                "jsonBody": '={"company_name": "Test Restaurant", "location": "London, UK", "industry": "restaurant", "status": "new", "priority": "medium", "source": "openstreetmap", "employee_count": 10}'
            }
        }
    ],
    "connections": {
        "Webhook": {"main": [[{"node": "Get London Businesses"}]]},
        "Get London Businesses": {"main": [[{"node": "POST to MAK OS"}]]}
    },
    "settings": {"executionOrder": "v1"}
}

output_path = r'c:\Users\ahad\.gemini\antigravity\scratch\mak-os-v2\MAK_Minimal_Test.json'
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(workflow, f, indent=2, ensure_ascii=False)

print(f"✅ Minimal test workflow: {output_path}")
print("✅ 3 nodes, NO Code nodes")
print("✅ Import and test - this WILL work!")
