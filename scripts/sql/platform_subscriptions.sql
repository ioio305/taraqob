-- ══════════════════════════════════════════════════════════════════════════
-- نموذج الاشتراك لكل منصة — المرحلة 1 (رؤية «3 منصات»)
-- ──────────────────────────────────────────────────────────────────────────
-- حساب/دخول واحد موحّد، واشتراك منفصل لكل منصة (spx · stocks · funds)،
-- ولكل منصة نفس الباقات الأربع (radar مجاني · signal · edge · alpha).
--
-- شغّل هذا الملف مرّة واحدة في: Supabase Dashboard → SQL Editor (مشروع ترقب).
-- آمن للإعادة (idempotent) ولا يحذف أي بيانات. يشمل ترحيل «grandfather»:
-- ينسخ باقة كل مستخدم الحالية إلى منصة spx كي لا يفقد أحد وصوله لحظة الإطلاق.
-- ══════════════════════════════════════════════════════════════════════════

-- ── 1) الجدول ──────────────────────────────────────────────────────────────
create table if not exists public.platform_subscriptions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  platform           text not null check (platform in ('spx','stocks','funds')),
  tier               text not null default 'radar' check (tier in ('radar','signal','edge','alpha')),
  status             text not null default 'active' check (status in ('active','canceled','past_due')),
  current_period_end timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (user_id, platform)
);

create index if not exists platform_subscriptions_user_idx
  on public.platform_subscriptions (user_id);

-- ── 2) ترحيل grandfather: باقة كل مستخدم الحالية → منصة spx ────────────────
--     أي باقة غير معروفة تُخفَّض إلى radar (مجاني) بأمان.
insert into public.platform_subscriptions (user_id, platform, tier)
select
  id,
  'spx',
  case when subscription_tier in ('radar','signal','edge','alpha')
       then subscription_tier else 'radar' end
from public.user_profiles
on conflict (user_id, platform) do nothing;

-- ── 3) الصلاحيات (وإلا 42501 على service_role) + RLS ──────────────────────
alter table public.platform_subscriptions enable row level security;

grant select, insert, update, delete on public.platform_subscriptions to service_role;
grant select on public.platform_subscriptions to authenticated;

-- المستخدم يقرأ صفوفه فقط
drop policy if exists "read own platform subs" on public.platform_subscriptions;
create policy "read own platform subs" on public.platform_subscriptions
  for select using (auth.uid() = user_id);

-- service_role يدير كل الصفوف (الفوترة/الويب هوك لاحقاً)
drop policy if exists "service manages platform subs" on public.platform_subscriptions;
create policy "service manages platform subs" on public.platform_subscriptions
  for all to service_role using (true) with check (true);

-- ── تحقّق سريع (اختياري) ───────────────────────────────────────────────────
-- select platform, tier, count(*) from public.platform_subscriptions
--   group by platform, tier order by platform, tier;
