'use client'

import { useState } from 'react'
import type { Strategy } from '@/lib/engine/contractAnalyzer'

type StrategyInfo = {
  icon:        string
  ar:          string
  desc:        string
  whenToUse:   string
  indicators:  string[]
  expectedResult: string
  risk:        string
  dteSuggested: string
  example:     string
  explosionPotential: 'عالٍ جداً' | 'متوسط' | 'منخفض'
}

export const STRATEGY_DETAILS: Record<Strategy, StrategyInfo> = {
  '0dte_scalping': {
    icon: '⚡',
    ar:   '0DTE السريع',
    desc: 'تداول عقود تنتهي في نفس اليوم للحصول على أرباح سريعة خلال ساعات.',
    whenToUse: 'عند وجود Kill Zone نشطة (9:30-11 صباحاً) واتجاه واضح في SPX مع VWAP يدعمه.',
    indicators: ['ICT Sessions ← الأهم', 'VWAP Reversion', 'الزخم اللحظي', 'الأحداث الكلية', 'السيولة'],
    expectedResult: 'ربح 20-50% في ساعات — أو خسارة 30-40%. لا وسط.',
    risk: '🔴 عالٍ جداً — الوقت يأكل العقد بسرعة',
    dteSuggested: '0 (ينتهي اليوم)',
    example: 'SPX عند 7229، يبدأ الصعود عند 9:45 فوق VWAP → شراء Call 7230 بـ $15 → بيع عند $22 بعد ساعة (+47%)',
    explosionPotential: 'عالٍ جداً',
  },
  'spread': {
    icon: '📊',
    ar:   'Spread محدد',
    desc: 'شراء عقد وبيع آخر في نفس الوقت لتقليل التكلفة وتحديد أقصى خسارة مسبقاً.',
    whenToUse: 'عند وجود اتجاه واضح لكن IV مرتفع يجعل العقد المنفرد غالياً جداً.',
    indicators: ['حالة السوق', 'ضغط التذبذب IV', 'الحركة المتوقعة', 'قيمة العقد', 'ICT Sessions'],
    expectedResult: 'ربح محدد ومعروف مسبقاً — خسارة محدودة. مناسب للمبتدئين.',
    risk: '🟡 متوسط — الخسارة القصوى معروفة من البداية',
    dteSuggested: '7-21 يوم',
    example: 'شراء Call 7200 + بيع Call 7225 → تكلفة $8 → أقصى ربح $17 إذا SPX تجاوز 7225',
    explosionPotential: 'منخفض',
  },
  'iron_condor': {
    icon: '🦅',
    ar:   'Iron Condor',
    desc: 'بيع Call وPut بعيدَين عن السعر الحالي. الربح عندما يبقى السوق هادئاً في نطاق.',
    whenToUse: 'عندما VIX مرتفع وتتوقع أن السوق سيبقى في نطاق بدون حركة كبيرة.',
    indicators: ['ضغط التذبذب VIX ← الأهم', 'الحركة المتوقعة', 'الأحداث الكلية', 'حالة السوق', 'قيمة العقد'],
    expectedResult: 'ربح ثابت ومحدود عند هدوء السوق — خسارة إذا تحرك SPX بقوة.',
    risk: '🟡 متوسط — يخسر عند الحركات الكبيرة',
    dteSuggested: '21-45 يوم',
    example: 'SPX عند 7229، VIX=22 → بيع Call 7350 + بيع Put 7100 → ربح $300 إذا SPX بقي بينهما',
    explosionPotential: 'منخفض',
  },
  'vwap_reversion': {
    icon: '🔄',
    ar:   'VWAP Reversion',
    desc: 'الدخول عندما يبتعد SPX كثيراً عن متوسط السعر اليومي توقعاً لعودته.',
    whenToUse: 'عند ابتعاد SPX عن VWAP بأكثر من 0.5% مع تراجع الحجم (exhaustion).',
    indicators: ['VWAP ← الأهم', 'الزخم اللحظي', 'ICT Sessions', 'الأحداث الكلية', 'السيولة'],
    expectedResult: 'ربح 15-40% عند عودة SPX لـ VWAP. فرص متعددة يومياً.',
    risk: '🟡 متوسط — قد يستمر الابتعاد أكثر',
    dteSuggested: '1-7 أيام',
    example: 'SPX عند 7260 (+0.8% فوق VWAP 7201) → شراء Put 7250 بـ $12 → بيع عند $18 لما عاد SPX لـ VWAP (+50%)',
    explosionPotential: 'متوسط',
  },
  'gamma_scalping': {
    icon: '🎯',
    ar:   'Gamma Scalping',
    desc: 'استغلال تسارع Gamma في العقود قريبة الانتهاء للحصول على مكاسب سريعة.',
    whenToUse: 'عند DTE 0-3 أيام، Gamma مرتفع، والسوق في Kill Zone نشطة.',
    indicators: ['Gamma Risk ← الأهم', 'احتمالية الربح', 'الزخم اللحظي', 'ICT Sessions', 'تآكل الوقت'],
    expectedResult: 'ربح سريع 15-30% في ساعات — لكن التوقيت حاسم.',
    risk: '🔴 عالٍ — يحتاج مراقبة مستمرة كل 5 دقائق',
    dteSuggested: '0-3 أيام',
    example: 'Call 7225 بـ $8، Gamma=0.008، SPX يصعد 20 نقطة → العقد يصل $14 (+75%) في ساعة',
    explosionPotential: 'عالٍ جداً',
  },
}

export function StrategyTooltip({ strategy, children }: { strategy: Strategy; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const info = STRATEGY_DETAILS[strategy]

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5">
        {children}
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="w-5 h-5 rounded-full bg-surface-100 text-surface-400 hover:bg-teal-100 hover:text-teal-600 flex items-center justify-center text-xs font-bold transition-colors flex-shrink-0"
        >
          ?
        </button>
      </div>

      {open && (
        <>
          <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-2 w-80 bg-white border border-surface-200 rounded-2xl shadow-card-lg overflow-hidden"
            style={{ zIndex: 9999 }}
            dir="rtl"
          >
            {/* Header */}
            <div className="bg-gradient-to-l from-navy-900 to-navy-800 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{info.icon}</span>
                <div>
                  <div className="text-white font-bold text-sm">{info.ar}</div>
                  <div className={`text-xs px-2 py-0.5 rounded-full mt-0.5 inline-block ${
                    info.explosionPotential === 'عالٍ جداً' ? 'bg-red-500/30 text-red-200' :
                    info.explosionPotential === 'متوسط' ? 'bg-amber-500/30 text-amber-200' :
                    'bg-surface-500/30 text-surface-300'
                  }`}>
                    احتمال انفجار سعري: {info.explosionPotential}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
              {/* الوصف */}
              <p className="text-xs text-surface-600 leading-relaxed">{info.desc}</p>

              {/* متى تستخدمها */}
              <div>
                <div className="text-[10px] font-bold text-navy-900 uppercase tracking-wider mb-1">⏰ متى تستخدمها؟</div>
                <div className="text-xs text-surface-600 bg-teal-50 rounded-lg p-2 border border-teal-100">{info.whenToUse}</div>
              </div>

              {/* المؤشرات */}
              <div>
                <div className="text-[10px] font-bold text-navy-900 uppercase tracking-wider mb-1.5">📊 المؤشرات الفعّالة</div>
                <div className="space-y-1">
                  {info.indicators.map((ind, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-surface-600">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${i === 0 ? 'bg-teal-500' : 'bg-surface-300'}`} />
                      {ind}
                    </div>
                  ))}
                </div>
              </div>

              {/* DTE */}
              <div className="flex items-center gap-2 bg-navy-50 rounded-lg p-2 border border-navy-100">
                <span className="text-sm">📅</span>
                <div>
                  <div className="text-[10px] text-navy-600 font-semibold">أيام الانتهاء المناسبة</div>
                  <div className="text-xs font-bold text-navy-900">{info.dteSuggested}</div>
                </div>
              </div>

              {/* النتيجة المتوقعة */}
              <div>
                <div className="text-[10px] font-bold text-navy-900 uppercase tracking-wider mb-1">🎯 النتيجة المتوقعة</div>
                <div className="text-xs text-surface-600">{info.expectedResult}</div>
              </div>

              {/* مستوى الخطر */}
              <div className="text-xs font-medium">{info.risk}</div>

              {/* مثال */}
              <div>
                <div className="text-[10px] font-bold text-navy-900 uppercase tracking-wider mb-1">💡 مثال عملي</div>
                <div className="text-[11px] text-surface-500 bg-surface-50 rounded-lg p-2 border border-surface-100 leading-relaxed font-mono">
                  {info.example}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
