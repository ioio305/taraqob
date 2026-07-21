'use client'

import { useEffect } from 'react'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Page error:', error.digest ?? error.message)
  }, [error])

  return (
    <main className="min-h-screen grid place-items-center px-6" dir="rtl"
          style={{ background: 'radial-gradient(circle at 50% 20%, #102C35 0%, #060D14 55%)' }}>
      <section className="w-full max-w-md rounded-3xl p-8 text-center"
               style={{ background: 'rgba(13,27,42,.92)', border: '1px solid rgba(201,148,58,.22)', boxShadow: '0 28px 80px rgba(0,0,0,.45)' }}>
        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl text-2xl font-black"
             style={{ color: '#E8D5A3', background: 'rgba(201,148,58,.12)', border: '1px solid rgba(201,148,58,.24)' }}>
          ت
        </div>
        <h1 className="text-2xl font-bold text-white">تعذّر تحميل الصفحة</h1>
        <p className="mt-3 text-sm leading-7" style={{ color: '#9CA9B7' }}>
          لم يتأثر حسابك أو بياناتك. جرّب مرة أخرى، وإن استمرت المشكلة عد إلى الصفحة الرئيسية.
        </p>
        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <button onClick={reset} className="rounded-xl px-5 py-3 text-sm font-bold transition hover:-translate-y-0.5"
                  style={{ background: '#C9943A', color: '#060D14' }}>
            المحاولة مجددًا
          </button>
          <a href="/v2" className="rounded-xl px-5 py-3 text-sm font-bold transition hover:-translate-y-0.5"
             style={{ color: '#E8D5A3', border: '1px solid rgba(201,148,58,.28)' }}>
            الصفحة الرئيسية
          </a>
        </div>
      </section>
    </main>
  )
}
