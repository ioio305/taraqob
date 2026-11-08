// تصنيف المضارب حسب المدى الزمني للصفقة (أفق الاحتفاظ)
// مغامر = يوم واحد · متوسط = يومان إلى ٥ أيام · محافظ = أسبوع فأكثر
// هذه الطبقة تحدّد نطاق أيام الانتهاء (DTE) المفضّل لكل تصنيف — لا تمنع شيئاً،
// بل تحيّز اختيار تاريخ الانتهاء نحو المدى الذي اختاره المضارب.

export type TraderHorizon = 'aggressive' | 'moderate' | 'conservative'

export interface HorizonSpec {
  key: TraderHorizon
  labelAr: string
  emoji: string
  // نطاق أيام الانتهاء المقبول وهدفه (بالأيام التقويمية)
  dte: { min: number; max: number; target: number }
  holdAr: string
  tooltip: string
}

export const HORIZONS: Record<TraderHorizon, HorizonSpec> = {
  aggressive: {
    key: 'aggressive',
    labelAr: 'مغامر',
    emoji: '🔴',
    dte: { min: 0, max: 1, target: 0 },
    holdAr: 'يوم واحد',
    tooltip: 'انتهاء اليوم نفسه — حركة سريعة وتذبذب عالٍ',
  },
  moderate: {
    key: 'moderate',
    labelAr: 'متوسط',
    emoji: '🟡',
    dte: { min: 2, max: 5, target: 3 },
    holdAr: 'يومان إلى ٥ أيام',
    tooltip: 'توازن بين الوقت والتكلفة — مهلة أطول من اليوم',
  },
  conservative: {
    key: 'conservative',
    labelAr: 'محافظ',
    emoji: '🟢',
    dte: { min: 7, max: 45, target: 10 },
    holdAr: 'أسبوع فأكثر',
    tooltip: 'مدى أطول وتذبذب أهدأ — عقود أسبوعية فأبعد',
  },
}

const ORDER: TraderHorizon[] = ['aggressive', 'moderate', 'conservative']

export function normalizeHorizon(value: unknown): TraderHorizon {
  return value === 'aggressive' || value === 'moderate' || value === 'conservative'
    ? value
    : 'aggressive'
}

export function horizonSpec(value: unknown): HorizonSpec {
  return HORIZONS[normalizeHorizon(value)]
}

export function horizonList(): HorizonSpec[] {
  return ORDER.map((key) => HORIZONS[key])
}

// تصنيف عدد أيام الانتهاء إلى أفق — للعرض عند معرفة DTE فعلي
export function matchHorizonByDte(dte: number): TraderHorizon {
  if (dte <= 1) return 'aggressive'
  if (dte <= 5) return 'moderate'
  return 'conservative'
}
