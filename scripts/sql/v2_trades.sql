-- ترقية دفتر الصفقات للمزامنة السحابية (اختياري — الدفتر يعمل محلياً بدونها)
-- شغّل هذا في Supabase SQL Editor ثم اطلب تبديل طبقة التخزين في src/lib/v2/journal.ts
create table if not exists public.v2_trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contract_type text not null check (contract_type in ('call','put')),
  strike numeric not null,
  expiry date,
  qty int not null default 1 check (qty > 0),
  entry_price numeric not null check (entry_price >= 0),
  exit_price numeric,
  pnl_total numeric,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists v2_trades_user_idx on public.v2_trades (user_id, opened_at desc);

alter table public.v2_trades enable row level security;

drop policy if exists "own trades select" on public.v2_trades;
create policy "own trades select" on public.v2_trades for select using (auth.uid() = user_id);
drop policy if exists "own trades insert" on public.v2_trades;
create policy "own trades insert" on public.v2_trades for insert with check (auth.uid() = user_id);
drop policy if exists "own trades update" on public.v2_trades;
create policy "own trades update" on public.v2_trades for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "own trades delete" on public.v2_trades;
create policy "own trades delete" on public.v2_trades for delete using (auth.uid() = user_id);
