-- المرحلة ٢ (فصل السوقين): أدوار الفريق — المالك (admin) · مشرف عام (moderator) · دعم فني (support).
-- واجهات الإدارة تتحقق من الصلاحية في الخادم ثم تقرأ بعميل الخدمة، فلا حاجة لسياسات RLS
-- جديدة لدور الدعم الفني (لا يحصل على أي قراءة مباشرة من المتصفح).
alter type public.user_role add value if not exists 'moderator';
alter type public.user_role add value if not exists 'support';

-- سجل الحركات: لم يكن موجوداً على الإنتاج (كانت كتابات السجل تفشل بصمت).
-- actor_id بلا مفتاح أجنبي عمداً: حذف حساب لا يجوز أن يتعطّل بسبب سجل لا يُعدَّل.
create table if not exists public.audit_logs (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid,
  actor_email  text,
  action       text not null,
  entity_type  text not null,
  entity_id    uuid,
  entity_ref   text,
  old_values   jsonb,
  new_values   jsonb,
  ip_address   text,
  user_agent   text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_audit_logs_entity  on public.audit_logs(entity_type, entity_id);
create index if not exists idx_audit_logs_actor   on public.audit_logs(actor_id);
create index if not exists idx_audit_logs_created on public.audit_logs(created_at desc);
create index if not exists idx_audit_logs_action  on public.audit_logs(action, created_at desc);

-- سجل للإضافة فقط: لا تعديل ولا حذف.
create or replace function public.prevent_audit_modification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'سجلات المراجعة غير قابلة للتعديل أو الحذف';
end;
$$;

drop trigger if exists no_update_audit on public.audit_logs;
create trigger no_update_audit before update on public.audit_logs
  for each row execute function public.prevent_audit_modification();
drop trigger if exists no_delete_audit on public.audit_logs;
create trigger no_delete_audit before delete on public.audit_logs
  for each row execute function public.prevent_audit_modification();

-- خادم فقط: RLS مفعّل بلا سياسات يمنع أي وصول من المتصفح؛ الكتابة والقراءة بعميل الخدمة.
alter table public.audit_logs enable row level security;
revoke all on public.audit_logs from anon, authenticated;
grant select, insert on public.audit_logs to service_role;
