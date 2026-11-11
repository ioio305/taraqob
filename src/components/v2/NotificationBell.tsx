'use client'

// جرس الإشعارات — مشترك بين ترويسات السوقين. فحص دوري + وصول فوري عبر Supabase Realtime.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { showBrowserNotificationOnce } from '@/lib/v2/browserNotifications'

type Notification = {
  id: string; type: string; title: string; body: string | null
  url: string | null; is_read: boolean; created_at: string
}

function notificationTime(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh',
  }).format(parsed)
}

export function NotificationBell({ accent = '#C9943A' }: { accent?: string }) {
  const router = useRouter()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const seen = useRef<Set<string> | null>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/v2/notifications', { cache: 'no-store' })
      const data = await res.json()
      if (!Array.isArray(data.notifications)) return
      const incoming = data.notifications as Notification[]
      if (seen.current === null) {
        seen.current = new Set(incoming.map(item => item.id))
      } else {
        for (const item of incoming) {
          if (!seen.current.has(item.id)) {
            seen.current.add(item.id)
            if (!item.is_read) showBrowserNotificationOnce(item.title, item.body ?? '')
          }
        }
      }
      setNotifications(incoming)
    } catch { /* صامت */ }
  }, [])

  useEffect(() => {
    void fetchNotifications()
    const id = setInterval(fetchNotifications, 15_000)
    const refreshNow = () => { void fetchNotifications() }
    const refreshVisible = () => { if (document.visibilityState === 'visible') void fetchNotifications() }
    window.addEventListener('taraqob:notifications-changed', refreshNow)
    window.addEventListener('focus', refreshNow)
    document.addEventListener('visibilitychange', refreshVisible)
    return () => {
      clearInterval(id)
      window.removeEventListener('taraqob:notifications-changed', refreshNow)
      window.removeEventListener('focus', refreshNow)
      document.removeEventListener('visibilitychange', refreshVisible)
    }
  }, [fetchNotifications])

  // وصول فوري عند إضافة إشعار خادمي، مع بقاء الفحص الدوري كمسار احتياطي.
  useEffect(() => {
    const supabase = createClient()
    let active = true
    let channel: ReturnType<typeof supabase.channel> | null = null
    void supabase.auth.getUser().then(({ data }) => {
      if (!active || !data.user) return
      channel = supabase
        .channel(`notifications:${data.user.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${data.user.id}` },
          payload => {
            const item = payload.new as Notification
            if (!item?.id) return
            const s = seen.current ?? new Set<string>()
            seen.current = s
            if (!s.has(item.id)) { s.add(item.id); showBrowserNotificationOnce(item.title, item.body ?? '') }
            setNotifications(current => [item, ...current.filter(existing => existing.id !== item.id)].slice(0, 30))
          },
        )
        .subscribe()
    })
    return () => { active = false; if (channel) void supabase.removeChannel(channel) }
  }, [])

  useEffect(() => {
    function handler(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function markRead(id: string) {
    const current = notifications.find(n => n.id === id)
    if (!current || current.is_read) return
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, is_read: true } : n)))
    try {
      const response = await fetch('/api/v2/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
      if (!response.ok) void fetchNotifications()
    } catch { void fetchNotifications() }
  }

  async function markAllRead() {
    const previous = notifications
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    try {
      const response = await fetch('/api/v2/notifications', { method: 'PATCH' })
      if (!response.ok) setNotifications(previous)
    } catch { setNotifications(previous) }
  }

  async function openNotification(n: Notification) {
    await markRead(n.id)
    setOpen(false)
    if (n.url) router.push(n.url)
  }

  const unread = notifications.filter(n => !n.is_read).length

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(v => !v)} aria-label="الإشعارات" aria-expanded={open}
        className="relative flex h-8 w-8 items-center justify-center rounded-lg transition-all"
        style={{ background: open ? `${accent}1a` : 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#7C8A99' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -left-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full font-mono text-[9px] font-bold" style={{ background: '#EF4444', color: 'white' }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl"
          style={{ background: '#0D1B2A', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span className="text-sm font-semibold text-white">الإشعارات</span>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button type="button" onClick={() => void markAllRead()} className="text-[10px] transition-colors hover:text-white" style={{ color: accent }}>قرأت الكل</button>
              )}
              <span className="font-mono text-xs" style={{ color: '#7C8A99' }}>{notifications.length} إشعار</span>
            </div>
          </div>
          {notifications.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm" style={{ color: '#6B7B8D' }}>لا توجد إشعارات</div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {notifications.slice(0, 20).map(n => {
                const typeColor: Record<string, string> = { alert: '#EF4444', signal: '#10B981', info: '#60A5FA', system: '#C9943A' }
                const tc = typeColor[n.type] ?? '#7C8A99'
                return (
                  <button key={n.id} type="button" onClick={() => void openNotification(n)}
                    className="w-full px-4 py-3 text-right transition-colors hover:bg-white/[0.03]"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: n.is_read ? 'transparent' : `${accent}0a` }}>
                    <div className="flex items-start gap-2">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: n.is_read ? '#33404D' : tc }} />
                      <div className="min-w-0 flex-1">
                        <div className="mb-0.5 text-xs font-semibold text-white">{n.title}</div>
                        {n.body && <div className="whitespace-pre-line text-xs leading-relaxed" style={{ color: '#7C8A99' }}>{n.body}</div>}
                        {n.url && <span className="mt-1 inline-block text-xs" style={{ color: tc }}>فتح ←</span>}
                        <div className="mt-1 font-mono text-[10px]" style={{ color: '#55657A' }}>{notificationTime(n.created_at)} · الرياض</div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
