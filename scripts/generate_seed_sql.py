import json
import os
import datetime

# Configuration
INPUT_FILE = "dist/site/data/ugurlular-yarns.json"
OUTPUT_FILE = "supabase/seed.sql"

def escape_sql_string(val):
    if val is None:
        return "NULL"
    if isinstance(val, (int, float)):
        return str(val)
    # Basic SQL escaping for text
    return "'" + str(val).replace("'", "''") + "'"

def generate_seed():
    if not os.path.exists(INPUT_FILE):
        print(f"Error: Input file {INPUT_FILE} not found.")
        return

    try:
        with open(INPUT_FILE, 'r', encoding='utf-8') as f:
            yarns = json.load(f)
    except Exception as e:
        print(f"Error reading JSON: {e}")
        return

    print(f"Found {len(yarns)} yarns. Generating SQL...")

    sql_statements = [
        "-- Auto-generated seed file from ugurlular-yarns.json",
        "TRUNCATE TABLE public.yarns CASCADE;",
        ""
    ]

    for yarn in yarns:
        # Extract fields
        dpp_id = yarn.get('id') or f"UG-GEN-{yarn.get('name', 'UNKNOWN')[:3].upper()}"
        name = yarn.get('name', 'Unknown Yarn')
        category = yarn.get('category', 'General')
        composition = yarn.get('composition', '100% Unknown')
        co2 = yarn.get('co2', 0.0)
        
        # Determine status from existing logic if present, else default
        status = yarn.get('strategic_status', 'ACTIVE')
        
        # Pack everything else into meta
        meta = json.dumps(yarn)
        
        # Construct INSERT
        stmt = f"""INSERT INTO public.yarns (dpp_id, name, category, composition, co2_score, strategic_status, meta)
VALUES ({escape_sql_string(dpp_id)}, {escape_sql_string(name)}, {escape_sql_string(category)}, {escape_sql_string(composition)}, {co2}, {escape_sql_string(status)}, {escape_sql_string(meta)}::jsonb);"""
        
        sql_statements.append(stmt)

    # Write to file
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write("\n".join(sql_statements))

    print(f"Successfully generated {OUTPUT_FILE} with {len(yarns)} inserts.")

if __name__ == "__main__":
    generate_seed()
