# تفعيل البريد الإلكتروني — دليل الإعداد الكامل (بعد شراء trqob.com)

> الكود جاهز بالكامل في المنصة. المتبقي 3 خطوات في لوحتين — ~15 دقيقة.

---

## الخطوة 1: ربط الدومين بـ Resend (لوحة resend.com)

1. ادخل [resend.com](https://resend.com) بنفس حساب مفتاح `RESEND_API_KEY` الموجود في Vercel
2. **Domains** ← **Add Domain** ← اكتب `trqob.com`
3. ستظهر لك 3 سجلات (نوعها TXT وMX) — **انسخها**

## الخطوة 2: لصق السجلات في Vercel

1. لوحة Vercel ← مشروع **taraqob** ← **Settings** ← **Domains** ← `trqob.com` ← **DNS Records**
2. أضف السجلات الثلاثة كما هي (Add Record لكل واحد)
3. عد للوحة Resend واضغط **Verify** — خلال دقائق تتحول لعلامة ✓ خضراء

## الخطوة 3: تفعيل تأكيد البريد في Supabase

لوحة [supabase.com](https://supabase.com/dashboard/project/kvlzowduqrciidkxsxeq) ← **Authentication**:

### أ. ربط الإرسال عبر Resend
- **Settings ← SMTP Settings** ← فعّل **Enable Custom SMTP**:
  - Host: `smtp.resend.com`
  - Port: `465`
  - Username: `resend`
  - Password: مفتاح `RESEND_API_KEY` نفسه (يبدأ بـ re_)
  - Sender email: `no-reply@trqob.com`
  - Sender name: `ترقّب`

### ب. تفعيل التأكيد
- **Providers ← Email** ← فعّل **Confirm email**

### ج. الروابط الصحيحة
- **URL Configuration**:
  - Site URL: `https://trqob.com`
  - Redirect URLs: أضف `https://trqob.com/auth/callback`

### د. قالب الرسالة العربي
- **Email Templates ← Confirm signup** ← الصق محتوى الملف
  [confirm-signup.html](email-templates/confirm-signup.html) في خانة Message body،
  وفي خانة Subject: `فعّل حسابك في ترقّب 🎯`
- كرر لقالب **Reset password** من ملف [reset-password.html](email-templates/reset-password.html)
  بعنوان: `استعادة كلمة المرور — ترقّب`

## الخطوة 4 (في Vercel): تحديث رابط المنصة

- **Settings ← Environment Variables** ← عدّل `NEXT_PUBLIC_APP_URL` إلى `https://trqob.com`
- **Redeploy**

---

## كيف تختبر أن كل شيء يعمل؟

1. افتح `https://trqob.com/register` وسجّل ببريد حقيقي جديد
2. يجب أن ترى شاشة «📬 تحقق من بريدك»
3. افتح بريدك ← اضغط «فعّل حسابي» ← يفتح حسابك مباشرة مع شريط التجربة الذهبي

> ملاحظة: قبل إتمام هذه الخطوات، المنصة تعمل كما هي (تسجيل فوري بلا تأكيد) — لا شيء ينكسر.
