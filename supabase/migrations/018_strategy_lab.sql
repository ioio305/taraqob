-- Durable private jobs. Existing application tables are unchanged.
create table if not exists public.strategy_lab_runs (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('pending','running','completed','failed','insufficient_data')),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lab_owner_matches_payload check (coalesce(payload->>'ownerId','') = owner_id::text),
  constraint lab_id_matches_payload check (coalesce(payload->>'id','') = id::text),
  constraint lab_status_matches_payload check (coalesce(payload->>'status','') = status),
  constraint lab_payload_size check (octet_length(payload::text) <= 262144)
);
create index if not exists strategy_lab_owner_created on public.strategy_lab_runs(owner_id, created_at desc);
create unique index if not exists strategy_lab_one_active on public.strategy_lab_runs(owner_id) where status in ('pending','running');
alter table public.strategy_lab_runs enable row level security;
revoke all on public.strategy_lab_runs from anon, authenticated;
grant select, insert on public.strategy_lab_runs to authenticated;
grant all on public.strategy_lab_runs to service_role;
drop policy if exists lab_read_own on public.strategy_lab_runs;
create policy lab_read_own on public.strategy_lab_runs for select to authenticated using (owner_id = auth.uid());
drop policy if exists lab_insert_own on public.strategy_lab_runs;
create policy lab_insert_own on public.strategy_lab_runs for insert to authenticated with check (
  owner_id = auth.uid() and status = 'pending' and (payload->>'results') is null
);
comment on table public.strategy_lab_runs is 'Owner-scoped research runs; only trusted worker may update results.';
