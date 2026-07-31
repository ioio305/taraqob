'use client'

// ── مخزن المحفظة التجريبية للصناديق — محلي على الجهاز ─────────────────────────
// نسخة أولى: محفظة افتراضية بأموال غير حقيقية تتبع المستخدم على جهازه.
// صفقاتها تُقيَّم بأسعار السوق الحية في كل فتح للصفحة.

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

export function loadPaper(): PaperPosition[] {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '[]') } catch { return [] }
}

export function savePaper(list: PaperPosition[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)) } catch { /* تجاهل */ }
}

export function addPaper(p: Omit<PaperPosition, 'id' | 'addedAt'>): PaperPosition[] {
  const list = loadPaper()
  // لا تكرار لنفس الصندوق وهو مفتوح
  if (list.some(x => x.symbol === p.symbol && !x.closed)) return list
  list.unshift({ ...p, id: `${p.symbol}-${Date.now()}`, addedAt: new Date().toISOString() })
  savePaper(list)
  return list
}

export function updatePaper(id: string, patch: Partial<PaperPosition>): PaperPosition[] {
  const list = loadPaper().map(x => (x.id === id ? { ...x, ...patch } : x))
  savePaper(list)
  return list
}

export function closePaper(id: string, exit: number): PaperPosition[] {
  return updatePaper(id, { closed: { exit, closedAt: new Date().toISOString() } })
}

export function removePaper(id: string): PaperPosition[] {
  const list = loadPaper().filter(x => x.id !== id)
  savePaper(list)
  return list
}
