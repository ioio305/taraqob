'use client'

// ── مخزن المحفظة التجريبية للصناديق — سحابي مع بديل محلي ──────────────────────
// إن طُبِّق جدول funds_paper_positions (هجرة 015) تتبع المحفظة المستخدم على
// كل أجهزته. وإلى ذلك الحين تعمل محليًا على الجهاز دون أي كسر.

import { createClient } from '@/lib/supabase/client'

export interface PaperPosition {
  id: string
  symbol: string
  nameAr: string
  units: number           // 0 = لم يحدد بعد — يُطلب من المستخدم إدخاله
  entry: number
  stop: number
  t1: number
  t2: number
  addedAt: string
  closed?: { exit: number; closedAt: string }
}

const KEY = 'taraqob_funds_paper_v1'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-/i
let cloudReady: boolean | null = null

export function loadPaper(): PaperPosition[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

export function savePaper(list: PaperPosition[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* تجاهل */ }
}

// ── السحابة (اختيارية، صامتة عند غيابها) ──────────────────────────────────────
function rowToPos(r: any): PaperPosition {
  return {
    id: r.id, symbol: r.symbol, nameAr: r.name_ar ?? r.symbol,
    units: r.units ?? 0, entry: Number(r.entry), stop: Number(r.stop),
    t1: Number(r.t1), t2: Number(r.t2), addedAt: r.added_at,
    closed: r.closed_exit != null ? { exit: Number(r.closed_exit), closedAt: r.closed_at } : undefined,
  }
}

async function cloudCtx() {
  if (cloudReady === false) return null
  try {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return null
    return { sb, userId: user.id }
  } catch { return null }
}

// مزامنة أولية: تسحب السحابة وتدفع المحلي الناقص — تُستدعى عند فتح الصفحة
export async function syncPaperCloud(): Promise<PaperPosition[]> {
  const ctx = await cloudCtx()
  if (!ctx) return loadPaper()
  const { sb, userId } = ctx
  const { data, error } = await sb.from('funds_paper_positions').select('*')
  if (error) { cloudReady = false; return loadPaper() } // الجدول لم يُطبَّق بعد
  cloudReady = true
  const cloud = (data ?? []).map(rowToPos)
  const keys = new Set(cloud.map(c => `${c.symbol}|${c.addedAt.slice(0, 19)}`))
  const merged = [...cloud]
  for (const p of loadPaper()) {
    if (keys.has(`${p.symbol}|${p.addedAt.slice(0, 19)}`)) continue
    const { data: ins, error: ie } = await sb.from('funds_paper_positions').insert({
      user_id: userId, symbol: p.symbol, name_ar: p.nameAr, units: p.units,
      entry: p.entry, stop: p.stop, t1: p.t1, t2: p.t2, added_at: p.addedAt,
      closed_exit: p.closed?.exit ?? null, closed_at: p.closed?.closedAt ?? null,
    }).select('*').single()
    if (!ie && ins) merged.push(rowToPos(ins))
  }
  merged.sort((a, b) => b.addedAt.localeCompare(a.addedAt))
  savePaper(merged)
  return merged
}

async function cloudWrite(p: PaperPosition) {
  const ctx = await cloudCtx()
  if (!ctx || !UUID_RE.test(p.id)) return
  await ctx.sb.from('funds_paper_positions').update({
    units: p.units, closed_exit: p.closed?.exit ?? null, closed_at: p.closed?.closedAt ?? null,
  }).eq('id', p.id).then(() => {}, () => {})
}

async function cloudRemove(id: string) {
  const ctx = await cloudCtx()
  if (!ctx || !UUID_RE.test(id)) return
  await ctx.sb.from('funds_paper_positions').delete().eq('id', id).then(() => {}, () => {})
}

// ── العمليات المحلية + دفع سحابي في الخلفية ───────────────────────────────────
export function addPaper(p: Omit<PaperPosition, 'id' | 'addedAt'>): PaperPosition[] {
  const list = loadPaper()
  if (list.some(x => x.symbol === p.symbol && !x.closed)) return list
  list.unshift({ ...p, id: `${p.symbol}-${Date.now()}`, addedAt: new Date().toISOString() })
  savePaper(list)
  void syncPaperCloud() // يستبدل المعرف المؤقت بمعرف سحابي ويدفع الصف الجديد
  return list
}

export function updatePaper(id: string, patch: Partial<PaperPosition>): PaperPosition[] {
  const list = loadPaper().map(x => (x.id === id ? { ...x, ...patch } : x))
  savePaper(list)
  const p = list.find(x => x.id === id)
  if (p) void cloudWrite(p)
  return list
}

export function closePaper(id: string, exit: number): PaperPosition[] {
  return updatePaper(id, { closed: { exit, closedAt: new Date().toISOString() } })
}

export function removePaper(id: string): PaperPosition[] {
  const list = loadPaper().filter(x => x.id !== id)
  savePaper(list)
  void cloudRemove(id)
  return list
}
