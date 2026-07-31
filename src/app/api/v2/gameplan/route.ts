import { NextResponse } from 'next/server'
import { getMarketSnapshot, getHistoryBars } from '@/lib/v2/marketData'
import {
  ema, rsi, macdFn, bollinger, atrFn, analyzeMarket, applyGamma,
  crashGuard, applyCrashGuard,
} from '@/lib/v2/marketAnalysis'
import { getGammaExposure } from '@/lib/v2/gammaExposure'
import { econWarning, upcomingEvents } from '@/lib/v2/econCalendar'

export const dynamic = 'force-dynamic'

// ── خطة اليوم — ترقب يتخذ موقفاً واحداً واضحاً كل صباح ──────────────────────
// يجمع: الاتجاه اليومي + جدران الجاما + الحركة المتوقعة + مستويات الأمس
// + التقويم الاقتصادي + حارس الانهيارات + تسعير الخوف → موقف مكتوب بالعربي.

function buildInds(bars: { open: number; high: number; low: number; close: number; volume: number }[]) {
  const closes = bars.map(b => b.close)
  const highs = bars.map(b => b.high)
  const lows = bars.map(b => b.low)
  const { macdLine, signalLine, histogram } = macdFn(closes)
  const { upper, mid, lower, width } = bollinger(closes)
  return {
    ema9: ema(closes, 9), ema21: ema(closes, 21), ema50: ema(closes, 50),
    ema200: closes.length >= 200 ? ema(closes, 200) : closes.map(() => null),
    rsiArr: rsi(closes),
    macdLine, sigLine: signalLine, histArr: histogram,
    bbUpper: upper, bbMid: mid, bbLower: lower, bbWidth: width,
    atrArr: atrFn(highs, lows, closes),
    vwapArr: bars.map(() => null),
  }
}

export async function GET() {
  try {
    const [snap, daily, gamma] = await Promise.all([
      getMarketSnapshot(),
      getHistoryBars('daily', 400),
      getGammaExposure().catch(() => null),
    ])
    if (daily.length < 60) return NextResponse.json({ success: false, error: 'بيانات غير كافية' })

    const inds = buildInds(daily)
    const a = analyzeMarket(daily as any, inds as any)
    if (gamma) applyGamma(a, gamma)
    const guard = crashGuard(daily, snap.vixPrice)
    applyCrashGuard(a, guard)

    const spot = snap.spxPrice || daily[daily.length - 1].close
    // آخر يوم *مكتمل* — نتخطى شمعة اليوم غير المكتملة إن ضمّتها المزوّد
    const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })
    const prior = [...daily].reverse().find(b => String((b as { time?: string }).time ?? '').slice(0, 10) !== todayET)
      ?? daily[daily.length - 1]
    const atrV = inds.atrArr[daily.length - 1] ?? 40
    const em = Math.round(spot * (snap.vixPrice / 100) * Math.sqrt(1 / 252))

    const bias = a.summary.bias
    const gammaPositive = gamma?.regime === 'positive'
    const callWall = gamma?.callWall ?? null
    const putWall = gamma?.putWall ?? null
    const flip = gamma?.flipLevel ?? null

    // ── الموقف: أفضل استراتيجية اليوم (قواعد مركبة من كل المحركات) ─────────
    let stance = ''
    let entryZone = ''
    let target1: number | null = a.summary.t1Level
    let target2: number | null = a.summary.t2Level
    let cancel = a.summary.cancelCondition

    // حدا التداول اليومي: الجدار يُعتمد فقط إن كان ضمن مدى واقعي لليوم
    // (1.5 × مدى الحركة) — جدران بعيدة كجدران الانتهاءات الشهرية تُستبدل
    // بمستويات الأمس، وإلا فمسافة نصف مدى يومي
    const maxDist = atrV * 1.5
    const nearSupport = Math.round(
      (putWall != null && spot - putWall <= maxDist && putWall < spot)
        ? putWall
        : (spot - prior.low <= maxDist && prior.low < spot) ? prior.low
        : spot - atrV * 0.5
    )
    const nearResist = Math.round(
      (callWall != null && callWall - spot <= maxDist && callWall > spot)
        ? callWall
        : (prior.high - spot <= maxDist && prior.high > spot) ? prior.high
        : spot + atrV * 0.5
    )

    if (guard.active) {
      stance = `اليوم للمشاهدة لا للتداول — حارس الانهيارات نشط (${guard.reasons[0]}). تاريخياً هذه الأيام تخسر حتى مع أفضل الإشارات. راقب واحفظ رأس مالك.`
      entryZone = 'لا دخول اليوم'
    } else if (bias === 'صاعد') {
      stance = gammaPositive
        ? `شراء كول عند التراجعات — الاتجاه صاعد والسوق مكبوح (جاما موجبة): التراجعات نحو ${nearSupport} فرص شراء، وتجنب مطاردة السعر قرب مقاومة ${nearResist}.`
        : `شراء كول مع الاتجاه — لكن الجاما سالبة فالحركة قد تتسارع بالاتجاهين: ادخل عند التراجعات لا القمم، وشدّد وقفك.`
      entryZone = `منطقة الدخول المفضلة: ${Math.round(nearSupport)} – ${Math.round(nearSupport + atrV * 0.3)}`
      target1 = target1 ?? nearResist
    } else if (bias === 'هابط') {
      stance = gammaPositive
        ? `بيع الارتدادات (بوت) — الاتجاه هابط لكن السوق مكبوح: الارتدادات نحو ${nearResist} فرص دخول بوت، والأهداف عند الدعوم القريبة.`
        : `بوت مع الاتجاه — هبوط بجاما سالبة: الحركة قد تتسارع نزولاً. ادخل عند الارتدادات نحو ${nearResist}، أهدافك أبعد، ووقفك أشد انضباطاً.`
      entryZone = `منطقة الدخول المفضلة: ${Math.round(nearResist - atrV * 0.3)} – ${Math.round(nearResist)}`
      target1 = target1 ?? nearSupport
    } else {
      stance = gammaPositive
        ? `يوم نطاق — السوق محايد ومكبوح: تداول حدود النطاق (كول قرب دعم ${nearSupport}، بوت قرب مقاومة ${nearResist})، ولا تطارد المنتصف.`
        : `يوم انتظار الكسر — محايد بجاما سالبة: السوق يجهز حركة. لا تدخل داخل النطاق؛ انتظر كسر ${nearResist} أو ${nearSupport} ثم اتبع الكسر.`
      entryZone = `الحدان: ${Math.round(nearSupport)} (دعم) / ${Math.round(nearResist)} (مقاومة)`
      // يوم نطاق: الهدف هو الجدار المقابل فقط — لا أهداف بعيدة
      target1 = nearResist
      target2 = null
    }

    // قص عام: لا يتجاوز أي هدف مدى اليوم الواقعي (1.5 × مدى الحركة)
    if (target1 != null) target1 = Math.max(Math.round(spot - maxDist), Math.min(Math.round(spot + maxDist), target1))
    if (target2 != null) target2 = Math.max(Math.round(spot - maxDist), Math.min(Math.round(spot + maxDist), target2))
    if (target1 != null && target2 != null && Math.abs(target2 - spot) < Math.abs(target1 - spot)) {
      const t = target1; target1 = target2; target2 = t
    }

    const econ = econWarning()
    const preMarketNote = econ && econ.when === 'اليوم' && econ.nameAr !== 'انتهاء العقود الشهرية OPEX'
      ? `⏰ ${econ.nameAr} ${econ.when} — ${econ.advice}`
      : null

    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      dayAr: new Date().toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Riyadh' }),
      market: {
        spx: spot, vix: snap.vixPrice, source: snap.source,
        priorClose: prior.close, priorHigh: prior.high, priorLow: prior.low,
      },
      bias, score: a.summary.score,
      decision: a.summary.decisionCode,
      stance, entryZone,
      targets: { t1: target1, t2: target2 },
      stop: a.summary.stopLevel,
      cancel,
      expectedMove: { points: em, upper: Math.round(spot + em), lower: Math.round(spot - em) },
      gamma: gamma ? {
        regime: gamma.regime, flipLevel: flip, callWall, putWall,
        note: gammaPositive
          ? 'جاما موجبة: سوق مكبوح — الارتدادات من الجدران مرجحة'
          : 'جاما سالبة: سوق مضخّم — الحركات تتسارع، احترم الوقف',
      } : null,
      // سلّم مستويات *اليوم* فقط — مستويات الأمس المرجعية تُعرض منفصلة أدناه
      levels: [
        { label: 'مقاومة اليوم (جدار الكول)', value: callWall, tone: 'res' },
        { label: 'أعلى الحركة المتوقعة', value: Math.round(spot + em), tone: 'res' },
        { label: 'السعر الآن', value: Math.round(spot), tone: 'mid' },
        { label: 'نقطة انقلاب الجاما', value: flip, tone: 'mid' },
        { label: 'أدنى الحركة المتوقعة', value: Math.round(spot - em), tone: 'sup' },
        { label: 'دعم اليوم (جدار البوت)', value: putWall, tone: 'sup' },
      ].filter(l => l.value != null),
      // مستويات الأمس المرجعية (منفصلة، بعنوانها الصحيح)
      priorLevels: [
        { label: 'قمة الأمس', value: prior.high, tone: 'res' },
        { label: 'إغلاق الأمس', value: prior.close, tone: 'mid' },
        { label: 'قاع الأمس', value: prior.low, tone: 'sup' },
      ].filter(l => l.value != null),
      crashGuard: guard,
      econToday: econ,
      preMarketNote,
      upcoming: upcomingEvents(7).slice(0, 3),
      bullCase: a.bullCase.slice(0, 4),
      bearCase: a.bearCase.slice(0, 4),
    })
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) })
  }
}
