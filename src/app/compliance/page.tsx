import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'الإفصاح القانوني',
}

export default function CompliancePage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC]" dir="rtl">

      {/* Nav */}
      <nav className="bg-white border-b border-surface-200">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-navy-900 flex items-center justify-center">
              <span className="text-gold-400 font-bold text-xs font-mono">ت</span>
            </div>
            <span className="text-navy-900 font-bold">ترقّب</span>
          </Link>
          <Link href="/login" className="btn-secondary btn-sm">تسجيل الدخول</Link>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="mb-10">
          <div className="text-xs font-semibold text-surface-400 uppercase tracking-widest mb-2">
            إفصاح قانوني
          </div>
          <h1 className="text-3xl font-bold text-navy-900 mb-3">
            إخلاء المسؤولية والإفصاح
          </h1>
          <p className="text-surface-500 text-sm">
            يرجى قراءة هذا الإفصاح بعناية قبل استخدام المنصة.
          </p>
        </div>

        <div className="flex flex-col gap-6">

          {/* Section 1 */}
          <div className="card p-6">
            <h2 className="text-base font-bold text-navy-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-amber-50 border border-amber-200
                text-amber-700 text-xs font-bold flex items-center justify-center">1</span>
              طبيعة الخدمة
            </h2>
            <p className="text-sm text-surface-600 leading-loose">
              ترقّب منصة تحليلات عامة ودعم قرار <strong className="text-navy-900">فقط</strong>.
              جميع المحتوى المقدم — بما في ذلك الإشارات والتحليلات والمؤشرات والتقارير —
              هو للأغراض المعلوماتية العامة حصرًا، ولا يُعدّ توصية استثمارية شخصية
              ملائمة لظروف أي فرد بعينه.
            </p>
          </div>

          {/* Section 2 */}
          <div className="card p-6">
            <h2 className="text-base font-bold text-navy-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-red-50 border border-red-200
                text-red-700 text-xs font-bold flex items-center justify-center">2</span>
              ما لا تقدمه المنصة
            </h2>
            <div className="flex flex-col gap-2">
              {[
                'لا تقدم ضمان ربح أو عائد محدد',
                'لا تدير أموال المستخدمين أو الحسابات',
                'لا تقدم نصيحة مالية شخصية ملزمة',
                'لا تضمن دقة أو اكتمال أي معلومة',
                'لا تتحمل مسؤولية أي قرار اتخذه المستخدم',
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5"
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  <span className="text-sm text-surface-600">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3 */}
          <div className="card p-6 border-amber-200 bg-amber-50/30">
            <h2 className="text-base font-bold text-navy-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-amber-100 border border-amber-300
                text-amber-700 text-xs font-bold flex items-center justify-center">3</span>
              مخاطر عقود الخيارات
            </h2>
            <p className="text-sm text-surface-600 leading-loose">
              عقود الخيارات <strong className="text-red-700">عالية المخاطر</strong> بطبيعتها.
              قد يخسر المستخدم <strong className="text-navy-900">كامل رأس المال</strong> المخصص للتداول.
              التداول في عقود الخيارات يتطلب فهمًا معمّقًا للمنتج والمخاطر المرتبطة به.
              المنصة لا تتحمل أي مسؤولية عن أي خسائر مالية تنتج عن استخدام أي تحليل أو إشارة.
            </p>
          </div>

          {/* Section 4 */}
          <div className="card p-6">
            <h2 className="text-base font-bold text-navy-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-surface-100 border border-surface-200
                text-surface-600 text-xs font-bold flex items-center justify-center">4</span>
              الأداء السابق
            </h2>
            <p className="text-sm text-surface-600 leading-loose">
              سجل الأداء المعروض على المنصة هو توثيق تاريخي لأغراض الشفافية فقط.
              <strong className="text-navy-900"> الأداء السابق لا يضمن ولا يشير إلى النتائج المستقبلية</strong>.
              أداء الإشارات في ظروف سوق معينة لا ينطبق بالضرورة على ظروف مستقبلية مختلفة.
            </p>
          </div>

          {/* Section 5 */}
          <div className="card p-6">
            <h2 className="text-base font-bold text-navy-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-teal-50 border border-teal-200
                text-teal-700 text-xs font-bold flex items-center justify-center">5</span>
              مسؤولية المستخدم
            </h2>
            <p className="text-sm text-surface-600 leading-loose">
              المستخدم مسؤول مسؤولية كاملة عن قراراته المالية. يُنصح بشدة
              بالتشاور مع مستشار مالي مرخص ومؤهل قبل اتخاذ أي قرار استثماري.
              استخدام المنصة يعني قبول هذا الإفصاح كاملًا.
            </p>
          </div>

          {/* Section 6 */}
          <div className="card p-6">
            <h2 className="text-base font-bold text-navy-900 mb-3 flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-navy-900 text-gold-400 text-xs font-bold flex items-center justify-center">6</span>
              هوية المنصة
            </h2>
            <p className="text-sm text-surface-600 leading-loose">
              ترقّب منصة مستقلة لا ترتبط بأي جهة حكومية أو مؤسسة أكاديمية أو شركة استثمار.
              المنصة في طور البيتا التجريبي وقد تتغير شروط الاستخدام.
            </p>
          </div>

        </div>

        {/* Footer note */}
        <div className="mt-10 pt-8 border-t border-surface-200 text-center">
          <p className="text-xs text-surface-400">
            آخر تحديث: 2024 — هذا الإفصاح جزء لا يتجزأ من شروط استخدام المنصة.
          </p>
          <Link href="/" className="inline-block mt-3 text-sm text-teal-600 hover:text-teal-700">
            ← العودة للصفحة الرئيسية
          </Link>
        </div>

      </main>
    </div>
  )
}
