'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import ContractForm from '@/components/contracts/ContractForm'
import ContractWatchlist from '@/components/contracts/ContractWatchlist'
import { Spinner } from '@/components/ui'
import type { MarketSession, OptionContract } from '@/lib/types'

export default function ContractsPage() {
  const [sessions, setSessions] = useState<MarketSession[]>([])
  const [selectedSession, setSelectedSession] = useState<MarketSession | null>(null)
  const [contracts, setContracts] = useState<OptionContract[]>([])
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [loadingContracts, setLoadingContracts] = useState(false)
  const [showForm, setShowForm] = useState(true)

  // Load sessions
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('market_sessions')
      .select('*')
      .order('session_date', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        setSessions(data ?? [])
        if (data && data.length > 0) {
          setSelectedSession(data[0])
        }
        setLoadingSessions(false)
      })
  }, [])

  // Load contracts when session changes
  const loadContracts = useCallback(async () => {
    if (!selectedSession) return
    setLoadingContracts(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('option_contracts')
      .select('*')
      .eq('session_id', selectedSession.id)
      .order('contract_type')
      .order('strike')
    setContracts(data ?? [])
    setLoadingContracts(false)
  }, [selectedSession])

  useEffect(() => { loadContracts() }, [loadContracts])

  if (loadingSessions) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="p-5 md:p-6">
        <div className="card p-8 text-center">
          <div className="text-sm font-medium text-surface-600 mb-2">
            لا توجد جلسات سوق
          </div>
          <div className="text-xs text-surface-400 mb-4">
            أنشئ جلسة سوق أولًا لإضافة العقود
          </div>
          <a href="/admin/sessions/new" className="btn-primary btn-sm">
            إنشاء جلسة
          </a>
        </div>
      </div>
    )
  }

  // Stats
  const goodCount       = contracts.filter(c => c.contract_quality === 'good').length
  const acceptableCount = contracts.filter(c => c.contract_quality === 'acceptable').length
  const avoidCount      = contracts.filter(c => c.contract_quality === 'avoid' || c.contract_quality === 'weak').length
  const selectedContract = contracts.find(c => c.is_selected)

  return (
    <div className="p-5 md:p-6 flex flex-col gap-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy-900">قائمة العقود</h1>
          <p className="text-xs text-surface-400 mt-0.5">
            SPX Options Watchlist — تقييم مباشر للسيولة
          </p>
        </div>
        <button
          onClick={() => setShowForm(prev => !prev)}
          className="btn-secondary gap-1.5"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          {showForm ? 'إخفاء النموذج' : 'إضافة عقد'}
        </button>
      </div>

      {/* Session Selector */}
      <div className="card p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="text-xs font-semibold text-surface-400 uppercase tracking-wide flex-shrink-0">
            الجلسة:
          </div>
          <div className="flex flex-wrap gap-2">
            {sessions.map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedSession(s)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                  selectedSession?.id === s.id
                    ? 'bg-navy-900 text-white border-navy-900'
                    : 'bg-white text-surface-600 border-surface-200 hover:border-surface-300'
                }`}
              >
                {new Date(s.session_date).toLocaleDateString('ar-SA', {
                  month: 'short', day: 'numeric'
                })}
                {s.spx_close && (
                  <span className="mr-1.5 font-mono opacity-70">
                    {s.spx_close.toLocaleString('en-US')}
                  </span>
                )}
              </button>
            ))}
          </div>
          {selectedSession && (
            <div className="mr-auto text-xs text-surface-400">
              <span className="font-mono font-bold text-navy-900">
                {selectedSession.spx_close?.toLocaleString('en-US') ?? '—'}
              </span>
              {' '}SPX · VIX{' '}
              <span className="font-mono font-bold text-navy-900">
                {selectedSession.vix?.toFixed(2) ?? '—'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      {contracts.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card p-4">
            <div className="text-xs font-semibold text-surface-400 uppercase mb-1">إجمالي العقود</div>
            <div className="text-2xl font-bold font-mono text-navy-900">{contracts.length}</div>
          </div>
          <div className="card p-4 bg-emerald-50/50 border-emerald-200">
            <div className="text-xs font-semibold text-emerald-600 uppercase mb-1">جيد</div>
            <div className="text-2xl font-bold font-mono text-emerald-700">{goodCount}</div>
          </div>
          <div className="card p-4 bg-amber-50/50 border-amber-200">
            <div className="text-xs font-semibold text-amber-600 uppercase mb-1">مقبول</div>
            <div className="text-2xl font-bold font-mono text-amber-700">{acceptableCount}</div>
          </div>
          <div className="card p-4 bg-red-50/50 border-red-200">
            <div className="text-xs font-semibold text-red-600 uppercase mb-1">ضعيف/تجنب</div>
            <div className="text-2xl font-bold font-mono text-red-700">{avoidCount}</div>
          </div>
        </div>
      )}

      {/* Selected Contract Banner */}
      {selectedContract && (
        <div className="bg-teal-50 border border-teal-300 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-teal-500 flex-shrink-0" />
          <div className="flex-1 text-sm">
            <span className="font-bold text-teal-800">العقد المختار للإشارة: </span>
            <span className="font-mono text-teal-700">
              {selectedContract.contract_type === 'call' ? 'Call' : 'Put'}{' '}
              {selectedContract.strike.toLocaleString('en-US')} ·{' '}
              DTE {selectedContract.dte} · Mid {((selectedContract.bid ?? 0 + (selectedContract.ask ?? 0)) / 2).toFixed(3)}
            </span>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
            selectedContract.contract_quality
              ? `${
                  selectedContract.contract_quality === 'good' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
                  selectedContract.contract_quality === 'acceptable' ? 'text-amber-700 bg-amber-50 border-amber-200' :
                  'text-red-700 bg-red-50 border-red-200'
                }`
              : ''
          }`}>
            {selectedContract.liquidity_score ?? '—'}
          </span>
        </div>
      )}

      <div className={`grid ${showForm ? 'grid-cols-1 xl:grid-cols-5' : 'grid-cols-1'} gap-5`}>

        {/* Form Panel */}
        {showForm && selectedSession && (
          <div className="xl:col-span-2">
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-bold text-navy-900">إضافة عقد جديد</div>
                <div className="text-xs text-surface-400">
                  التقييم مباشر وتلقائي
                </div>
              </div>
              <ContractForm
                session={selectedSession}
                onSaved={loadContracts}
              />
            </div>
          </div>
        )}

        {/* Watchlist Panel */}
        <div className={showForm ? 'xl:col-span-3' : 'col-span-1'}>
          <div className="card">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-surface-100">
              <div>
                <div className="text-sm font-bold text-navy-900">العقود المراقبة</div>
                <div className="text-xs text-surface-400 mt-0.5">
                  {contracts.length} عقد · انقر "اختيار" لتحديد العقد للإشارة
                </div>
              </div>
              <button
                onClick={loadContracts}
                disabled={loadingContracts}
                className="btn-ghost btn-sm gap-1"
              >
                {loadingContracts ? <Spinner size="sm" /> : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="23 4 23 10 17 10"/>
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                  </svg>
                )}
                تحديث
              </button>
            </div>

            {loadingContracts ? (
              <div className="flex items-center justify-center py-16">
                <Spinner size="lg" />
              </div>
            ) : (
              <ContractWatchlist
                contracts={contracts}
                onRefresh={loadContracts}
                showActions={true}
              />
            )}
          </div>
        </div>

      </div>

      {/* Compliance Note */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
        <strong>ملاحظة:</strong> درجة السيولة محسوبة تلقائيًا بناءً على Spread، Volume، OI، وDTE.
        العقود بدرجة "تجنب" لا يمكن اختيارها للإشارة.
        تداول 0DTE محظور تمامًا في النسخة Beta.
      </div>

    </div>
  )
}
