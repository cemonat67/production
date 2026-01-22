-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ============ 1) Core: Yarns ============
create table if not exists public.yarns (
  id uuid primary key default gen_random_uuid(),
  yarn_id text not null unique,            -- e.g. "UGR-001"
  name text not null,
  dpp_id text,                             -- DPP ID
  composition jsonb not null default '{}'::jsonb,  -- {"cotton":80,"poly":20}
  co2_impact numeric not null check (co2_impact >= 0),
  energy_intensity numeric,                -- optional
  renewable_share numeric default 0 check (renewable_share >= 0 and renewable_share <= 1),
  governance_status text not null default 'TRANSFORM'
    check (governance_status in ('EXIT','HERO','TRANSFORM')),
  claim_status text not null default 'ALLOWED'
    check (claim_status in ('ALLOWED','RESTRICTED','PROHIBITED')),
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_yarns_active on public.yarns(is_active);
create index if not exists idx_yarns_governance on public.yarns(governance_status);
create index if not exists idx_yarns_claim on public.yarns(claim_status);
create index if not exists idx_yarns_comp_gin on public.yarns using gin (composition);

-- ============ 2) Immutable Audit Ledger ============
create table if not exists public.governance_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,                -- OVERRIDE_REQUEST, OVERRIDE_DECISION, INCIDENT, EXPORT, DATA_FAIL...
  actor_role text not null,                -- CEO/CFO/CTO/REGULATOR/SYSTEM
  actor_id text,
  yarn_id text,                            -- optional
  details jsonb not null default '{}'::jsonb,
  event_hash text,                         -- tamper-evidence hash (optional)
  created_at timestamptz not null default now()
);

create index if not exists idx_gov_events_time on public.governance_events(created_at desc);
create index if not exists idx_gov_events_yarn on public.governance_events(yarn_id);
create index if not exists idx_gov_events_type on public.governance_events(event_type);

-- Prevent UPDATE/DELETE at DB level (immutable)
create or replace function public.block_mutations_on_governance_events()
returns trigger language plpgsql as $$
begin
  raise exception 'governance_events is append-only (no UPDATE/DELETE)';
end;
$$;

drop trigger if exists trg_block_update_gov_events on public.governance_events;
create trigger trg_block_update_gov_events
before update or delete on public.governance_events
for each row execute function public.block_mutations_on_governance_events();

-- ============ 3) Override Requests (State machine) ============
create table if not exists public.override_requests (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null,                -- from client, can be used for idempotency
  yarn_id text not null references public.yarns(yarn_id),
  requester_role text not null,            -- CEO
  requester_id text,
  violation_type text not null,            -- MARGIN_RISK, DATA_INTEGRITY, LEGAL_BAN
  current_value numeric,
  threshold numeric,
  justification text,
  status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')),
  approver_role text,                      -- CFO/CTO
  approver_id text,
  decision_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create unique index if not exists uq_override_request_id on public.override_requests(request_id);
create index if not exists idx_override_status on public.override_requests(status, created_at desc);
create index if not exists idx_override_yarn on public.override_requests(yarn_id);

-- ============ 4) Evidence Exports ============
create table if not exists public.audit_exports (
  id uuid primary key default gen_random_uuid(),
  yarn_id text not null references public.yarns(yarn_id),
  file_url text not null,
  file_hash text not null,                 -- hash of zip
  manifest_hash text,                      -- hash of manifest.sha256
  generated_by text,
  created_at timestamptz not null default now()
);

create index if not exists idx_exports_yarn_time on public.audit_exports(yarn_id, created_at desc);

-- ============ 5) System Health ============
create table if not exists public.system_health (
  component text primary key,              -- SYNAPSE_API, DATA_INTEGRITY, N8N, STORAGE...
  status text not null default 'HEALTHY' check (status in ('HEALTHY','DEGRADED','DOWN')),
  last_check timestamptz,
  incident_id uuid
);

-- ============ 6) Incidents (Ops) ============
create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,                -- SEV1_SYNAPSE_DOWN, etc.
  severity int not null default 3,         -- 1=Critical, 2=High, 3=Medium
  status text not null default 'OPEN' check (status in ('OPEN','ACKED','RESOLVED')),
  details jsonb not null default '{}'::jsonb,
  counter int not null default 1,          -- dedupe counter
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_incidents_status on public.incidents(status);
create index if not exists idx_incidents_type on public.incidents(event_type);

-- ============ 7) Incident Acks ============
create table if not exists public.incident_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id),
  actor_role text not null,
  actor_id text,
  note text,
  created_at timestamptz not null default now()
);

-- ============ 8) Storage Bucket (Optional/Enterprise) ============
-- Note: Requires storage schema to be active
insert into storage.buckets (id, name, public) 
values ('compliance-evidence', 'compliance-evidence', true) 
on conflict (id) do nothing;

-- Allow public access to evidence (for demo download)
create policy "Public Evidence Access" 
on storage.objects for select 
using ( bucket_id = 'compliance-evidence' );

-- Allow authenticated (service role) to insert
create policy "Service Upload Evidence" 
on storage.objects for insert 
with check ( bucket_id = 'compliance-evidence' );
