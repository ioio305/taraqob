// ══════════════════════════════════════════════════════════════════════════
// مواصفة الاستراتيجية — مصدر حقيقة واحد لـ«مختبر الاستراتيجيات» ومحرك LEAN
// ──────────────────────────────────────────────────────────────────────────
// هذا الملف يصف قواعد استراتيجية SPX «خارج المال فقط» كبيانات مُهيكلة، كي
// يستهلكها طرفان من مصدر واحد (لا نسختان يدويّتان):
//   • الجانب TS: اختبار التطابق (strategySpec.test.ts) يعيد استخدام
//     mandatoryFilter/liveScore من recommendCore.ts (النواة المشتركة نفسها).
//   • الجانب Python: محرك LEAN يقرأ strategy_spec.json المُولّد من هنا
//     (scripts/lab/gen-spec.ts) فيطبّق القواعد ذاتها داخل المحرك.
//
// القاعدة الذهبية: لا تُكرّر منطق التوصيات. هذه المواصفة تلتقط *القيود* التي
// يجب أن يحترمها أي اختبار تاريخي كي يطابق ما تراه المنصة (بوابة خارج المال،
// نطاق DTE حسب الأفق، عتبات المعايرة، نموذج التكاليف). التقييم المالي يبقى
// مسؤولية المحرك (LEAN) ببيانات عقود حقيقية — راجع docs/strategy-lab.md.
//
// ملف نقيّ (بلا 'server-only') كي يُستورد في الاختبار وفي مُولّد JSON.
// ══════════════════════════════════════════════════════════════════════════

import { HORIZONS, type TraderHorizon } from '../traderHorizon'
import { SPX_BANDS } from '../recommendCore'
import { SPX_CALIBRATION } from '../adapters/registry'

// إصدار الاستراتيجية — يُحفظ مع كل تشغيل كي تكون النتائج قابلة لإعادة الإنتاج والمقارنة.
// غيّره عند أي تعديل في القواعد أدناه (semver: كسر = تغيّر بوابة/عتبة).
export const STRATEGY_VERSION = 'spx-otm-1.0.0'

export interface DteBand {
  horizon: TraderHorizon
  labelAr: string
  min: number
  max: number
  target: number
}

// نموذج التكاليف الافتراضي — يُعرض ويُحفظ مع كل تشغيل. لا انزلاق صفري بلا مبرر.
// القيم مبدئية محافظة؛ المحرك يقبل تجاوزها لكل تشغيل. الوحدات: دولار لكل عقد
// ما لم يُذكر خلاف ذلك.
export interface CostModel {
  // عمولة الوساطة لكل عقد (ذهاباً وإياباً يُحتسب مرتين داخل المحرك)
  commissionPerContract: number
  // افتراض التعبئة داخل الفرق bid/ask: 'mid' = منتصف، 'worst' = الجانب السيّئ
  fillAssumption: 'mid' | 'worst' | 'spread_fraction'
  // نسبة الفرق المدفوعة عند fillAssumption='spread_fraction' (0=mid، 1=الجانب السيّئ كاملاً)
  spreadFraction: number
  // انزلاق إضافي كنسبة من سعر العقد (فوق الفرق) — افتراض محافظ معلن
  slippagePct: number
  // مضاعف العقد (SPX/مؤشرات = 100)
  contractMultiplier: number
  // افتراض لمس الوقف/الهدف داخل الشمعة: 'stop_first' محافظ (الوقف يُفترض أولاً)
  intrabarAssumption: 'stop_first' | 'target_first' | 'worst_case'
}

export const DEFAULT_COST_MODEL: CostModel = {
  commissionPerContract: 0.65,
  fillAssumption: 'spread_fraction',
  spreadFraction: 0.5,
  slippagePct: 0.0,
  contractMultiplier: 100,
  intrabarAssumption: 'stop_first',
}

export interface StrategySpec {
  version: string
  label: string
  descriptionAr: string
  asset: 'spx'
  // بوابة خارج المال المطلقة — call: strike>price · put: strike<price (مطابقة recommendCore)
  otmOnly: true
  // نطاقات DTE لكل أفق زمني (من traderHorizon) — تفصل تاريخ الانتهاء عن المدى
  dteBands: DteBand[]
  // عتبات المعايرة المعتمدة (من SPX_CALIBRATION) — للعرض والمقارنة فقط داخل المختبر؛
  // المختبر لا يحوّل النتائج إلى «نفّذ».
  calibration: {
    executeScore: number
    watchScore: number
    minNetRR: number
    validated: boolean
    note: string
  }
  // نطاق سعر الطلب المقبول (من SPX_BANDS) — القيد نفسه الذي يطبّقه mandatoryFilter
  askRange: { safe: [number, number]; balanced: [number, number]; bold: [number, number] }
  costModel: CostModel
  // المرجع المناسب للمقارنة
  benchmark: { symbol: string; labelAr: string; kind: 'buy_and_hold' }
  // حدود صريحة: المواصفة تلتقط القواعد، لا التقييم المالي — يحتاج بيانات عقود حقيقية
  dataRequirements: string[]
}

export function buildStrategySpec(): StrategySpec {
  const dteBands: DteBand[] = (Object.keys(HORIZONS) as TraderHorizon[]).map((key) => {
    const h = HORIZONS[key]
    return { horizon: key, labelAr: h.labelAr, min: h.dte.min, max: h.dte.max, target: h.dte.target }
  })

  return {
    version: STRATEGY_VERSION,
    label: 'SPX OTM Long Option',
    descriptionAr:
      'شراء عقد خيار واحد خارج المال على مؤشر S&P 500، ضمن نطاق أيام انتهاء يحدّده الأفق '
      + 'الزمني (مغامر/متوسط/محافظ)، مع إدارة الخروج من حركة الأصل (هدف/وقف) لا من سعر العقد.',
    asset: 'spx',
    otmOnly: true,
    dteBands,
    calibration: {
      executeScore: SPX_CALIBRATION.executeScore,
      watchScore: SPX_CALIBRATION.watchScore,
      minNetRR: SPX_CALIBRATION.minNetRR,
      validated: SPX_CALIBRATION.validated,
      note: SPX_CALIBRATION.note,
    },
    askRange: SPX_BANDS.askRange,
    costModel: DEFAULT_COST_MODEL,
    benchmark: { symbol: 'SPX', labelAr: 'شراء واحتفاظ بالمؤشر', kind: 'buy_and_hold' },
    dataRequirements: [
      'سلاسل خيارات SPX التاريخية بأسعار bid/ask فعلية وتواريخها (لا أسعار تركيبية).',
      'مواصفات العقد: المضاعف (100)، نمط التسوية (نقدي أوروبي لـSPX)، تاريخ ونمط الانتهاء.',
      'دقّة زمنية كافية (دقيقة أو أدق) لتقييم لمس الوقف/الهدف داخل الشمعة بأمانة.',
    ],
  }
}

// مطابق لبوابة recommendCore.mandatoryFilter (بوابتا 1+2): خارج المال فقط.
// يُستخدم في اختبار التطابق وفي توثيق القاعدة للجانب Python.
export function isOtm(type: 'call' | 'put', strike: number, price: number): boolean {
  return type === 'call' ? strike > price : strike < price
}

// تصنيف DTE إلى أفق — مطابق matchHorizonByDte، مُعاد هنا للاكتفاء الذاتي للمواصفة.
export function horizonForDte(dte: number): TraderHorizon {
  if (dte <= 1) return 'aggressive'
  if (dte <= 5) return 'moderate'
  return 'conservative'
}
