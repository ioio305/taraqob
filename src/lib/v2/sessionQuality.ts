export type SessionQuality = {
  action: 'allow' | 'caution' | 'block'
  phase: 'pre_market' | 'open_risk' | 'morning' | 'lunch' | 'afternoon' | 'power_hour' | 'closed'
  label: string
  reason: string
  minutesFromOpen: number | null
  minutesToClose: number | null
}

export function evaluateSessionQuality(now = new Date()): SessionQuality {
  const ny = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const day = ny.getDay()
  const t = ny.getHours() * 60 + ny.getMinutes()
  const open = 9 * 60 + 30
  const close = 16 * 60
  const minutesFromOpen = t - open
  const minutesToClose = close - t

  if (day === 0 || day === 6 || t >= close) {
    return { action: 'block', phase: 'closed', label: 'السوق مغلق', reason: 'لا توجد توصيات دخول خارج جلسة السوق النظامية.', minutesFromOpen: null, minutesToClose: null }
  }
  if (t < open) {
    return { action: 'block', phase: 'pre_market', label: 'قبل الافتتاح', reason: 'انتظر افتتاح السوق وتكوّن السيولة الفعلية.', minutesFromOpen, minutesToClose }
  }
  if (minutesFromOpen < 15) {
    return { action: 'block', phase: 'open_risk', label: 'أول 15 دقيقة — ممنوع', reason: 'أول 15 دقيقة عادةً يكون الفرق بين الشراء والبيع واسعاً والحركة مضلّلة.', minutesFromOpen, minutesToClose }
  }
  if (minutesFromOpen < 45) {
    return { action: 'caution', phase: 'morning', label: 'افتتاح مبكر — حذر', reason: 'السوق ما زال يحدد اتجاهه. لا تدخل إلا مع تأكيد واضح.', minutesFromOpen, minutesToClose }
  }
  if (t >= 12 * 60 && t < 13 * 60 + 30) {
    return { action: 'caution', phase: 'lunch', label: 'منتصف اليوم — حركة أبطأ', reason: 'منتصف اليوم قد تكون الحركة ضعيفة، خصوصاً للعقود التي تنتهي اليوم.', minutesFromOpen, minutesToClose }
  }
  if (minutesToClose <= 45) {
    return { action: 'caution', phase: 'power_hour', label: 'آخر 45 دقيقة — سريع وخطر', reason: 'آخر الجلسة سريع، الأهداف قد تتحقق بسرعة لكن الانعكاس أعنف.', minutesFromOpen, minutesToClose }
  }
  if (t >= 14 * 60) {
    return { action: 'caution', phase: 'afternoon', label: 'بعد 2:00 — ذوبان الوقت أسرع', reason: 'للعقود التي تنتهي اليوم، تتسارع خسارة قيمة العقد مع مرور الوقت بعد الساعة 2:00.', minutesFromOpen, minutesToClose }
  }
  return { action: 'allow', phase: 'morning', label: 'وقت مناسب نسبياً', reason: 'السيولة أوضح والمخاطرة الزمنية مقبولة نسبياً.', minutesFromOpen, minutesToClose }
}
