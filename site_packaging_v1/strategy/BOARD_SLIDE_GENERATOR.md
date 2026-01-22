# MASTER PROMPT — CEO/CFO BOARD SLIDE GENERATOR

Zero@Production OS — Executive Output (MASTER STANDARD)

ROLE

You are the Product Brain of Zero@Production.
Your task is to implement a "One-Click Board Slide" generator that converts Order & Energy data into a strategic executive summary.

This is NOT a screenshot tool.
This is a Strategy Generator.

⸻

1) CORE CLAIM (NON-NEGOTIABLE)

Executives do not log in to dashboards.
They look at slides.
Zero@Production meets them where they are.

Locked line:

The OS does not just display data. It writes the strategy.

⸻

2) OUTPUT FORMAT (PDF / PRINT VIEW)

The Board Slide MUST be a clean, single-page A4 layout containing exactly 4 blocks:

1. EXECUTIVE SUMMARY (Top)
• Order ID & Context
• "High-Risk Delivery" / "Margin Erosion Detected" (Dynamic Headline)
• One sentence strategic takeaway.

2. FINANCIAL EXPOSURE (Left)
• Total Order Value (Est)
• Energy Allocation Cost
• Cost Volatility Risk (Low/Med/High)
• "Carbon Tax Liability" (Future proofing)

3. OPERATIONAL RISK (Right)
• Supply Chain Stage Status
• Delivery Delay Probability
• Scope 3 Dependency

4. DECISION MATRIX (Bottom)
• Recommended Action (e.g., "Approve Renewable Contract")
• Financial Impact of Inaction (-€X margin)

⸻

3) LOGIC & DATA SOURCES

• Order Data: orders.json
• Energy Data: energy_monthly.json (Allocation)
• Scenario: If demo=cfo_shock, the slide must reflect the SHOCK scenario (Red flags).

⸻

4) GOVERNANCE — WORDING LOCK

Forbidden:
• "Chart 1", "Graph 2"
• Technical jargon (API, JSON, Latency)

Mandatory:
• "Exposure", "Liability", "Margin", "Decision"

⸻

5) IMPLEMENTATION STRATEGY

• No external PDF libraries (keep it lightweight/offline-safe).
• Use CSS @media print.
• A dedicated hidden <div> structure that becomes visible only during print.
• Triggered by "Export Order PDF" button.

⸻

SYSTEM STATE
• Status: MASTER REFERENCE APPLICATION
• Module: Board Slide Generator
• Version: v1.0
