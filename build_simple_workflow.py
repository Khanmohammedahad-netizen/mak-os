#!/usr/bin/env python3
"""Generate Fixed n8n Workflow - Webhook Only (No Schedule)"""
import json

workflow = {
    "name": "MAK Lead Discovery - Production",
    "nodes": [
        {
            "name": "Manual Webhook",
            "type": "n8n-nodes-base.webhook",
            "position": [250, 500],
            "parameters": {
                "path": "lead-discovery",
                "responseMode": "lastNode",
                "httpMethod": "POST"
            },
            "webhookId": "lead-discovery"
        },
        {
            "name": "Initialize Regions",
            "type": "n8n-nodes-base.code",
            "position": [500, 500],
            "parameters": {
                "jsCode": """const regions = [
  {region: 'UK', lat: 51.5074, lon: -0.1278, city: 'London', jurisdiction: 'gb'},
  {region: 'USA', lat: 40.7128, lon: -74.0060, city: 'New York', jurisdiction: 'us_ny'},
  {region: 'UAE', lat: 25.2048, lon: 55.2708, city: 'Dubai', jurisdiction: 'ae'}
];
const input = $input.first().json;
if (input && input.region) {
  return regions.filter(r => r.region.toLowerCase() === input.region.toLowerCase()).map(r => ({json: r}));
}
return regions.map(r => ({json: r}));"""
            }
        },
        {
            "name": "Loop Regions",
            "type": "n8n-nodes-base.splitInBatches",
            "position": [750, 500],
            "parameters": {"batchSize": 1}
        },
        {
            "name": "OpenStreetMap Overpass",
            "type": "n8n-nodes-base.httpRequest",
            "position": [1000, 500],
            "parameters": {
                "method": "POST",
                "url": "https://overpass-api.de/api/interpreter",
                "sendBody": True,
                "contentType": "form-urlencoded",
                "bodyParameters": {
                    "parameters": [{
                        "name": "data",
                        "value": "=[out:json];(node[\"amenity\"=\"restaurant\"](around:10000,{{$json.lat}},{{$json.lon}});node[\"amenity\"=\"cafe\"](around:10000,{{$json.lat}},{{$json.lon}}););out body 12;"
                    }]
                },
                "options": {"timeout": 15000, "response": {"response": {"neverError": True}}}
            },
            "continueOnFail": True
        },
        {
            "name": "Parse OSM",
            "type": "n8n-nodes-base.code",
            "position": [1250, 500],
            "parameters": {
                "jsCode": """const elements = $json.elements || [];
const parsed = [];
elements.forEach(place => {
  const tags = place.tags || {};
  if (tags.name) {
    parsed.push({
      company_name: tags.name,
      location: `${tags['addr:city'] || $('Loop Regions').item.json.city}, ${$('Loop Regions').item.json.region}`,
      industry: tags.amenity === 'restaurant' ? 'restaurant' : 'cafe',
      region: $('Loop Regions').item.json.region,
      phone: tags.phone || tags['contact:phone'] || null,
      website: tags.website || tags['contact:website'] || null,
      email: tags.email || tags['contact:email'] || null,
      source: 'openstreetmap'
    });
  }
});
return parsed.map(p => ({json: p}));"""
            }
        },
        {
            "name": "Format for Backend",
            "type": "n8n-nodes-base.code",
            "position": [1500, 500],
            "parameters": {
                "jsCode": """return [{json: {
  company_name: $json.company_name,
  website: $json.website,
  email: $json.email,
  phone: $json.phone,
  industry: $json.industry,
  location: $json.location,
  employee_count: 10,
  status: 'new',
  priority: 'medium',
  pain_points: 'Manual operations',
  notes: `Discovered from ${$json.source}`,
  source: $json.source
}}];"""
            }
        },
        {
            "name": "POST to MAK OS",
            "type": "n8n-nodes-base.httpRequest",
            "position": [1750, 500],
            "parameters": {
                "method": "POST",
                "url": "https://mak-os.onrender.com/api/leads",
                "sendHeaders": True,
                "headerParameters": {"parameters": [{"name": "Content-Type", "value": "application/json"}]},
                "sendBody": True,
                "specifyBody": "json",
                "jsonBody": "={{$json}}",
                "options": {"timeout": 10000, "response": {"response": {"neverError": True}}}
            }
        },
        {
            "name": "Success",
            "type": "n8n-nodes-base.code",
            "position": [2000, 500],
            "parameters": {"jsCode": "console.log('✅ Lead added:', $json.company_name); return [$input];"}
        }
    ],
    "connections": {
        "Manual Webhook": {"main": [[{"node": "Initialize Regions"}]]},
        "Initialize Regions": {"main": [[{"node": "Loop Regions"}]]},
        "Loop Regions": {"main": [[{"node": "OpenStreetMap Overpass"}]]},
        "OpenStreetMap Overpass": {"main": [[{"node": "Parse OSM"}]]},
        "Parse OSM": {"main": [[{"node": "Format for Backend"}]]},
        "Format for Backend": {"main": [[{"node": "POST to MAK OS"}]]},
        "POST to MAK OS": {"main": [[{"node": "Success"}]]}
    },
    "settings": {"executionOrder": "v1"}
}

# Write simplified workflow
output_path = r'c:\Users\ahad\.gemini\antigravity\scratch\mak-os-v2\MAK_Simple_Workflow.json'
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(workflow, f, indent=2, ensure_ascii=False)

print(f"✅ Simple workflow created: {output_path}")
print(f"✅ {len(workflow['nodes'])} nodes (webhook trigger only)")
print(f"✅ No schedule - activate and test with webhook!")
