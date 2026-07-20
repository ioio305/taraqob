'use client'

// ── صفحة إلغاء الاشتراك — تأكيد بضغطة (نتجنّب الإلغاء عند مسح البريد للروابط) ─
import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

function UnsubContent() {
  const id = useSearchParams().get('id') ?? ''
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle')

  async function confirm() {
    setState('busy')
    try {
      const res = await fetch('/api/v2/unsubscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      setState(data.ok ? 'done' : 'error')
    } catch { setState('error') }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" dir="rtl"
      style={{ background: '#060D14', fontFamily: '"IBM Plex Sans Arabic", sans-serif' }}>
      <div className="w-full max-w-sm text-center rounded-2xl p-8"
        style={{ background: 'rgba(13,27,42,0.9)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="text-4xl mb-4">📭</div>

        {state === 'done' ? (
          <>
            <h1 className="text-xl font-bold text-white mb-2">تم إلغاء اشتراكك</h1>
            <p className="text-sm mb-6" style={{ color: '#8595A5' }}>لن تصلك نشرتنا بعد الآن. نأسف لرحيلك ونرحّب بعودتك دائماً.</p>
            <Link href="/" className="text-xs font-bold" style={{ color: '#C9943A' }}>العودة إلى ترقّب ←</Link>
          </>
        ) : state === 'error' ? (
          <>
            <h1 className="text-xl font-bold text-white mb-2">تعذّر التنفيذ</h1>
            <p className="text-sm mb-6" style={{ color: '#8595A5' }}>الرابط قد يكون منتهياً أو غير صحيح.</p>
            <Link href="/" className="text-xs font-bold" style={{ color: '#C9943A' }}>العودة إلى ترقّب ←</Link>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-white mb-2">إلغاء الاشتراك من النشرة؟</h1>
            <p className="text-sm mb-6" style={{ color: '#8595A5' }}>لن تصلك رسائل ترقّب الأسبوعية بعد التأكيد.</p>
            <button onClick={confirm} disabled={state === 'busy' || !id}
              className="w-full py-3 rounded-xl text-sm font-bold disabled:opacity-50"
              style={{ background: 'rgba(240,67,90,0.12)', border: '1px solid rgba(240,67,90,0.4)', color: '#F0435A' }}>
              {state === 'busy' ? '...' : 'أكّد إلغاء الاشتراك'}
            </button>
            <Link href="/" className="block mt-4 text-xs" style={{ color: '#5E6E7F' }}>تراجعت — أبقني مشتركاً</Link>
          </>
        )}
      </div>
    </div>
  )
}

export default function UnsubscribePage() {
  return <Suspense fallback={null}><UnsubContent /></Suspense>
}
