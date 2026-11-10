-- سجلّ إشعارات Moyasar (idempotency): يمنع تفعيل الفاتورة نفسها مرتين.
create table if not exists public.moyasar_webhook_events (
  invoice_id text primary key,
  created_at timestamptz not null default now()
);

-- webhook يعمل بعميل service_role (بلا جلسة مستخدم) — يحتاج صلاحيات صريحة.
grant select, insert on public.moyasar_webhook_events to service_role;
