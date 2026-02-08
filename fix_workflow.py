#!/usr/bin/env python3
"""Fix Schedule Trigger in Full Production Workflow"""
import json

# Load the existing workflow
with open(r'c:\Users\ahad\.gemini\antigravity\scratch\mak-os-v2\MAK_Lead_Discovery_Full.json', 'r', encoding='utf-8') as f:
    workflow = json.load(f)

# Fix the Schedule Trigger node
for node in workflow['nodes']:
    if node['name'] == 'Schedule Trigger':
        # Replace with correct cron-based schedule
        node['parameters'] = {
            "rule": {
                "interval": [{"field": "cronExpression", "expression": "0 9 * * *"}]
            }
        }
        print("✅ Fixed Schedule Trigger - now runs daily at 9:00 AM")
        break

# Save fixed workflow
output_path = r'c:\Users\ahad\.gemini\antigravity\scratch\mak-os-v2\MAK_Lead_Discovery_FIXED.json'
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(workflow, f, indent=2, ensure_ascii=False)

print(f"✅ Fixed workflow saved: {output_path}")
print(f"✅ {len(workflow['nodes'])} nodes (all AI features intact)")
print(f"✅ Ready to import!")
