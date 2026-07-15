// ============================================================
// انكشاف جاما لصانعي السوق — SPX Gamma Exposure (GEX)
// ------------------------------------------------------------
// يُحسب مجاناً من بيانات CBOE المباشرة (الفائدة المفتوحة + جاما).
// يكشف تموضع المؤسسات: هل تكبح التذبذب (جاما موجبة) أم تضخّمه (سالبة)،
// ونقطة الانقلاب، وجدران جاما (مستويات جذب قوية).
// ============================================================

const CBOE_URL = 'https://cdn.cboe.com/api/global/delayed_quotes/options/_SPX.json'

export interface GammaWall {
  strike: number
  gex: number   // مليار دولار لكل حركة 1%
}

export interface GammaExposure {
  spot: number
  totalGex: number            // إجمالي الانكشاف ($Bn لكل 1%)
  regime: 'positive' | 'negative'
  flipLevel: number | null    // نقطة الانقلاب (جاما صفرية)
  callWall: number | null     // أكبر جدار فوق السعر = مقاومة
  putWall: number | null      // أكبر جدار تحت السعر = دعم
  walls: GammaWall[]          // أقوى المستويات (مغناطيس)
  profile: { strike: number; gex: number }[]  // ملف كامل قرب السعر
  fetchedAt: string
  source: 'cboe'
}

type CboeOption = {
  option: string
  gamma: number | null
  open_interest: number | null
}

const OCC = /^(SPXW|SPX)(\d{6})([CP])(\d{8})$/

export async function getGammaExposure(): Promise<GammaExposure | null> {
  let json: any
  try {
    const res = await fetch(CBOE_URL, { headers: { Accept: 'application/json' }, cache: 'no-store' })
    if (!res.ok) return null
    json = await res.json()
  } catch { return null }

  const data = json?.data
  const spot: number = data?.current_price ?? data?.close ?? 0
  const options: CboeOption[] = data?.options ?? []
  if (!spot || options.length === 0) return null

  // تجميع صافي الانكشاف لكل ستريك (call موجب، put سالب — العرف المعياري)
  const perStrike = new Map<number, number>()
  const S2 = spot * spot
  for (const o of options) {
    const m = o.option?.match(OCC)
    if (!m) continue
    const type = m[3]
    const strike = parseInt(m[4]) / 1000
    const gamma = o.gamma ?? 0
    const oi = o.open_interest ?? 0
    if (!gamma || !oi) continue
    // نتجاهل الستريكات البعيدة جداً (ضجيج)
    if (Math.abs(strike - spot) > spot * 0.15) continue
    // $ جاما لكل حركة 1%
    const gex = gamma * oi * 100 * S2 * 0.01 * (type === 'C' ? 1 : -1)
    perStrike.set(strike, (perStrike.get(strike) ?? 0) + gex)
  }
  if (perStrike.size === 0) return null

  const strikes = [...perStrike.entries()]
    .map(([strike, gex]) => ({ strike, gex: gex / 1e9 }))   // إلى مليارات
    .sort((a, b) => a.strike - b.strike)

  const totalGex = strikes.reduce((s, x) => s + x.gex, 0)
  const regime: 'positive' | 'negative' = totalGex >= 0 ? 'positive' : 'negative'

  // نقطة الانقلاب: حيث يعبر التراكم من أسفل لأعلى الصفر
  let cum = 0, flipLevel: number | null = null
  for (let i = 0; i < strikes.length; i++) {
    const prev = cum
    cum += strikes[i].gex
    if (i > 0 && ((prev < 0 && cum >= 0) || (prev > 0 && cum <= 0))) {
      // استيفاء خطي بين الستريكين
      const a = strikes[i - 1], b = strikes[i]
      const t = Math.abs(prev) / (Math.abs(prev) + Math.abs(cum) || 1)
      flipLevel = Math.round(a.strike + (b.strike - a.strike) * t)
      break
    }
  }

  // جدران جاما: أقوى المستويات المطلقة
  const walls = [...strikes]
    .sort((a, b) => Math.abs(b.gex) - Math.abs(a.gex))
    .slice(0, 5)
    .map(w => ({ strike: w.strike, gex: Math.round(w.gex * 100) / 100 }))

  // جدار الشراء (مقاومة): أكبر انكشاف موجب فوق السعر
  const callWall = strikes.filter(s => s.strike > spot && s.gex > 0)
    .sort((a, b) => b.gex - a.gex)[0]?.strike ?? null
  // جدار البيع (دعم): أكبر انكشاف سالب تحت السعر
  const putWall = strikes.filter(s => s.strike < spot && s.gex < 0)
    .sort((a, b) => a.gex - b.gex)[0]?.strike ?? null

  return {
    spot,
    totalGex: Math.round(totalGex * 100) / 100,
    regime,
    flipLevel,
    callWall,
    putWall,
    walls,
    profile: strikes.map(s => ({ strike: s.strike, gex: Math.round(s.gex * 100) / 100 })),
    fetchedAt: new Date().toISOString(),
    source: 'cboe',
  }
}

// نص تفسيري بالعربية للحالة
export function gammaVerdict(g: GammaExposure): { title: string; advice: string; tone: 'calm' | 'volatile' } {
  if (g.regime === 'positive') {
    return {
      title: 'جاما موجبة — المؤسسات تكبح التذبذب',
      advice: 'سوق يميل للهدوء والتذبذب العرضي. الأفضل: البيع قرب القمة والشراء قرب القاع، وتوقّع انجذاب السعر لجدران جاما.',
      tone: 'calm',
    }
  }
  return {
    title: 'جاما سالبة — المؤسسات تضخّم الحركة',
    advice: 'سوق عنيف واتجاهي، الحركات تتسارع. الأفضل: ركوب الاتجاه وتجنّب معاندته، والحذر من التقلبات الحادة.',
    tone: 'volatile',
  }
}
