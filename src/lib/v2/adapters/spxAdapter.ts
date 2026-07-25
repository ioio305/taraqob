// ── محوّل SPX — التطبيق المرجعي لعقد AssetAdapter ─────────────────────────────
// يغلّف سلوك المؤشر الحالي (بيانات + اتجاه + معايرة) بلا أي تغيير سلوكي.
// ملاحظة مهمة: مسار api/v2/recommend يُبقي تنسيق SPX الخاص (صناديق الجلسات،
// جاما، حارس الانهيارات، التقويم الاقتصادي، أخبار/رد فعل/جلسة) داخله للحفاظ
// على التطابق 100%؛ هذا المحوّل يوفّر التطبيق المرجعي النظيف للعقد نفسه.

import type {
  AssetAdapter, AssetSnapshot, AdapterDirection, EventRisk, UniverseItem,
} from './types'
import { PLATFORMS, SPX_CALIBRATION } from './registry'
import { getMarketSnapshot, getExpirations, getOptionsChain } from '../marketData'

const META = PLATFORMS.find(p => p.key === 'spx')!

// اتجاه المؤشر من تغيّره + مؤشر الخوف (VIX) — يطابق منطق route.ts السابق حرفياً
export function spxDirection(changePct: number, vix: number): AdapterDirection {
  if (vix > 28)           return { type: null,  label: 'توقّف — مؤشر الخوف مرتفع', color: '#EF4444', reason: `مؤشر الخوف ${vix.toFixed(1)} — خطر عالٍ` }
  if (changePct >= 0.5)   return { type: 'call', label: '▲ السوق صاعد — عقود شراء (Call)', color: '#10B981', reason: `المؤشر +${changePct.toFixed(2)}% — اتجاه صاعد` }
  if (changePct <= -0.5)  return { type: 'put',  label: '▼ السوق هابط — عقود هبوط (Put)',  color: '#EF4444', reason: `المؤشر ${changePct.toFixed(2)}% — اتجاه هابط` }
  if (changePct >= 0.15)  return { type: 'call', label: '▲ صعود خفيف — عقود شراء (Call)', color: '#34D399', reason: `المؤشر +${changePct.toFixed(2)}%` }
  if (changePct <= -0.15) return { type: 'put',  label: '▼ هبوط خفيف — عقود هبوط (Put)',  color: '#F87171', reason: `المؤشر ${changePct.toFixed(2)}%` }
  return { type: null, label: '↔ بلا اتجاه — انتظر', color: '#F59E0B', reason: 'المؤشر يتحرك بلا اتجاه واضح — انتظر' }
}

export const spxAdapter: AssetAdapter = {
  meta: META,
  calibration: SPX_CALIBRATION,

  async getUniverse(): Promise<UniverseItem[]> {
    return [{ symbol: 'SPX', name: 'مؤشر S&P 500', liquid: true }]
  },

  async getSnapshot(_symbol: string): Promise<AssetSnapshot> {
    const s = await getMarketSnapshot()
    const em = s.spxPrice > 0 && s.vixPrice > 0
      ? Math.round(s.spxPrice * (s.vixPrice / 100) * Math.sqrt(1 / 252))
      : null
    const changePct = s.spxPrev > 0 ? ((s.spxPrice - s.spxPrev) / s.spxPrev) * 100 : 0
    return {
      symbol: 'SPX',
      price: s.spxPrice,
      prevClose: s.spxPrev,
      changePct,
      high: s.spxHigh,
      low: s.spxLow,
      volMeasure: s.vixPrice,
      volLabel: 'مؤشر الخوف',
      atrPct: null,
      expectedMove: em,
      source: s.source,
    }
  },

  async getExpirations(_symbol: string): Promise<string[]> {
    return getExpirations()
  },

  async getChain(_symbol: string, expiration: string): Promise<any[]> {
    const s = await getMarketSnapshot()
    const { options } = await getOptionsChain(expiration, s.spxPrice, s.vixPrice)
    return options
  },

  getDirection(_symbol: string, snap: AssetSnapshot): AdapterDirection {
    return spxDirection(snap.changePct, snap.volMeasure ?? 0)
  },

  // مخاطر أحداث المؤشر تُعالَج في المسار عبر الأخبار/رد الفعل/الجلسة والتقويم
  // الاقتصادي (نظام أغنى من البوابة العامة) — فنعيد null هنا للحفاظ على التطابق.
  async getEventRisk(_symbol: string): Promise<EventRisk | null> {
    return null
  },
}
