-- ═══════════════════════════════════════════════════════════════════
-- جدولة تليجرام من داخل Supabase (pg_cron) — النسخة المطبّقة فعلاً 2026-08-03
-- ملاحظة: ALTER DATABASE SET محظور في Supabase المُستضاف، لذلك يُضمَّن
-- السر مباشرة في تعريف المهمة (تعريفات cron.job لا تظهر إلا لدور postgres)
-- التشغيل: SQL Editor ← الصق بعد استبدال ضع_CRON_SECRET_هنا ← Run
-- ═══════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- مراقب تليجرام: نبضة احتياطية كل 15 ثانية.
-- المسار نفسه يتوقف فوراً خارج جلسة نيويورك، ولا يرسل إلا بعد اعتماد الفرصة.
SELECT cron.schedule(
  'telegram-watch',
  '15 seconds',
  $$
  SELECT net.http_get(
    url := 'https://trqob.com/api/v2/telegram-watch',
    headers := jsonb_build_object('Authorization', 'Bearer ضع_CRON_SECRET_هنا')
  );
  $$
);

-- الملخص اليومي: 21:47 UTC بعد الإغلاق وبعد اكتمال التقييم
SELECT cron.schedule(
  'telegram-digest',
  '47 21 * * 1-5',
  $$
  SELECT net.http_get(
    url := 'https://trqob.com/api/v2/telegram-digest',
    headers := jsonb_build_object('Authorization', 'Bearer ضع_CRON_SECRET_هنا')
  );
  $$
);

-- تحقق من التسجيل: مهمتان نشطتان
SELECT jobname, schedule, active FROM cron.job;

-- تحقق من التشغيل الفعلي: نبضات ناجحة كل 15 ثانية
-- SELECT j.jobname, d.status, d.start_time FROM cron.job_run_details d
-- JOIN cron.job j ON j.jobid = d.jobid ORDER BY d.start_time DESC LIMIT 6;
