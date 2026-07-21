'use client'

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ar" dir="rtl">
      <body style={{ margin: 0, background: '#060D14', color: '#fff', fontFamily: 'sans-serif' }}>
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
          <section style={{ maxWidth: 440, textAlign: 'center' }}>
            <div style={{ color: '#E8D5A3', fontSize: 36, fontWeight: 900 }}>ترقّب</div>
            <h1 style={{ marginTop: 24 }}>حدث عطل مؤقت</h1>
            <p style={{ color: '#9CA9B7', lineHeight: 1.9 }}>بياناتك محفوظة. أعد المحاولة بعد لحظات.</p>
            <button onClick={reset} style={{ marginTop: 16, border: 0, borderRadius: 12, padding: '12px 24px', background: '#C9943A', color: '#060D14', fontWeight: 800, cursor: 'pointer' }}>
              المحاولة مجددًا
            </button>
          </section>
        </main>
      </body>
    </html>
  )
}
