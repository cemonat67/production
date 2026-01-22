# MASTER PROMPT — OFFICE → GOVERNANCE SHOCK → BOARD SLIDE

Zero@Production OS (MASTER STANDARD)

ROLE

You are the Product Brain of Zero@Production OS.
Your task is to implement the Office DPP Board Scene as a mandatory executive outcome:
one click → one board narrative.

This is a master application. No customer-specific language.

⸻

1) DATA MODEL (REALISTIC, EXPLAINABLE, CONSERVATIVE)

Use realistic ranges and simple logic. Never show “Unknown”.

Required Inputs (all can be mocked but must be plausible)
• org_name (string)
• month (YYYY-MM)
• headcount_range (e.g., 180–220) → display midpoint only
• office_electricity_kwh (monthly)
• office_gas_kwh (optional; if none set 0)
• energy_unit_price_eur_per_kwh (blended)
• travel_policy_compliance_pct (0–100)
• exceptions_count (integer)
• lease_rigidity_score (0–100) where high = rigid

Derived KPIs (show these)
• office_co2_t
• office_cost_eur
• kwh_per_fte
• eur_per_fte
• governance_risk = OK / MONITOR / ACTION

Simple carbon logic (demo-safe)
• Electricity EF (grid average): 0.35 kgCO₂/kWh (explain as “grid blended factor”)
• Gas EF: 0.20 kgCO₂/kWh
• Travel “policy leak” cost: exception_count × avg_exception_cost (e.g., €420)
• Travel “policy leak” CO₂: exception_count × avg_exception_co2 (e.g., 32 kg)

No precision theater: round totals.

⸻

2) GOVERNANCE SHOCK MODE (MANDATORY)

If URL contains ?demo=office_governance_shock:

Apply shock
• Energy unit price +20%
• Travel compliance drops to 68%
• Exceptions increase (e.g., +12)
• Risk becomes ACTION
• Auto-toast: “Governance Shock Detected — Board Export suggested.”

The point is not the number — it’s the discipline.

⸻

3) BOARD SLIDE EXPORT (THE SCENE)

When user clicks Board Export OR in demo shock auto-suggest:

Generate a “Board Slide” view (modal or printable section) with exactly:

Header
• Organization, Month, Role
• “Office DPP — Organizational Carbon Discipline”

Board Summary (7 bullets max)
1. Total Office CO₂ (t) and Cost (€)
2. Cost per FTE (€)
3. Energy intensity (kWh/FTE)
4. Travel policy compliance (%) + exceptions count
5. Lease rigidity score (fixed exposure)
6. Risk status + why in one sentence
7. 90-day actions (3 bullets):
• “Rail-first enforcement + approval gate”
• “Off-peak contract / renegotiation check”
• “Governance cadence: monthly CFO review”

Footer (locked)

“Allocated at organizational level. Privacy-safe. Policy-driven. Audit-ready.”

Visual rule

No charts required on board slide.
Board wants: signal + action, not analytics.

⸻

4) EXECUTIVE LENS MEANING (SAME UI)

CFO lens:
• highlight € exposure, €/FTE, fixed vs flexible cost
• show “energy volatility risk” and “policy leak cost”

CEO lens:
• highlight “credibility & maturity”
• show “governance risk” and “reputation readiness”

HR lens (optional):
• highlight “policy compliance & behavior system (non-personal)”

Layout unchanged. Meaning changes.

⸻

5) DEMO LINKS (ONE-CLICK)

These must work:
• office-dpp.html?role=cfo
• office-dpp.html?role=ceo
• office-dpp.html?demo=office_governance_shock&role=cfo

In shock demo:
• open governance shock toast
• suggest Board Export
• optionally auto-open Board view after 900ms

⸻

6) LANGUAGE RULES (STRICT)

ALLOWED: Governance, Discipline, Exposure, Policy, Allocation
FORBIDDEN: Tracking individuals, Exact measurement, Monitoring people

Never say “we tracked employees”.

⸻

7) ACCEPTANCE CRITERIA (SHIP)

✅ No “Unknown” values
✅ Demo shock flips risk to ACTION
✅ Board export produces one clean slide with 7 bullets max
✅ All numbers can be defended in one sentence
✅ Works offline / iPad Safari / no-CDN

⸻

Closing line (locked)

“This is where sustainability becomes a management system — not a factory experiment.”
