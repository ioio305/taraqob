'use client'

import { useState } from 'react'
import { QUALITY_CONFIG, EXEC_RISK_CONFIG } from '@/lib/engine/liquidityCalculator'
import type { OptionContract } from '@/lib/types'
import toast from 'react-hot-toast'

interface ContractWatchlistProps {
  contracts: OptionContract[]
  onSelect?: (contractId: string) => void
  selectedId?: string
  showActions?: boolean
  onRefresh?: () => void
}

function ScoreBar({ score }: { score: number | null }) {
  if (score === null) return <span className="text-surface-400 text-xs">—</span>
  const color = score >= 75 ? 'bg-emerald-500' : score >= 55 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 h-1.5 bg-surface-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-mono font-bold ${
        score >= 75 ? 'text-emerald-700' : score >= 55 ? 'text-amber-700' : 'text-red-700'
      }`}>{score}</span>
    </div>
  )
}

export default function ContractWatchlist({
  contracts, onSelect, selectedId, showActions = true, onRefresh
}: ContractWatchlistProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [selectedContractId, setSelectedContractId] = useState<string | null>(selectedId ?? null)

  async function handleDelete(id: string) {
    if (!confirm('هل تريد حذف هذا العقد؟')) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/contracts/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('تم حذف العقد')
        onRefresh?.()
      } else {
        toast.error('خطأ في الحذف')
      }
    } finally {
      setDeletingId(null)
    }
  }

  async function handleSelect(id: string) {
    setSelectedContractId(id)
    onSelect?.(id)
    // Mark as selected in DB
    await fetch(`/api/contracts/${id}/select`, { method: 'PATCH' })
  }

  if (contracts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-12 h-12 rounded-2xl bg-surface-100 border border-surface-200
          flex items-center justify-center mb-3">
          <svg className="w-5 h-5 text-surface-300" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
        </div>
        <div className="text-sm font-medium text-surface-500">لا توجد عقود في القائمة</div>
        <div className="text-xs text-surface-400 mt-1">أضف عقدًا باستخدام النموذج أعلاه</div>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-surface-200">
            {[
              'النوع', 'Strike', 'DTE', 'Bid', 'Ask', 'Mid',
              'Delta', 'Theta', 'IV%', 'Volume', 'OI',
              'جودة السيولة', 'مخاطر التنفيذ', ''
            ].map(h => (
              <th key={h} className="px-3 py-3 text-right text-[11px] font-semibold
                text-surface-400 uppercase tracking-wider bg-surface-50 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {contracts.map(c => {
            const isSelected = selectedContractId === c.id || c.is_selected
            const qConfig = c.contract_quality ? QUALITY_CONFIG[c.contract_quality] : null
            const eConfig = c.execution_risk ? EXEC_RISK_CONFIG[c.execution_risk] : null
            const mid = c.bid && c.ask ? ((c.bid + c.ask) / 2) : null

            return (
              <tr key={c.id} className={`border-b border-surface-100 transition-colors ${
                isSelected ? 'bg-teal-50 border-b-teal-200' :
                c.contract_quality === 'avoid' ? 'bg-red-50/30 opacity-70' :
                'hover:bg-surface-50'
              }`}>

                {/* Type */}
                <td className="px-3 py-3">
                  <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold ${
                    c.contract_type === 'call'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {c.contract_type === 'call' ? '↑ Call' : '↓ Put'}
                  </span>
                </td>

                {/* Strike */}
                <td className="px-3 py-3 font-mono font-bold text-navy-900">
                  {c.strike.toLocaleString('en-US')}
                </td>

                {/* DTE */}
                <td className="px-3 py-3">
                  <span className={`font-mono font-bold text-sm ${
                    (c.dte ?? 99) < 3  ? 'text-red-700' :
                    (c.dte ?? 99) <= 14 ? 'text-emerald-700' : 'text-surface-600'
                  }`}>
                    {c.dte ?? '—'}
                  </span>
                </td>

                {/* Bid / Ask / Mid */}
                <td className="px-3 py-3 font-mono text-surface-600">{c.bid?.toFixed(3) ?? '—'}</td>
                <td className="px-3 py-3 font-mono text-surface-600">{c.ask?.toFixed(3) ?? '—'}</td>
                <td className="px-3 py-3 font-mono font-medium text-navy-900">
                  {mid?.toFixed(3) ?? '—'}
                </td>

                {/* Greeks */}
                <td className="px-3 py-3 font-mono text-surface-600">
                  {c.delta?.toFixed(3) ?? '—'}
                </td>
                <td className="px-3 py-3 font-mono text-surface-600">
                  {c.theta?.toFixed(3) ?? '—'}
                </td>
                <td className="px-3 py-3 font-mono text-surface-600">
                  {c.iv ? `${(c.iv).toFixed(1)}%` : '—'}
                </td>

                {/* Volume / OI */}
                <td className="px-3 py-3 font-mono text-surface-600">
                  {c.volume?.toLocaleString('en-US') ?? '—'}
                </td>
                <td className="px-3 py-3 font-mono text-surface-600">
                  {c.open_interest?.toLocaleString('en-US') ?? '—'}
                </td>

                {/* Quality */}
                <td className="px-3 py-3">
                  {qConfig ? (
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border
                        ${qConfig.color} ${qConfig.bg} ${qConfig.border}`}>
                        {qConfig.ar}
                      </span>
                      <ScoreBar score={c.liquidity_score} />
                    </div>
                  ) : '—'}
                </td>

                {/* Execution Risk */}
                <td className="px-3 py-3">
                  {eConfig ? (
                    <span className={`text-xs font-semibold ${eConfig.color}`}>
                      {eConfig.ar}
                    </span>
                  ) : '—'}
                </td>

                {/* Actions */}
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1.5">
                    {showActions && (
                      <>
                        <button
                          onClick={() => handleSelect(c.id)}
                          disabled={c.contract_quality === 'avoid'}
                          title="اختيار هذا العقد للإشارة"
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            isSelected
                              ? 'bg-teal-500 text-white'
                              : c.contract_quality === 'avoid'
                                ? 'bg-surface-100 text-surface-300 cursor-not-allowed'
                                : 'bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200'
                          }`}
                        >
                          {isSelected ? '✓ مختار' : 'اختيار'}
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
                          disabled={deletingId === c.id}
                          title="حذف العقد"
                          className="p-1.5 rounded-lg text-surface-300 hover:text-red-500
                            hover:bg-red-50 transition-all"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6l-1 14H6L5 6"/>
                            <path d="M10 11v6M14 11v6"/>
                            <path d="M9 6V4h6v2"/>
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </td>

              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
