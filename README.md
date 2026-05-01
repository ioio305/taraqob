# ترقّب — Taraqob Platform

منصة دعم قرار لعقود SPX Options | Beta مغلق

## متطلبات التشغيل

- Node.js 18+
- حساب Supabase
- حساب Vercel
- مفتاح Anthropic API

---

## خطوات التثبيت

### 1. استنساخ المشروع

```bash
git clone https://github.com/your-username/taraqob.git
cd taraqob
npm install
```

### 2. إنشاء مشروع Supabase

1. اذهب إلى [supabase.com](https://supabase.com)
2. أنشئ مشروع جديد باسم `taraqob-beta`
3. انتظر حتى يكتمل الإعداد

### 3. تشغيل قاعدة البيانات

في لوحة Supabase → SQL Editor، شغّل الملفات بالترتيب:

```sql
-- 1. Schema الكامل
-- انسخ محتوى: supabase/migrations/001_schema.sql

-- 2. سياسات RLS
-- انسخ محتوى: supabase/migrations/002_rls.sql

-- 3. البيانات الأولية
-- انسخ محتوى: supabase/migrations/003_seed.sql
```

### 4. إعداد متغيرات البيئة

```bash
cp .env.example .env.local
```

افتح `.env.local` وأدخل:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

مصدر البيانات: Supabase → Settings → API

### 5. إعداد Supabase Auth

في Supabase → Authentication → URL Configuration:
- Site URL: `http://localhost:3000`
- Redirect URLs: `http://localhost:3000/auth/callback`

### 6. إنشاء حساب Admin

في Supabase → Authentication → Users → Create user:
- أدخل بريدك وكلمة مرور
- في SQL Editor:

```sql
UPDATE user_profiles
SET role = 'admin', full_name_ar = 'اسمك'
WHERE email = 'your@email.com';
```

### 7. تشغيل المشروع

```bash
npm run dev
```

افتح: http://localhost:3000

---

## النشر على Vercel

### 1. رفع الكود على GitHub

```bash
git init
git add .
git commit -m "Initial Taraqob Beta"
git remote add origin https://github.com/your-username/taraqob.git
git push -u origin main
```

### 2. إنشاء مشروع Vercel

1. اذهب إلى [vercel.com](https://vercel.com)
2. New Project → Import من GitHub
3. اختر مستودع taraqob
4. Framework: Next.js (تلقائي)

### 3. إعداد متغيرات البيئة في Vercel

في Settings → Environment Variables أضف:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
NEXT_PUBLIC_APP_URL=https://taraqob.vercel.app
```

### 4. تحديث Supabase Redirect URLs

في Supabase → Authentication → URL Configuration:
أضف: `https://taraqob.vercel.app/auth/callback`

### 5. Deploy

Vercel سينشر تلقائيًا عند كل push لـ main

---

## هيكل المشروع

```
src/
├── app/
│   ├── page.tsx              → Landing Page
│   ├── login/                → صفحة الدخول
│   ├── admin/                → لوحة تحكم Admin
│   │   ├── sessions/         → جلسات السوق
│   │   ├── signals/          → الإشارات (composer, review, detail)
│   │   ├── contracts/        → قائمة العقود
│   │   ├── performance/      → سجل الأداء
│   │   ├── audit/            → Audit Trail
│   │   └── users/            → إدارة المستخدمين
│   ├── analyst/              → مساحة عمل المحلل
│   ├── dashboard/            → لوحة Beta User
│   ├── api/                  → API Routes
│   └── compliance/           → صفحة الإفصاح
├── components/
│   ├── ui/                   → مكونات مشتركة
│   ├── layout/               → الـ Sidebar والـ Shell
│   ├── market/               → نماذج الجلسة
│   ├── contracts/            → قائمة العقود والنماذج
│   └── signals/              → Signal Composer
└── lib/
    ├── engine/               → Decision Engine + Liquidity Calculator
    ├── supabase/             → clients
    ├── types/                → TypeScript types
    └── utils/                → constants + formatters
```

---

## الأدوار والصلاحيات

| الدور     | الوصول |
|-----------|--------|
| Admin     | كامل — إنشاء جلسات، نشر إشارات، إدارة المستخدمين |
| Analyst   | إنشاء جلسات، إدخال مؤشرات، إنشاء مسودات |
| Beta User | عرض الإشارات المنشورة فقط |

---

## ملاحظات مهمة

- الإشارة بعد النشر **لا تُعدَّل** — أي تغيير عبر Signal Update مستقل
- 0DTE محظور تمامًا في النسخة Beta
- العقود بجودة "تجنب" لا يمكن اختيارها
- كل إجراء مسجل في Audit Trail لا يُحذف
- AI مدمج مع Content Safety Filter صارم

---

## الدعم

ترقّب Beta — للتحليل العام فقط | لا ضمان ربح | لا إدارة أموال
