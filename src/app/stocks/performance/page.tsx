import Link from 'next/link'

const standards = [
  'نسبة نجاح بعد احتساب فرق السعر والتكاليف',
  'متوسط الربح والخسارة وأقصى تراجع',
  'نتائج مستقلة لكل سهم وقطاع ونوع عقد',
  'حجم العينة ووقت إنشاء كل توصية',
]

export default function StocksPerformancePage() {
  return (
    <div className="min-h-full p-4 pb-12 max-w-4xl mx-auto" dir="rtl">
      <section className="rounded-3xl overflow-hidden" style={{ background: '#0D1B2A', border: '1px solid rgba(167,139,250,.25)' }}>
        <div className="p-6 md:p-9" style={{ background: 'radial-gradient(circle at 15% 0%, rgba(167,139,250,.14), transparent 42%)' }}>
          <div className="text-xs font-bold mb-3" style={{ color: '#A78BFA' }}>خاص بباقة ألفا</div>
          <h1 className="text-2xl md:text-3xl font-black text-white">سجل أداء توصيات الشركات</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7" style={{ color: '#94A3B8' }}>
            لن نعرض نسبة نجاح تسويقية قبل اكتمال المعايرة. هنا ستظهر النتائج الموثقة فقط، مع كل توصية ووقتها ونتيجتها دون حذف الخاسر.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-3 p-5 md:p-8 border-t border-white/5">
          {standards.map((item, index) => (
            <div key={item} className="rounded-2xl p-4 flex gap-3 bg-black/20 border border-white/5">
              <span className="font-mono text-sm" style={{ color: '#A78BFA' }}>0{index + 1}</span>
              <span className="text-sm text-slate-300">{item}</span>
            </div>
          ))}
        </div>

        <div className="mx-5 mb-5 md:mx-8 md:mb-8 rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap"
             style={{ background: 'rgba(245,158,11,.07)', border: '1px solid rgba(245,158,11,.2)' }}>
          <div>
            <div className="font-bold" style={{ color: '#F59E0B' }}>المعايرة جارية</div>
            <div className="text-xs mt-1 text-slate-400">تظهر النتائج فور بلوغ العينة المعتمدة.</div>
          </div>
          <Link href="/stocks" className="rounded-xl px-4 py-2 text-sm font-bold text-white bg-white/5 border border-white/10">
            العودة لتوصية اليوم
          </Link>
        </div>
      </section>
    </div>
  )
}
