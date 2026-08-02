import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getMarketSnapshot, getOptionsChain, getExpirations } from '@/lib/v2/marketData'
import { getGammaExposure } from '@/lib/v2/gammaExposure'
import { getStockQuote, getStockExpirations, getStockChain } from '@/lib/v2/stockData'

export const dynamic = 'force-dynamic'

function todayET(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
}
function marketClosedNow(): boolean {
  const ny = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const day = ny.getDay(); const t = ny.getHours() * 60 + ny.getMinutes()
  return day === 0 || day === 6 || t >= 16 * 60 || t < 9 * 60 + 30
}

// ── مساعد الخروج: تقيّم صفقة قائمة وتعطي قرار خروج ──────────────────────────
export async function GET(req: NextRequest) {
  const p = new URL(req.url).searchParams
  const strike = parseFloat(p.get('strike') ?? '')
  const type = (p.get('type') ?? 'call') as 'call' | 'put'
  const entry = parseFloat(p.get('entry') ?? '')     // سعر دخولك (لكل سهم)
  const expiryParam = p.get('expiry') ?? ''

  if (!strike || strike <= 0) return NextResponse.json({ error: 'أدخل رقم السترايك' })
  if (!entry || entry <= 0)   return NextResponse.json({ error: 'أدخل سعر دخولك (مثال: 4.60)' })

  // المؤشرات الأخرى (NDX/SPY/QQQ) لها فرعها الخاص — مسار SPX أدناه لا يتغير إطلاقاً
  const symbol = (p.get('symbol') ?? 'SPX').toUpperCase()
  if (symbol === 'NDX' || symbol === 'SPY' || symbol === 'QQQ') {
    return indexExitPlan({ symbol, strike, type, entry, expiryParam })
  }

  const snap = await getMarketSnapshot()
  const spx = snap.spxPrice
  if (!spx) return NextResponse.json({ error: 'تعذر جلب سعر SPX' })
  const spxPrev = snap.spxPrev ?? spx
  const chgPct = spxPrev > 0 ? ((spx - spxPrev) / spxPrev) * 100 : 0

  // تاريخ الانتهاء
  const exps = await getExpirations()
  const closed = marketClosedNow()
  const today = todayET()
  const exp = (expiryParam && /^\d{4}-\d{2}-\d{2}$/.test(expiryParam))
    ? expiryParam
    : (exps.find(e => closed ? e > today : e >= today) ?? exps.find(e => e >= today) ?? exps[0] ?? today)

  const { options, estimated } = await getOptionsChain(exp, spx, snap.vixPrice)
  const c = options.find(o => o.option_type === type && Math.round(o.strike) === Math.round(strike))
  if (!c) return NextResponse.json({ error: 'لم يُعثر على العقد في هذا التاريخ' })

  const bid = c.bid ?? 0, ask = c.ask ?? 0
  const mid = bid && ask ? Math.round((bid + ask) / 2 * 100) / 100 : (c.last ?? 0)
  const delta = Math.abs(c.greeks?.delta ?? 0)
  const dte = Math.max(0, Math.round((new Date(exp + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86400000))

  // ربح/خسارة (لكل عقد ×100)
  const pnlPerShare = mid - entry
  const pnlPct = entry > 0 ? (pnlPerShare / entry) * 100 : 0
  const pnlTotal = Math.round(pnlPerShare * 100)

  // الوقف: 35% من الدخول
  const stopPrice = Math.round(entry * 0.65 * 100) / 100
  const stopSpx = delta > 0.02 ? Math.round(spx + (stopPrice - mid) / (type === 'call' ? delta : -delta)) : null

  // جاما + النظرية
  const gamma = await getGammaExposure().catch(() => null)
  // اتجاه السوق
  const bias: 'صاعد' | 'هابط' | 'محايد' = chgPct >= 0.3 ? 'صاعد' : chgPct <= -0.3 ? 'هابط' : 'محايد'
  // هل النظرية سليمة؟ call يحتاج ألا يكون الاتجاه هابطاً بقوة، put العكس
  const thesisValid = type === 'call' ? bias !== 'هابط' : bias !== 'صاعد'
  // جاما ضدك؟ (call فوق مقاومة جاما = صعود مكبوح؛ put تحت دعم جاما)
  const gammaAgainst = gamma
    ? (type === 'call' ? (gamma.callWall != null && spx >= gamma.callWall) : (gamma.putWall != null && spx <= gamma.putWall))
    : false

  // تحذير الوقت (ثيتا): 0DTE بعد منتصف اليوم
  const ny = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const timeWarn = dte === 0 && !closed && ny.getHours() >= 13

  // ── القرار ───────────────────────────────────────────────────────────────
  let verdict: 'exit_now' | 'exit_thesis' | 'manage_profit' | 'hold_cautious' | 'standby'
  let verdictText: string, actionText: string

  if (closed) {
    verdict = 'standby'
    verdictText = 'السوق مغلق — التقييم عند الفتح'
    actionText = `مركزك حالياً ${pnlTotal >= 0 ? 'رابح' : 'خاسر'} ${Math.abs(pnlTotal)}$. جهّز خطة: الوقف عند $${stopPrice}.`
  } else if (mid <= stopPrice) {
    verdict = 'exit_now'
    verdictText = 'اخرج فوراً — وصل الوقف'
    actionText = `الخسارة بلغت ${Math.abs(pnlPct).toFixed(0)}%. لا تعاند — أغلق المركز الآن.`
  } else if (!thesisValid || gammaAgainst) {
    verdict = 'exit_thesis'
    verdictText = 'اخرج — السبب انتهى'
    actionText = !thesisValid
      ? `الاتجاه ${bias} صار ضدّ عقدك. النظرية ماتت — اخرج وأعد التقييم.`
      : `السعر عند جدار جاما المعاكس — الحركة مكبوحة ضدّك. اخرج.`
  } else if (pnlPerShare > 0) {
    verdict = 'manage_profit'
    const bigWin = pnlPct >= 60
    const nextWall = type === 'call' ? (gamma?.callWall ?? null) : (gamma?.putWall ?? null)
    verdictText = bigWin ? 'اربح الآن — لا تطمع' : 'أدِر الربح بذكاء'
    actionText = bigWin
      ? `رابح ${pnlTotal}$ (${pnlPct.toFixed(0)}%). الطمع يذهب ما جمع — بِع نصف مركزك الآن (تؤمّن ~$${Math.round(pnlTotal / 2)})، وارفع الوقف للتعادل، ودع الباقي يجري${nextWall ? ` نحو ${nextWall}` : ''}.`
      : `رابح ${pnlTotal}$ (${pnlPct.toFixed(0)}%). ${pnlPct >= 30 ? `بِع نصف العقود وارفع الوقف إلى التعادل ($${entry})` : `راقب الوقف عند $${stopPrice}`}، ودع الباقي يجري${nextWall ? ` نحو جدار جاما ${nextWall}` : ''}.`
  } else {
    verdict = 'hold_cautious'
    verdictText = 'احتفظ بحذر — السبب سليم'
    actionText = `خسارة بسيطة (${Math.abs(pnlPct).toFixed(0)}%) والسبب ما زال قائماً. راقب الوقف عند $${stopPrice}${timeWarn ? ' — وانتبه: الوقت يتآكل بعد الظهر (0DTE).' : '.'}`
  }

  // اقتراح دحرجة: إن كان الاتجاه سليماً لكن الستريك بعيد/بطيء (دلتا منخفضة)
  let roll: { strike: number; ask: number; delta: number; reason: string } | null = null
  if (thesisValid && delta < 0.18) {
    const better = options
      .filter(o => o.option_type === type && (o.ask ?? 0) >= 0.5 && (o.ask ?? 0) <= 6)
      .map(o => ({ o, d: Math.abs(o.greeks?.delta ?? 0) }))
      .filter(x => x.d >= 0.22 && x.d <= 0.48)
      .sort((a, b) => Math.abs(a.d - 0.33) - Math.abs(b.d - 0.33))[0]
    if (better) roll = {
      strike: better.o.strike, ask: better.o.ask ?? 0, delta: Math.round(better.d * 100) / 100,
      reason: `ستريكك الحالي بطيء (دلتا ${delta.toFixed(2)}). ${better.o.strike} أسرع تفاعلاً (دلتا ${better.d.toFixed(2)}) — فكّر بالدحرجة إليه.`,
    }
  }

  // ── خطة إدارة الربح (إن كان رابحاً) — ضد الطمع ──────────────────────────────
  const nextWallForTarget = type === 'call' ? (gamma?.callWall ?? null) : (gamma?.putWall ?? null)
  const profitPlan = pnlPerShare > 0 ? {
    scaleOut: pnlPct >= 60 ? `بِع نصف المركز الآن — تؤمّن ~$${Math.round(pnlTotal / 2)} مؤكداً`
      : pnlPct >= 30 ? 'بِع ثلث المركز — أمّن جزءاً من الربح'
      : 'انتظر +30% قبل التدريج',
    trailStop: pnlPct >= 30 ? entry : stopPrice,
    trailStopLabel: pnlPct >= 30 ? 'التعادل (لا خسارة بعد الآن)' : 'الوقف الأصلي',
    nextTarget: nextWallForTarget,
    greedWarning: pnlPct >= 60 ? 'الطمع يذهب ما جمع — أمّن ربحك ولا ترفع الهدف' : null,
  } : null

  return NextResponse.json({
    contract: { strike, type, expiration: exp, dte, bid, ask, mid, delta: Math.round(delta * 100) / 100 },
    estimated,
    entry,
    pnl: { perShare: Math.round(pnlPerShare * 100) / 100, pct: Math.round(pnlPct * 10) / 10, total: pnlTotal },
    market: { spx, changePct: Math.round(chgPct * 100) / 100, bias },
    gamma: gamma ? { regime: gamma.regime, callWall: gamma.callWall, putWall: gamma.putWall, flipLevel: gamma.flipLevel } : null,
    stop: { optionPrice: stopPrice, spxLevel: stopSpx },
    timeWarn,
    verdict, verdictText, actionText,
    roll,
    profitPlan,
  })
}

// ── فرع المؤشرات (NDX/SPY/QQQ): نفس منطق القرار ببيانات المؤشر المختار ───────
// لا جدران جاما هنا (مصدرها SPX فقط) — القرار يعتمد على السعر والاتجاه والوقت.
async function indexExitPlan(opts: { symbol: string; strike: number; type: 'call' | 'put'; entry: number; expiryParam: string }) {
  const { symbol, strike, type, entry, expiryParam } = opts

  const quote = await getStockQuote(symbol)
  const spot = quote?.price
  if (!spot) return NextResponse.json({ error: `تعذر جلب سعر ${symbol}` })
  const spotPrev = quote.prevClose || spot
  const chgPct = spotPrev > 0 ? ((spot - spotPrev) / spotPrev) * 100 : 0

  const exps = await getStockExpirations(symbol)
  const closed = marketClosedNow()
  const today = todayET()
  const exp = (expiryParam && /^\d{4}-\d{2}-\d{2}$/.test(expiryParam))
    ? expiryParam
    : (exps.find(e => closed ? e > today : e >= today) ?? exps.find(e => e >= today) ?? exps[0] ?? today)

  const options = await getStockChain(symbol, exp)
  const c = options.find(o => o.option_type === type && Math.round(o.strike) === Math.round(strike))
  if (!c) return NextResponse.json({ error: 'لم يُعثر على العقد في هذا التاريخ' })

  const bid = c.bid ?? 0, ask = c.ask ?? 0
  const mid = bid && ask ? Math.round((bid + ask) / 2 * 100) / 100 : (c.last ?? 0)
  const delta = Math.abs(c.greeks?.delta ?? 0)
  const dte = Math.max(0, Math.round((new Date(exp + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86400000))

  // ربح/خسارة (لكل عقد ×100)
  const pnlPerShare = mid - entry
  const pnlPct = entry > 0 ? (pnlPerShare / entry) * 100 : 0
  const pnlTotal = Math.round(pnlPerShare * 100)

  // الوقف: 35% من الدخول
  const stopPrice = Math.round(entry * 0.65 * 100) / 100
  const stopSpot = delta > 0.02 ? Math.round(spot + (stopPrice - mid) / (type === 'call' ? delta : -delta)) : null

  // اتجاه السوق
  const bias: 'صاعد' | 'هابط' | 'محايد' = chgPct >= 0.3 ? 'صاعد' : chgPct <= -0.3 ? 'هابط' : 'محايد'
  const thesisValid = type === 'call' ? bias !== 'هابط' : bias !== 'صاعد'

  // تحذير الوقت: عقد اليوم بعد منتصف الجلسة
  const ny = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const timeWarn = dte === 0 && !closed && ny.getHours() >= 13

  // ── القرار ───────────────────────────────────────────────────────────────
  let verdict: 'exit_now' | 'exit_thesis' | 'manage_profit' | 'hold_cautious' | 'standby'
  let verdictText: string, actionText: string

  if (closed) {
    verdict = 'standby'
    verdictText = 'السوق مغلق — التقييم عند الفتح'
    actionText = `مركزك حالياً ${pnlTotal >= 0 ? 'رابح' : 'خاسر'} ${Math.abs(pnlTotal)}$. جهّز خطة: الوقف عند $${stopPrice}.`
  } else if (mid <= stopPrice) {
    verdict = 'exit_now'
    verdictText = 'اخرج فوراً — وصل الوقف'
    actionText = `الخسارة بلغت ${Math.abs(pnlPct).toFixed(0)}%. لا تعاند — أغلق المركز الآن.`
  } else if (!thesisValid) {
    verdict = 'exit_thesis'
    verdictText = 'اخرج — السبب انتهى'
    actionText = `الاتجاه ${bias} صار ضدّ عقدك. النظرية ماتت — اخرج وأعد التقييم.`
  } else if (pnlPerShare > 0) {
    verdict = 'manage_profit'
    const bigWin = pnlPct >= 60
    verdictText = bigWin ? 'اربح الآن — لا تطمع' : 'أدِر الربح بذكاء'
    actionText = bigWin
      ? `رابح ${pnlTotal}$ (${pnlPct.toFixed(0)}%). الطمع يذهب ما جمع — بِع نصف مركزك الآن (تؤمّن ~$${Math.round(pnlTotal / 2)})، وارفع الوقف للتعادل، ودع الباقي يجري.`
      : `رابح ${pnlTotal}$ (${pnlPct.toFixed(0)}%). ${pnlPct >= 30 ? `بِع نصف العقود وارفع الوقف إلى التعادل ($${entry})` : `راقب الوقف عند $${stopPrice}`}، ودع الباقي يجري.`
  } else {
    verdict = 'hold_cautious'
    verdictText = 'احتفظ بحذر — السبب سليم'
    actionText = `خسارة بسيطة (${Math.abs(pnlPct).toFixed(0)}%) والسبب ما زال قائماً. راقب الوقف عند $${stopPrice}${timeWarn ? ' — وانتبه: الوقت يتآكل بعد الظهر.' : '.'}`
  }

  // اقتراح دحرجة: الاتجاه سليم لكن الستريك بطيء (دلتا منخفضة)
  // نطاق السعر نسبي لأن أسعار عقود المؤشرات تختلف كثيراً بين مؤشر وآخر
  let roll: { strike: number; ask: number; delta: number; reason: string } | null = null
  if (thesisValid && delta < 0.18 && mid > 0) {
    const better = options
      .filter(o => o.option_type === type && (o.ask ?? 0) >= mid * 0.3 && (o.ask ?? 0) <= mid * 3)
      .map(o => ({ o, d: Math.abs(o.greeks?.delta ?? 0) }))
      .filter(x => x.d >= 0.22 && x.d <= 0.48)
      .sort((a, b) => Math.abs(a.d - 0.33) - Math.abs(b.d - 0.33))[0]
    if (better) roll = {
      strike: better.o.strike, ask: better.o.ask ?? 0, delta: Math.round(better.d * 100) / 100,
      reason: `ستريكك الحالي بطيء (دلتا ${delta.toFixed(2)}). ${better.o.strike} أسرع تفاعلاً (دلتا ${better.d.toFixed(2)}) — فكّر بالدحرجة إليه.`,
    }
  }

  // خطة إدارة الربح — ضد الطمع
  const profitPlan = pnlPerShare > 0 ? {
    scaleOut: pnlPct >= 60 ? `بِع نصف المركز الآن — تؤمّن ~$${Math.round(pnlTotal / 2)} مؤكداً`
      : pnlPct >= 30 ? 'بِع ثلث المركز — أمّن جزءاً من الربح'
      : 'انتظر +30% قبل التدريج',
    trailStop: pnlPct >= 30 ? entry : stopPrice,
    trailStopLabel: pnlPct >= 30 ? 'التعادل (لا خسارة بعد الآن)' : 'الوقف الأصلي',
    nextTarget: null,
    greedWarning: pnlPct >= 60 ? 'الطمع يذهب ما جمع — أمّن ربحك ولا ترفع الهدف' : null,
  } : null

  return NextResponse.json({
    contract: { strike, type, expiration: exp, dte, bid, ask, mid, delta: Math.round(delta * 100) / 100 },
    estimated: false,
    entry,
    symbol,
    pnl: { perShare: Math.round(pnlPerShare * 100) / 100, pct: Math.round(pnlPct * 10) / 10, total: pnlTotal },
    market: { spx: Math.round(spot * 100) / 100, changePct: Math.round(chgPct * 100) / 100, bias },
    gamma: null,
    stop: { optionPrice: stopPrice, spxLevel: stopSpot },
    timeWarn,
    verdict, verdictText, actionText,
    roll,
    profitPlan,
  })
}
