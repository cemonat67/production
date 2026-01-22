
import json
import re

raw_data = """
COTTON 	 Organic Cotton 	 Ring 	 6/1 	 3.8 	 85 	 TRUE 
COTTON 	 Organic Cotton 	 Ring 	 12/1 	 3.7 	 86 	 TRUE 
COTTON 	 Organic Cotton 	 Ring 	 20/1 	 3.6 	 87 	 TRUE 
COTTON 	 Organic Cotton 	 Compact 	 20/1 	 3.5 	 90 	 TRUE 
COTTON 	 Organic Cotton 	 Compact 	 40/1 	 3.4 	 91 	 TRUE 
COTTON 	 Organic Cotton 	 Open-End 	 10/1 	 3.9 	 80 	 TRUE 
COTTON 	 Organic Cotton 	 Open-End 	 20/1 	 3.8 	 81 	 TRUE 
COTTON 	 U.S. Cotton 	 Ring 	 10/1 	 4.0 	 84 	 TRUE 
COTTON 	 U.S. Cotton 	 Ring 	 20/1 	 3.9 	 85 	 TRUE 
COTTON 	 Giza 	 Ring 	 20/1 	 4.2 	 88 	 TRUE 
COTTON 	 Giza 	 Compact 	 40/1 	 4.1 	 90 	 TRUE 
COTTON 	 Supima 	 Ring 	 30/1 	 4.3 	 89 	 TRUE 
COTTON 	 Supima 	 Compact 	 60/1 	 4.2 	 91 	 TRUE 
COTTON 	 Turkish Cotton 	 Ring 	 20/1 	 3.9 	 86 	 TRUE 
COTTON 	 BCI 	 Ring 	 20/1 	 3.8 	 85 	 TRUE 
COTTON 	 Regenerative Cotton 	 Compact 	 40/1 	 3.2 	 93 	 TRUE 
CELLULOSIC 	 TENCEL™ Modal 	 Ring 	 20/1 	 5.5 	 88 	 TRUE 
CELLULOSIC 	 TENCEL™ Modal Micro 	 Ring 	 40/1 	 5.6 	 89 	 TRUE 
CELLULOSIC 	 TENCEL™ Lyocell STD 	 Compact 	 30/1 	 5.1 	 90 	 TRUE 
CELLULOSIC 	 TENCEL™ Lyocell LF 	 Compact 	 40/1 	 5.0 	 91 	 TRUE 
CELLULOSIC 	 TENCEL™ Lyocell A100 	 Compact 	 60/1 	 4.9 	 92 	 TRUE 
CELLULOSIC 	 LENZING™ Viscose 	 Ring 	 20/1 	 6.0 	 82 	 TRUE 
CELLULOSIC 	 LENZING™ ECOVERO™ Viscose 	 Ring 	 30/1 	 4.8 	 88 	 TRUE 
CELLULOSIC 	 Livaeco™ Modal 	 Compact 	 40/1 	 4.9 	 90 	 TRUE 
CELLULOSIC 	 Livaeco™ Viscose 	 Ring 	 20/1 	 5.2 	 86 	 TRUE 
CELLULOSIC 	 SaXcell 	 Ring 	 20/1 	 3.2 	 94 	 TRUE 
CELLULOSIC 	 Bamboo 	 Ring 	 20/1 	 7.5 	 75 	 TRUE 
BLENDS 	 Linen 	 Ring 	 16/1 	 4.5 	 83 	 TRUE 
BLENDS 	 Hemp 	 Ring 	 20/1 	 2.8 	 92 	 TRUE 
BLENDS 	 Silk 	 Ring 	 30/1 	 6.8 	 87 	 TRUE 
BLENDS 	 Cashmere 	 Ring 	 40/1 	 9.5 	 90 	 TRUE 
BLENDS 	 Wool 	 Ring 	 24/1 	 6.2 	 82 	 TRUE 
BLENDS 	 Seacell® 	 Compact 	 40/1 	 4.6 	 91 	 TRUE 
BLENDS 	 Smartcell® 	 Compact 	 40/1 	 4.4 	 92 	 TRUE 
BLENDS 	 Repreve® 	 Ring 	 20/1 	 3.1 	 89 	 TRUE 
BLENDS 	 Recycle PES 	 Open-End 	 10/1 	 4.2 	 80 	 TRUE 
BLENDS 	 Polyester 	 Open-End 	 10/1 	 5.9 	 78 	 TRUE 
BLENDS 	 Polyamid 	 Open-End 	 10/1 	 6.5 	 76 	 TRUE 
BLENDS 	 Acrylic 	 Open-End 	 10/1 	 6.8 	 74 	 TRUE 
TECHNOLOGY 	 Ring Yarn 	 Ring 	 — 	 3.8 	 85 	 TRUE 
TECHNOLOGY 	 Compact Yarn 	 Compact 	 — 	 3.5 	 90 	 TRUE 
TECHNOLOGY 	 Open-End Yarn 	 Open-End 	 — 	 4.1 	 80 	 TRUE 
TECHNOLOGY 	 Slub Yarn 	 Slub 	 — 	 4.0 	 88 	 TRUE 
TECHNOLOGY 	 Softtwist Yarn 	 Softtwist 	 — 	 3.9 	 86 	 TRUE 
TECHNOLOGY 	 Siro-Spun Yarn 	 Siro-Spun 	 — 	 3.7 	 89 	 TRUE
"""

yarns = []
lines = raw_data.strip().split('\n')

def get_badges(name, category):
    badges = []
    lower_name = name.lower()
    
    if "organic" in lower_name:
        badges.append("Organic")
        badges.append("GOTS")
    if "recycled" in lower_name or "repreve" in lower_name or "recycle" in lower_name:
        badges.append("Recycled")
        badges.append("GRS")
    if "bci" in lower_name:
        badges.append("BCI")
    if "tencel" in lower_name:
        badges.append("TENCEL™")
        badges.append("Biodegradable")
    if "ecovero" in lower_name:
        badges.append("ECOVERO™")
        badges.append("EU Ecolabel")
    if "supima" in lower_name:
        badges.append("Supima")
    if "us cotton" in lower_name or "u.s. cotton" in lower_name:
        badges.append("US Cotton Trust Protocol")
    if "regenerative" in lower_name:
        badges.append("Regenerative")
    if "bamboo" in lower_name:
        badges.append("FSC")
    if "livaeco" in lower_name:
        badges.append("Livaeco™")
    if "seacell" in lower_name:
        badges.append("Seacell®")
    
    # Default badges if none found but category suggests
    if not badges:
        if category == "COTTON":
            badges.append("Natural")
        elif category == "CELLULOSIC":
            badges.append("Man-Made Cellulosic")
    
    return list(set(badges))

for i, line in enumerate(lines):
    parts = [p.strip() for p in line.split('\t')]
    if len(parts) < 7:
        continue
        
    category = parts[0]
    product = parts[1]
    technology = parts[2]
    yarn_no = parts[3]
    co2 = float(parts[4])
    dpi = int(parts[5])
    ml = parts[6]
    
    # Format Category
    formatted_category = category.title() + " Yarns"
    if category == "COTTON": formatted_category = "Cotton Yarns"
    if category == "CELLULOSIC": formatted_category = "Cellulosic Yarns"
    if category == "BLENDS": formatted_category = "Blended Yarns"
    if category == "TECHNOLOGY": formatted_category = "Technology Yarns"

    # Construct Name
    name = f"{product}"
    
    # Infer Composition
    composition = product
    if "Cotton" not in composition and "Cotton" in category:
        composition += " Cotton"
    
    yarn_entry = {
        "id": f"UG-{i+1:03d}",
        "name": name,
        "category": formatted_category,
        "brand": "Ugurlular Tekstil",
        "composition": composition,
        "yarn_count": yarn_no,
        "type": technology,
        "co2": co2,
        "score": dpi,
        "badges": get_badges(product, category),
        "properties": [technology, "High Quality"],
        "end_use": ["Knitting", "Weaving"],
        "source": {
            "source_type": "provided_data",
            "source_confidence": "high",
            "ml_verified": True if ml == "TRUE" else False
        },
        "notes_missing": []
    }
    
    yarns.append(yarn_entry)

print(json.dumps(yarns, indent=2))
