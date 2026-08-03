-- ═══════════════════════════════════════════════════════════════════
-- جدولة مراقب تيليجرام والملخص اليومي من داخل Supabase
-- بديل دقيق (كل 3 دقائق) لجدولة GitHub التي تتأخر أوقات الذروة
-- التشغيل: الصق هذا الملف كاملاً في Supabase → SQL Editor → Run
-- ═══════════════════════════════════════════════════════════════════

-- 1) تفعيل الامتدادين (مرة واحدة)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2) تخزين السر في إعدادات قاعدة البيانات (لا يُكتب داخل الجدولة نفسها)
--    ⚠️ استبدل القيمة أدناه بقيمة CRON_SECRET من ملف .env.local
ALTER DATABASE postgres SET app.cron_secret = 'ضع_CRON_SECRET_هنا';

-- 3) مراقب تليجرام: كل 3 دقائق أثناء جلسة نيويورك (13:00–21:59 UTC، إثنين–جمعة)
--    المسار نفسه يتحقق من توقيت نيويورك بدقة ويخرج مبكراً خارج الجلسة
SELECT cron.schedule(
  'telegram-watch',
  '*/3 13-21 * * 1-5',
  $$
  SELECT net.http_get(
    url := 'https://trqob.com/api/v2/telegram-watch',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || current_setting('app.cron_secret')
    )
  );
  $$
);

-- 4) الملخص اليومي: 21:47 UTC (بعد إغلاق نيويورك وبعد اكتمال التقييم)
SELECT cron.schedule(
  'telegram-digest',
  '47 21 * * 1-5',
  $$
  SELECT net.http_get(
    url := 'https://trqob.com/api/v2/telegram-digest',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || current_setting('app.cron_secret')
    )
  );
  $$
);

-- 5) تحقق: يجب أن ترى المهمتين
SELECT jobname, schedule, active FROM cron.job;
