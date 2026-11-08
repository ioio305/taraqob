import { executableOptionQuote, quoteIsCurrent, type LiveQuote } from './quoteQuality'

export type TicketContract = {
  symbol: string
  type: string
  strike: number
  expiration: string
  status: string
  focus?: { action: string }
  execution?: { entryLow: number; entryHigh: number; hardProtectionPrice: number }
}
export type TicketScenario = {
  direction?: string
  entry: number
  target1: { value: number }
  target2: { value: number }
  invalidation: { value: number }
}
export type EntryGate = { ready: boolean; code: string; reason: string; checkedAt: string }

export function entryGate(input: {
  marketOpen: boolean
  marketClosed?: boolean
  estimated?: boolean
  contract?: TicketContract | null
  scenario?: TicketScenario | null
  validUntil?: string | null
  issuedAt?: string | null
  underlying?: LiveQuote | null
  option?: LiveQuote | null
}, now = Date.now()): EntryGate {
  const result = (ready: boolean, code: string, reason: string): EntryGate => ({ ready, code, reason, checkedAt: new Date(now).toISOString() })
  if (input.marketClosed) return result(false, 'closed', 'السوق مغلق — لا دخول الآن')
  if (input.estimated || !quoteIsCurrent(input.underlying, now)) return result(false, 'data', 'الأسعار الفورية غير متاحة أو قديمة — لا دخول الآن')
  if (!input.marketOpen) return result(false, 'session', 'تعذر تأكيد جلسة التداول — لا دخول الآن')
  const { contract: c, scenario: s } = input
  if (!c || c.status !== 'execute' || c.focus?.action !== 'enter') return result(false, 'wait', 'لا توجد فرصة دخول مكتملة الآن')
  const identity = /^SPXW(\d{6})([CP])(\d{8})$/.exec(c.symbol)
  const expiryKey = c.expiration?.slice(2).replace(/-/g, '')
  const today = new Date(now).toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
  if (!identity || identity[1] !== expiryKey || c.expiration < today
    || (identity[2] === 'C' ? 'call' : 'put') !== c.type || Number(identity[3]) / 1000 !== c.strike) return result(false, 'identity', 'هوية العقد أو تاريخ انتهائه غير صالح')
  if (!executableOptionQuote(input.option, now) || input.option?.symbol !== c.symbol) return result(false, 'quote', 'عرض شراء وبيع العقد غير صالح للدخول الآن')
  if (!s || ![s.entry, s.target1.value, s.target2.value, s.invalidation.value].every(v => Number.isFinite(v) && v > 0)) return result(false, 'plan', 'خطة الدخول والخروج غير مكتملة')
  if (s.direction && s.direction !== c.type) return result(false, 'plan', 'العقد لا يطابق اتجاه الخطة')
  const call = c.type === 'call'
  if (!['call', 'put'].includes(c.type) || !(call
    ? s.invalidation.value < s.entry && s.entry < s.target1.value && s.target1.value <= s.target2.value
    : s.invalidation.value > s.entry && s.entry > s.target1.value && s.target1.value >= s.target2.value)) return result(false, 'plan', 'مستويات الخروج لا تطابق اتجاه الصفقة')
  const issued = input.issuedAt ? Date.parse(input.issuedAt) : NaN
  const expiry = input.validUntil ? Date.parse(input.validUntil) : NaN
  if (!Number.isFinite(issued) || now - issued > 60_000 || issued - now > 3_000 || !Number.isFinite(expiry) || now >= expiry) return result(false, 'expired', 'انتهت صلاحية الدخول — انتظر توصية محدثة')
  const spot = input.underlying!.price
  if (call ? spot >= c.strike : spot <= c.strike) return result(false, 'passed', 'العقد تجاوز نطاق الاختيار — انتظر فرصة جديدة')
  if (call ? spot >= s.target1.value || spot <= s.invalidation.value : spot <= s.target1.value || spot >= s.invalidation.value) return result(false, 'passed', 'تحرك السعر خارج الخطة — لا تلاحق الدخول')
  const x = c.execution
  if (!x || ![x.entryLow, x.entryHigh, x.hardProtectionPrice].every(v => Number.isFinite(v) && v > 0)
    || x.entryLow > x.entryHigh || x.hardProtectionPrice >= x.entryLow) return result(false, 'plan', 'سعر الدخول أو وقف العقد غير صالح')
  // A limit order may wait inside the spread. A bid already above the cap means entry was missed.
  if (input.option!.bid! > x.entryHigh || input.option!.ask! < x.entryLow) return result(false, 'passed', 'فات نطاق الدخول — لا ترفع سعر الشراء')
  return result(true, 'ready', 'دخول بأمر محدد ضمن النطاق فقط')
}

export function sizeExecutionTicket(balance: number, riskPct: number, entry: number, stop: number, commissionPerSide: number) {
  if (![balance, riskPct, entry, stop, commissionPerSide].every(Number.isFinite)
    || balance <= 0 || riskPct <= 0 || riskPct > 5 || entry <= 0 || stop <= 0 || stop >= entry || commissionPerSide < 0) return null
  const budget = balance * riskPct / 100
  const lossPerContract = Math.ceil(((entry - stop) * 100 + 2 * commissionPerSide) * 100) / 100
  const cashPerContract = Math.ceil((entry * 100 + commissionPerSide) * 100) / 100
  const quantity = Math.max(0, Math.floor(Math.min(budget / lossPerContract, balance / cashPerContract)))
  return { quantity, budget, cost: quantity * cashPerContract, plannedLoss: quantity * lossPerContract,
    maximumPremiumLoss: quantity * cashPerContract, lossPerContract }
}
