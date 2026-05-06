الملفات المتغيرة فقط — انسخ كل ملف لمساره:

1. src/middleware.ts
   ← يستبدل src/middleware.ts الموجود

2. src/app/auth/callback/route.ts
   ← يستبدل src/app/auth/callback/route.ts الموجود
   التغيير: beta_user بعد login يذهب لـ /v2 بدلاً من /dashboard

ملاحظة:
- src/app/page.tsx لا تلمسه — يبقى كما هو (landing page القديمة)
- النظام القديم /dashboard يبقى يعمل بدون تغيير
- /v2 يعمل لجميع المستخدمين المسجلين
