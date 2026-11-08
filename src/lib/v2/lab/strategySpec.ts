import { HORIZONS } from '../traderHorizon'
import { SPX_BANDS } from '../recommendCore'
import { SPX_CALIBRATION } from '../adapters/registry'
import type { LabHorizon } from './types'
export const STRATEGY_VERSION = 'spx-signal-replay-2.0.0'
export interface DteBand { horizon: LabHorizon; labelAr: string; min: number; max: number; target: number }
export interface CostModel {
  commissionPerContract: number; fillAssumption: 'worst'; spreadFraction: number
  slippagePct: number; contractMultiplier: number; intrabarAssumption: 'quote_close'
}
export const DEFAULT_COST_MODEL: CostModel = {
  commissionPerContract: 0.65, fillAssumption: 'worst', spreadFraction: 1,
  slippagePct: 0.005, contractMultiplier: 100, intrabarAssumption: 'quote_close',
}
export interface StrategySpec {
  version: string; label: string; descriptionAr: string; asset: 'spx'; otmOnly: true
  dteBands: DteBand[]; calibration: typeof SPX_CALIBRATION; askRange: typeof SPX_BANDS.askRange
  costModel: CostModel
  benchmark: { symbol: string; labelAr: string; kind: 'buy_and_hold' }
  dataRequirements: string[]
}
export function buildStrategySpec(): StrategySpec {
  return {
    version: STRATEGY_VERSION, label: 'SPX — إعادة اختبار قرارات محفوظة', asset: 'spx', otmOnly: true,
    descriptionAr: 'يعيد تشغيل قرارات مؤرخة من محرك ترقّب المشترك؛ لا يخمّن اتجاهًا أو يختار عقدًا بديلًا. تختبر النتيجة خطة الهدف الأول والوقف المحفوظة، ولا تمثل جميع أساليب إدارة الخروج أو غرفة القرار.',
    dteBands: [
      ...Object.values(HORIZONS).map(h => ({ horizon: h.key, labelAr: h.labelAr, ...h.dte })),
      { horizon: 'long_term', labelAr: 'بعيد', min: 46, max: 365, target: 90 },
    ],
    calibration: { ...SPX_CALIBRATION }, askRange: SPX_BANDS.askRange, costModel: { ...DEFAULT_COST_MODEL },
    benchmark: { symbol: 'SPX', labelAr: 'تغير المؤشر؛ مرجع سياقي وليس محفظة خيارات مكافئة', kind: 'buy_and_hold' },
    dataRequirements: [
      'أسعار Bid/Ask مؤرخة لعقود SPXW المنتهية، مع مصدر مرخّص وتغطية الفترة المطلوبة.',
      'أرشيف قرارات وخطط مولد من محرك ترقّب، باستخدام المعلومات المتاحة وقت كل قرار.',
      'سعر المؤشر ومواصفات عقود التسوية المسائية. العقود الصباحية لا تدخل هذا الإصدار.',
      'التقييم بالدقيقة يستخدم سعر العرض في نهاية الشمعة؛ لا يدّعي ترتيب لمس الهدف والوقف داخلها.',
    ],
  }
}
export function isOtm(type: 'call' | 'put', strike: number, price: number): boolean {
  return type === 'call' ? strike > price : strike < price
}
export function horizonForDte(dte: number): LabHorizon {
  if (dte <= 1) return 'aggressive'
  if (dte <= 5) return 'moderate'
  return dte <= 45 ? 'conservative' : 'long_term'
}
