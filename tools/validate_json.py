import json
import sys

try:
    with open('/Users/cemonat/Desktop/ZeroAtEcoSystemDeploy/ZeroAtYarnDeploy/dist/site/data/ugurlular-yarns.json', 'r') as f:
        data = json.load(f)
except Exception as e:
    print(f"Error loading JSON: {e}")
    sys.exit(1)

if not isinstance(data, list):
    print("Error: JSON is not a list")
    sys.exit(1)

print(f"Loaded {len(data)} items.")

required_fields = ['name', 'brand', 'composition', 'co2', 'score', 'yarn_count', 'type', 'badges']
errors = 0

for i, item in enumerate(data):
    missing = []
    for field in required_fields:
        if field not in item:
            missing.append(field)
    
    if 'badges' in item and not isinstance(item['badges'], list):
        print(f"Item {i} ({item.get('name', 'Unknown')}): 'badges' is not a list")
        errors += 1
    
    if missing:
        print(f"Item {i} ({item.get('name', 'Unknown')}): Missing fields {missing}")
        errors += 1

if errors == 0:
    print("All items valid.")
else:
    print(f"Found {errors} invalid items.")
