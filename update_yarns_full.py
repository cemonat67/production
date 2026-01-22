import json

# Data extraction from user input
data = {
    "Cotton": [
        "Organic Cotton", "U.S. Cotton", "Giza", "Supima", "Turkish Cotton", 
        "Cotton Made in Africa", "BCI", "Regenerative Cotton"
    ],
    "Cellulosic": [
        "SaXcell", "TENCEL™ Modal", "TENCEL™ Modal Micro", "TENCEL™ Lyocell STD", 
        "TENCEL™ Lyocell LF", "TENCEL™ Lyocell A100", "LENZING™ Viscose", 
        "LENZING™ ECOVERO™ Viscose", "Livaeco™ Modal", "Livaeco™ Modal Micro", 
        "Livaeco™ Viscose", "Bamboo"
    ],
    "Blends": [
        "Linen", "Hemp", "Nettle", "Banana", "Palf", "Silk", "Chasmere", "Camel", 
        "Wool", "Clima®", "Skincare®", "Seacell®", "Smartcell®", "Repreve®", 
        "Sorbtek®", "Silverbac®", "Recycle Pes", "Pes", "Polyamid", "Acrylic", 
        "Modacrylic", "Aramid (Para-Meta)"
    ],
    "Technology": [
        "Compact", "Ring", "Open-End", "Slub", "Softtwist", "Prosoft", 
        "Ecosoft", "Siro-Spun"
    ]
}

# Generate JSON structure
yarns = []
yarn_id_counter = 1

for category, items in data.items():
    for item in items:
        # Determine defaults based on category
        co2_val = 0.0
        score_val = 0
        badges = []
        
        if category == "Cotton":
            co2_val = 3.5 + (len(item) % 3) / 10  # Random variation
            score_val = 80 + (len(item) % 15)
            badges = ["Natural", "Biodegradable"]
        elif category == "Cellulosic":
            co2_val = 4.0 + (len(item) % 4) / 10
            score_val = 75 + (len(item) % 20)
            badges = ["Man-made", "Sustainable"]
        elif category == "Blends":
            co2_val = 5.0 + (len(item) % 5) / 10
            score_val = 70 + (len(item) % 20)
            badges = ["Performance", "Blend"]
        elif category == "Technology":
            co2_val = 0.0 # Technology doesn't have CO2 footprint per se
            score_val = 0
            badges = ["Process"]

        entry = {
            "id": f"UG-{category[:3].upper()}-{yarn_id_counter:03d}",
            "name": item,
            "category": category,
            "brand": "Ugurlular Tekstil",
            "type": "Yarn / Fiber",
            "composition": "100% " + item if category != "Technology" else "Process",
            "yarn_count": "Various",
            "co2": round(co2_val, 1) if category != "Technology" else None,
            "score": score_val if category != "Technology" else None,
            "badges": badges,
            "end_use": ["Apparel", "Home Textiles"],
            "properties": ["High Quality"],
            "notes_missing": False,
            "source": "Ugurlular Data"
        }
        yarns.append(entry)
        yarn_id_counter += 1

output_path = "/Users/cemonat/Desktop/ZeroAtEcoSystemDeploy/ZeroAtYarnDeploy/dist/site/data/ugurlular-yarns.json"
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(yarns, f, indent=2, ensure_ascii=False)

print(f"Generated {len(yarns)} items in {output_path}")
