// ── أنواع «مختبر الاستراتيجيات» (Strategy Lab) ────────────────────────────────
// واجهة اتصال واضحة بين المنصة ومحرك الاختبار (LEAN) بحالات صريحة، وسجل تشغيل
// كامل قابل لإعادة الإنتاج والمقارنة. راجع docs/strategy-lab.md.

import type { CostModel } from './strategySpec'
import type { TraderHorizon } from '../traderHorizon'

// الحد الأدنى للباقة لرؤية المختبر — بوابة مركزية (تُطبَّق على الخادم وطبقة البيانات).
export const LAB_MIN_TIER = 'edge' as const

// حالات التشغيل — واجهة الاتصال مع المحرك المنفصل.
export type RunStatus =
  | 'pending'          // أُنشئ، لم يبدأ بعد
  | 'running'          // قيد التشغيل داخل المحرك
  | 'completed'        // اكتمل بنتائج حقيقية
  | 'failed'           // تعطّل المحرك/خطأ تشغيل
  | 'insufficient_data' // لا بيانات حقيقية كافية — يُعرض السبب والمتطلبات لا نتيجة ملفّقة

// تصنيف مصدر النتيجة — تمييز واضح لا يختلط.
export type RunLabel = 'historical' | 'paper' | 'live'

export interface RunConfig {
  asset: 'spx'
  strategyVersion: string
  horizon: TraderHorizon
  // نطاق أيام الانتهاء المقصود (مستقل عن مدة الاحتفاظ وعن إطار التحليل)
  dte: { min: number; max: number; target: number }
  // فترة الاختبار التاريخية
  period: { from: string; to: string }   // YYYY-MM-DD
  // دقّة بيانات المحرك
  resolution: 'minute' | 'hour' | 'daily'
  costModel: CostModel
  benchmarkSymbol: string
}

export interface DataSourceInfo {
  provider: string        // مثال: 'quantconnect', 'local-csv', 'none'
  resolution: RunConfig['resolution']
  licenseAr: string       // ترخيص البيانات (المحرك ≠ حق إعادة توزيع البيانات)
  coverageAr: string      // وصف التغطية الزمنية والرموز
}

export interface DataQuality {
  // تقييم صادق لجودة البيانات المستخدمة — يُعرض للجميع حتى لو حُجب المختبر.
  realContractPrices: boolean  // أسعار عقود حقيقية (لا تركيبية)؟
  hasBidAsk: boolean
  intrabarResolution: boolean  // دقّة كافية داخل الشمعة؟
  notesAr: string[]
}

export interface TradeRecord {
  openedAt: string
  closedAt: string | null
  type: 'call' | 'put'
  strike: number
  expiration: string
  dte: number
  entryPrice: number
  exitPrice: number | null
  quantity: number
  grossPnl: number
  feesTotal: number
  netPnl: number
  exitReason: string   // هدف/وقف/انتهاء/خروج زمني
}

export interface EquityPoint { date: string; equity: number; benchmark: number | null }

export interface RunResults {
  trades: number
  wins: number
  losses: number
  winRatePct: number
  grossPnl: number
  netPnl: number
  avgWin: number
  avgLoss: number
  profitFactor: number | null   // إجمالي الأرباح ÷ إجمالي الخسائر
  expectancyR: number | null    // العائد المتوقع لكل صفقة (بوحدات R)
  maxDrawdownPct: number | null
  benchmarkReturnPct: number | null
  strategyReturnPct: number | null
  equityCurve: EquityPoint[]
  tradeLog: TradeRecord[]
}

export interface StrategyRun {
  id: string
  createdAt: string
  updatedAt: string
  status: RunStatus
  label: RunLabel
  config: RunConfig
  dataSource: DataSourceInfo
  dataQuality: DataQuality
  results: RunResults | null
  // سبب عدم الاكتمال (insufficient_data / failed) + المتطلبات لإتمامه حقيقةً
  reasonAr: string | null
  requirementsAr: string[]
  // بصمة بيئة المحرك وقت التشغيل (قابلية إعادة الإنتاج)
  engineAr: string | null
}
