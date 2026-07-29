import Link from 'next/link'

export default function StocksPerformancePage() {
  return (
    <div className="min-h-full p-4 pb-12 max-w-4xl mx-auto" dir="rtl">
      <section className="rounded-3xl overflow-hidden" style={{ background: '#0D1B2A', border: '1px solid rgba(167,139,250,.25)' }}>
        <div className="p-6 md:p-9" style={{ background: 'radial-gradient(circle at 15% 0%, rgba(167,139,250,.14), transparent 42%)' }}>
          <div className="text-xs font-bold mb-3" style={{ color: '#A78BFA' }}>خاص بباقة ألفا</div>
          <h1 className="text-2xl md:text-3xl font-black text-white">سجل الأداء</h1>
        </div>

        <div className="m-5 md:m-8 rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap"
             style={{ background: 'rgba(245,158,11,.07)', border: '1px solid rgba(245,158,11,.2)' }}>
          <div>
            <div className="font-bold" style={{ color: '#F59E0B' }}>المعايرة جارية</div>
          </div>
          <Link href="/stocks" className="rounded-xl px-4 py-2 text-sm font-bold text-white bg-white/5 border border-white/10">
            العودة لتوصية اليوم
          </Link>
        </div>
      </section>
    </div>
  )
}
