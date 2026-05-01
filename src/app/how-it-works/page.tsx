'use client'

import Link from 'next/link'
import { useState } from 'react'

// ── ROLE TABS ──────────────────────────────────────────────────

type Role = 'beta_user' | 'analyst' | 'admin'

const ROLES: { id: Role; label: string; icon: string; desc: string }[] = [
  { id: 'beta_user', label: 'المستخدم العادي',  icon: '👤', desc: 'يتلقى الإشارات ويتابعها' },
  { id: 'analyst',   label: 'المحلل',            icon: '📊', desc: 'يدخل البيانات ويبني الإشارات' },
  { id: 'admin',     label: 'المدير / المؤسس',  icon: '⚙️', desc: 'يدير المنصة وينشر الإشارات' },
]

// ── STEP CARD ──────────────────────────────────────────────────

function StepCard({
  number, title, description, detail, warning, tip, icon
}: {
  number: string
  title: string
  description: string
  detail?: string
  warning?: string
  tip?: string
  icon?: string
}) {
  return (
    <div className="flex gap-4">
      {/* Number */}
      <div className="flex-shrink-0">
        <div className="w-10 h-10 rounded-xl bg-navy-900 text-gold-400 font-bold text-sm
          flex items-center justify-center font-mono">
          {number}
        </div>
        <div className="w-0.5 bg-surface-200 mx-auto mt-2 h-full min-h-[20px]" />
      </div>

      {/* Content */}
      <div className="pb-6 flex-1">
        <div className="flex items-center gap-2 mb-1.5">
          {icon && <span className="text-base">{icon}</span>}
          <h3 className="text-base font-bold text-navy-900">{title}</h3>
        </div>
        <p className="text-sm text-surface-600 leading-relaxed mb-2">{description}</p>
        {detail && (
          <p className="text-xs text-surface-500 leading-relaxed mb-2">{detail}</p>
        )}
        {tip && (
          <div className="bg-teal-50 border border-teal-200 rounded-xl px-3 py-2 text-xs text-teal-800 leading-relaxed">
            <span className="font-bold">💡 نصيحة: </span>{tip}
          </div>
        )}
        {warning && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-800 leading-relaxed">
            <span className="font-bold">⚠ مهم: </span>{warning}
          </div>
        )}
      </div>
    </div>
  )
}

// ── CONCEPT CARD ───────────────────────────────────────────────

function ConceptCard({ term, definition, example }: {
  term: string; definition: string; example?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-surface-200 p-4 shadow-card">
      <div className="text-sm font-bold text-navy-900 mb-1.5">{term}</div>
      <p className="text-xs text-surface-600 leading-relaxed">{definition}</p>
      {example && (
        <div className="mt-2 bg-surface-50 rounded-lg px-3 py-1.5 text-[11px] text-surface-500 border border-surface-200 font-mono">
          مثال: {example}
        </div>
      )}
    </div>
  )
}

// ── SIGNAL STATUS GUIDE ────────────────────────────────────────

const SIGNAL_STATUSES = [
  {
    status: 'مراقبة',
    color:  'text-blue-700 bg-blue-50 border-blue-200',
    dot:    'bg-blue-500',
    meaning: 'الإشارة تتشكل لكن شروط الدخول لم تكتمل. لا إجراء مطلوب — فقط انتظر.',
    action:  'راقب المستوى المذكور في الإشارة.',
  },
  {
    status: 'دخول مشروط',
    color:  'text-amber-700 bg-amber-50 border-amber-200',
    dot:    'bg-amber-500',
    meaning: 'الفكرة التحليلية صالحة لكن الدخول مشروط بتحقق مستوى أو سلوك معين.',
    action:  'لا تدخل حتى يتحقق شرط الدخول المذكور في الإشارة.',
  },
  {
    status: 'إشارة نشطة',
    color:  'text-emerald-700 bg-emerald-50 border-emerald-200',
    dot:    'bg-emerald-500',
    meaning: 'شرط الدخول تحقق. الإشارة مفعّلة حاليًا.',
    action:  'راجع نقطة الإبطال وخطة الخروج قبل أي إجراء.',
  },
  {
    status: 'خروج',
    color:  'text-purple-700 bg-purple-50 border-purple-200',
    dot:    'bg-purple-500',
    meaning: 'تحقق شرط الخروج أو الهدف. الإشارة في طور الإغلاق.',
    action:  'الإشارة اقتربت من الإغلاق — انتظر التحديث النهائي.',
  },
  {
    status: 'ملغاة',
    color:  'text-red-700 bg-red-50 border-red-200',
    dot:    'bg-red-500',
    meaning: 'تحقق شرط الإبطال وأُلغيت الإشارة. لا داعي لأي إجراء.',
    action:  'الإشارة أُلغيت. الانتظار لإشارة جديدة.',
  },
  {
    status: 'مغلقة',
    color:  'text-surface-600 bg-surface-100 border-surface-200',
    dot:    'bg-surface-500',
    meaning: 'الإشارة أُغلقت ووُثّقت نتيجتها النهائية.',
    action:  'راجع نتيجة الإشارة في صفحة التفاصيل.',
  },
]

// ── FAQ ────────────────────────────────────────────────────────

const FAQ = [
  {
    q: 'هل الإشارة توصية بالشراء أو البيع؟',
    a: 'لا. ترقّب منصة دعم قرار وتحليل فقط. الإشارات تُقدم تحليلًا مشروطًا وليست أوامر شراء أو بيع. أنت المسؤول الكامل عن قراراتك.',
  },
  {
    q: 'ماذا يعني "دخول مشروط"؟',
    a: 'يعني أن الفكرة التحليلية صالحة نظريًا، لكن الدخول يتطلب تحقق شرط معين — مثل إغلاق SPX فوق مستوى محدد. إذا لم يتحقق الشرط، الإشارة لا تُفعّل.',
  },
  {
    q: 'ما الفرق بين نقطة الإبطال وخطة الخروج؟',
    a: 'نقطة الإبطال: مستوى يُلغي الإشارة كليًا إذا كُسر — يعني أن الفكرة التحليلية خاطئة. خطة الخروج: الطريقة المخططة للخروج بربح أو بدون خسارة كبيرة.',
  },
  {
    q: 'هل درجة الثقة تعني احتمال الربح؟',
    a: 'لا. درجة الثقة تعكس مدى اكتمال الشروط المنهجية وتوافق المؤشرات — وليست احتمالًا إحصائيًا للربح. 80% ثقة لا تعني 80% احتمال ربح.',
  },
  {
    q: 'لماذا قد لا تُصدر إشارة رغم وجود جلسة؟',
    a: 'المنصة تلتزم بـ 10 قواعد منع صارمة. إذا كان هناك حدث اقتصادي عالي الخطر، أو سيولة ضعيفة للعقد، أو تعارض بين المؤشرات — لن تُصدر إشارة. هذا جزء من منهجية الانضباط.',
  },
  {
    q: 'كيف أعرف أن الأداء حقيقي وغير مُعدَّل؟',
    a: 'كل إشارة تُنشر تُحفظ فورًا مع Timestamp وبيانات المؤشرات وقت النشر. لا يمكن تعديل الإشارة المنشورة — أي تغيير يُسجَّل كـ Update مستقل. Audit Trail يوثق كل إجراء.',
  },
  {
    q: 'من يمكنه الانضمام للمنصة؟',
    a: 'النسخة Beta مغلقة. الدخول بالدعوة فقط من المدير. لا يوجد تسجيل عام.',
  },
]

// ── MAIN PAGE ──────────────────────────────────────────────────

export default function HowItWorksPage() {
  const [activeRole, setActiveRole] = useState<Role>('beta_user')
  const [openFAQ, setOpenFAQ] = useState<number | null>(null)

  return (
    <div className="min-h-screen bg-[#F8FAFC]" dir="rtl">

      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-surface-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-navy-900 flex items-center justify-center">
              <span className="text-gold-400 font-bold text-xs font-mono">ت</span>
            </div>
            <span className="text-navy-900 font-bold text-sm">ترقّب</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-xs text-surface-500 hover:text-navy-900 hidden sm:block">
              الرئيسية
            </Link>
            <Link href="/login" className="btn-primary btn-sm">دخول المنصة</Link>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">

        {/* Hero */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-navy-900/5 border border-navy-900/10
            rounded-full px-4 py-1.5 mb-4 text-xs font-medium text-navy-700">
            دليل استخدام المنصة
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-navy-900 mb-3">
            كيف تستخدم ترقّب
          </h1>
          <p className="text-surface-500 text-base max-w-xl mx-auto leading-relaxed">
            دليل شامل لفهم المنصة والحصول على أفضل النتائج —
            من قراءة الإشارة إلى فهم سجل الأداء
          </p>
        </div>

        {/* ── SECTION 1: Overview ─────────────────────────── */}
        <section className="mb-14">
          <h2 className="text-xl font-bold text-navy-900 mb-2">ما هي ترقّب بالضبط؟</h2>
          <div className="w-12 h-1 bg-gold-400 rounded-full mb-5" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[
              {
                icon: '📡',
                title: 'ترصد',
                desc: 'تجمع بيانات السوق يوميًا: SPX، VIX، VWAP، الأحداث الاقتصادية، وبيانات العقود.',
              },
              {
                icon: '🔬',
                title: 'تحلل',
                desc: 'تشغّل سبعة مؤشرات مستقلة ومحرك قرار يُقيّم البيئة قبل إصدار أي إشارة.',
              },
              {
                icon: '📋',
                title: 'توثّق',
                desc: 'كل إشارة تُنشر مع كامل بياناتها وتُحفظ بشكل لا يُعدَّل ويُقاس أداؤه.',
              },
            ].map(item => (
              <div key={item.title} className="card p-5">
                <div className="text-2xl mb-3">{item.icon}</div>
                <div className="text-base font-bold text-navy-900 mb-2">{item.title}</div>
                <p className="text-sm text-surface-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* What it is NOT */}
          <div className="bg-navy-900 rounded-2xl p-5">
            <div className="text-xs font-semibold text-gold-400 uppercase tracking-widest mb-3">
              ترقّب ليست
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                '❌ قناة توصيات',
                '❌ بوت تداول آلي',
                '❌ ضمان ربح',
                '❌ إدارة أموال',
                '❌ توصية شخصية',
                '❌ نظام يعمل بلا محلل',
              ].map(item => (
                <div key={item} className="bg-white/5 rounded-lg px-3 py-2 text-xs text-surface-300">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── SECTION 2: Role Guide ───────────────────────── */}
        <section className="mb-14">
          <h2 className="text-xl font-bold text-navy-900 mb-2">دليل الاستخدام حسب دورك</h2>
          <div className="w-12 h-1 bg-gold-400 rounded-full mb-5" />

          {/* Role Selector */}
          <div className="flex gap-2 flex-wrap mb-6">
            {ROLES.map(role => (
              <button
                key={role.id}
                onClick={() => setActiveRole(role.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium
                  transition-all duration-150
                  ${activeRole === role.id
                    ? 'bg-navy-900 text-white border-navy-900'
                    : 'bg-white text-surface-600 border-surface-200 hover:border-surface-300'}`}
              >
                <span>{role.icon}</span>
                <span>{role.label}</span>
              </button>
            ))}
          </div>

          {/* Beta User Guide */}
          {activeRole === 'beta_user' && (
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-6">
                <span className="text-xl">👤</span>
                <div>
                  <div className="text-base font-bold text-navy-900">دليل المستخدم العادي</div>
                  <div className="text-xs text-surface-400">يتلقى الإشارات ويتابعها</div>
                </div>
              </div>

              <StepCard
                number="01"
                title="سجّل الدخول واذهب للوحة التحكم"
                description="بعد الدخول ستجد لوحة مبسطة تُجيب على سؤال واحد: هل توجد إشارة الآن؟"
                tip="اللوحة مصممة لتُقرأ في 10 ثوانٍ — لا تحتاج لأي خبرة تقنية."
              />
              <StepCard
                number="02"
                title="افهم حالة الإشارة"
                description='كل إشارة لها حالة واضحة: "دخول مشروط" أو "إشارة نشطة" أو "مراقبة". اقرأ الحالة أولًا قبل أي شيء آخر.'
                tip="اقرأ قسم دليل الحالات أدناه لفهم معنى كل حالة."
              />
              <StepCard
                number="03"
                title="اقرأ شرط الدخول بدقة"
                description="شرط الدخول يُحدد متى يمكن تفعيل الإشارة. إذا كانت الإشارة 'مشروطة' لا تتصرف حتى يتحقق الشرط."
                warning="الدخول قبل تحقق الشرط يُعدّ خطأ منهجيًا ولا تتحمل المنصة مسؤوليته."
              />
              <StepCard
                number="04"
                title="راجع نقطة الإبطال"
                description="هذه أهم معلومة في الإشارة. إذا كسر السوق هذا المستوى، الإشارة أُلغيت والفكرة خاطئة."
                tip="احفظ مستوى الإبطال قبل أي إجراء — هو خط دفاعك الأول."
              />
              <StepCard
                number="05"
                title="تابع التحديثات"
                description="المحلل يضيف تحديثات على الإشارة عند تغيّر الأوضاع. كل تحديث يُوضح ما تغيّر ولماذا."
                tip="فعّل إشعارات البريد الإلكتروني في إعدادات التنبيهات."
              />
              <StepCard
                number="06"
                title="راجع سجل الأداء"
                description="كل إشارة سابقة موثقة بنتيجتها الحقيقية. السجل لا يُعدَّل ويُعرض كما هو."
                warning="الأداء السابق لا يضمن النتائج المستقبلية. كل إشارة مستقلة."
              />
            </div>
          )}

          {/* Analyst Guide */}
          {activeRole === 'analyst' && (
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-6">
                <span className="text-xl">📊</span>
                <div>
                  <div className="text-base font-bold text-navy-900">دليل المحلل</div>
                  <div className="text-xs text-surface-400">يبني الإشارات ويدخل البيانات</div>
                </div>
              </div>

              <StepCard
                number="01"
                title="أنشئ جلسة سوق جديدة"
                description="في بداية كل يوم تداول، أنشئ جلسة جديدة وأدخل: SPX Open/High/Low/Close، إغلاق أمس، VIX، VWAP، نطاق الافتتاح، والحركة المتوقعة."
                tip="بعد إدخال SPX الافتتاح والإغلاق السابق، سيحسب النظام التغيير تلقائيًا."
              />
              <StepCard
                number="02"
                title="شغّل محرك المؤشرات السبعة"
                description="أدخل درجة لكل مؤشر من 0 إلى 100 مع الحالة والمدخلات. النظام يحسب الدرجة المركبة ويُظهر القرار فورًا في اللوحة الجانبية."
                detail="المؤشرات: حالة السوق، ضغط التذبذب، الحركة المتوقعة، الزخم اللحظي، جودة السيولة، تآكل الوقت، الأحداث الكلية."
                tip="استخدم زر 'توليد AI' لكل مؤشر للحصول على تفسير تلقائي يساعدك في صياغة ملاحظاتك."
              />
              <StepCard
                number="03"
                title="أضف العقود للقائمة"
                description="أدخل تفاصيل العقود المرشحة (Strike، DTE، Bid/Ask، Greeks). النظام يحسب درجة السيولة تلقائيًا ويُحذرك من العقود الضعيفة."
                warning="العقود بتصنيف 'تجنب' لا يمكن اختيارها للإشارة. 0DTE محظور كليًا في البيتا."
              />
              <StepCard
                number="04"
                title="افتح Signal Composer وابنِ الإشارة"
                description="اختر الجلسة والاستراتيجية والعقد. أدخل شرط الدخول ونقطة الإبطال وخطة الخروج. اضغط 'توليد AI' لبناء سبب الإشارة تلقائيًا."
                detail="محرك القرار يعمل فورًا ويُظهر لك الدرجة المركبة وأي قواعد حظر مفعّلة."
                warning="لا يمكن إرسال الإشارة للمراجعة بدون: شرط دخول، نقطة إبطال، خطة خروج، مستوى مخاطرة."
              />
              <StepCard
                number="05"
                title="أرسل للمراجعة"
                description="بعد اكتمال الإشارة، اضغط 'إرسال للمدير'. الإشارة تنتقل لحالة 'قيد المراجعة' ويتلقى المدير إشعارًا."
                tip="المدير هو من ينشر الإشارة — أنت لا تملك صلاحية النشر المباشر."
              />
            </div>
          )}

          {/* Admin Guide */}
          {activeRole === 'admin' && (
            <div className="card p-6">
              <div className="flex items-center gap-2 mb-6">
                <span className="text-xl">⚙️</span>
                <div>
                  <div className="text-base font-bold text-navy-900">دليل المدير / المؤسس</div>
                  <div className="text-xs text-surface-400">يدير المنصة وينشر الإشارات</div>
                </div>
              </div>

              <StepCard
                number="01"
                title="أدعُ المستخدمين"
                description="من قسم 'إدارة المستخدمين'، أدخل البريد الإلكتروني واختر الدور (محلل أو Beta User). ستُرسل دعوة صالحة 7 أيام."
                tip="لا يوجد تسجيل عام — الدخول بالدعوة فقط. هذا عمدًا لضمان جودة المستخدمين."
              />
              <StepCard
                number="02"
                title="راجع الإشارات المعلقة"
                description="في لوحة التحكم ستجد عدد الإشارات بانتظار المراجعة. افتح صفحة المراجعة وتحقق من: المؤشرات، العقد، قواعد المنع، وسبب الإشارة."
                warning="لا تنشر إشارة إذا كان هناك موانع إلزامية في محرك القرار — حتى لو كانت الفكرة جيدة."
              />
              <StepCard
                number="03"
                title="انشر أو أعِد للمحلل"
                description="إذا كانت الإشارة مكتملة ومنهجية، اضغط 'نشر'. إذا كان هناك نقص، أعِدها للمحلل مع سبب."
                detail="عند النشر يُجمَّد snapshot كامل: بيانات الجلسة، درجات المؤشرات، بيانات العقد. هذا الـ snapshot لا يُعدَّل أبدًا."
              />
              <StepCard
                number="04"
                title="أضف تحديثات خلال الجلسة"
                description="عند تغيّر الأوضاع، أضف تحديثًا من صفحة الإشارة. اختر نوع التحديث (تفعيل، إبطال، خروج...) وأكتب المحتوى."
                warning="كل تحديث محفوظ إلى الأبد ولا يُحذف. فكّر جيدًا قبل الكتابة."
                tip="عند إغلاق الإشارة، أكمل حقل 'نتيجة الإشارة' لتسجيل الربح أو الخسارة في سجل الأداء."
              />
              <StepCard
                number="05"
                title="راجع Audit Trail دوريًا"
                description="سجل المراجعة يُظهر كل إجراء تم على المنصة مع التوقيت والمنفذ. مرجع مهم لضمان الانضباط المنهجي."
              />
            </div>
          )}
        </section>

        {/* ── SECTION 3: Signal Status Guide ─────────────── */}
        <section className="mb-14">
          <h2 className="text-xl font-bold text-navy-900 mb-2">دليل حالات الإشارة</h2>
          <div className="w-12 h-1 bg-gold-400 rounded-full mb-5" />

          <div className="flex flex-col gap-3">
            {SIGNAL_STATUSES.map(item => (
              <div key={item.status} className="card p-4">
                <div className="flex items-start gap-4">
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold
                    flex-shrink-0 ${item.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${item.dot}`} />
                    {item.status}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-navy-900 font-medium mb-1">{item.meaning}</p>
                    <div className="text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-2.5 py-1.5">
                      <span className="font-bold">ماذا تفعل: </span>{item.action}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── SECTION 4: Key Concepts ─────────────────────── */}
        <section className="mb-14">
          <h2 className="text-xl font-bold text-navy-900 mb-2">المفاهيم الأساسية</h2>
          <div className="w-12 h-1 bg-gold-400 rounded-full mb-5" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ConceptCard
              term="شرط الدخول"
              definition="الحدث أو المستوى الذي يجب تحققه قبل أن تُفعَّل الإشارة. الإشارة المشروطة غير مفعّلة حتى يتحقق هذا الشرط."
              example="الدخول عند إغلاق SPX فوق 5,200 بشمعة 5 دقائق"
            />
            <ConceptCard
              term="نقطة الإبطال"
              definition="المستوى الذي إذا كُسر يُلغي الإشارة كليًا — يعني الفكرة التحليلية أصبحت خاطئة وليس مجرد توقف مؤقت."
              example="الإشارة تُلغى إذا أغلق SPX تحت 5,170"
            />
            <ConceptCard
              term="درجة الثقة"
              definition="رقم من 0 إلى 100 يعكس مدى اكتمال الشروط المنهجية وتوافق المؤشرات — ليست احتمال ربح."
              example="درجة 78 = 78% اكتمالًا منهجيًا، لا 78% احتمال ربح"
            />
            <ConceptCard
              term="الدرجة المركبة"
              definition="مجموع أوزان المؤشرات السبعة المُدخلة. تحدد قرار محرك القرار: No Trade / Watch / Conditional / Active."
              example="Composite 67 → Conditional Entry"
            />
            <ConceptCard
              term="Audit Trail"
              definition="سجل لا يُحذف يُوثّق كل إجراء على المنصة: النشر، التحديثات، الإغلاق — مع التوقيت والمنفذ."
            />
            <ConceptCard
              term="Snapshot عند النشر"
              definition="لقطة مجمّدة من بيانات الجلسة والمؤشرات والعقد تُحفظ لحظة النشر ولا تتغير حتى لو تغيّرت البيانات لاحقًا."
            />
            <ConceptCard
              term="قواعد المنع"
              definition="10 قواعد صارمة تمنع إصدار الإشارة إذا تحققت. مثل: حدث كلي بخطر عالٍ، سيولة ضعيفة، أو غياب نقطة إبطال."
            />
            <ConceptCard
              term="درع الأحداث الكلية"
              definition="مؤشر يرصد الأحداث الاقتصادية (FOMC، CPI، تقارير الوظائف). إذا كان 'حظر تام' لا يمكن نشر أي إشارة."
              example="يوم FOMC = Block Trade في أغلب الحالات"
            />
          </div>
        </section>

        {/* ── SECTION 5: Tips ─────────────────────────────── */}
        <section className="mb-14">
          <h2 className="text-xl font-bold text-navy-900 mb-2">للحصول على أفضل النتائج</h2>
          <div className="w-12 h-1 bg-gold-400 rounded-full mb-5" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                icon: '🔔',
                title: 'فعّل الإشعارات',
                desc: 'فعّل إشعارات البريد لـ "نشر إشارة جديدة" و"تحديث الإشارة" — هذان الحدثان الأهم.',
              },
              {
                icon: '📖',
                title: 'اقرأ الإشارة كاملة',
                desc: 'لا تركّز على درجة الثقة وحدها. اقرأ شرط الدخول، الإبطال، والخطة — هي الأهم.',
              },
              {
                icon: '⏰',
                title: 'تابع التوقيت',
                desc: 'إشارة "دخول مشروط" منشورة منذ ساعات قد تكون فقدت سياقها. راجع تاريخ النشر دائمًا.',
              },
              {
                icon: '📊',
                title: 'راجع سجل الأداء',
                desc: 'قبل البناء على أي إشارة، راجع سجل الأداء العام للمنصة لفهم التاريخ التحليلي.',
              },
              {
                icon: '🧠',
                title: 'فهم قبل القرار',
                desc: 'إذا لم تفهم شرط الدخول أو نقطة الإبطال — لا تتخذ أي إجراء حتى يتضح لك الأمر.',
              },
              {
                icon: '⚖️',
                title: 'استشر متخصصًا',
                desc: 'ترقّب أداة تحليلية — ليست بديلًا عن مستشار مالي مرخص يعرف ظروفك الشخصية.',
              },
            ].map(item => (
              <div key={item.title} className="card p-4 flex gap-3">
                <div className="text-xl flex-shrink-0">{item.icon}</div>
                <div>
                  <div className="text-sm font-bold text-navy-900 mb-1">{item.title}</div>
                  <p className="text-xs text-surface-500 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── SECTION 6: FAQ ───────────────────────────────── */}
        <section className="mb-14">
          <h2 className="text-xl font-bold text-navy-900 mb-2">أسئلة شائعة</h2>
          <div className="w-12 h-1 bg-gold-400 rounded-full mb-5" />

          <div className="flex flex-col gap-2">
            {FAQ.map((item, i) => (
              <div key={i} className="card overflow-hidden">
                <button
                  onClick={() => setOpenFAQ(openFAQ === i ? null : i)}
                  className="w-full flex items-center justify-between p-4 text-right hover:bg-surface-50
                    transition-colors"
                >
                  <span className="text-sm font-semibold text-navy-900 flex-1 text-right">
                    {item.q}
                  </span>
                  <span className={`text-surface-400 transition-transform duration-200 flex-shrink-0 mr-3 ${
                    openFAQ === i ? 'rotate-180' : ''
                  }`}>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </span>
                </button>
                {openFAQ === i && (
                  <div className="px-4 pb-4 border-t border-surface-100">
                    <p className="text-sm text-surface-600 leading-relaxed pt-3">{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="bg-navy-900 rounded-2xl p-8 text-center">
          <div className="text-2xl font-bold text-white mb-2">جاهز للبدء؟</div>
          <p className="text-surface-400 text-sm mb-6">
            ادخل المنصة وابدأ بمتابعة أول إشارة موثقة
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/login" className="btn-gold btn-lg">دخول المنصة</Link>
            <Link href="/compliance" className="text-surface-400 hover:text-white text-sm transition-colors">
              الإفصاح القانوني ←
            </Link>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="bg-navy-900 border-t border-navy-800 py-8 mt-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-navy-800 border border-navy-700 flex items-center justify-center">
                <span className="text-gold-400 font-bold text-xs font-mono">ت</span>
              </div>
              <div>
                <div className="text-white font-bold text-sm">ترقّب — Taraqob</div>
                <div className="text-surface-500 text-[10px]">منصة دعم قرار لعقود SPX Options</div>
              </div>
            </div>
            <div className="text-center">
              <div className="text-surface-400 text-xs">
                © {new Date().getFullYear()} جميع الحقوق محفوظة
              </div>
              <div className="text-surface-500 text-[11px] mt-0.5">
                نايف الشهراني · 0568122221
              </div>
            </div>
            <div className="flex items-center gap-4 text-xs text-surface-500">
              <Link href="/" className="hover:text-white transition-colors">الرئيسية</Link>
              <Link href="/compliance" className="hover:text-white transition-colors">الإفصاح</Link>
              <Link href="/login" className="hover:text-white transition-colors">الدخول</Link>
            </div>
          </div>
        </div>
      </footer>

    </div>
  )
}
