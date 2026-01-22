# PHASE E — Governance & Control Operating Layer

## E1 — LEGAL & CLAIM ENFORCEMENT LAYER

Sustainability and material claims are no longer marketing features; they are compliance data objects governed by the EU Green Claims Directive and ESPR.

### Classification & Enforcement Logic

*   **ALLOWED:**
    *   **Definition:** Full Digital Product Passport (DPP) data available + 3rd Party Certification (GOTS, GRS, etc.) + Low Risk Material.
    *   **System Action:** **Green Light.** Sales enabled. Premium pricing unlocked.
*   **RESTRICTED:**
    *   **Definition:** Self-declared data only or partial traceability. High-risk material (Conventional Cotton) without batch-level proof.
    *   **System Action:** **Yellow Warning.** Sales allowed only with mandatory "Data Disclaimer" attached to the invoice. "Eco" keywords disabled in pitch deck generation.
*   **PROHIBITED:**
    *   **Definition:** Generic environmental claims (e.g., "Eco-Friendly Bamboo") without LCA backing. Materials on the corporate "Phase-Out" list.
    *   **System Action:** **Red Lock.** UI blocks access to product details. Sales order entry disabled.

### JSON Enforcement Schema
```json
"governance": {
  "claim_status": "PROHIBITED",
  "legal_blocking_code": "GCD_ART_3_GENERIC_CLAIM",
  "ui_action": "LOCK_MODAL",
  "override_required": true
}
```

**Governance Principle:** If the data cannot defend the claim in an EU court, the system will not allow the sale.

---

## E2 — CFO SHADOW COST ENGINE

Hidden liabilities (Carbon Taxes, Energy Volatility) must be visible in the margin calculation *before* a price is quoted.

### Shadow Cost Logic

1.  **CBAM Liability (Shadow Tax):**
    *   `Shadow_CBAM_Cost (€/kg) = (Product_CO2_kg * €85/tonne_Carbon) / 1000`
2.  **Energy Risk Premium:**
    *   `Energy_Risk (€/kg) = (Energy_Intensity_kWh * €0.15 * (1 - Renewable_Share_%))`
3.  **True Margin Safety:**
    *   `True_Margin = Gross_Margin - (Shadow_CBAM_Cost + Energy_Risk)`

### Financial Thresholds & Rules

*   **Safety Rule:** If `True_Margin` < 15%, the system **BLOCKS** all discretionary discounting.
*   **CFO Alert:** "WARNING: Proposed price yields negative True Margin due to €0.45/kg latent carbon liability."

**Key Principle:** Hidden cost is not profit.

---

## E3 — FIRST 90 DAYS EXECUTION CHECKPOINT

Execution is measured by binary outcomes, not activity reports.

### The 3 Governance KPIs

| KPI | Target | RED Condition (Failure) |
| :--- | :--- | :--- |
| **1. EU Export Compliance** | > 80% Vol | < 50% of EU shipments have full DPP |
| **2. Hero Product Mix** | > 30% Rev | < 15% Revenue from Hero/Allowed SKUs |
| **3. Energy Data Coverage** | 100% Batches | < 80% Real-time data availability |

### Traffic Light Logic
*   **GREEN:** Continue acceleration.
*   **YELLOW:** Weekly "War Room" required.
*   **RED:** **Automatic Budget Freeze.** Non-essential CAPEX paused. Strategy Review Board convened immediately.

---

## E4 — SYNAPSE AUDIT & OVERRIDE LOG

We assume standard operations will fail or be challenged. Every deviation must be recorded.

### Override Definitions
*   Unlocking a **PROHIBITED** SKU for a specific client.
*   Pricing below the **True Margin** safety threshold.
*   Shipping to EU without a compliant DPP.

### Audit Mechanism
*   **No Silent Exceptions:** The UI does not allow "ignoring" a warning. The user must click "Request Override" and select a reason.
*   **Board Visibility:** Monthly "Governance Exception Report" is auto-generated and sent to the Audit Committee, listing top violators by User ID and Revenue at Risk.

### Event Log Schema
```json
{
  "event_type": "COMPLIANCE_OVERRIDE",
  "user_id": "SALES_REP_04",
  "timestamp": "2024-10-24T14:30:00Z",
  "sku_id": "UG-BAMBOO-01",
  "reason_code": "CLIENT_CONTRACT_LEGACY",
  "risk_value_eur": 4500.00,
  "approver": "VP_SALES"
}
```

**Governance Rule:** You can break the rules, but you cannot hide the evidence.

---

## FAILURE SCENARIO

**What happens if Phase E is NOT implemented?**

*   **Legal:** The company will face fines up to 4% of annual turnover under the Green Claims Directive for "Generic Claims" made by unsupervised sales staff.
*   **Financial:** The CFO will report "profits" that are actually future CBAM tax debts, leading to a sudden liquidity crisis when the tax bill arrives.
*   **Strategic:** The pivot will fail. The organization will revert to selling high-volume, low-margin toxic assets because it is "easier," destroying the brand's future value.

---

## BOARD CONCLUSION

Phase E is not a request for resources; it is the **condition of employment** for the capital entrusted to this management team.
