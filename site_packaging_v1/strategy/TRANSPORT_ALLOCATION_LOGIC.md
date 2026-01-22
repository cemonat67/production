🧠 TRANSPORT ALLOCATION STRATEGY — Zero@Production OS

DATE: 2025-12-26
STATUS: MASTER STANDARD
SCOPE: Employee Transport CO₂ Attribution Logic

⸻

1️⃣ THE CORE PHILOSOPHY
"Employee Transport is a Shared Organizational Footprint."

We do NOT track which employee worked on which order.
We DO track the total facility transport impact and allocate it fairly to production output.

This approach is:
• Privacy-safe (No individual tracking)
• Audit-defensible (Standard allocation method)
• Scalable (Works for 100 or 10,000 employees)

⸻

2️⃣ THE ALLOCATION FORMULA (The Engine)

Formula:
[ Facility Transport CO₂ (Monthly) ] ÷ [ Total Production Output (kg) ] = [ Transport CO₂ Intensity Factor (kgCO₂e / kg_product) ]

Application to Order:
[ Order Weight (kg) ] × [ Transport CO₂ Intensity Factor ] = [ Order Transport Footprint ]

Example Calculation:
• Facility Transport CO₂ (Dec): 100,000 kg CO₂
• Total Production (Dec): 500,000 kg
• Intensity Factor: 0.2 kg CO₂ / kg product

• Order #123 (1,000 kg T-Shirts):
• 1,000 kg × 0.2 = 200 kg CO₂ (Employee Transport Share)

⸻

3️⃣ UI WORDING STANDARD

Where to show it:
1. Order Delivery DPP (Breakdown Section)
   Label: "Employee Transport Contribution"
   Value: "+200 kg CO₂"
   Subtext: "Allocated based on facility shared footprint (Scope 3.7)"

2. Product Passport (LCA Breakdown)
   Row: "Organizational Transport"
   Value: "0.2 kg CO₂e / unit"
   Context: "Commuting & Shuttles"

⸻

4️⃣ AUDIT DEFENSE STATEMENT (The Shield)

"Zero@Production utilizes a 'Mass Allocation Method' for Scope 3 Category 7 (Employee Commuting). Instead of invasive individual tracking, we calculate the total facility transport footprint based on modal split and distance, then allocate it to production output by weight. This aligns with GHG Protocol allocation principles for shared organizational activities and ensures GDPR compliance while maintaining data materiality."

⸻

5️⃣ IMPLEMENTATION RULES

• Input: Facility Manager inputs baseline once per quarter (Headcount, Modal Split, Avg Dist).
• System: Automatically updates the "Intensity Factor".
• Output: Every new order inherits the current factor automatically.

This transforms "HR Data" into "Product Data" without friction.
