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

lines = raw_data.strip().split('\n')
yarns = []

def get_badges(name):
    badges = []
    name_lower = name.lower()
    if "organic" in name_lower:
        badges.extend(["Organic", "GOTS"])
    if "recycle" in name_lower or "repreve" in name_lower:
        badges.extend(["Recycled", "GRS"])
    if "tencel" in name_lower:
        badges.extend(["TENCEL™", "Eco-Friendly"])
    if "livaeco" in name_lower:
        badges.extend(["Livaeco™", "Sustainable"])
    if "bci" in name_lower:
        badges.extend(["BCI", "Better Cotton"])
    if "regenerative" in name_lower:
        badges.extend(["Regenerative", "Traceable"])
    if "bamboo" in name_lower:
        badges.extend(["Bamboo", "Natural"])
    if "hemp" in name_lower:
        badges.extend(["Hemp", "Durable"])
    if "linen" in name_lower:
        badges.extend(["Linen", "Breathable"])
    if "seacell" in name_lower:
        badges.extend(["Seacell", "Wellness"])
    if "smartcell" in name_lower:
        badges.extend(["Smartcell", "Wellness"])
    if "us cotton" in name_lower or "u.s. cotton" in name_lower:
        badges.extend(["US Cotton", "Trust Protocol"])
    if "supima" in name_lower:
        badges.extend(["Supima", "Premium"])
    if "giza" in name_lower:
        badges.extend(["Giza", "Premium"])
        
    return list(set(badges))

def get_properties(tech, co2):
    props = [tech]
    if tech == "Compact":
        props.append("High Strength")
        props.append("Low Hairiness")
    elif tech == "Ring":
        props.append("Soft Touch")
        props.append("Versatile")
    elif tech == "Open-End":
        props.append("Cost Effective")
        props.append("Uniformity")
    
    if co2 < 4.0:
        props.append("Low Carbon")
        
    return props

def get_strategic_status(co2, score, ml_ready):
    # Heuristic for strategic status
    if co2 < 4.0 and score >= 85:
        return "HERO"
    if co2 > 6.0 or score < 80:
        return "EXIT"
    return "TRANSFORM"

category_map = {
    "COTTON": "Cotton Yarns",
    "CELLULOSIC": "Cellulosic Yarns",
    "BLENDS": "Blended Yarns",
    "TECHNOLOGY": "Technology & Innovation"
}

for i, line in enumerate(lines):
    parts = [p.strip() for p in line.split('\t')]
    if len(parts) < 7:
        continue
        
    cat_raw = parts[0]
    name = parts[1]
    tech = parts[2]
    yarn_no = parts[3]
    co2 = float(parts[4])
    dpi = int(parts[5])
    ml = parts[6]
    
    # Handle "—" in yarn_no for Technology entries
    if yarn_no == "—":
        yarn_no = "Various"

    category = category_map.get(cat_raw, cat_raw.title())
    ml_ready = ml.upper() == "TRUE"
    
    item = {
        "id": f"UG-{i+1:03d}",
        "name": name,
        "category": category,
        "brand": "Ugurlular Tekstil",
        "composition": name, # Simplification
        "yarn_count": yarn_no,
        "type": tech,
        "co2": co2,
        "score": dpi,
        "ml_ready": ml_ready,
        "strategic_status": get_strategic_status(co2, dpi, ml_ready),
        "badges": get_badges(name),
        "properties": get_properties(tech, co2),
        "end_use": ["Knitting", "Weaving"],
        "source": {
            "source_type": "provided_data",
            "certification_body": "Internal",
            "last_audit": "2024-12-25"
        }
    }
    
    yarns.append(item)

print(json.dumps(yarns, indent=4))
