-- المشغّل التلقائي لإنشاء الملف الشخصي عند كل تسجيل جديد
-- (نُفّذ في الإنتاج 2026-07-20 — محفوظ هنا للتوثيق وإعادة الإنشاء عند الحاجة)
-- السبب: التسجيل الذاتي كان ينشئ حساب مصادقة بلا صف في user_profiles،
-- فيُحسب المستخدم «معطلاً» ويقع في حلقة تحويل. هذا المشغّل يسد الفجوة.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, email, full_name, role, is_active, subscription_tier)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'user'),
    true,
    'radar'
  )
  on conflict (id) do nothing;
  return new;
end
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ترميم أي حسابات سابقة بلا ملف (آمن للتكرار)
insert into public.user_profiles (id, email, full_name, role, is_active, subscription_tier)
select u.id, u.email, coalesce(u.raw_user_meta_data->>'full_name', ''), 'user', true, 'radar'
from auth.users u
left join public.user_profiles p on p.id = u.id
where p.id is null;
