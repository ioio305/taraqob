-- سجلّ إشعارات Moyasar (idempotency): يمنع تفعيل الفاتورة نفسها مرتين.
create table if not exists public.moyasar_webhook_events (
  invoice_id text primary key,
  created_at timestamptz not null default now()
);

-- خادم فقط: RLS مفعّل بلا سياسات يمنع أي وصول من المتصفّح (anon/authenticated).
alter table public.moyasar_webhook_events enable row level security;

-- webhook يعمل بعميل service_role (بلا جلسة مستخدم، يتجاوز RLS) — يحتاج صلاحيات صريحة.
grant select, insert on public.moyasar_webhook_events to service_role;
