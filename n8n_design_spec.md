# Zero@Ecosystem n8n Workflow Specifications

## Workflow 1: Compliance Override Request
**Trigger:** Webhook (POST) `/webhook/governance/override-request`

### Node Design
1.  **Webhook Node**: Receives payload.
2.  **Schema Validator (Code Node)**: Checks for `yarn_id`, `requester_role`, `violation_type`, `justification`.
3.  **RBAC Check (If/Else)**:
    *   Condition: `requester_role` == "CEO" OR `requester_role` == "BOARD"
    *   False: Return JSON `{ "status": "FORBIDDEN", "message": "Only Executive roles can request overrides." }`
4.  **Legal Ban Check (If/Else)**:
    *   Condition: `violation_type` == "LEGAL_BAN"
    *   True:
        *   **Supabase Insert**: Log `governance_events` (Event: ILLEGAL_ATTEMPT).
        *   **Return JSON**: `{ "status": "REJECTED_FATAL", "message": "Legal Bans cannot be overridden." }`
5.  **Supabase Insert**: Insert into `override_requests` (Status: PENDING). Return `request_id`.
6.  **Route Approver (Switch)**:
    *   `violation_type` = "MARGIN_RISK" -> Route to **CFO**
    *   `violation_type` = "DATA_INTEGRITY" -> Route to **CTO**
    *   Default -> Route to **CEO**
7.  **Notification (Slack/Email)**:
    *   Send message: "Override Request for Yarn {{yarn_id}}. Risk: {{violation_type}}. Justification: {{justification}}."
    *   Buttons/Links:
        *   Approve: `https://n8n.instance/webhook/governance/override-decide?id={{request_id}}&decision=APPROVED`
        *   Reject: `https://n8n.instance/webhook/governance/override-decide?id={{request_id}}&decision=REJECTED`
8.  **Wait for Webhook**: (Or separate workflow for decision callback). *Design decision: Use separate workflow for callback to avoid long-running processes.*
9.  **Return JSON**: `{ "status": "PENDING", "request_id": "{{request_id}}", "message": "Request sent to approver." }`

---

## Workflow 2: Evidence Pack Generator
**Trigger:** Webhook (POST) `/webhook/governance/generate-evidence-pack`

### Node Design
1.  **Webhook Node**: Receives `yarn_id`.
2.  **Supabase Select**:
    *   Fetch `yarns` where `id` = `yarn_id`.
    *   Fetch `governance_events` where `yarn_id` = `yarn_id`.
    *   Fetch `incidents` where `details->yarn_id` = `yarn_id`.
3.  **Data Aggregator (Code Node)**:
    *   Combine data into a single JSON object `product_snapshot`.
    *   Generate Markdown summary `governance_decision.md`.
4.  **PDF Generator (HTML to PDF)**:
    *   Convert `governance_decision.md` + HTML Template -> `governance_decision.pdf`.
5.  **Crypto Hasher (Code Node)**:
    *   Calculate SHA-256 for JSON and PDF.
    *   Create `manifest.json` containing hashes and timestamp.
    *   Calculate SHA-256 for `manifest.json`.
6.  **Compression (ZIP)**:
    *   Zip `product_snapshot.json`, `governance_decision.pdf`, `audit_trail.json`, `manifest.json`.
7.  **Supabase Storage Upload**:
    *   Upload ZIP to bucket `compliance-evidence`.
    *   File name: `Evidence_{{yarn_id}}_{{timestamp}}.zip`
8.  **Supabase Insert**:
    *   Insert into `audit_exports` with `file_url` and `file_hash`.
9.  **Return JSON**:
    *   `{ "url": "{{signed_url}}", "hash": "{{manifest_hash}}" }`

---

## Workflow 3: Self-Heal Incident Intake
**Trigger:** Webhook (POST) `/webhook/ops/incident`

### Node Design
1.  **Webhook Node**: Receives `type`, `details`, `timestamp`.
2.  **Deduplication Check (Supabase Select)**:
    *   Query `incidents` where `type` = `type` AND `status` = 'OPEN' AND `last_occurrence_at` > NOW() - 30m.
3.  **If Exists (If/Else)**:
    *   True:
        *   **Supabase Update**: Increment `occurrences`, update `last_occurrence_at`.
        *   **Return JSON**: `{ "status": "UPDATED", "message": "Incident count incremented." }`
    *   False:
        *   **Supabase Insert**: Create new row in `incidents` (Status: OPEN).
        *   **Supabase Insert**: Log to `governance_events` (Event: SYSTEM_INCIDENT).
        *   **Notify DevOps**: Send alert to Slack/PagerDuty.
        *   **Return JSON**: `{ "status": "CREATED", "incident_id": "{{id}}" }`
4.  **Auto-Remediation (Optional Branch)**:
    *   If payload `allow_remediate` is true:
        *   Execute remediation script (e.g., restart service via SSH/API).
        *   Log result to `incidents`.

---

## Workflow 3b: Incident Acknowledge
**Trigger:** Webhook (POST) `/webhook/ops/incident-ack`

### Node Design
1.  **Webhook Node**: Receives `incident_id` (or matches by context), `acked_by`.
2.  **Supabase Update**:
    *   Update `incidents` set `status` = 'ACKED'.
3.  **Supabase Insert**:
    *   Insert into `incident_acknowledgements`.
4.  **Return JSON**: `{ "status": "ACKNOWLEDGED" }`
