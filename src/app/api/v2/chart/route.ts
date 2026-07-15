import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getNewsResult } from '@/app/api/v2/news/route'
import { evaluateMarketReaction } from '@/lib/v2/marketReaction'
import { getIntradayBars, getHistoryBars, getMarketSnapshot } from '@/lib/v2/marketData'
import {
  type RawBar,
  ema, rsi, macdFn, bollinger, atrFn, computeVwap, aggregateBars,
  analyzeMarket, defaultAnalysis, applyGamma,
} from '@/lib/v2/marketAnalysis'
import { getGammaExposure } from '@/lib/v2/gammaExposure'

export const dynamic = 'force-dynamic'

// ─── Timeframe config ─────────────────────────────────────────────────────────

// ─── Timeframe config ─────────────────────────────────────────────────────────

type TfId = '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '1d' | '1w' | '1M'

const TF_CONFIG: Record<TfId, {
  intraday:        boolean
  tradierInterval: string
  aggregate:       number   // bars to merge (1 = none)
  days:            number   // lookback calendar days
}> = {
  '1m':  { intraday: true,  tradierInterval: '1min',    aggregate: 1, days: 2   },
  '3m':  { intraday: true,  tradierInterval: '1min',    aggregate: 3, days: 3   },
  '5m':  { intraday: true,  tradierInterval: '5min',    aggregate: 1, days: 5   },
  '15m': { intraday: true,  tradierInterval: '15min',   aggregate: 1, days: 10  },
  '30m': { intraday: true,  tradierInterval: '15min',   aggregate: 2, days: 20  },
  '1h':  { intraday: true,  tradierInterval: '15min',   aggregate: 4, days: 40  },
  '1d':  { intraday: false, tradierInterval: 'daily',   aggregate: 1, days: 365 },
  '1w':  { intraday: false, tradierInterval: 'weekly',  aggregate: 1, days: 1095},
  '1M':  { intraday: false, tradierInterval: 'monthly', aggregate: 1, days: 1825},
}

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const tf  = (searchParams.get('tf') ?? '1d') as TfId
  const cfg = TF_CONFIG[tf] ?? TF_CONFIG['1d']

  let bars: RawBar[] = []

  try {
    if (cfg.intraday) {
      bars = await getIntradayBars(cfg.tradierInterval, cfg.days)
      if (cfg.aggregate > 1) bars = aggregateBars(bars, cfg.aggregate)
    } else {
      bars = await getHistoryBars(cfg.tradierInterval, cfg.days)
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 })
  }

  if (bars.length < 10) {
    return NextResponse.json({ tf, symbol: 'SPX', candles: [], analysis: defaultAnalysis(), error: 'بيانات غير كافية — تعذّر جلب الشموع' })
  }

  const closes = bars.map(b => b.close)
  const highs  = bars.map(b => b.high)
  const lows   = bars.map(b => b.low)

  const ema9Arr  = ema(closes, 9)
  const ema21Arr = ema(closes, 21)
  const ema50Arr = ema(closes, 50)
  const ema200Arr = closes.length >= 200 ? ema(closes, 200) : closes.map(() => null)
  const rsiArr   = rsi(closes)
  const { macdLine, signalLine, histogram } = macdFn(closes)
  const { upper: bbUpper, mid: bbMid, lower: bbLower, width: bbWidth } = bollinger(closes)
  const atrArr   = atrFn(highs, lows, closes)
  const vwapArr  = cfg.intraday ? computeVwap(bars) : bars.map(() => null)

  const n2 = (v: number | null) => v !== null ? +v.toFixed(2) : null
  const n1 = (v: number | null) => v !== null ? +v.toFixed(1) : null

  const candles = bars.map((b, i) => ({
    time:       b.time,
    open:       b.open, high: b.high, low: b.low, close: b.close, volume: b.volume,
    ema9:       n2(ema9Arr[i]),
    ema21:      n2(ema21Arr[i]),
    ema50:      n2(ema50Arr[i]),
    ema200:     n2(ema200Arr[i]),
    vwap:       n2(vwapArr[i]),
    rsi:        n1(rsiArr[i]),
    macdLine:   n2(macdLine[i]),
    macdSignal: n2(signalLine[i]),
    macdHist:   n2(histogram[i]),
    bbUpper:    n2(bbUpper[i]),
    bbMid:      n2(bbMid[i]),
    bbLower:    n2(bbLower[i]),
    bbWidth:    n1(bbWidth[i]),
    atr:        n2(atrArr[i]),
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

  const news = await getNewsResult().catch(() => null)
  if (news?.decision) {
    analysis.newsRisk = news.decision
    if (news.decision.action === 'block') {
      analysis.summary.decisionCode = 'no_entry'
      analysis.summary.decisionText = 'لا تدخل — التوصيات معلقة بسبب خبر مؤثر'
      analysis.summary.entryCondition = `انتظر انتهاء نافذة الخطر: ${news.decision.reason}`
      analysis.summary.cancelCondition = 'إلغاء أي دخول جديد حتى تهدأ ردة فعل السوق بعد الخبر'
    } else if (news.decision.action === 'caution' && analysis.summary.decisionCode === 'execute') {
      analysis.summary.decisionCode = 'conditional'
      analysis.summary.decisionText = 'دخول مشروط — يوجد خطر إخباري'
      analysis.summary.entryCondition = `${analysis.summary.entryCondition} + تأكيد بعد الخبر`
    }
  }
  if (reaction.action === 'block') {
    analysis.summary.decisionCode = 'no_entry'
    analysis.summary.decisionText = 'لا تدخل — رد فعل السوق حاد'
    analysis.summary.entryCondition = `انتظر هدوء الحركة: ${reaction.reason}`
    analysis.summary.cancelCondition = 'إلغاء أي دخول جديد عند اندفاع الحجم أو كسر VWAP بعنف'
  } else if (reaction.action === 'caution' && analysis.summary.decisionCode === 'execute') {
    analysis.summary.decisionCode = 'conditional'
    analysis.summary.decisionText = 'دخول مشروط — رد فعل السوق متوتر'
    analysis.summary.entryCondition = `${analysis.summary.entryCondition} + تأكيد شمعة إضافية بعد الحركة`
  }

  // ── انكشاف جاما: يغذّي القرار (جاما موجبة عند المقاومة → تخفيض) ──────────────
  const gamma = await getGammaExposure().catch(() => null)
  if (gamma && analysis.summary.decisionCode !== 'no_entry' && reaction.action !== 'block' && news?.decision?.action !== 'block') {
    applyGamma(analysis, gamma)
  }

  // ── نطاق الحركة المتوقعة لليوم (من VIX) ──────────────────────────────────────
  // نستخدم آخر سعر في الشموع نفسها كمرجع (لا سعر منفصل) — ليتطابق النطاق مع الشارت
  let em: { upper: number; lower: number; points: number } | null = null
  try {
    const snap = await getMarketSnapshot()
    const spot = bars[bars.length - 1].close || snap.spxPrice
    if (spot > 0) {
      const points = Math.round(spot * (snap.vixPrice / 100) * Math.sqrt(1 / 252))
      em = { upper: Math.round(spot + points), lower: Math.round(spot - points), points }
    }
  } catch { /* تجاهل */ }

  return NextResponse.json({ tf, symbol: 'SPX', candles, analysis, gamma, em })
}
