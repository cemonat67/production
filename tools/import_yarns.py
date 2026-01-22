print("Script starting...")
import json, os, sys, requests
print("Imports done")

try:
    SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
    SERVICE_KEY  = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    print(f"Env loaded: {SUPABASE_URL}")
except Exception as e:
    print(f"Env error: {e}")
    sys.exit(1)

SRC = "dist/site/data/ugurlular-yarns.json"

def main():
    print(f"Loading {SRC}")
    try:
        data = json.load(open(SRC, "r", encoding="utf-8"))
        print("Data loaded")
    except Exception as e:
        print(f"JSON load error: {e}")
        return

    yarns = data if isinstance(data, list) else data.get("yarns", [])
    print(f"Found {len(yarns)} yarns")
    rows = []
    for y in yarns:
        yarn_id = y.get("yarn_id") or y.get("id") or y.get("code")
        if not yarn_id:
            continue
        rows.append({
            "yarn_id": yarn_id,
            "name": y.get("name",""),
            "dpp_id": y.get("dpp_id"),
            "composition": y.get("composition") or {},
            "co2_impact": float(y.get("co2_impact") or y.get("co2") or 0),
            "energy_intensity": y.get("energy_intensity"),
            "renewable_share": float(y.get("renewable_share") or 0) / 100.0,
            "governance_status": y.get("governance_status") or y.get("strategic_status") or "TRANSFORM",
            "claim_status": y.get("claim_status") or "ALLOWED",
            "is_active": bool(y.get("is_active", True))
        })
    
    print(f"Prepared {len(rows)} rows")

    url = f"{SUPABASE_URL}/rest/v1/yarns?on_conflict=yarn_id"
    headers = {
        "apikey": SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }
    print(f"Posting to {url}...")
    try:
        r = requests.post(url, headers=headers, json=rows, timeout=60)
        print("status:", r.status_code)
        print(r.text[:5000])
    except Exception as e:
        print(f"Request error: {e}")

if __name__ == "__main__":
    main()
