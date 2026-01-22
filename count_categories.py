import json
from collections import Counter

try:
    with open('dist/site/data/ugurlular-yarns.json', 'r') as f:
        data = json.load(f)
        
    categories = [item.get('category', 'Unknown') for item in data]
    print("Categories:", Counter(categories))
    
    types = [item.get('type', 'Unknown') for item in data]
    print("Types:", Counter(types))
    
    ring_count = 0
    for item in data:
        if "Ring" in item.get('name', '') or "Ring" in item.get('type', ''):
            ring_count += 1
    print("Items with 'Ring':", ring_count)
    
    compact_count = 0
    for item in data:
        if "Compact" in item.get('name', '') or "Compact" in item.get('type', ''):
            compact_count += 1
    print("Items with 'Compact':", compact_count)
    
    open_end_count = 0
    for item in data:
        if "Open End" in item.get('name', '') or "Open End" in item.get('type', ''):
            open_end_count += 1
    print("Items with 'Open End':", open_end_count)

except Exception as e:
    print(e)
