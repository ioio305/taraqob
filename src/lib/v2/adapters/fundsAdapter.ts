// ── محوّل الصناديق — خيارات صناديق ETF (المؤشرات + القطاعات) ───────────────────
// يطبّق عقد AssetAdapter على الصناديق المتداولة، وهي الأقرب لمنصة المؤشر SPX:
//   • البيانات: Tradier بالرمز (نفس stockData.ts — الصندوق يُتداول كالسهم)
//   • الاتجاه: زخم الصندوق نفسه (تغيّره اليومي) — عتبات وسط بين المؤشر والسهم
//   • الجاما: SPY/QQQ لهما GEX من نواة gammaExposure.ts (fundsGamma.ts)
//   • دوران القطاعات: أي قطاع صاعد/هابط اليوم (أداة عرض إضافية)
//   • المعايرة: FUNDS_CALIBRATION (validated:false) → لا «اشترِ» حتى معايرة SPY
//
// راجع docs/platforms.md — المنصة 3 (الصناديق).

import type {
  AssetAdapter, AssetSnapshot, AdapterDirection, EventRisk, UniverseItem,
} from './types'
import { PLATFORMS, FUNDS_CALIBRATION } from './registry'
import { getStockQuote, getStockExpirations, getStockChain, getStockDailyBars } from '../stockData'

const META = PLATFORMS.find(p => p.key === 'funds')!

// ── كون الصناديق — مؤشرات واسعة + قطاعات S&P الأحد عشر ────────────────────────
// كلها سائلة جداً بخيارات نظيفة عبر Tradier. `nameAr` للعرض المبسّط،
// و`kind` يفصل المؤشرات عن القطاعات (لأداة دوران القطاعات).
export interface FundItem extends UniverseItem {
  kind:   'index' | 'sector'
  nameAr: string
}

export const FUNDS_UNIVERSE: FundItem[] = [
  // ── مؤشرات واسعة ──
  { symbol: 'IWM',  name: 'Russell 2000', nameAr: 'الشركات الصغيرة',       kind: 'index',  liquid: true },
  { symbol: 'DIA',  name: 'Dow Jones',    nameAr: 'داو جونز الصناعي',      kind: 'index',  liquid: true },
  // ── قطاعات S&P الأحد عشر ──
  { symbol: 'XLF',  name: 'Financials',   nameAr: 'قطاع البنوك والمال',   kind: 'sector', liquid: true },
  { symbol: 'XLE',  name: 'Energy',       nameAr: 'قطاع الطاقة',          kind: 'sector', liquid: true },
  { symbol: 'XLK',  name: 'Technology',   nameAr: 'قطاع التقنية',         kind: 'sector', liquid: true },
  { symbol: 'XLV',  name: 'Health Care',  nameAr: 'قطاع الصحة',           kind: 'sector', liquid: true },
  { symbol: 'XLI',  name: 'Industrials',  nameAr: 'قطاع الصناعة',         kind: 'sector', liquid: true },
  { symbol: 'XLY',  name: 'Cons. Disc.',  nameAr: 'الاستهلاك الكمالي',    kind: 'sector', liquid: true },
  { symbol: 'XLP',  name: 'Cons. Staples',nameAr: 'الاستهلاك الأساسي',    kind: 'sector', liquid: true },
  { symbol: 'XLU',  name: 'Utilities',    nameAr: 'قطاع المرافق',         kind: 'sector', liquid: true },
  { symbol: 'XLB',  name: 'Materials',    nameAr: 'قطاع المواد الخام',    kind: 'sector', liquid: true },
  { symbol: 'XLRE', name: 'Real Estate',  nameAr: 'قطاع العقار',          kind: 'sector', liquid: true },
  { symbol: 'XLC',  name: 'Comm. Svcs.',  nameAr: 'قطاع الاتصالات',       kind: 'sector', liquid: true },
]

export function isKnownFund(symbol: string): boolean {
  return FUNDS_UNIVERSE.some(u => u.symbol === symbol.toUpperCase())
}

export function fundBySymbol(symbol: string): FundItem | undefined {
  return FUNDS_UNIVERSE.find(u => u.symbol === symbol.toUpperCase())
}

// التذبذب المحقّق السنوي% من عوائد الإغلاق اليومية (بديل نزيه عن VIX للصندوق)
function realizedVolPct(closes: number[]): number | null {
  if (closes.length < 10) return null
  const rets: number[] = []
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) rets.push(Math.log(closes[i] / closes[i - 1]))
  }
  if (rets.length < 8) return null
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length
  return Math.sqrt(variance) * Math.sqrt(252) * 100
}

// متوسط المدى الحقيقي% (ATR14/السعر)
function atrPct(bars: { high: number; low: number; close: number }[]): number | null {
  const n = bars.length
  if (n < 15) return null
  let sum = 0
  for (let i = n - 14; i < n; i++) {
    sum += Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - bars[i - 1].close),
      Math.abs(bars[i].low - bars[i - 1].close),
    )
  }
  const last = bars[n - 1].close
  return last > 0 ? (sum / 14 / last) * 100 : null
}

// اتجاه الصندوق من زخمه اليومي — عتبات وسط: الصندوق سلّة، فأهدأ من السهم المفرد
// وأنشط قليلاً من المؤشر (خصوصاً القطاعات).
export function fundDirection(changePct: number): AdapterDirection {
  if (changePct >= 1.2)   return { type: 'call', label: '▲ الصندوق صاعد بقوة — عقود شراء (Call)', color: '#10B981', reason: `الصندوق +${changePct.toFixed(2)}% اليوم — زخم صاعد قوي` }
  if (changePct <= -1.2)  return { type: 'put',  label: '▼ الصندوق هابط بقوة — عقود هبوط (Put)',  color: '#EF4444', reason: `الصندوق ${changePct.toFixed(2)}% اليوم — زخم هابط قوي` }
  if (changePct >= 0.5)   return { type: 'call', label: '▲ الصندوق صاعد — عقود شراء (Call)', color: '#34D399', reason: `الصندوق +${changePct.toFixed(2)}% اليوم` }
  if (changePct <= -0.5)  return { type: 'put',  label: '▼ الصندوق هابط — عقود هبوط (Put)',  color: '#F87171', reason: `الصندوق ${changePct.toFixed(2)}% اليوم` }
  return { type: null, label: '↔ حركة ضعيفة — انتظر', color: '#F59E0B', reason: 'الصندوق يتحرك بلا اتجاه واضح اليوم — انتظر' }
}

// الاتجاه الاحترافي: لا يعتمد على شمعة اليوم وحدها، بل يطلب اتفاق اليوم مع
// زخم أسبوع وشهر. هذا يقلل مطاردة حركة عابرة في صندوق واحد.
export function fundDirectionFromBars(
  changePct: number,
  bars: Array<{ close: number }>,
): AdapterDirection & { strength: number } {
  const closes = bars.map(b => b.close).filter(v => Number.isFinite(v) && v > 0)
  if (closes.length < 21) return { ...fundDirection(changePct), strength: Math.min(100, Math.round(Math.abs(changePct) * 35)) }

  const last = closes[closes.length - 1]
  const ret5 = ((last / closes[closes.length - 6]) - 1) * 100
  const ret20 = ((last / closes[closes.length - 21]) - 1) * 100
  const upVotes = Number(changePct >= 0.35) + Number(ret5 >= 0.8) + Number(ret20 >= 1.5)
  const downVotes = Number(changePct <= -0.35) + Number(ret5 <= -0.8) + Number(ret20 <= -1.5)
  const strength = Math.min(100, Math.round(Math.abs(changePct) * 22 + Math.abs(ret5) * 8 + Math.abs(ret20) * 3))

  if (upVotes >= 2 && downVotes === 0) {
    return { type: 'call', label: '▲ اتجاه صاعد مؤكد', color: '#10B981', reason: `اليوم ${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}% · أسبوع ${ret5 >= 0 ? '+' : ''}${ret5.toFixed(2)}% · شهر ${ret20 >= 0 ? '+' : ''}${ret20.toFixed(2)}%`, strength }
  }
  if (downVotes >= 2 && upVotes === 0) {
    return { type: 'put', label: '▼ اتجاه هابط مؤكد', color: '#EF4444', reason: `اليوم ${changePct.toFixed(2)}% · أسبوع ${ret5.toFixed(2)}% · شهر ${ret20.toFixed(2)}%`, strength }
  }
  return { type: null, label: '↔ الاتجاهات غير متفقة — انتظر', color: '#F59E0B', reason: `اليوم ${changePct.toFixed(2)}% · أسبوع ${ret5.toFixed(2)}% · شهر ${ret20.toFixed(2)}%`, strength }
}

export const fundsAdapter: AssetAdapter = {
  meta: META,
  calibration: FUNDS_CALIBRATION,

  async getUniverse(): Promise<UniverseItem[]> {
    return FUNDS_UNIVERSE
  },

  async getSnapshot(symbol: string): Promise<AssetSnapshot> {
    const sym = symbol.toUpperCase()
    const [quote, bars] = await Promise.all([
      getStockQuote(sym),
      getStockDailyBars(sym, 60).catch(() => []),
    ])
    if (!quote) throw new Error(`تعذر جلب سعر الصندوق ${sym}`)
    const closes = bars.map(b => b.close)
    const rv = realizedVolPct(closes)
    const atr = atrPct(bars)
    const em = rv && quote.price > 0
      ? Math.round(quote.price * (rv / 100) * Math.sqrt(1 / 252) * 100) / 100
      : null
    return {
      symbol: sym,
      price: quote.price,
      prevClose: quote.prevClose,
      changePct: quote.changePct,
      high: quote.high,
      low: quote.low,
      volMeasure: rv,
      volLabel: 'التذبذب',
      atrPct: atr,
      expectedMove: em,
      source: quote.source,
    }
  },

  async getExpirations(symbol: string): Promise<string[]> {
    return getStockExpirations(symbol)
  },

  async getChain(symbol: string, expiration: string): Promise<any[]> {
    return getStockChain(symbol, expiration)
  },

  getDirection(_symbol: string, snap: AssetSnapshot): AdapterDirection {
    return fundDirection(snap.changePct)
  },

  // الصناديق لا أرباح فردية لها؛ مخاطر الأحداث الاقتصادية (FOMC/CPI) تُعالَج على
  // مستوى السوق في منصة المؤشر. نُبقيها null هنا — لا موانع دخول جديدة على الصناديق.
  async getEventRisk(_symbol: string): Promise<EventRisk | null> {
    return null
  },
}
