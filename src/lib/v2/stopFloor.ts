// ── أرضية وقف الخسارة — لا خسارة مخططة تتجاوز 30% من سعر الدخول ─────────────
// التقريب الرياضي (دلتا-جاما) قد يقدّر سعر العقد عند مستوى الوقف البعيد بصفر —
// فتظهر للمستخدم «خسارة كاملة» وهي خطة غير صالحة.
// القاعدة: الوقف لا ينزل أبدًا عن 70% من سعر الدخول (خسارة ≤ 30%).
// عند تفعيل الأرضية نعيد حساب مستوى المؤشر المكافئ بعكس الدلتا.

export const MAX_PLANNED_LOSS_PCT = 0.30

function round2(v: number) { return Math.round(v * 100) / 100 }

export function applyStopFloor(input: {
  entryPx: number        // سعر الدخول المخطط
  exitStop: number       // سعر الوقف المقدّر (قد يكون 0.01 من التقريب)
  stopSpx: number        // مستوى المؤشر عند الوقف
  mid: number            // سعر العقد الحالي
  delta: number | null
  spxPrice: number
}): { exitStop: number; stopSpx: number; floored: boolean } {
  const floor = round2(input.entryPx * (1 - MAX_PLANNED_LOSS_PCT))
  if (input.entryPx <= 0 || input.exitStop >= floor) {
    return { exitStop: input.exitStop, stopSpx: input.stopSpx, floored: false }
  }
  // عكس التقريب (درجة أولى): dSPX = (سعر_الوقف_الجديد − السعر_الحالي) ÷ دلتا
  let spx = input.stopSpx
  if (input.delta && Math.abs(input.delta) >= 0.01 && input.spxPrice > 0) {
    spx = round2(input.spxPrice + (floor - input.mid) / input.delta)
  }
  return { exitStop: floor, stopSpx: spx, floored: true }
}
