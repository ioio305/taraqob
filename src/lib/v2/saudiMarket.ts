// ================================================================
// طبقة بيانات السوق السعودي (خادم فقط) — السوق كاملاً من ياهو مع تخزين مؤقت.
//
// • كل سهم: شموع يومية لسنة من ياهو (XXXX.SR) بتخزين Next لربع ساعة لكل رمز.
// • «اللقطة»: نتيجة محرّك computeConfluence لكل أسهم القائمة، محسوبة مرة واحدة
//   ومخزّنة 5 دقائق (unstable_cache) تتشاركها كل الصفحات (الخطة، الماسح، القطاعات…)
//   بدل أن يجلب كل طلب 250 سهماً من جديد. ياهو مؤخّر ~15 دقيقة أصلاً.
// • الجلب بتوازٍ محدود (لا 250 طلباً دفعة واحدة) مع محاولة ثانية على خادم ياهو البديل.
// ================================================================
import { unstable_cache } from 'next/cache'
import { computeConfluence, windowReturn, type TechnicalScore } from './saudiIndicators'
import { SAUDI_STOCKS, type SaudiStockMeta } from './saudiStocks'
import { SEGMENT_LIST, segmentOf, type SaudiSegment } from './saudiUniverse'
import { firedSignals, type FiredSignal } from './saudiEntry'
import { atrSeries, chandelierLong } from './saudiPro'
import { buildStockExtras, type SaudiStockExtras } from './saudiSignals'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36'
const YF = { 'User-Agent': UA, Accept: 'application/json', 'Accept-Language': 'en-US,en;q=0.9' }
const HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']

export const SNAPSHOT_TTL_SEC = 300
const HISTORY_TTL_SEC = 900
const CONCURRENCY = 12

export type SaudiCandle = { t: number; o: number; h: number; l: number; c: number; v: number }
export type SaudiDaily = { candles: SaudiCandle[]; meta: Record<string, unknown> }

// شموع يومية لرمز تداول (مثل '2222.SR'). null عند الفشل أو قلّة البيانات.
export async function fetchSaudiDaily(yfSymbol: string, range = '1y', ttl = HISTORY_TTL_SEC): Promise<SaudiDaily | null> {
  for (const host of HOSTS) {
    try {
      const url = `https://${host}/v8/finance/chart/${encodeURIComponent(yfSymbol)}?range=${range}&interval=1d`
      const res = await fetch(url, { headers: YF, next: { revalidate: ttl } })
      if (!res.ok) continue
      const result = (await res.json())?.chart?.result?.[0]
      if (!result) continue
      const ts = (result.timestamp as number[]) ?? []
      const q = result.indicators?.quote?.[0] ?? {}
      const candles: SaudiCandle[] = []
      for (let i = 0; i < ts.length; i++) {
        const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i]
        if (o == null || h == null || l == null || c == null || c <= 0) continue
        candles.push({ t: ts[i], o: +o.toFixed(2), h: +h.toFixed(2), l: +l.toFixed(2), c: +c.toFixed(2), v: q.volume?.[i] ?? 0 })
      }
      return { candles, meta: (result.meta ?? {}) as Record<string, unknown> }
    } catch { /* جرّب الخادم البديل */ }
  }
  return null
}

export type IndexQuote = { price: number; changePct: number; high: number; low: number }

// المؤشر العام (تاسي) والنفط (برنت). فشلهما لا يُسقط الأسهم.
export async function fetchYahooIndex(yfSymbol: string): Promise<IndexQuote | null> {
  const d = await fetchSaudiDaily(yfSymbol, '1mo', 60)
  if (!d) return null
  const price = Number(d.meta.regularMarketPrice)
  // إغلاق الجلسة السابقة: الشمعة قبل الأخيرة إن وُجدت. ياهو يحتفظ لتاسي أحياناً بشمعة
  // اليوم وحدها، وعندها يكون chartPreviousClose هو إغلاق أمس.
  const closes = d.candles.map(c => c.c)
  const prev = closes.length >= 2 ? closes[closes.length - 2] : Number(d.meta.chartPreviousClose ?? d.meta.previousClose)
  if (!Number.isFinite(price) || price <= 0) return null
  return {
    price,
    changePct: Number.isFinite(prev) && prev > 0 ? ((price - prev) / prev) * 100 : 0,
    high: Number(d.meta.regularMarketDayHigh) || price,
    low: Number(d.meta.regularMarketDayLow) || price,
  }
}

export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return out
}

export type SaudiStockRow = {
  symbol: string; name: string; sector: string
  price: number; change: number; changeAbs: number
  high: number; low: number; prevClose: number; volume: number
  buyPressure: number; flow: string; flowLabel: string
  techScore: number; techSignal: TechnicalScore['signal']; techSignalEn: TechnicalScore['signalEn']
  rsi: number; macdBullish: boolean; macdHist: number; bbPct: number; stoch: number; roc: number
  ema20Above: boolean; ema50Above: boolean; ema200Above: boolean; golden: boolean; adx: number; vwap: number; priceVsVwap: string
  atr: number; atrPct: number; suggestedStop: number; obvRising: boolean; relStrength: number | null
  bullishCount: number; bearishCount: number
  // إشارات الدخول المرصودة (آخر 3 جلسات) ومخرج الثريا الحالي — انظر saudiEntry.ts.
  entrySignals: FiredSignal[]; chandelier: number | null
} & SaudiStockExtras

export type SaudiSnapshot = {
  asOf: string
  marketReturn: number | null
  universe: number
  stocks: SaudiStockRow[]
}

function rowFor(meta: SaudiStockMeta, d: SaudiDaily, marketReturn: number | undefined): SaudiStockRow | null {
  const cs = d.candles
  if (cs.length < 30) return null
  const closes = cs.map(c => c.c), highs = cs.map(c => c.h), lows = cs.map(c => c.l), volumes = cs.map(c => c.v)
  const last = cs[cs.length - 1]
  const price = Number(d.meta.regularMarketPrice) || last.c
  // إغلاق الجلسة السابقة = الشمعة قبل الأخيرة (chartPreviousClose مع نافذة سنة = إغلاق ما قبل سنة).
  const prev = cs[cs.length - 2].c
  const tech = computeConfluence(closes, highs, lows, volumes, { marketReturn })
  const flowLabel = tech.flow === 'تجميع' ? 'تجميع — شراء قوي' : tech.flow === 'تصريف' ? 'تصريف — بيع قوي' : 'محايد — انتظر'
  return {
    symbol: meta.symbol.replace('.SR', ''), name: meta.name, sector: meta.sector,
    price: +price.toFixed(2),
    change: prev > 0 ? +(((price - prev) / prev) * 100).toFixed(2) : 0,
    changeAbs: +(price - prev).toFixed(2),
    high: +(Number(d.meta.regularMarketDayHigh) || last.h).toFixed(2),
    low: +(Number(d.meta.regularMarketDayLow) || last.l).toFixed(2),
    prevClose: +prev.toFixed(2),
    volume: Number(d.meta.regularMarketVolume) || last.v,
    buyPressure: tech.buyPressure, flow: tech.flow, flowLabel,
    techScore: tech.score, techSignal: tech.signal, techSignalEn: tech.signalEn,
    rsi: tech.rsi, macdBullish: tech.macd.bullish, macdHist: tech.macd.hist, bbPct: tech.bb.pct, stoch: tech.stoch, roc: tech.roc,
    ema20Above: tech.ema20Above, ema50Above: tech.ema50Above, ema200Above: tech.ema200Above, golden: tech.golden,
    adx: tech.adx, vwap: tech.vwap, priceVsVwap: tech.priceVsVwap,
    atr: tech.atr, atrPct: tech.atrPct, suggestedStop: tech.suggestedStop, obvRising: tech.obvRising, relStrength: tech.relStrength,
    bullishCount: tech.bullishCount, bearishCount: tech.bearishCount,
    ...buildStockExtras(cs, price, tech),
    entrySignals: firedSignals(cs, tech.relStrength != null ? tech.relStrength / 100 : null),
    chandelier: chandelierLong(cs, atrSeries(cs)).at(-1) ?? null,
  }
}

// اللقطة لقائمة رموز (الافتراضي السوق الرئيسية — المحرّك معاير عليها). مرجع القوة النسبية
// يُحسب من القائمة نفسها: «نمو» تُقاس بـ«نمو» والصناديق بالصناديق.
export async function buildSaudiSnapshot(list: SaudiStockMeta[] = SAUDI_STOCKS): Promise<SaudiSnapshot> {
  const histories = await mapLimit(list, CONCURRENCY, s => fetchSaudiDaily(s.symbol))
  // مرجع السوق للقوة النسبية = متوسط عائد أسهم السوق على ~3 أشهر (نفس منطق الاختبار التاريخي).
  const returns = histories
    .filter((h): h is SaudiDaily => !!h && h.candles.length > 63)
    .map(h => windowReturn(h.candles.map(c => c.c), 63))
  const marketReturn = returns.length >= 5 ? returns.reduce((a, b) => a + b, 0) / returns.length : undefined
  const stocks = list
    .map((s, i) => (histories[i] ? rowFor(s, histories[i]!, marketReturn) : null))
    .filter((x): x is SaudiStockRow => x !== null)
    .sort((a, b) => b.techScore - a.techScore)
  if (!stocks.length) throw new Error('تعذّر الاتصال بمصدر البيانات')
  return { asOf: new Date().toISOString(), marketReturn: marketReturn ?? null, universe: list.length, stocks }
}

// اللقطة المشتركة — تُحسب مرة كل 5 دقائق على الأكثر. الخطأ لا يُخزَّن (يُعاد المحاولة).
export const getSaudiSnapshot = unstable_cache(() => buildSaudiSnapshot(), ['saudi-snapshot-v2'], {
  revalidate: SNAPSHOT_TTL_SEC,
  tags: ['saudi-snapshot'],
})

const getNomuSnapshot = unstable_cache(() => buildSaudiSnapshot(SEGMENT_LIST.nomu), ['saudi-snapshot-nomu-v2'], {
  revalidate: SNAPSHOT_TTL_SEC,
  tags: ['saudi-snapshot'],
})

const getFundsSnapshot = unstable_cache(() => buildSaudiSnapshot(SEGMENT_LIST.funds), ['saudi-snapshot-funds-v2'], {
  revalidate: SNAPSHOT_TTL_SEC,
  tags: ['saudi-snapshot'],
})

// لقطة منصة من منصّات السوق السعودي الثلاث.
export function getSegmentSnapshot(segment: SaudiSegment): Promise<SaudiSnapshot> {
  return segment === 'nomu' ? getNomuSnapshot() : segment === 'funds' ? getFundsSnapshot() : getSaudiSnapshot()
}

// أسعار رموز من أي منصة (المحفظة والتنبيهات): تُجلب لقطات المنصّات المطلوبة فقط.
// فشل منصة لا يُسقط البقية.
export async function getSaudiRowsFor(codes: string[]): Promise<Map<string, SaudiStockRow>> {
  const segments = new Set<SaudiSegment>()
  for (const c of codes) segments.add(segmentOf(c) ?? 'main')
  const snaps = await Promise.all(Array.from(segments).map(seg => getSegmentSnapshot(seg).catch(() => null)))
  const map = new Map<string, SaudiStockRow>()
  for (const snap of snaps) for (const row of snap?.stocks ?? []) map.set(row.symbol, row)
  return map
}

export function marketStatus(now = new Date()): 'open' | 'closed' | 'pre' {
  const riyadh = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Riyadh' }))
  const day = riyadh.getDay()
  const minutes = riyadh.getHours() * 60 + riyadh.getMinutes()
  const tradingDay = day >= 0 && day <= 4
  if (tradingDay && minutes >= 600 && minutes < 900) return 'open'
  if (tradingDay && minutes < 600) return 'pre'
  return 'closed'
}
