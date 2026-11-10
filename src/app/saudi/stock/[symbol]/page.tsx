'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useSaudiFavorites } from '@/lib/v2/saudiFavorites'
import { SAUDI_CALIBRATION } from '@/lib/v2/saudiIndicators'

const ACCENT = '#16A34A'
const RED = '#F04760'

type Tech = {
  score: number; signal: string; signalEn: string
  rsi: number; macd: { bullish: boolean; hist: number }; bb: { pct: number }; stoch: number; roc: number
  ema20Above: boolean; ema50Above: boolean; ema200Above: boolean; golden: boolean; adx: number; vwap: number; priceVsVwap: string
  atr: number; atrPct: number; suggestedStop: number
  buyPressure: number; flow: string; obvRising: boolean; relStrength: number | null; bullishCount: number; bearishCount: number
}
type StockData = {
  symbol: string; name: string; sector: string; segment?: string; segmentLabel?: string
  price: number; prevClose: number; changeAbs: number; change: number
  high52: number; low52: number
  tech: Tech; series: number[]
  quote?: { bid: number | null; ask: number | null; netLiquidity: number | null; updatedAt: string | null } | null
  quotes?: { delayed: boolean; label: string; attribution: string | null }
  error?: string
}

function n(v: number | null | undefined, d = 2) {
  if (v == null || Number.isNaN(v)) return '—'
  return v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
}
function signalColor(en: string) {
  if (en === 'strong_buy' || en === 'buy') return ACCENT
  if (en === 'sell' || en === 'strong_sell') return RED
  return '#60A5FA'
}
function flowColor(flow: string) {
  return flow === 'تجميع' ? ACCENT : flow === 'تصريف' ? RED : '#8A97A6'
}

function Sparkline({ series, color }: { series: number[]; color: string }) {
  if (series.length < 2) return null
  const min = Math.min(...series), max = Math.max(...series)
  const range = max - min || 1
  const w = 320, h = 64
  const pts = series.map((v, i) => `${(i / (series.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-16 w-full" preserveAspectRatio="none" aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

function Tile({ label, value, color, hint }: { label: string; value: string; color?: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-white/8 px-3 py-2.5" style={{ background: 'rgba(255,255,255,.02)' }}>
      <div className="text-[10px] text-slate-500">{label}</div>
      <div className="mt-0.5 text-sm font-black" style={{ color: color ?? '#E2E8F0' }}>{value}</div>
      {hint ? <div className="text-[10px] text-slate-600">{hint}</div> : null}
    </div>
  )
}

export default function SaudiStockPage() {
  const params = useParams<{ symbol: string }>()
  const symbol = String(params?.symbol ?? '')
  const { isFavorite, toggle } = useSaudiFavorites()

  const [data, setData] = useState<StockData | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    if (!symbol) return
    try {
      const res = await fetch(`/api/v2/saudi/stock/${encodeURIComponent(symbol)}`)
      const json = (await res.json()) as StockData
      if (!res.ok || json.error) setErr(json.error ?? 'تعذّر تحميل تحليل السهم')
      else { setData(json); setErr('') }
    } catch { setErr('تعذّر الاتصال بمصدر البيانات') }
    setLoading(false)
  }, [symbol])

  useEffect(() => { load() }, [load])

  const t = data?.tech
  const sc = t ? signalColor(t.signalEn) : ACCENT
  const up = (data?.change ?? 0) >= 0

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 pb-24">
      <Link href="/saudi" className="text-xs text-slate-500 transition-colors hover:text-white">→ السوق السعودي</Link>

      {loading && !data ? (
        <div className="flex h-56 flex-col items-center justify-center gap-2">
          <div className="h-6 w-6 animate-spin rounded-full border-2" style={{ borderColor: ACCENT, borderTopColor: 'transparent' }} />
          <div className="text-sm text-slate-400">يحلّل {symbol}…</div>
        </div>
      ) : !data ? (
        <div className="flex h-56 items-center justify-center text-sm text-slate-500">{err || 'تعذّر التحميل'}</div>
      ) : (
        <>
          {/* ترويسة السهم */}
          <div className="rounded-3xl border-2 p-5" style={{ borderColor: sc, background: `linear-gradient(135deg, ${sc}14, rgba(255,255,255,.02) 55%)` }}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-white">{data.name}</span>
                  <span className="rounded-md px-2 py-0.5 text-[11px] font-bold text-slate-400" style={{ background: 'rgba(255,255,255,.06)' }}>{data.symbol}</span>
                  <button type="button" aria-label={isFavorite(data.symbol) ? 'إزالة من المفضّلة' : 'إضافة للمفضّلة'}
                    onClick={() => toggle(data.symbol)} className="text-xl leading-none"
                    style={{ color: isFavorite(data.symbol) ? '#F5B301' : '#475569' }}>
                    {isFavorite(data.symbol) ? '★' : '☆'}
                  </button>
                  <Link href={`/saudi/alerts?symbol=${encodeURIComponent(data.symbol)}`} aria-label="ضع تنبيهاً سعرياً"
                    title="نبّهني عند سعر" className="text-lg leading-none text-slate-500 hover:text-amber-300">🔔</Link>
                </div>
                <div className="mt-1 text-xs text-slate-500">{data.sector}{data.segment && data.segment !== 'main' ? ` · ${data.segmentLabel}` : ''}</div>
                <div className="mt-3 flex items-end gap-3">
                  <span className="text-3xl font-black text-white">{n(data.price)}</span>
                  <span className="pb-1 text-sm font-bold" style={{ color: up ? ACCENT : RED }}>
                    {up ? '+' : ''}{n(data.changeAbs)} ({up ? '+' : ''}{n(data.change)}%)
                  </span>
                </div>
                {data.quotes ? (
                  <div className="mt-1 text-[10px] font-bold" style={{ color: data.quotes.delayed ? '#F5B301' : ACCENT }}>
                    {data.quotes.delayed ? '⏱ ' : '● '}{data.quotes.label}{data.quotes.attribution ? ` · ${data.quotes.attribution}` : ''}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col items-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full border-4" style={{ borderColor: sc, background: `${sc}14` }}>
                  <span className="text-2xl font-black" style={{ color: sc }}>{t!.score}</span>
                </div>
                <span className="mt-1 text-[10px] text-slate-500">قوة فنية من 100</span>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5 text-xs">
              <span className="rounded-full px-3 py-1 font-black" style={{ color: sc, background: `${sc}1e` }}>{t!.signal}</span>
              <span className="rounded-full px-3 py-1 font-bold" style={{ color: t!.ema200Above ? ACCENT : RED, background: `${t!.ema200Above ? ACCENT : RED}18` }}>{t!.golden && t!.ema200Above ? 'اتجاه صاعد مؤكّد' : t!.ema200Above ? 'فوق متوسط 200' : 'تحت متوسط 200'}</span>
              {t!.relStrength != null ? <span className="rounded-full px-3 py-1 font-bold" style={{ color: t!.relStrength >= 0 ? ACCENT : RED, background: `${t!.relStrength >= 0 ? ACCENT : RED}18` }}>قوة نسبية {t!.relStrength >= 0 ? '+' : ''}{t!.relStrength}% مقابل السوق</span> : null}
              <span className="rounded-full px-3 py-1 font-bold" style={{ color: flowColor(t!.flow), background: `${flowColor(t!.flow)}18` }}>السيولة: {t!.flow} ({t!.buyPressure}% شراء)</span>
            </div>
            <div className="mt-4"><Sparkline series={data.series} color={sc} /></div>
            <div className="mt-1 text-left text-[10px] text-slate-600">آخر 60 جلسة · المدى (سنة): {n(data.low52)} — {n(data.high52)}</div>
          </div>

          {/* شبكة المؤشرات */}
          <div>
            <div className="mb-2 text-xs font-bold text-slate-500">المؤشرات الفنية ({t!.bullishCount} إيجابي · {t!.bearishCount} سلبي)</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Tile label="الزخم RSI" value={String(t!.rsi)} color={t!.rsi > 55 ? ACCENT : t!.rsi < 45 ? RED : undefined} hint={t!.rsi > 70 ? 'تشبّع شراء' : t!.rsi < 30 ? 'تشبّع بيع' : 'متوازن'} />
              <Tile label="MACD" value={t!.macd.bullish ? 'إيجابي' : 'سلبي'} color={t!.macd.bullish ? ACCENT : RED} hint={`الهستوغرام ${n(t!.macd.hist, 3)}`} />
              <Tile label="قوة الاتجاه ADX" value={String(t!.adx)} color={t!.adx > 25 ? ACCENT : undefined} hint={t!.adx > 25 ? 'اتجاه قوي' : 'سوق عرضي'} />
              <Tile label="ستوكاستك" value={String(t!.stoch)} hint={t!.stoch >= 80 ? 'تشبّع' : t!.stoch > 50 ? 'زخم إيجابي' : 'ضعيف'} />
              <Tile label="بولنجر %" value={`${t!.bb.pct}%`} hint={t!.bb.pct > 85 ? 'عند الحد العلوي' : t!.bb.pct < 15 ? 'عند الحد السفلي' : 'ضمن القناة'} />
              <Tile label="VWAP" value={n(t!.vwap)} color={t!.priceVsVwap === 'above' ? ACCENT : RED} hint={t!.priceVsVwap === 'above' ? 'السعر أعلى — قوة' : 'السعر أدنى — ضعف'} />
              <Tile label="فوق EMA20" value={t!.ema20Above ? 'نعم' : 'لا'} color={t!.ema20Above ? ACCENT : RED} />
              <Tile label="فوق EMA50" value={t!.ema50Above ? 'نعم' : 'لا'} color={t!.ema50Above ? ACCENT : RED} />
              <Tile label="ضغط الشراء" value={`${t!.buyPressure}%`} color={t!.buyPressure > 58 ? ACCENT : t!.buyPressure < 42 ? RED : undefined} hint={t!.flow} />
              <Tile label="فوق EMA200 (الاتجاه)" value={t!.ema200Above ? 'نعم' : 'لا'} color={t!.ema200Above ? ACCENT : RED} hint={t!.golden ? 'تقاطع ذهبي 50/200' : 'تحت الذهبي'} />
              <Tile label="قوة الزخم ROC" value={`${t!.roc}%`} color={t!.roc > 0 ? ACCENT : RED} />
              <Tile label="الحجم التراكمي OBV" value={t!.obvRising ? 'صاعد' : 'هابط'} color={t!.obvRising ? ACCENT : RED} />
              <Tile label="وقف مقترح (2×ATR)" value={n(t!.suggestedStop)} color={RED} hint={`تقلّب ${t!.atrPct}%`} />
              {t!.relStrength != null ? <Tile label="قوة نسبية مقابل السوق" value={`${t!.relStrength >= 0 ? '+' : ''}${t!.relStrength}%`} color={t!.relStrength >= 0 ? ACCENT : RED} hint="تفوّق/تخلّف عن السوق" /> : null}
              {data.quote?.bid != null && data.quote?.ask != null ? <Tile label="أفضل طلب / عرض" value={`${n(data.quote.bid)} / ${n(data.quote.ask)}`} hint="من سهمك" /> : null}
              {data.quote?.netLiquidity != null ? (
                <Tile label="صافي السيولة اليوم" value={`${(data.quote.netLiquidity / 1e6).toFixed(1)} م ر.س`}
                  color={data.quote.netLiquidity >= 0 ? ACCENT : RED} hint={data.quote.netLiquidity >= 0 ? 'دخول أموال' : 'خروج أموال'} />
              ) : null}
            </div>
          </div>

          <div className="rounded-xl border border-white/8 px-4 py-3 text-[11px] leading-5 text-slate-500" style={{ background: 'rgba(255,255,255,.015)' }}>
            <span className="font-bold text-amber-300/80">قيد المعايرة: </span>{SAUDI_CALIBRATION.summary} البيانات من مصادر عامة (ياهو) وقد تتأخر. القرار النهائي مسؤوليتك.
          </div>
        </>
      )}
    </div>
  )
}
