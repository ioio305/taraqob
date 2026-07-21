import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="min-h-screen grid place-items-center px-6" dir="rtl" style={{ background: '#060D14' }}>
      <section className="text-center">
        <div className="text-7xl font-black" style={{ color: '#C9943A' }}>404</div>
        <h1 className="mt-4 text-2xl font-bold text-white">هذه الصفحة غير موجودة</h1>
        <p className="mt-3 text-sm" style={{ color: '#9CA9B7' }}>قد يكون الرابط قديمًا أو كُتب بطريقة غير صحيحة.</p>
        <Link href="/" className="mt-7 inline-flex rounded-xl px-6 py-3 text-sm font-bold"
              style={{ background: '#C9943A', color: '#060D14' }}>
          العودة للبداية
        </Link>
      </section>
    </main>
  )
}
