'use client'

import type { AnalysisResult } from '@/lib/engine/contractAnalyzer'

type Target = {
  label:       string
  spxTarget:   number
  strikeTarget: number
  contractTarget: number
  pctGain:     number
  probability: number
  timeframe:   string
  type:        'conservative' | 'moderate' | 'aggressive' | 'explosion'
}

function computeTargets(
  result: AnalysisResult,
  spxPrice: number,
  strike: number,
  mid: number,
  contractType: 'call' | 'put',
  dte: number,
  vix: number,
): Target[] {
  const isPut = contractType === 'put'
  const expMove = spxPrice * (vix / 100) * Math.sqrt(Math.max(dte, 1) / 365)
  const direction = isPut ? -1 : 1

  // مستويات الحركة المتوقعة
  const moves = [
    { pct: 0.3,  label: 'محافظ 🟢',    timeframe: '2-4 ساعات', type: 'conservative' as const, prob: 65 },
    { pct: 0.6,  label: 'معتدل 🟡',    timeframe: '4-8 ساعات', type: 'moderate'     as const, prob: 45 },
    { pct: 1.0,  label: 'جريء 🔴',     timeframe: 'جلسة كاملة', type: 'aggressive'  as const, prob: 25 },
    { pct: 1.8,  label: '💥 انفجار',   timeframe: 'غير محدد',   type: 'explosion'   as const, prob: 10 },
  ]

  return moves.map(m => {
    const spxMove    = expMove * m.pct
    const spxTarget  = spxPrice + direction * spxMove
    // حساب سعر العقد عند الهدف باستخدام Delta تقريبي
    const deltaApprox = result.indicators.find(i => i.code === 'profit_probability')
      ? Math.abs(parseFloat(result.indicators.find(i => i.code === 'profit_probability')!.status) / 100) || 0.35
      : 0.35
    const contractMove   = deltaApprox * spxMove
    const contractTarget = Math.max(0.1, mid + contractMove)
    const pctGain        = ((contractTarget - mid) / mid) * 100

    // أقرب Strike مناسب
    const strikeStep   = spxTarget < 7000 ? 5 : 25
    const strikeTarget = Math.round(spxTarget / strikeStep) * strikeStep

    return {
      label:          m.label,
      spxTarget:      Math.round(spxTarget * 100) / 100,
      strikeTarget,
      contractTarget: Math.round(contractTarget * 100) / 100,
      pctGain:        Math.round(pctGain),
      probability:    m.prob,
      timeframe:      m.timeframe,
      type:           m.type,
    }
  })
}

export function SmartTargetsCard({
  result, spxPrice, strike, mid, contractType, dte, vix,
}: {
  result: AnalysisResult; spxPrice: number; strike: number
  mid: number; contractType: 'call'|'put'; dte: number; vix: number
}) {
  const targets = computeTargets(result, spxPrice, strike, mid, contractType, dte, vix)
  const isPut   = contractType === 'put'

  return (
    <div className="card overflow-hidden" dir="rtl">
      {/* Header */}
      <div className="px-5 py-4 border-b border-surface-100 bg-gradient-to-l from-navy-50 to-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-navy-900">🎯 أهداف الجلسة الذكية</div>
            <div className="text-[10px] text-surface-400 mt-0.5">
              محسوبة من الحركة المتوقعة — SPX عند {spxPrice.toFixed(2)}
            </div>
          </div>
          <div className={`text-xs font-bold px-3 py-1 rounded-full ${isPut ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
            {isPut ? '📉 Put' : '📈 Call'}
          </div>
        </div>
      </div>

      {/* الأهداف */}
      <div className="divide-y divide-surface-100">
        {targets.map((t, i) => (
          <div key={i} className={`px-5 py-4 ${t.type === 'explosion' ? 'bg-gradient-to-l from-amber-50/50 to-white' : ''}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-bold text-navy-900">{t.label}</span>
                  <span className="text-[10px] text-surface-400 bg-surface-100 px-2 py-0.5 rounded-full">{t.timeframe}</span>
                </div>

                {/* مؤشر الاحتمالية */}
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 h-1.5 bg-surface-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${
                      t.type === 'conservative' ? 'bg-emerald-400' :
                      t.type === 'moderate'     ? 'bg-amber-400' :
                      t.type === 'aggressive'   ? 'bg-orange-400' :
                      'bg-red-400 animate-pulse'
                    }`} style={{ width: `${t.probability}%` }} />
                  </div>
                  <span className="text-[10px] text-surface-400 font-mono">{t.probability}%</span>
                </div>

                {/* الأهداف بالأرقام */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-navy-50 rounded-lg p-2 text-center border border-navy-100">
                    <div className="text-[9px] text-navy-500 font-semibold mb-0.5">SPX يصل</div>
                    <div className="text-xs font-bold text-navy-900 font-mono">{t.spxTarget.toFixed(0)}</div>
                    <div className={`text-[9px] font-mono ${isPut ? 'text-red-500' : 'text-emerald-500'}`}>
                      {isPut ? '-' : '+'}{Math.abs(t.spxTarget - spxPrice).toFixed(0)} نقطة
                    </div>
                  </div>
                  <div className="bg-teal-50 rounded-lg p-2 text-center border border-teal-100">
                    <div className="text-[9px] text-teal-500 font-semibold mb-0.5">Strike المناسب</div>
                    <div className="text-xs font-bold text-teal-900 font-mono">{t.strikeTarget}</div>
                    <div className="text-[9px] text-teal-400">
                      {isPut ? 'Put' : 'Call'} {t.strikeTarget}
                    </div>
                  </div>
                  <div className={`rounded-lg p-2 text-center border ${t.type === 'explosion' ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-100'}`}>
                    <div className="text-[9px] text-emerald-600 font-semibold mb-0.5">العقد يصل</div>
                    <div className="text-xs font-bold text-emerald-900 font-mono">${t.contractTarget.toFixed(2)}</div>
                    <div className={`text-[9px] font-bold ${t.pctGain >= 50 ? 'text-emerald-600' : 'text-emerald-500'}`}>
                      +{t.pctGain}%
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* تحذير الانفجار */}
            {t.type === 'explosion' && (
              <div className="mt-3 text-[10px] text-amber-700 bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">
                💥 <span className="font-semibold">منطقة الانفجار السعري</span> — تحتاج GEX سلبي + كسر مستوى رئيسي + حجم ضخم. احتمال منخفض لكن المكافأة كبيرة جداً.
              </div>
            )}
          </div>
        ))}
      </div>

      {/* حد الإبطال */}
      <div className="px-5 py-4 bg-red-50 border-t border-red-100">
        <div className="flex items-center gap-3">
          <span className="text-lg">⛔</span>
          <div className="flex-1">
            <div className="text-xs font-bold text-red-800">حد الإبطال — اخرج فوراً إذا وصل SPX</div>
            <div className="flex items-center gap-4 mt-1">
              <div className="text-sm font-bold text-red-900 font-mono">
                SPX: {(spxPrice + (isPut ? 1 : -1) * spxPrice * 0.004).toFixed(0)}
              </div>
              <div className="text-xs text-red-600">
                العقد سيخسر تقريباً 40%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ملاحظة */}
      <div className="px-5 py-3 bg-surface-50 border-t border-surface-100">
        <div className="text-[10px] text-surface-400 text-center">
          الأهداف محسوبة من الحركة المتوقعة والـ Delta — للاسترشاد فقط
        </div>
      </div>
    </div>
  )
}
