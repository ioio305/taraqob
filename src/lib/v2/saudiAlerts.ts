// التنبيهات السعرية للسوق السعودي (دوال صافية).
export type PriceAlert = {
  id: string
  symbol: string
  direction: 'above' | 'below'
  price: number
  note: string | null
  created_at: string
  triggered_at: string | null
  triggered_price: number | null
}

// هل تحقّق التنبيه؟ يُستخدم أعلى/أدنى سعر الجلسة إن توفّرا حتى لا يفوت لمسٌ داخل اليوم.
export function alertHit(a: Pick<PriceAlert, 'direction' | 'price'>, q: { price: number; high?: number; low?: number }): boolean {
  if (a.direction === 'above') return Math.max(q.price, q.high ?? 0) >= a.price
  return Math.min(q.price, q.low ?? Infinity) <= a.price
}

export function alertDistancePct(a: Pick<PriceAlert, 'price'>, price: number): number {
  return price > 0 ? +(((a.price - price) / price) * 100).toFixed(2) : 0
}

export function describeAlert(a: Pick<PriceAlert, 'direction' | 'price'>): string {
  return a.direction === 'above' ? `يصل إلى ${a.price} أو أعلى` : `ينزل إلى ${a.price} أو أدنى`
}

export function parseAlertInput(body: unknown, currentPrice?: number):
  { ok: true; value: { symbol: string; direction: 'above' | 'below'; price: number; note: string | null } } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>
  const symbol = String(b.symbol ?? '').replace(/\D/g, '').slice(0, 4)
  const price = Number(b.price)
  if (symbol.length !== 4) return { ok: false, error: 'رمز السهم أربعة أرقام' }
  if (!(price > 0) || price > 1e6) return { ok: false, error: 'السعر غير صحيح' }
  // الاتجاه من السعر الحالي إن لم يُحدَّد: هدف فوق السعر = «أعلى»، وتحته = «أدنى».
  let direction: 'above' | 'below' | null = b.direction === 'above' || b.direction === 'below' ? b.direction : null
  if (!direction && currentPrice) direction = price >= currentPrice ? 'above' : 'below'
  if (!direction) return { ok: false, error: 'حدّد هل التنبيه عند الصعود أو النزول' }
  const note = typeof b.note === 'string' && b.note.trim() ? b.note.trim().slice(0, 120) : null
  return { ok: true, value: { symbol, direction, price, note } }
}
