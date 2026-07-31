// ── سجل المنصات الثلاث — مصدر واحد لبطاقات الصفحة التعريفية والتنقل ──────────
// كل جلسة تبني منصة جديدة تُبدّل status إلى 'available' وتربط route فعلياً.
// راجع docs/platforms.md و src/lib/v2/adapters/types.ts

import type { PlatformMeta, CalibrationConfig } from './types'

export const PLATFORMS: PlatformMeta[] = [
  {
    key:     'spx',
    label:   'الخيارات SPX الأمريكية',
    tagline: 'توصيات وتحليل وشارت لخيارات مؤشر S&P 500 — مُعايَرة على 8 سنوات',
    icon:    '📈',
    route:   '/v2',
    status:  'available',
    color:   '#C9943A',
  },
  {
    key:     'stocks',
    label:   'الشركات',
    tagline: 'أفضل فرص خيارات الأسهم الأمريكية السائلة — ماسح متعدد الرموز + تقويم الأرباح',
    icon:    '🏢',
    route:   '/stocks',
    status:  'available',
    color:   '#60A5FA',
  },
  {
    key:     'funds',
    label:   'الصناديق',
    tagline: 'خيارات الصناديق (SPY · QQQ · القطاعات) مع دوران القطاعات',
    icon:    '🧺',
    route:   '/funds',
    status:  'available',
    color:   '#26D07C',
  },
]

// عتبات SPX المُعايَرة الحالية (المرجع). كل فئة جديدة تحتاج معايرتها الخاصة.
export const SPX_CALIBRATION: CalibrationConfig = {
  executeScore: 80,
  watchScore:   74,
  minNetRR:     1.3,
  validated:    true,
  note:         'مُعايَرة خارج العينة 2016–2023: ~51% و+0.25R، تخسر في الانهيارات، الفرق يأكل ~20%',
}

// قوالب معايرة غير مُفعّلة — لا تُظهر «نفّذ» حتى تُعايَر فعلياً على بياناتها
export const STOCKS_CALIBRATION: CalibrationConfig = {
  executeScore: 80,
  watchScore:   74,
  minNetRR:     1.3,
  validated:    false,
  note:         'النظام البطل مُعتمد (وصفة لكل شركة): تحقق 2023→الآن +0.069R بمعامل 1.13 — موجب لكن دون عتبة «نفّذ» (+0.12R)',
}

export const FUNDS_CALIBRATION: CalibrationConfig = {
  executeScore: 80,
  watchScore:   74,
  minNetRR:     1.3,
  validated:    false,
  note:         'متوقفة مؤقتًا — كل الوصفات خسرت على الصناديق في 8 تجارب تاريخية؛ تُعاد بعد ترقية البيانات',
}

export function platformByKey(key: string): PlatformMeta | undefined {
  return PLATFORMS.find(p => p.key === key)
}

// ── منتقي المحوّل حسب فئة الأصول ──────────────────────────────────────────────
// يُستورد ديناميكياً لتفادي دورات الاستيراد (المحوّلات تستورد من هذا السجل).
// الافتراضي spx (توافق خلفي — المسار بلا ?asset= يبقى SPX).
export async function getAdapter(asset: string | null | undefined) {
  const key = (asset ?? 'spx').toLowerCase()
  if (key === 'stocks') {
    const { stocksAdapter } = await import('./stocksAdapter')
    return stocksAdapter
  }
  if (key === 'funds') {
    const { fundsAdapter } = await import('./fundsAdapter')
    return fundsAdapter
  }
  const { spxAdapter } = await import('./spxAdapter')
  return spxAdapter
}
