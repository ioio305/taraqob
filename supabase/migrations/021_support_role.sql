-- المرحلة ٢ (فصل السوقين): أدوار الفريق — المالك (admin) · مشرف عام (moderator) · دعم فني (support).
-- واجهات الإدارة تتحقق من الصلاحية في الخادم ثم تقرأ بعميل الخدمة، فلا حاجة لسياسات RLS
-- جديدة لدور الدعم الفني (لا يحصل على أي قراءة مباشرة من المتصفح).
alter type public.user_role add value if not exists 'moderator';
alter type public.user_role add value if not exists 'support';

-- سجل الحركات يُكتب بعميل الخدمة (دخول/تبديل سوق/دفع/إجراءات الفريق).
grant select, insert on public.audit_logs to service_role;
create index if not exists idx_audit_logs_action on public.audit_logs(action, created_at desc);
