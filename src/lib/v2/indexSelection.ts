// ── المؤشر المختار — هوية منصة المؤشرات ────────────────────────────────────────
// الافتراضي SPX (المنصة الأم، لا يتغير سلوكها إطلاقًا). اختيار NDX/SPY/QQQ يقلب
// الصفحات الداعمة على المؤشر المختار. يُحفظ محلياً ويتزامن بين التبويبات.

export type IndexId = 'SPX' | 'NDX' | 'SPY' | 'QQQ'

export const INDICES: { id: IndexId; name: string; href: string }[] = [
  { id: 'SPX', name: 'السوق الأمريكي',      href: '/v2' },
  { id: 'NDX', name: 'ناسداك ١٠٠',           href: '/v2/index?symbol=NDX' },
  { id: 'SPY', name: 'يتبع السوق الأمريكي',  href: '/v2/index?symbol=SPY' },
  { id: 'QQQ', name: 'يتبع ناسداك ١٠٠',      href: '/v2/index?symbol=QQQ' },
]

const KEY = 'taraqob_index'

export function getSelectedIndex(): IndexId {
  if (typeof window === 'undefined') return 'SPX'
  try {
    const v = (localStorage.getItem(KEY) ?? '').toUpperCase()
    return v === 'NDX' || v === 'SPY' || v === 'QQQ' ? v : 'SPX'
  } catch { return 'SPX' }
}

export function setSelectedIndex(id: IndexId) {
  try {
    localStorage.setItem(KEY, id)
    // إشعار فوري لكل الصفحات المفتوحة في نفس التبويب
    window.dispatchEvent(new CustomEvent('taraqob:index', { detail: id }))
  } catch { /* تجاهل */ }
}

export function indexMeta(id: IndexId) {
  return INDICES.find(ix => ix.id === id) ?? INDICES[0]
}
