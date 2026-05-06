'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

type Log = {
  id: string; actor_email: string; action: string
  entity_type: string; entity_id: string | null
  new_values: Record<string, unknown> | null; created_at: string
}

const ACTION_AR: Record<string, string> = {
  invite_user:  'دعوة مستخدم',
  update_user:  'تحديث مستخدم',
  activate_user: 'تفعيل حساب',
  deactivate_user: 'إيقاف حساب',
}

const ACTION_COLOR: Record<string, string> = {
  invite_user:     '#60A5FA',
  update_user:     '#C9943A',
  activate_user:   '#10B981',
  deactivate_user: '#EF4444',
}

export default function AuditPage() {
  const [logs, setLogs]     = useState<Log[]>([])
  const [total, setTotal]   = useState(0)
  const [page, setPage]     = useState(1)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/v2/admin/audit?page=${page}`)
    const d   = await res.json()
    setLogs(d.logs ?? [])
    setTotal(d.total ?? 0)
    setLoading(false)
  }, [page])

  useEffect(() => { load() }, [load])

  const pages = Math.ceil(total / 30)

  return (
    <div className="max-w-5xl mx-auto px-5 py-6 space-y-5" dir="rtl"
      style={{ fontFamily: '"IBM Plex Sans Arabic", sans-serif' }}>

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/v2/admin" className="text-sm" style={{ color: '#2D3748' }}>← الإدارة</Link>
        <span style={{ color: '#1A2A3A' }}>/</span>
        <h1 className="text-lg font-bold text-white">سجل الأحداث</h1>
        <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.04)', color: '#4A5568' }}>
          {total} حدث
        </span>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ background: 'rgba(13,27,42,0.85)', border: '1px solid rgba(255,255,255,0.06)' }}>
        {loading ? (
          <div className="py-20 text-center font-mono text-sm" style={{ color: '#2D3748' }}>جاري التحميل...</div>
        ) : logs.length === 0 ? (
          <div className="py-20 text-center font-mono text-sm" style={{ color: '#2D3748' }}>لا توجد أحداث</div>
        ) : (
          <div className="divide-y" style={{ '--tw-divide-opacity': 1 } as React.CSSProperties}>
            {logs.map(log => (
              <div key={log.id} className="flex items-start gap-4 px-5 py-4">
                {/* وقت */}
                <div className="shrink-0 text-right" style={{ minWidth: 110 }}>
                  <div className="text-xs font-mono" style={{ color: '#4A5568' }}>
                    {new Date(log.created_at).toLocaleDateString('ar-SA')}
                  </div>
                  <div className="text-xs font-mono" style={{ color: '#2D3748' }}>
                    {new Date(log.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                {/* Action Badge */}
                <span className="shrink-0 text-xs font-mono px-2 py-1 rounded mt-0.5"
                  style={{
                    background: `${ACTION_COLOR[log.action] ?? '#4A5568'}15`,
                    color:      ACTION_COLOR[log.action] ?? '#4A5568',
                    border:     `1px solid ${ACTION_COLOR[log.action] ?? '#4A5568'}25`,
                  }}>
                  {ACTION_AR[log.action] ?? log.action}
                </span>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white">
                    <span className="font-mono" style={{ color: '#C9943A' }}>{log.actor_email}</span>
                    {log.entity_type && (
                      <span style={{ color: '#4A5568' }}> · {log.entity_type}
                        {log.entity_id && <span className="font-mono text-xs"> #{log.entity_id.slice(0, 8)}</span>}
                      </span>
                    )}
                  </div>
                  {log.new_values && Object.keys(log.new_values).length > 0 && (
                    <div className="text-xs font-mono mt-1" style={{ color: '#2D3748' }}>
                      {Object.entries(log.new_values).map(([k, v]) => `${k}: ${String(v)}`).join(' · ')}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 rounded text-sm disabled:opacity-30"
            style={{ background: 'rgba(255,255,255,0.04)', color: '#4A5568' }}>→</button>
          <span className="text-sm font-mono" style={{ color: '#4A5568' }}>{page} / {pages}</span>
          <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
            className="px-3 py-1.5 rounded text-sm disabled:opacity-30"
            style={{ background: 'rgba(255,255,255,0.04)', color: '#4A5568' }}>←</button>
        </div>
      )}
    </div>
  )
}
