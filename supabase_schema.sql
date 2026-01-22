-- Zero@Ecosystem Supabase Schema
-- Target: Postgres 15+ (Supabase)

-- 1. ENABLE EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. YARNS TABLE (Master Data)
CREATE TABLE IF NOT EXISTS yarns (
    id TEXT PRIMARY KEY, -- e.g. UG-001
    name TEXT NOT NULL,
    category TEXT,
    composition TEXT,
    co2_kg NUMERIC(10, 2),
    score INTEGER,
    strategic_status TEXT DEFAULT 'RESTRICTED', -- EXIT, HERO, TRANSFORM, RESTRICTED
    dpp_id TEXT UNIQUE,
    batch_info JSONB, -- Stores lot, date, machine info
    environmental_impact JSONB, -- Stores energy, water, etc.
    governance_data JSONB, -- Stores claim_status, legal_justification
    raw_json JSONB, -- Full original JSON for backup
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookup
CREATE INDEX idx_yarns_strategic_status ON yarns(strategic_status);
CREATE INDEX idx_yarns_co2 ON yarns(co2_kg);

-- 3. GOVERNANCE EVENTS (Immutable Audit Ledger)
CREATE TABLE IF NOT EXISTS governance_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type TEXT NOT NULL, -- OVERRIDE_REQUEST, OVERRIDE_APPROVED, INCIDENT_ACK, etc.
    actor_role TEXT NOT NULL, -- CEO, CFO, CTO, SYSTEM
    actor_id TEXT, -- Optional User ID
    yarn_id TEXT REFERENCES yarns(id),
    rule_id TEXT,
    reason TEXT,
    details JSONB, -- Context, payload snapshot
    client_timestamp TIMESTAMPTZ,
    server_timestamp TIMESTAMPTZ DEFAULT NOW(),
    event_hash TEXT, -- Client-side or Server-side hash
    prev_hash TEXT -- Blockchain-style linking (optional implementation)
);

-- Prevent Updates/Deletes (Immutability)
CREATE RULE no_update_governance_events AS ON UPDATE TO governance_events DO INSTEAD NOTHING;
CREATE RULE no_delete_governance_events AS ON DELETE TO governance_events DO INSTEAD NOTHING;

-- 4. OVERRIDE REQUESTS (State Machine)
CREATE TABLE IF NOT EXISTS override_requests (
    request_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    yarn_id TEXT REFERENCES yarns(id),
    requester_role TEXT NOT NULL,
    violation_type TEXT NOT NULL, -- MARGIN_RISK, DATA_INTEGRITY
    current_value TEXT,
    threshold TEXT,
    justification TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    approver_role TEXT, -- Target approver (CFO, CTO)
    decision_by TEXT, -- Actual approver
    decision_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. AUDIT EXPORTS (Evidence Packs)
CREATE TABLE IF NOT EXISTS audit_exports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    yarn_id TEXT REFERENCES yarns(id),
    requested_by TEXT,
    file_url TEXT NOT NULL, -- Supabase Storage URL
    file_hash TEXT NOT NULL, -- SHA256
    manifest_hash TEXT,
    content_summary JSONB, -- What's inside
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. INCIDENTS (Ops)
CREATE TABLE IF NOT EXISTS incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL, -- SEV1_SYNAPSE_DOWN, SEV2_DATA_INTEGRITY
    status TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ACKED', 'RESOLVED')),
    details JSONB,
    dedupe_key TEXT, -- Hash of type + critical details to prevent spam
    occurrences INTEGER DEFAULT 1,
    last_occurrence_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- 7. INCIDENT ACKNOWLEDGEMENTS
CREATE TABLE IF NOT EXISTS incident_acknowledgements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    incident_id UUID REFERENCES incidents(id),
    acked_by TEXT NOT NULL, -- OPERATOR, SYSTEM
    acked_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT
);

-- 8. SYSTEM HEALTH
CREATE TABLE IF NOT EXISTS system_health (
    id SERIAL PRIMARY KEY,
    component TEXT UNIQUE NOT NULL, -- API, DB, WORKER
    status TEXT NOT NULL, -- ONLINE, DEGRADED, OFFLINE
    last_check_at TIMESTAMPTZ DEFAULT NOW(),
    metrics JSONB
);

-- 9. DATA INTEGRITY VIEW (For easy monitoring)
CREATE OR REPLACE VIEW view_data_integrity_issues AS
SELECT 
    id, 
    name, 
    co2_kg, 
    composition,
    CASE 
        WHEN co2_kg IS NULL OR co2_kg <= 0 THEN 'MISSING_CO2'
        WHEN composition IS NULL OR composition = '' THEN 'MISSING_COMPOSITION'
        ELSE 'OK'
    END as integrity_status
FROM yarns
WHERE co2_kg IS NULL OR co2_kg <= 0 OR composition IS NULL OR composition = '';

-- MIGRATION HELPER (JSON Import Logic)
-- In a real scenario, you would run a script to read the JSON and INSERT here.
-- This is a placeholder for the logic.
/*
INSERT INTO yarns (id, name, category, composition, co2_kg, score, strategic_status, dpp_id, batch_info, environmental_impact, governance_data, raw_json)
VALUES (
    'UG-001', 'Organic Cotton', 'Cotton Yarns', 'Organic Cotton', 3.8, 85, 'HERO', 'DPP-UG-001...', 
    '{"batch_id":...}', '{"energy":...}', '{"claim_status":...}', '{...}'
);
*/
