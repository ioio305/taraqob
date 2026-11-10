// ── طبقة أسعار السوق السعودي: سهمك أولاً ثم ياهو ─────────────────────────────
// سهمك (https://sahmk.sa/developers) مصدر مرخّص محلي:
//   • مجاني: 100 طلب/يوم، 10/دقيقة، سعر سهم واحد فقط، مؤخّر ~15 دقيقة.
//   • Starter: أسعار جماعية (50 سهماً/طلب)، 5K/يوم، مؤخّرة.
//   • Pro فأعلى: أسعار لحظية (+ عرضها للمستخدمين قد يتطلب موافقة سهمك).
// بلا مفتاح، أو عند أي فشل/تجاوز حصة، يبقى المستدعي على بيانات ياهو (عامة، مؤخّرة).
// شرط سهمك: أي عرض لبياناته يُنسب إليه («البيانات مقدّمة من سهمك»).
// المفتاح يبقى على الخادم فقط — لا يُستورد هذا الملف في مكوّنات العميل.

const SAHMK_BASE = 'https://api.sahmk.sa/api/v1'

export type QuoteSource = 'sahmk' | 'yahoo'
export type SahmkPlan = 'free' | 'starter' | 'pro'

export type SaudiQuote = {
  symbol: string
  price: number
  change: number
  changePct: number
  volume: number | null
  bid: number | null
  ask: number | null
  netLiquidity: number | null // صافي السيولة اليوم (تدفّق داخل − خارج) بالريال
  updatedAt: string | null
  isDelayed: boolean
}

export type QuoteFreshness = {
  source: QuoteSource
  delayed: boolean
  label: string
  attribution: string | null
}

function apiKey(): string {
  return process.env.SAHMK_API_KEY?.trim() ?? ''
}

export function sahmkConfigured(): boolean {
  return apiKey().length > 0
}

export function sahmkPlan(value = process.env.SAHMK_PLAN): SahmkPlan {
  const p = (value ?? '').trim().toLowerCase()
  if (p === 'pro' || p === 'business' || p === 'enterprise') return 'pro'
  if (p === 'starter') return 'starter'
  return 'free' // الافتراض الآمن: لا طلبات جماعية تستنزف الحصة المجانية
}

export function parseSahmkQuote(raw: unknown): SaudiQuote | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  const symbol = typeof r.symbol === 'string' ? r.symbol : null
  const price = num(r.price)
  if (!symbol || price == null || price <= 0) return null
  const liq = r.liquidity && typeof r.liquidity === 'object' ? (r.liquidity as Record<string, unknown>) : null
  return {
    symbol,
    price,
    change: num(r.change) ?? 0,
    changePct: num(r.change_percent) ?? 0,
    volume: num(r.volume),
    bid: num(r.bid),
    ask: num(r.ask),
    netLiquidity: liq ? num(liq.net_value) : null,
    updatedAt: typeof r.updated_at === 'string' ? r.updated_at : null,
    isDelayed: r.is_delayed !== false, // غير المعروف يُعامل مؤخّراً (افتراض صادق)
  }
}

// يقبل أشكال الاستجابة الجماعية الشائعة: مصفوفة، أو { results|quotes|data }، أو كائناً بالرمز.
export function parseSahmkBulk(json: unknown): SaudiQuote[] {
  if (!json) return []
  let items: unknown[] = []
  if (Array.isArray(json)) items = json
  else if (typeof json === 'object') {
    const o = json as Record<string, unknown>
    const list = o.results ?? o.quotes ?? o.data
    items = Array.isArray(list) ? list : Object.values(o)
  }
  return items.map(parseSahmkQuote).filter((q): q is SaudiQuote => q !== null)
}

function headers() {
  return { 'X-API-Key': apiKey(), Accept: 'application/json' }
}

// سعر سهم واحد (متاح في كل الخطط). null عند غياب المفتاح أو أي فشل.
export async function fetchSahmkQuote(symbol: string, revalidate: number): Promise<SaudiQuote | null> {
  if (!sahmkConfigured()) return null
  try {
    const res = await fetch(`${SAHMK_BASE}/quote/${encodeURIComponent(symbol)}/`, { headers: headers(), next: { revalidate } })
    if (!res.ok) return null
    return parseSahmkQuote(await res.json())
  } catch {
    return null
  }
}

// أسعار جماعية (Starter فأعلى). خريطة فارغة عند أي فشل ⇒ يبقى المستدعي على ياهو.
export async function fetchSahmkBulk(symbols: string[], revalidate: number): Promise<Map<string, SaudiQuote>> {
  const out = new Map<string, SaudiQuote>()
  if (!sahmkConfigured() || !symbols.length) return out
  for (let i = 0; i < symbols.length; i += 50) {
    const chunk = symbols.slice(i, i + 50)
    try {
      const res = await fetch(`${SAHMK_BASE}/quotes/?symbols=${chunk.map(encodeURIComponent).join(',')}`, { headers: headers(), next: { revalidate } })
      if (!res.ok) return out
      for (const q of parseSahmkBulk(await res.json())) out.set(q.symbol, q)
    } catch {
      return out
    }
  }
  return out
}

// مدة الاحتفاظ بالسعر في ذاكرة الخادم حسب الخطة (توفير الحصة؛ المؤخّر لا يكسب من تحديث أسرع).
export function sahmkRevalidate(plan: SahmkPlan, kind: 'bulk' | 'single'): number {
  if (plan === 'pro') return kind === 'bulk' ? 15 : 30
  if (plan === 'starter') return kind === 'bulk' ? 60 : 300
  return 900
}

export function quoteFreshness(source: QuoteSource, delayed: boolean): QuoteFreshness {
  if (source === 'sahmk') {
    return {
      source,
      delayed,
      label: delayed ? 'أسعار مؤخّرة ~15 دقيقة' : 'أسعار لحظية',
      attribution: 'البيانات مقدّمة من سهمك',
    }
  }
  return { source: 'yahoo', delayed: true, label: 'أسعار مؤخّرة (مصدر عام)', attribution: null }
}

// يدمج أسعار سهمك فوق صفوف ياهو (يعدّل الصفوف الممرّرة — مرّر نسخاً لا كائنات اللقطة المخزّنة).
// خطط Starter/Pro فقط: المجاني لا يدعم الجماعي ولا يتحمّل حصته المسح.
export async function overlayLiveQuotes(
  rows: Array<{ symbol: string; price: number; changeAbs: number; change: number; volume: number }>,
): Promise<QuoteFreshness> {
  const plan = sahmkPlan()
  if (!sahmkConfigured() || plan === 'free' || !rows.length) return quoteFreshness('yahoo', true)
  const live = await fetchSahmkBulk(rows.map(s => s.symbol), sahmkRevalidate(plan, 'bulk'))
  if (!live.size) return quoteFreshness('yahoo', true)
  let delayed = false
  for (const s of rows) {
    const q = live.get(s.symbol)
    if (!q) continue
    s.price = +q.price.toFixed(2)
    s.changeAbs = +q.change.toFixed(2)
    s.change = +q.changePct.toFixed(2)
    if (q.volume != null) s.volume = q.volume
    if (q.isDelayed) delayed = true
  }
  return quoteFreshness('sahmk', delayed)
}
