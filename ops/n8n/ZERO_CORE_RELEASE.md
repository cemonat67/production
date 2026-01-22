# Zero@Core Governance & Ops v1.0

Status: Production Ready

Scope:
- Incident Management
- Governance Override
- Evidence Generation

ML-Ready: YES

Workflows:
- Ops - Incident Intake
- Ops - Incident Ack
- Governance - Override Request
- Governance - Override Approve
- Governance - Evidence Generator

Interfaces:
- Public Webhooks (via Caddy Proxy)
- Internal Governance Flows

Runtime:
- n8n (Docker)
- Caddy Reverse Proxy
- SQLite (n8n internal DB)

Deployment State:
- Activated
- Webhooks validated
- Proxy routing verified

Date: $(date)
Owner: Zero@Ecosystem
