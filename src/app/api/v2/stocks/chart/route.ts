import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getStockIntradayBars, getStockDailyBars } from '@/lib/v2/stockData'
import { isKnownStock } from '@/lib/v2/adapters/stocksAdapter'
import {
  type RawBar,
  ema, rsi, macdFn, bollinger, atrFn, computeVwap,
  analyzeMarket, defaultAnalysis, crashGuard, applyCrashGuard,
} from '@/lib/v2/marketAnalysis'
import { evaluateMarketReaction } from '@/lib/v2/marketReaction'

export const dynamic = 'force-dynamic'
const NO_STORE = { 'Cache-Control': 'no-store, max-age=0, must-revalidate' }

// ── شارت + تحليل فني للأسهم ───────────────────────────────────────────────────
// يعيد استخدام محرك التحليل المشترك (analyzeMarket) على شموع السهم نفسه.
// المنصة تحت المعايرة → أي «ادخل الآن» من التحليل يُخفَّض إلى «راقب» بنص صادق
// (إحصاءات 51% مُعايَرة على SPX لا الأسهم).

type TfId = '15m' | '1h' | '1d'
const TF: Record<TfId, { intraday: boolean; interval: string }> = {
  '15m': { intraday: true,  interval: '15min' },
  '1h':  { intraday: true,  interval: '1h' },
  '1d':  { intraday: false, interval: 'daily' },
}

const WATCH_ONLY_TEXT =
  'منصة الشركات تحت المعايرة — هذا التحليل للمراقبة والتعلّم فقط، لا توصية دخول بعد.'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const symbol = (searchParams.get('symbol') ?? 'AAPL').toUpperCase()
  const tf = (searchParams.get('tf') ?? '1d') as TfId
  const cfg = TF[tf] ?? TF['1d']

  if (!/^[A-Z]{1,6}$/.test(symbol)) {
    return NextResponse.json({ success: false, symbol, error: 'رمز غير صالح', candles: [], analysis: defaultAnalysis() }, { headers: NO_STORE })
  }

  let bars: RawBar[] = []
  try {
    bars = cfg.intraday
      ? await getStockIntradayBars(symbol, cfg.interval)
      : await getStockDailyBars(symbol, 365)
  } catch { /* أدناه */ }

  if (bars.length < 20) {
    return NextResponse.json(
      { success: false, symbol, tf, candles: [], analysis: defaultAnalysis(), error: 'بيانات غير كافية للشارت' },
      { headers: NO_STORE },
    )
  }

  const closes = bars.map(b => b.close)
  const highs = bars.map(b => b.high)
  const lows = bars.map(b => b.low)

  const ema9Arr = ema(closes, 9)
  const ema21Arr = ema(closes, 21)
  const ema50Arr = ema(closes, 50)
  const ema200Arr = closes.length >= 200 ? ema(closes, 200) : closes.map(() => null)
  const rsiArr = rsi(closes)
  const { macdLine, signalLine, histogram } = macdFn(closes)
  const { upper: bbUpper, mid: bbMid, lower: bbLower, width: bbWidth } = bollinger(closes)
  const atrArr = atrFn(highs, lows, closes)
  const vwapArr = cfg.intraday ? computeVwap(bars) : bars.map(() => null)

  const n2 = (v: number | null) => (v !== null ? +v.toFixed(2) : null)
  const n1 = (v: number | null) => (v !== null ? +v.toFixed(1) : null)

  const candles = bars.map((b, i) => ({
    time: b.time, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume,
    ema9: n2(ema9Arr[i]), ema21: n2(ema21Arr[i]), ema50: n2(ema50Arr[i]), ema200: n2(ema200Arr[i]),
    vwap: n2(vwapArr[i]), rsi: n1(rsiArr[i]),
    macdLine: n2(macdLine[i]), macdSignal: n2(signalLine[i]), macdHist: n2(histogram[i]),
    bbUpper: n2(bbUpper[i]), bbMid: n2(bbMid[i]), bbLower: n2(bbLower[i]), atr: n2(atrArr[i]),
  }))

  const analysis = analyzeMarket(bars, {
    ema9: ema9Arr, ema21: ema21Arr, ema50: ema50Arr, ema200: ema200Arr,
    rsiArr, macdLine, sigLine: signalLine, histArr: histogram,
    bbUpper, bbMid, bbLower, bbWidth, atrArr, vwapArr,
  })

  const reaction = evaluateMarketReaction({
    bars: bars.map((b, i) => ({ ...b, vwap: vwapArr[i] })),
    spxChangePct: bars.length >= 2 ? ((bars[bars.length - 1].close - bars[bars.length - 2].close) / bars[bars.length - 2].close) * 100 : null,
  })
  analysis.marketReaction = reaction

  // حارس الانهيارات على شموع السهم اليومية
  try {
    const daily = cfg.intraday ? await getStockDailyBars(symbol, 60).catch(() => []) : bars
    applyCrashGuard(analysis, crashGuard(daily, null))
  } catch { /* تجاهل */ }

  // ── بوابة المعايرة: لا «ادخل الآن» للأسهم — نخفّض ونستبدل النص بصدق ──────────
  if (analysis.summary.decisionCode === 'execute' || analysis.summary.decisionCode === 'conditional') {
    analysis.summary.decisionCode = 'watch'
    analysis.summary.decisionText = WATCH_ONLY_TEXT
  } else if (analysis.summary.decisionCode === 'watch') {
    analysis.summary.decisionText = 'التحليل يميل للمراقبة — انتظر تأكيداً. ' + WATCH_ONLY_TEXT
  }

  const last = bars[bars.length - 1]
  const prev = bars[bars.length - 2]
  const changePct = prev && prev.close > 0 ? ((last.close - prev.close) / prev.close) * 100 : 0

  return NextResponse.json({
    success: true,
    symbol,
    known: isKnownStock(symbol),
    tf,
    price: last.close,
    changePct: Math.round(changePct * 100) / 100,
    candles,
    analysis,
    updatedAt: new Date().toISOString(),
    lastCandleAt: last.time,
  }, { headers: NO_STORE })
}
