// ── التقويم الاقتصادي 2026 — الأحداث التي تحرك SPX ──────────────────────────
// مصادر الجداول الرسمية: الاحتياطي الفيدرالي (FOMC)، مكتب إحصاءات العمل (CPI/NFP)،
// وانتهاءات الشهرية = الجمعة الثالثة. التواريخ قد تُعدَّل من مصدرها — نعرض
// «تحقق قبل اليوم الكبير» ولا نمنع أي تداول بناءً عليها (معلومة لا فيتو).

export interface EconEvent {
  date: string          // YYYY-MM-DD (بتوقيت نيويورك)
  time: string          // وقت الصدور بتوقيت نيويورك
  nameAr: string
  impact: 'high' | 'medium'
  advice: string        // نصيحة سياقية قصيرة
}

// قرارات الفائدة (اليوم الثاني للاجتماع — المؤتمر الصحفي 14:30)
const FOMC_2026 = ['2026-01-28', '2026-03-18', '2026-04-29', '2026-06-17', '2026-07-29', '2026-09-16', '2026-10-28', '2026-12-09']
// تقرير التضخم CPI (08:30 صباحاً نيويورك)
const CPI_2026 = ['2026-01-13', '2026-02-11', '2026-03-11', '2026-04-10', '2026-05-12', '2026-06-10', '2026-07-14', '2026-08-12', '2026-09-11', '2026-10-13', '2026-11-12', '2026-12-10']
// تقرير الوظائف (أول جمعة — 08:30)
const NFP_2026 = ['2026-01-02', '2026-02-06', '2026-03-06', '2026-04-03', '2026-05-01', '2026-06-05', '2026-07-02', '2026-08-07', '2026-09-04', '2026-10-02', '2026-11-06', '2026-12-04']
// انتهاء العقود الشهرية (الجمعة الثالثة)
const OPEX_2026 = ['2026-01-16', '2026-02-20', '2026-03-20', '2026-04-17', '2026-05-15', '2026-06-19', '2026-07-17', '2026-08-21', '2026-09-18', '2026-10-16', '2026-11-20', '2026-12-18']
// الساحرات الأربع (انتهاء ربع سنوي مزدوج — تذبذب أعلى)
const QUAD_2026 = ['2026-03-20', '2026-06-19', '2026-09-18', '2026-12-18']

function buildAll(): EconEvent[] {
  const out: EconEvent[] = []
  for (const d of FOMC_2026) out.push({
    date: d, time: '14:00', nameAr: 'قرار الفائدة (الفيدرالي)', impact: 'high',
    advice: 'أعنف حدث للسوق — قلّل حجمك قبله، وانتظر 30 دقيقة بعد المؤتمر الصحفي',
  })
  for (const d of CPI_2026) out.push({
    date: d, time: '08:30', nameAr: 'تقرير التضخم CPI', impact: 'high',
    advice: 'يصدر قبل الافتتاح — الفجوات الصباحية شائعة، لا تدخل قبل استقرار أول ساعة',
  })
  for (const d of NFP_2026) out.push({
    date: d, time: '08:30', nameAr: 'تقرير الوظائف', impact: 'high',
    advice: 'يصدر قبل الافتتاح — حركة الافتتاح خادعة غالباً، تريّث',
  })
  for (const d of OPEX_2026) out.push({
    date: d, time: '16:00', nameAr: QUAD_2026.includes(d) ? 'الساحرات الأربع (انتهاء ربع سنوي)' : 'انتهاء العقود الشهرية OPEX', impact: 'medium',
    advice: QUAD_2026.includes(d)
      ? 'أضخم انتهاء في الربع — سيولة وجاذبية للجدران، وتذبذب آخر ساعة'
      : 'جاذبية الأسعار نحو جدران الجاما تشتد اليوم — الأهداف البعيدة أصعب',
  })
  return out.sort((a, b) => a.date.localeCompare(b.date))
}
const ALL_EVENTS = buildAll()

function todayNY(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}
function addDaysNY(days: number): string {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// الأحداث القادمة خلال N يوماً (مع عدد الأيام المتبقية)
export function upcomingEvents(withinDays = 14): (EconEvent & { inDays: number })[] {
  const today = todayNY()
  const limit = addDaysNY(withinDays)
  return ALL_EVENTS
    .filter(e => e.date >= today && e.date <= limit)
    .map(e => ({
      ...e,
      inDays: Math.round((new Date(e.date + 'T12:00:00Z').getTime() - new Date(today + 'T12:00:00Z').getTime()) / 86400000),
    }))
}

// تحذير سياقي: حدث كبير اليوم أو غداً؟ (معلومة — لا تمنع شيئاً)
export function econWarning(): { nameAr: string; when: 'اليوم' | 'غداً'; advice: string; impact: 'high' | 'medium' } | null {
  const today = todayNY()
  const tomorrow = addDaysNY(1)
  const t = ALL_EVENTS.find(e => e.date === today)
  if (t) return { nameAr: t.nameAr, when: 'اليوم', advice: t.advice, impact: t.impact }
  const m = ALL_EVENTS.find(e => e.date === tomorrow)
  if (m && m.impact === 'high') return { nameAr: m.nameAr, when: 'غداً', advice: 'استعد: ' + m.advice, impact: m.impact }
  return null
}
