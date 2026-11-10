// ================================================================
// محفظتي — السوق السعودي (دوال صافية): ربح/خسارة المركز، وقف وهدف افتراضيان،
// وقف متحرّك، ومساعد خروج بلغة بسيطة. يقيّم مركز المستخدم نفسه لا توصية جديدة.
// ================================================================

export type Holding = {
  id: string
  symbol: string
  qty: number
  buy_price: number
  buy_date: string | null
  stop_price: number | null
  target_price: number | null
  note: string | null
}

export type HoldingQuote = {
  price: number
  change: number
  atr: number
  techScore: number
  techSignal: string
  techSignalEn: string
  flow: string
  ema20: number
  support: number | null
  resistance: number | null
}

export type HoldingStatus = 'stop_hit' | 'target_hit' | 'near_stop' | 'near_target' | 'weakening' | 'ok'

export type HoldingAssessment = {
  cost: number
  value: number
  pnl: number
  pnlPct: number
  dayPnl: number
  stop: number
  stopIsDefault: boolean
  target: number
  targetIsDefault: boolean
  trailingStop: number | null
  status: HoldingStatus
  headline: string
  advice: string[]
}

const r2 = (v: number) => +v.toFixed(2)

export const STATUS_LABEL: Record<HoldingStatus, { label: string; color: string }> = {
  stop_hit: { label: 'كسر الوقف', color: '#F04760' },
  target_hit: { label: 'بلغ الهدف', color: '#16A34A' },
  near_stop: { label: 'قريب من الوقف', color: '#F5B301' },
  near_target: { label: 'قريب من الهدف', color: '#4ADE80' },
  weakening: { label: 'ضعف فني', color: '#F5B301' },
  ok: { label: 'مستقر', color: '#60A5FA' },
}

export function assessHolding(h: Pick<Holding, 'qty' | 'buy_price' | 'stop_price' | 'target_price'>, q: HoldingQuote): HoldingAssessment {
  const cost = h.qty * h.buy_price
  const value = h.qty * q.price
  const pnl = value - cost
  const pnlPct = h.buy_price > 0 ? ((q.price - h.buy_price) / h.buy_price) * 100 : 0
  const prevPrice = q.change !== -100 ? q.price / (1 + q.change / 100) : q.price
  const dayPnl = h.qty * (q.price - prevPrice)

  // وقف افتراضي = سعر الشراء − 2×ATR (نفس منطق المنصة)، وهدف افتراضي = ضعفا المخاطرة.
  const atr = q.atr > 0 ? q.atr : h.buy_price * 0.03
  const stopIsDefault = !(h.stop_price != null && h.stop_price > 0)
  const stop = stopIsDefault ? r2(h.buy_price - 2 * atr) : h.stop_price!
  const risk = Math.max(h.buy_price - stop, h.buy_price * 0.01)
  const targetIsDefault = !(h.target_price != null && h.target_price > 0)
  const target = targetIsDefault ? r2(h.buy_price + 2 * risk) : h.target_price!

  // وقف متحرّك: بعد ربح يتجاوز مخاطرة واحدة، ارفع الوقف إلى السعر − 2×ATR (ولا يقل عن الدخول).
  const trailingStop = q.price - h.buy_price >= risk
    ? r2(Math.max(stop, h.buy_price, q.price - 2 * atr))
    : null

  const advice: string[] = []
  let status: HoldingStatus = 'ok'
  let headline = 'المركز ضمن خطته'

  if (q.price <= stop) {
    status = 'stop_hit'
    headline = `السعر ${r2(q.price)} عند وقفك ${stop} أو تحته`
    advice.push('الالتزام بالوقف يحمي رأس مالك من خسارة أكبر. الخروج الآن هو تنفيذ لخطتك.')
  } else if (q.price >= target) {
    status = 'target_hit'
    headline = `بلغ السعر هدفك ${target}`
    advice.push('فكّر في جني جزء من الربح (مثلاً النصف)، وارفع الوقف للباقي.')
    if (trailingStop != null) advice.push(`وقف متحرّك مقترح للباقي: ${trailingStop}`)
  } else if ((q.price - stop) / q.price <= 0.02) {
    status = 'near_stop'
    headline = `السعر على بعد ${r2(((q.price - stop) / q.price) * 100)}% من وقفك`
    advice.push('راقب الإغلاق اليوم. لا تنقل الوقف إلى أسفل.')
  } else if ((target - q.price) / q.price <= 0.02) {
    status = 'near_target'
    headline = `السعر على بعد ${r2(((target - q.price) / q.price) * 100)}% من هدفك`
    advice.push('جهّز خطة جني الربح عند الهدف.')
  } else if (q.techSignalEn === 'sell' || q.techSignalEn === 'strong_sell' || q.flow === 'تصريف') {
    status = 'weakening'
    headline = 'الصورة الفنية للسهم ضعفت'
    advice.push(q.flow === 'تصريف' ? 'السيولة خارجة من السهم (تصريف).' : `تقييم السهم الفني الآن: ${q.techSignal}.`)
    advice.push('راجع مركزك: قد يكون تقليص الكمية أو تضييق الوقف مناسباً.')
  }

  if (status === 'ok' && trailingStop != null && trailingStop > stop) {
    advice.push(`أنت في ربح جيد. ارفع وقفك إلى ${trailingStop} لتحمي الربح.`)
  }
  if (status === 'ok' && q.price < q.ema20) advice.push('السعر تحت متوسط 20 يوماً، فالزخم القصير ضعيف.')
  if (stopIsDefault) advice.push(`لم تحدّد وقفاً. الوقف المحسوب لك: ${stop} (ضعفا متوسط التذبذب تحت سعر شرائك).`)

  return {
    cost: r2(cost), value: r2(value), pnl: r2(pnl), pnlPct: r2(pnlPct), dayPnl: r2(dayPnl),
    stop, stopIsDefault, target, targetIsDefault, trailingStop, status, headline, advice,
  }
}

// تحقّق مدخلات إضافة/تعديل مركز.
export function parseHoldingInput(body: unknown): { ok: true; value: Omit<Holding, 'id'> } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>
  const symbol = String(b.symbol ?? '').replace(/\D/g, '').slice(0, 4)
  const qty = Number(b.qty)
  const buy = Number(b.buy_price)
  const num = (v: unknown) => (v === '' || v == null ? null : Number(v))
  const stop = num(b.stop_price)
  const target = num(b.target_price)
  if (symbol.length !== 4) return { ok: false, error: 'رمز السهم أربعة أرقام' }
  if (!(qty > 0) || qty > 1e9) return { ok: false, error: 'الكمية يجب أن تكون أكبر من صفر' }
  if (!(buy > 0) || buy > 1e6) return { ok: false, error: 'سعر الشراء غير صحيح' }
  if (stop != null && (!(stop > 0) || stop >= buy)) return { ok: false, error: 'الوقف يجب أن يكون أقل من سعر الشراء' }
  if (target != null && (!(target > 0) || target <= buy)) return { ok: false, error: 'الهدف يجب أن يكون أعلى من سعر الشراء' }
  const date = typeof b.buy_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.buy_date) ? b.buy_date : null
  const note = typeof b.note === 'string' ? b.note.slice(0, 200) : null
  return { ok: true, value: { symbol, qty, buy_price: buy, buy_date: date, stop_price: stop, target_price: target, note } }
}
