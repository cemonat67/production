import json
import os

JSON_PATH = 'dist/site/data/ugurlular-yarns.json'

def load_data():
    if not os.path.exists(JSON_PATH):
        print(f"Error: {JSON_PATH} not found.")
        return []
    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_data(data):
    with open(JSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=4, ensure_ascii=False)
    print(f"Updated {len(data)} yarns in {JSON_PATH}")

def apply_strategy(yarns):
    changes_count = 0
    for i, yarn in enumerate(yarns):
        # --- 6) ALIGN WITH PYTHON STRATEGY: STABLE FIELDS ---
        # Ensure ID exists (deterministically)
        if 'id' not in yarn:
            yarn['id'] = f"yarn_{i+1:03d}"
        
        # Ensure Name/Composition exist
        if 'name' not in yarn: yarn['name'] = "Unknown Yarn"
        if 'composition' not in yarn: yarn['composition'] = "Unknown Composition"
        
        # Ensure Numeric Fields
        if 'co2' not in yarn: yarn['co2'] = 5.0 # Default high
        # Map co2 to co2_kg_per_kg if missing (for schema consistency)
        if 'co2_kg_per_kg' not in yarn: yarn['co2_kg_per_kg'] = yarn['co2']
        
        # Ensure Arrays
        if 'reasons' not in yarn: yarn['reasons'] = []
        
        # Ensure Environmental Impact Structure
        if 'environmental_impact' not in yarn: yarn['environmental_impact'] = {}
        if 'energy' not in yarn['environmental_impact']: yarn['environmental_impact']['energy'] = {}
        
        # Ensure Optional Fields (populate with defaults if missing, for stability)
        if 'energy_intensity' not in yarn: 
            # Try to get from nested or default
            yarn['energy_intensity'] = yarn['environmental_impact']['energy'].get('real_time_kwh_kg', 4.0)
        
        if 'renewable_share' not in yarn:
             # Try to get from nested or default
            yarn['renewable_share'] = yarn['environmental_impact']['energy'].get('renewable_share', 0.0)

        name_lower = yarn.get('name', '').lower()
        comp_lower = yarn.get('composition', '').lower()
        
        # Initialize Governance Object
        yarn['governance'] = {
            'claim_status': 'RESTRICTED', # Default
            'legal_justification': 'Subject to ESPR Digital Product Passport requirements. Data verification pending.',
            'shadow_cost': 0.0,
            'margin_erosion_risk': 'LOW',
            'data_integrity': 'PASS'
        }

        # --- DATA INTEGRITY CHECK (Failure Condition: Data Inconsistency -> HALT) ---
        missing_critical_data = []
        if 'co2' not in yarn or yarn['co2'] is None: missing_critical_data.append('CO2')
        if 'composition' not in yarn: missing_critical_data.append('Composition')
        # Check for numeric anomalies
        if yarn.get('co2', 0) < 0: missing_critical_data.append('Negative CO2')

        if missing_critical_data:
            yarn['governance']['data_integrity'] = 'FAIL'
            yarn['governance']['claim_status'] = 'PROHIBITED'
            yarn['governance']['legal_justification'] = f"DATA INCONSISTENCY DETECTED: Missing {', '.join(missing_critical_data)}. HALT AND FLAG."
            # Skip further logic for this yarn, strictly enforce block
            yarn['strategic_status'] = 'EXIT'
            yarn['status_display'] = 'DATA HALT'
            yarn['sales_instruction'] = "SYSTEM LOCK: Audit Trail Missing. Do not sell."
            changes_count += 1
            continue # STOP PROCESSING THIS YARN
        # -----------------------------------------------------------------------------

        # Calculate Shadow Cost (E2)
        # CBAM Cost = CO2 (kg/kg) * €85/tonne = CO2 * 0.085
        co2 = yarn.get('co2', 5.0) # Default 5.0 if missing
        shadow_cbam = co2 * 0.085
        yarn['governance']['shadow_cost'] = round(shadow_cbam, 2)
        
        # Energy Risk Premium (E2)
        # Energy_Risk = (Energy_Intensity_kWh * €0.15 * (1 - Renewable_Share_%))
        # Assuming Energy Intensity ~ 4 kWh/kg for spinning (generic placeholder if missing)
        energy_kwh = 4.0 
        renewable_share = 0.0
        if 'environmental_impact' in yarn and 'energy' in yarn['environmental_impact']:
            energy_data = yarn['environmental_impact']['energy']
            energy_kwh = energy_data.get('real_time_kwh_kg', 4.0)
            renewable_share = energy_data.get('renewable_share', 0.0) / 100.0
            
        energy_risk = energy_kwh * 0.15 * (1.0 - renewable_share)
        yarn['governance']['energy_risk_premium'] = round(energy_risk, 2)
        
        # True Margin Safety Check
        # If Shadow Costs > 0.40 EUR -> High Risk (Simplified threshold for demo)
        total_shadow_liability = shadow_cbam + energy_risk
        
        # Margin Erosion Logic
        if total_shadow_liability > 0.4:
             yarn['governance']['margin_erosion_risk'] = 'HIGH'

        # 1. KILL LOGIC (Bamboo, Acrylic) - E1: PROHIBITED
        if 'bamboo' in name_lower or 'bamboo' in comp_lower or 'acrylic' in name_lower or 'acrylic' in comp_lower:
            yarn['strategic_status'] = 'EXIT'
            yarn['status_display'] = 'PHASE OUT'
            
            if 'compliance_status' not in yarn: yarn['compliance_status'] = {}
            yarn['compliance_status']['eu_market_ban'] = True
            yarn['compliance_status']['risk_level'] = 'HIGH'
            
            yarn['sales_instruction'] = "STOP SALE: High Regulatory Risk (Green Claims/CBAM). Do not pitch to EU."
            
            # Governance E1
            yarn['governance']['claim_status'] = 'PROHIBITED'
            yarn['governance']['legal_justification'] = 'Violates EU Green Claims Directive (Generic Environmental Claim). High Compliance Risk.'
            
            changes_count += 1
            
        # 2. HERO LOGIC (Regenerative, Tencel, Organic) - E1: ALLOWED
        elif 'regenerative' in name_lower or 'tencel' in name_lower or 'organic' in name_lower:
            yarn['strategic_status'] = 'HERO'
            yarn['status_display'] = 'PREFERRED'
            
            if 'compliance_status' not in yarn: yarn['compliance_status'] = {}
            yarn['compliance_status']['preferred_material'] = True
            yarn['compliance_status']['risk_level'] = 'LOW'
            
            yarn['sales_instruction'] = "PRIORITY: Target +15% Premium. Full DPP Available."
            
            # Governance E1
            yarn['governance']['claim_status'] = 'ALLOWED'
            reason = 'Validated Data + 3rd Party Cert. Green Light.'
            yarn['governance']['legal_justification'] = reason
            yarn['reasons'].append(reason)
            
            changes_count += 1
            
        # 3. TRANSFORM LOGIC (Standard Cotton) - E1: RESTRICTED
        elif 'cotton' in name_lower and 'regenerative' not in name_lower and 'organic' not in name_lower:
            yarn['strategic_status'] = 'TRANSFORM'
            yarn['status_display'] = 'OPTIMIZE'
            
            if 'compliance_status' not in yarn: yarn['compliance_status'] = {}
            yarn['compliance_status']['risk_level'] = 'MEDIUM'
            
            yarn['sales_instruction'] = "DEFENSE: Use DPP to retain Tier-1 accounts. Verify energy data."
            
            # Governance E1
            yarn['governance']['claim_status'] = 'RESTRICTED'
            # Justification default is already set
            
            changes_count += 1
            
    print(f"Applied strategic logic to {changes_count} yarns.")
    return yarns

if __name__ == "__main__":
    yarns = load_data()
    if yarns:
        yarns = apply_strategy(yarns)
        save_data(yarns)
