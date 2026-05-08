import Link from 'next/link'

export default function UpgradePage() {
  return (
    <div className="min-h-full flex items-center justify-center px-6 py-16" dir="rtl"
      style={{ fontFamily: '"IBM Plex Sans Arabic", sans-serif' }}>
      <div className="max-w-lg w-full text-center space-y-8">

        {/* Icon */}
        <div className="inline-flex w-20 h-20 rounded-2xl items-center justify-center text-3xl mx-auto"
          style={{ background: 'rgba(201,148,58,0.08)', border: '1px solid rgba(201,148,58,0.2)' }}>
          🔒
        </div>

        <div>
          <h1 className="text-2xl font-bold text-white mb-3">هذه الميزة تحتاج ترقية</h1>
          <p className="text-sm leading-relaxed" style={{ color: '#4A5568' }}>
            المستوى الحالي لحسابك لا يشمل هذه الأداة.
            ارقّ إلى <span style={{ color: '#60A5FA' }}>Signal</span> أو{' '}
            <span style={{ color: '#C9943A' }}>Edge</span> للوصول الكامل.
          </p>
        </div>

        {/* Tier comparison */}
        <div className="grid grid-cols-2 gap-3 text-right">
          {[
            {
              name: 'Signal', nameAr: 'محلل', price: '$29', color: '#60A5FA',
              features: ['كونسول العقود كاملاً', 'الشارت بكل الإطارات', 'الإشارات والأداء كاملاً'],
            },
            {
              name: 'Edge', nameAr: 'استراتيجي', price: '$89', color: '#C9943A', popular: true,
              features: ['كل ما في Signal', 'محرك الاستراتيجيات', 'إشعارات فورية + تقارير'],
            },
          ].map(plan => (
            <div key={plan.name} className="rounded-2xl p-4 flex flex-col gap-3"
              style={{
                background: plan.popular ? 'rgba(13,27,42,0.95)' : 'rgba(13,27,42,0.6)',
                border: `1px solid ${plan.color}40`,
                boxShadow: plan.popular ? `0 0 24px ${plan.color}12` : 'none',
              }}>
              {plan.popular && (
                <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-full self-start"
                  style={{ background: plan.color, color: '#060D14' }}>الأكثر اختياراً</span>
              )}
              <div>
                <div className="text-xs font-mono font-bold mb-0.5" style={{ color: plan.color }}>{plan.name}</div>
                <div className="text-sm font-bold text-white">{plan.nameAr}</div>
                <div className="text-xl font-black mt-1" style={{ color: plan.color }}>{plan.price}<span className="text-xs font-normal text-gray-500">/شهر</span></div>
              </div>
              <ul className="space-y-1.5 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-1.5 text-xs" style={{ color: '#94A3B8' }}>
                    <span style={{ color: '#10B981' }}>✓</span> {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/#plans"
            className="px-8 py-3 rounded-xl text-sm font-bold transition-all"
            style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
            عرض جميع الباقات ←
          </Link>
          <Link href="/v2"
            className="px-8 py-3 rounded-xl text-sm font-medium transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#94A3B8' }}>
            العودة للوحة المستخدم
          </Link>
        </div>

        <p className="text-xs font-mono" style={{ color: '#1A2A3A' }}>
          تواصل مع الدعم إذا كنت تعتقد أن وصولك لا يعمل بشكل صحيح
        </p>
      </div>
    </div>
  )
}
