'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button, C, Card, LogItem, Notice, PageTitle, inputClass, inputStyle, type LogRow } from '../ui'

// سجل الحركات — للمالك وحده.
export default function ActivityPage() {
  return (
    <Suspense fallback={<p className="text-sm" style={{ color: C.muted }}>جاري التحميل…</p>}>
      <ActivityLog />
    </Suspense>
  )
}

function ActivityLog() {
  const params = useSearchParams()
  const user = params.get('user')
  const [logs, setLogs] = useState<LogRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [kind, setKind] = useState('')
  const [market, setMarket] = useState('')
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const qs = new URLSearchParams({ page: String(page) })
    if (kind) qs.set('kind', kind)
    if (market) qs.set('market', market)
    if (search) qs.set('q', search)
    if (user) qs.set('user', user)
    const res = await fetch(`/api/v2/admin/audit?${qs}`, { cache: 'no-store' })
    const data = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) { setError(data.error ?? 'تعذّر التحميل'); return }
    setError(null)
    setLogs(data.logs)
    setTotal(data.total)
  }, [page, kind, market, search, user])

  useEffect(() => { load() }, [load])

  const pages = Math.max(1, Math.ceil(total / 40))

  return (
    <div>
      <PageTitle title="سجل الحركات"
        hint={user ? 'حركات حساب واحد.' : 'كل دخول وتبديل سوق ودفع، وكل إجراء من الفريق — سجل لا يُعدَّل ولا يُحذف.'} />

      <Card className="mb-4">
        <form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); setPage(1); setSearch(q.trim()) }}>
          <select value={kind} onChange={e => { setPage(1); setKind(e.target.value) }} aria-label="النوع" className={`${inputClass} w-auto`} style={inputStyle}>
            <option value="">كل الحركات</option>
            <option value="users">حركات المستخدمين</option>
            <option value="team">إجراءات الفريق</option>
          </select>
          <select value={market} onChange={e => { setPage(1); setMarket(e.target.value) }} aria-label="السوق" className={`${inputClass} w-auto`} style={inputStyle}>
            <option value="">كل الأسواق</option>
            <option value="saudi">السوق السعودي</option>
            <option value="us">السوق الأمريكي</option>
          </select>
          {!user ? (
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="بريد صاحب الحركة" aria-label="بحث بالبريد"
              dir="ltr" className={`${inputClass} min-w-[180px] flex-1`} style={inputStyle} />
          ) : null}
          <Button type="submit">تصفية</Button>
          {user ? <a href="/admin/activity" className="self-center text-xs font-bold" style={{ color: C.gold }}>كل الحسابات</a> : null}
        </form>
      </Card>

      {error ? <Notice text={error} ok={false} /> : null}

      <Card>
        {loading && !logs.length ? <p className="text-sm" style={{ color: C.muted }}>جاري التحميل…</p>
          : logs.length ? <ul className="divide-y divide-white/5">{logs.map(log => <LogItem key={log.id} log={log} />)}</ul>
          : <p className="text-sm" style={{ color: C.muted }}>لا توجد حركات مطابقة.</p>}
      </Card>

      <div className="mt-4 flex items-center justify-between text-xs" style={{ color: C.muted }}>
        <span>{total} حركة</span>
        <div className="flex items-center gap-2">
          <Button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>الأحدث</Button>
          <span className="tabular-nums">{page} / {pages}</span>
          <Button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages}>الأقدم</Button>
        </div>
      </div>
    </div>
  )
}
