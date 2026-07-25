// ── محوّل الشركات — خيارات الأسهم الأمريكية السائلة ───────────────────────────
// يطبّق عقد AssetAdapter على الأسهم المفردة:
//   • البيانات: Tradier بالرمز (stockData.ts)
//   • الاتجاه: زخم السهم نفسه (تغيّره اليومي) لا المؤشر
//   • بوابة الأحداث: تقويم الأرباح (أخطر حدث لسهم مفرد)
//   • المعايرة: STOCKS_CALIBRATION (validated:false) → لا «نفّذ» حتى المعايرة
//
// راجع docs/platforms.md — الشركات أولاً بعد الأساس.

import type {
  AssetAdapter, AssetSnapshot, AdapterDirection, EventRisk, UniverseItem,
} from './types'
import { PLATFORMS, STOCKS_CALIBRATION } from './registry'
import { getStockQuote, getStockExpirations, getStockChain, getStockDailyBars } from '../stockData'
import { getEarningsRisk } from '../earningsCalendar'

const META = PLATFORMS.find(p => p.key === 'stocks')!

// ── كون الرموز — أسهم أمريكية سائلة قابلة للخيارات ────────────────────────────
// معيار الاختيار: سيولة خيارات عالية + فروق ضيقة + اهتمام تجزئة.
export const STOCKS_UNIVERSE: UniverseItem[] = [
  { symbol: 'AAPL', name: 'Apple',        liquid: true },
  { symbol: 'NVDA', name: 'Nvidia',       liquid: true },
  { symbol: 'TSLA', name: 'Tesla',        liquid: true },
  { symbol: 'MSFT', name: 'Microsoft',    liquid: true },
  { symbol: 'AMZN', name: 'Amazon',       liquid: true },
  { symbol: 'META', name: 'Meta',         liquid: true },
  { symbol: 'GOOGL', name: 'Alphabet',    liquid: true },
  { symbol: 'AMD',  name: 'AMD',          liquid: true },
  { symbol: 'NFLX', name: 'Netflix',      liquid: true },
  { symbol: 'AVGO', name: 'Broadcom',     liquid: true },
  { symbol: 'COIN', name: 'Coinbase',     liquid: true },
  { symbol: 'PLTR', name: 'Palantir',     liquid: true },
]

export function isKnownStock(symbol: string): boolean {
  return STOCKS_UNIVERSE.some(u => u.symbol === symbol.toUpperCase())
}

// التذبذب المحقّق السنوي% من عوائد الإغلاق اليومية (بديل نزيه عن VIX للسهم)
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

// اتجاه السهم من زخمه اليومي — عتبات أوسع من المؤشر (السهم المفرد أكثر تذبذباً)
export function stockDirection(changePct: number): AdapterDirection {
  if (changePct >= 1.5)   return { type: 'call', label: '▲ السهم صاعد بقوة — عقود شراء (Call)', color: '#10B981', reason: `السهم +${changePct.toFixed(2)}% اليوم — زخم صاعد قوي` }
  if (changePct <= -1.5)  return { type: 'put',  label: '▼ السهم هابط بقوة — عقود هبوط (Put)',  color: '#EF4444', reason: `السهم ${changePct.toFixed(2)}% اليوم — زخم هابط قوي` }
  if (changePct >= 0.6)   return { type: 'call', label: '▲ السهم صاعد — عقود شراء (Call)', color: '#34D399', reason: `السهم +${changePct.toFixed(2)}% اليوم` }
  if (changePct <= -0.6)  return { type: 'put',  label: '▼ السهم هابط — عقود هبوط (Put)',  color: '#F87171', reason: `السهم ${changePct.toFixed(2)}% اليوم` }
  return { type: null, label: '↔ حركة ضعيفة — انتظر', color: '#F59E0B', reason: 'السهم يتحرك بلا اتجاه واضح اليوم — انتظر' }
}

export const stocksAdapter: AssetAdapter = {
  meta: META,
  calibration: STOCKS_CALIBRATION,

  async getUniverse(): Promise<UniverseItem[]> {
    return STOCKS_UNIVERSE
  },

  async getSnapshot(symbol: string): Promise<AssetSnapshot> {
    const sym = symbol.toUpperCase()
    const [quote, bars] = await Promise.all([
      getStockQuote(sym),
      getStockDailyBars(sym, 60).catch(() => []),
    ])
    if (!quote) throw new Error(`تعذر جلب سعر السهم ${sym}`)
    const closes = bars.map(b => b.close)
    const rv = realizedVolPct(closes)
    const atr = atrPct(bars)
    // الحركة المتوقعة اليومية من التذبذب المحقّق (تُصقل لاحقاً من ATM straddle)
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
    return stockDirection(snap.changePct)
  },

  // ── بوابة الأرباح: أخطر حدث لسهم مفرد ──────────────────────────────────────
  async getEventRisk(symbol: string): Promise<EventRisk | null> {
    const { info, inDays } = await getEarningsRisk(symbol, 14)
    if (!info || inDays == null || inDays < 0) return null
    const whenAr = inDays === 0 ? 'اليوم' : inDays === 1 ? 'غداً' : `خلال ${inDays} يوم`
    if (inDays <= 5) {
      return {
        active: true,
        nameAr: 'إعلان الأرباح',
        when: whenAr,
        advice: 'الأرباح أخطر حدث للسهم — لا تشترِ عقوداً قربها. الفجوة الليلية قد تُبخّر العقد حتى لو صحّ اتجاهك، وأسعار العقود تنهار بعد الإعلان.',
        impact: 'high',
      }
    }
    return {
      active: false,
      nameAr: 'إعلان الأرباح',
      when: whenAr,
      advice: `أرباح قادمة ${whenAr} — خطّط لإغلاق أي صفقة قبلها بيوم على الأقل.`,
      impact: 'medium',
    }
  },
}
