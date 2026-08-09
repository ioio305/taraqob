import type { DecisionCouncil } from '@/lib/v2/decisionCouncil'
import type { OpportunityWindow, UnderlyingScenario } from '@/lib/v2/opportunityModel'

const ACTION = {
  call: { label: 'شراء صاعد', color: '#26D07C', icon: '▲' },
  put: { label: 'شراء هابط', color: '#F87171', icon: '▼' },
  wait: { label: 'انتظار', color: '#FBBF24', icon: '◌' },
  manage: { label: 'إدارة فرصة قائمة', color: '#60A5FA', icon: '◆' },
} as const

export function DecisionCouncilCard({
  council,
  scenario,
  window,
  compact = false,
}: {
  council: DecisionCouncil
  scenario?: UnderlyingScenario | null
  window?: OpportunityWindow | null
  compact?: boolean
}) {
  const action = ACTION[council.action]
  return (
    <section className="rounded-2xl border p-4" style={{ borderColor: `${action.color}45`, background: `${action.color}0B` }} dir="rtl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold text-slate-500">قرار ترقّب المركزي</div>
          <div className="mt-1 text-xl font-black" style={{ color: action.color }}>{action.icon} {action.label}</div>
          <div className="mt-1 max-w-2xl text-xs leading-6 text-slate-300">{council.explanation}</div>
        </div>
        <div className="text-left">
          <div className="text-3xl font-black tabular-nums" style={{ color: action.color }}>{council.opportunityScore}</div>
          <div className="text-[10px] text-slate-500">درجة الفرصة من 100</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Datum label="الثقة" value={council.confidence} />
        <Datum label="حالة السوق" value={council.marketState.label} />
        <Datum label="المخاطرة" value={council.riskLevel} />
        <Datum label="نافذة الفرصة" value={window?.label ?? (council.action === 'wait' ? 'غير مكتملة' : 'قيد التقدير')} />
      </div>

      {scenario ? (
        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
          <Datum label="الحركة المتوقعة" value={`${scenario.movementMin.toFixed(1)}–${scenario.movementMax.toFixed(1)} نقطة`} />
          <Datum label="الهدف الأول" value={scenario.target1.value.toLocaleString()} />
          <Datum label="الهدف الثاني" value={scenario.target2.value.toLocaleString()} />
          <Datum label="إلغاء السيناريو" value={scenario.invalidation.value.toLocaleString()} danger />
        </div>
      ) : null}

      {!compact ? (
        <details className="mt-3 rounded-xl border border-white/[.06] bg-black/10 px-3 py-2">
          <summary className="cursor-pointer text-xs font-bold text-slate-400">لماذا صدر هذا القرار؟</summary>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <div className="text-[11px] font-bold text-emerald-300">الأدلة المؤيدة</div>
              <ul className="mt-1 space-y-1 text-xs leading-5 text-slate-400">
                {(council.supportingEvidence.length ? council.supportingEvidence : ['لا يوجد اتفاق كافٍ بعد']).slice(0, 5).map(item => <li key={item}>• {item}</li>)}
              </ul>
            </div>
            <div>
              <div className="text-[11px] font-bold text-amber-300">الأدلة المعارضة أو الحماية</div>
              <ul className="mt-1 space-y-1 text-xs leading-5 text-slate-400">
                {[...council.opposingEvidence, ...council.vetoes].slice(0, 5).map(item => <li key={item}>• {item}</li>)}
                {!council.opposingEvidence.length && !council.vetoes.length ? <li>• لا توجد معارضة قوية تلغي السيناريو</li> : null}
              </ul>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {council.advisors.map(advisor => (
              <span key={advisor.key} className="rounded-full border border-white/[.06] bg-white/[.025] px-2 py-1 text-[10px] text-slate-400">
                {advisor.label}: {advisor.strength}
              </span>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  )
}

function Datum({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-xl border border-white/[.05] bg-black/10 px-3 py-2">
      <div className="text-[10px] text-slate-600">{label}</div>
      <div className="mt-0.5 text-xs font-bold" style={{ color: danger ? '#F87171' : '#E2E8F0' }}>{value}</div>
    </div>
  )
}
