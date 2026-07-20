'use client'

// ── صندوق النشرة: التقاط بريد المهتمين في الصفحة التسويقية ───────────────────
import { useState } from 'react'

export function NewsletterBox() {
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setBusy(true); setErr(null)
    try {
      const res = await fetch('/api/v2/leads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), source: 'newsletter' }),
      })
      const data = await res.json()
      if (data.ok) { setDone(true); setEmail('') }
      else setErr(data.error ?? 'تعذّر الحفظ')
    } catch {
      setErr('تعذّر الاتصال — جرّب لاحقاً')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="max-w-2xl mx-auto px-6 py-16 text-center" dir="rtl">
      <div className="rounded-2xl p-8"
        style={{ background: 'linear-gradient(135deg, rgba(201,148,58,0.06), rgba(13,27,42,0.6))', border: '1px solid rgba(201,148,58,0.25)' }}>
        <div className="text-2xl mb-2">📬</div>
        <h3 className="text-xl font-bold text-white mb-2">ملخّص السوق الأسبوعي — مجاناً</h3>
        <p className="text-sm mb-6 max-w-md mx-auto" style={{ color: '#8595A5' }}>
          نظرة موجزة كل أسبوع على أداء السوق، أبرز الفرص التي رصدها ترقّب، ومستجدّات المنصة.
          بلا إزعاج، وتلغيه بضغطة.
        </p>

        {done ? (
          <div className="inline-block text-sm font-bold px-5 py-3 rounded-xl"
            style={{ background: 'rgba(38,208,124,0.12)', border: '1px solid rgba(38,208,124,0.35)', color: '#34D399' }}>
            ✓ تم — سيصلك ملخّصنا القادم بإذن الله
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2 max-w-md mx-auto">
            <input value={email} onChange={e => setEmail(e.target.value)}
              type="email" dir="ltr" placeholder="you@example.com" required
              className="flex-1 rounded-xl px-4 py-3 text-sm text-white outline-none text-left"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
            <button type="submit" disabled={busy}
              className="text-sm font-bold px-6 py-3 rounded-xl disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
              {busy ? '...' : 'اشترك'}
            </button>
          </form>
        )}
        {err && <p className="text-xs mt-3" style={{ color: '#F87171' }}>{err}</p>}
      </div>
    </section>
  )
}
