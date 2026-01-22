# MASTER PROMPT — CFO SHOCK (Energy Allocation → Order Delivery)

Zero@Production OS — Decision Layer Narrative (MASTER STANDARD)

ROLE

You are the Product Brain of Zero@Production.
Your task is to implement a CFO-first shock narrative inside Order Delivery DPP, driven by Energy Allocation data.

This is not a “feature”.
This is a decision scene.

⸻

1) CORE CLAIM (NON-NEGOTIABLE)

Energy Allocation proves CFO risk without IoT.
From one monthly bill + production output + order weight, the OS quantifies:
• Order-level energy CO₂ exposure
• Order-level energy cost exposure
• Sensitivity to price shock

Locked line:

Orders don’t consume energy — organizations do. The OS allocates responsibility and exposure.

⸻

2) REQUIRED UI STRUCTURE (ORDER DELIVERY DPP)

The CFO scene MUST render in this order:

1. Executive KPIs (Top Row)
• Order CO₂ (kg)
• Order Cost (€)
• Risk Pill: OK / MONITOR / ACTION

2. Decision Layer
• 💶 Show € Impact
• 📄 Export Order PDF
• ✉️ Email Supplier
• 🚩 Flag Delivery Risk

3. Energy Allocation Card (NEW)
Shows:
• Energy CO₂ for this order (kg)
• Energy Cost for this order (€)
• Intensity: kgCO₂/kg
• Cost intensity: €/kg

And the locked disclaimer:

Allocation based on facility energy consumption normalized by production output. Privacy-safe. Audit-ready.

4. Insight Panel (So What?)
Short 3-line structure:
• Observation
• Root cause
• Recommendation

No decorative charts.

⸻

3) DATA INPUTS (MINIMUM)

From facility monthly energy context:
• facility_energy_mwh
• facility_energy_cost_eur
• grid_emission_factor_kg_per_kwh (default 0.5)
• facility_output_kg

From order:
• order_id
• order_weight_kg
• month
• facility

If missing → conservative fallback (never “Unknown”).

⸻

4) ALLOCATION FORMULAS (LOCKED)

Compute facility totals:

CO₂_total_kg
= MWh × 1000 × grid_factor(kg/kWh)

CO₂_per_kg
= CO₂_total_kg / output_kg

Cost_per_kg
= cost_eur / output_kg

Allocate to order:

Order_Energy_CO₂_kg
= order_weight_kg × CO₂_per_kg

Order_Energy_Cost_€
= order_weight_kg × Cost_per_kg

⸻

5) CFO SHOCK MODE (MANDATORY DEMO)

The scene MUST support:

URL trigger
delivery-dpp.html?demo=cfo_shock&order_id=PO-UGR-10492&role=cfo

Behavior
When demo=cfo_shock:
1. Simulate energy price shock +25%
2. Recalculate Order_Energy_Cost_€
3. Risk Pill flips:
• If cost increase > €4,000 → ACTION
• Else if > €2,000 → MONITOR
• Else OK
4. Auto-open € Impact modal

⸻

6) € IMPACT MODAL (CFO LENS)

Modal MUST show 4 blocks:
1. Before vs After (€)
• Baseline energy cost
• Shock energy cost
• Delta (€)

2. Margin Pressure
• Delta as % of order value (use conservative assumed order value)
• One sentence: “This is why CFO cares.”

3. Mitigation Options (3 buttons)
• Shift production off-peak
• Negotiate energy clause with supplier
• Contract renewable mix (Scope 2 strategy)

4. Board-line Summary (copy button)
One line CFO can paste:
“Energy price volatility adds €X risk to this order via normalized allocation (Scope 2).”

Use “allocated / normalized” wording only.

⸻

7) ACTION FEEDBACK (NO ALERTS)

No alert().
Use toast notifications only:
• “€ impact view opened — energy price shock applied.”
• “Risk flagged — procurement notified.”
• “Email draft opened for supplier follow-up.”

⸻

8) GOVERNANCE — WORDING LOCK

Forbidden words:
• exact, measured, tracked, real-time

Mandatory words:
• allocated, normalized, shared footprint

⸻

9) DONE CRITERIA (ACCEPTANCE TEST)

CFO Shock is accepted when:
✅ Opening the link auto-opens € Impact
✅ Energy Allocation card shows CO₂ + cost + intensities
✅ Risk pill changes with shock
✅ PDF export includes the order context header
✅ No Unknown values appear

⸻

SYSTEM STATE
• Status: MASTER REFERENCE APPLICATION
• Module: Order Delivery DPP (Energy Allocation → CFO Shock)
• Version: v1.0
• Change policy: Governance-only
