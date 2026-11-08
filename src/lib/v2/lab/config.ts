import { buildStrategySpec } from './strategySpec'
import type { RunConfig, LabHorizon } from './types'
function validDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
}
export function parseRunConfig(body: Record<string, unknown>): RunConfig {
  const spec = buildStrategySpec()
  if (!spec.dteBands.some(b => b.horizon === body.horizon)) throw new Error('اختر أفق انتهاء صالحًا.')
  if (!validDate(body.from) || !validDate(body.to) || body.from >= body.to) throw new Error('أدخل فترة تاريخية صحيحة.')
  if (body.to >= new Date().toISOString().slice(0, 10)) throw new Error('نهاية الفترة يجب أن تكون يومًا تاريخيًا مكتملًا.')
  if (Date.parse(body.to) - Date.parse(body.from) > 366 * 86400000) throw new Error('الحد الأقصى للتشغيل الواحد سنة؛ قسّم الفترة إلى اختبارات مستقلة.')
  if (body.resolution !== 'minute') throw new Error('اختبارات الخيارات الحالية تتطلب بيانات دقيقة؛ الساعة واليومي غير مدعومين.')
  const initialCapital = Number(body.initialCapital ?? 10000), riskPct = Number(body.riskPct ?? 1)
  if (!Number.isFinite(initialCapital) || initialCapital < 100 || initialCapital > 10000000) throw new Error('رأس المال التجريبي غير صالح.')
  if (!Number.isFinite(riskPct) || riskPct <= 0 || riskPct > 5) throw new Error('المخاطرة لكل صفقة بين أكثر من صفر و5%.')
  const horizon = body.horizon as LabHorizon, band = spec.dteBands.find(b => b.horizon === horizon)!
  return { asset: 'spx', strategyVersion: spec.version, horizon,
    dte: { min: band.min, max: band.max, target: band.target }, period: { from: body.from, to: body.to },
    resolution: 'minute', costModel: { ...spec.costModel }, benchmarkSymbol: 'SPX', initialCapital, riskPct }
}
