'use client'

// ── دليل المبتدئ: قاموس مبسط + جولة تعريفية أول دخول ────────────────────────
// الهدف: أي مصطلح في المنصة له شرح من سطرين بلغة إنسان، لا لغة خبراء.

import { useState, useEffect } from 'react'

const GLOSSARY: { term: string; icon: string; simple: string }[] = [
  { term: 'العقد (كول / بوت)', icon: '📄', simple: 'كول = تربح إذا صعد السوق. بوت = تربح إذا نزل. تشتري العقد بسعر صغير وتبيعه أغلى (أو أرخص فتخسر).' },
  { term: 'الستريك', icon: '🎯', simple: 'الرقم الذي تراهن أن السوق سيصله. كلما كان أبعد عن السعر الحالي كان العقد أرخص — وأصعب ربحاً.' },
  { term: 'الدلتا (سرعة العقد)', icon: '⚡', simple: 'كم يتحرك سعر عقدك حين يتحرك السوق نقطة واحدة. دلتا 0.30 يعني عقدك يكسب 30 سنتاً لكل نقطة. الأفضل بين 0.25 و 0.45 — الأبطأ من ذلك يانصيب.' },
  { term: 'فرق الشراء/البيع', icon: '💸', simple: 'الفرق بين سعر من يبيعك ومن يشتري منك. هذا الفرق تدفعه أنت من جيبك في كل صفقة — فوق 8% يأكل ربحك.' },
  { term: 'الحركة المتوقعة', icon: '📏', simple: 'كم نقطة يتوقع السوق أن يتحرك اليوم (صعوداً أو نزولاً). هدف خارج هذا النطاق = حلم بعيد.' },
  { term: 'الوقف (ستوب)', icon: '🛑', simple: 'السعر الذي تخرج عنده وتقبل الخسارة الصغيرة قبل أن تكبر. من يتداول بلا وقف يتبرع بحسابه للسوق.' },
  { term: 'الجاما ونقطة الانقلاب', icon: '🧲', simple: 'خريطة أموال صنّاع السوق. فوق نقطة الانقلاب: السوق هادئ ويرتد من الجدران. تحتها: السوق عنيف ومتسارع — شدّد وقفك.' },
  { term: 'VWAP (متوسط السعر العادل)', icon: '⚖️', simple: 'متوسط سعر اليوم مرجحاً بحجم التداول. فوقه = المشترون مسيطرون. تحته = الباعة مسيطرون.' },
  { term: 'مؤشر الخوف VIX', icon: '😨', simple: 'مقياس توتر السوق. تحت 17 هادئ، 17-24 طبيعي، فوق 28 خطر — ترقب يوقف التوصيات تلقائياً.' },
  { term: 'التصنيف A+ / A / B / C', icon: '🏅', simple: 'كم دليل مستقل يتفق على الفرصة (من 7). A+ يعني 6-7 أدلة متفقة — نادرة لكنها الأقوى. B و C للمراقبة لا للدخول.' },
  { term: 'R (وحدة المخاطرة)', icon: '🎲', simple: 'مقياس الربح مقارنة بما خاطرت به. ربحت +2R يعني ربحت ضعف ما كنت مستعداً لخسارته. أنجح المتداولين يفكرون بـ R لا بالدولارات.' },
  { term: 'حارس الانهيارات', icon: '🛡️', simple: 'حماية تلقائية: في الأيام العنيفة جداً (مثل انهيار كورونا) يمنع ترقب أي توصية دخول — لأن التاريخ أثبت أنها أيام خاسرة.' },
]

const TOUR_STEPS: { icon: string; title: string; body: string }[] = [
  { icon: '👋', title: 'أهلاً بك في ترقب', body: 'منصة قرار لعقود SPX: تقول لك متى تدخل، وكم تشتري، ومتى تخرج — بأسعار حقيقية من البورصة وبأرقام مثبتة على 8 سنوات من الاختبار.' },
  { icon: '📊', title: 'الداشبورد', body: 'يعرض اتجاه السوق الآن وأفضل 3 عقود مرشحة مع تصنيف قوة (A+ الأقوى). إن رأيت «راقب» فلا تدخل — ربع قوة ترقب في منعك من الصفقات الخاسرة.' },
  { icon: '🔬', title: 'تحليل العقد', body: 'أدخل رقم أي ستريك وسيقيّمه بـ 7 محركات من 100 نقطة، ويحسب لك عدد العقود المناسب لحسابك ووقف الخسارة والأهداف.' },
  { icon: '🚪', title: 'مساعد الخروج', body: 'أنت داخل صفقة؟ سجّلها هنا وسيراقبها ترقب تلقائياً ويناديك بإشعار حين يحين وقت الخروج أو جني الربح — ضد الطمع وضد التردد.' },
  { icon: '🛡️', title: 'قواعد تحميك', body: 'خسرت صفقتين اليوم؟ ترقب يقفل يومك. يوم عنيف؟ حارس الانهيارات يمنع الدخول. هذه القواعد هي الفرق بين متداول يبقى ومتداول يحترق.' },
  { icon: '🎮', title: 'ابدأ بالمحفظة التجريبية', body: 'جرّب التوصيات بمال وهمي (10,000$ افتراضية) قبل أن تخاطر بريال واحد. حين تقتنع بالنتائج بنفسك — ابدأ بمبالغ صغيرة.' },
]

export function BeginnerHelpers() {
  const [glossaryOpen, setGlossaryOpen] = useState(false)
  const [tourStep, setTourStep] = useState<number | null>(null)

  useEffect(() => {
    try {
      if (!localStorage.getItem('taraqob_tour_done')) setTourStep(0)
    } catch { /* تجاهل */ }
  }, [])

  function closeTour() {
    setTourStep(null)
    try { localStorage.setItem('taraqob_tour_done', '1') } catch { /* تجاهل */ }
  }

  return (
    <>
      {/* زر القاموس العائم */}
      <button onClick={() => setGlossaryOpen(true)}
        className="fixed bottom-4 right-4 z-40 w-10 h-10 rounded-full text-lg shadow-lg"
        style={{ background: 'rgba(13,27,42,0.9)', border: '1px solid rgba(201,148,58,0.4)', backdropFilter: 'blur(8px)' }}
        title="قاموس المصطلحات ببساطة">
        ❓
      </button>

      {/* القاموس */}
      {glossaryOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setGlossaryOpen(false)} dir="rtl">
          <div className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl p-5"
            style={{ background: '#0D1B2A', border: '1px solid rgba(201,148,58,0.3)' }}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-[#E8D5A3]">المصطلحات ببساطة — بلا تعقيد</h2>
              <button onClick={() => setGlossaryOpen(false)} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>
            <div className="space-y-3">
              {GLOSSARY.map(g => (
                <div key={g.term} className="rounded-xl p-3"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="text-sm font-bold text-white mb-1">{g.icon} {g.term}</div>
                  <p className="text-sm text-gray-400 leading-relaxed">{g.simple}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* الجولة التعريفية (أول دخول فقط) */}
      {tourStep !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} dir="rtl">
          <div className="w-full max-w-md rounded-2xl p-6 text-center"
            style={{ background: '#0D1B2A', border: '1px solid rgba(201,148,58,0.35)' }}>
            <div className="text-4xl mb-3">{TOUR_STEPS[tourStep].icon}</div>
            <h2 className="text-xl font-bold text-[#E8D5A3] mb-2">{TOUR_STEPS[tourStep].title}</h2>
            <p className="text-sm text-gray-300 leading-relaxed mb-5">{TOUR_STEPS[tourStep].body}</p>
            <div className="flex items-center justify-center gap-1.5 mb-4">
              {TOUR_STEPS.map((_, i) => (
                <span key={i} className="w-2 h-2 rounded-full"
                  style={{ background: i === tourStep ? '#C9943A' : 'rgba(255,255,255,0.15)' }} />
              ))}
            </div>
            <div className="flex gap-2 justify-center">
              {tourStep < TOUR_STEPS.length - 1 ? (
                <>
                  <button onClick={() => setTourStep(tourStep + 1)}
                    className="px-6 py-2.5 rounded-xl text-sm font-bold"
                    style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
                    التالي ←
                  </button>
                  <button onClick={closeTour} className="px-4 py-2.5 rounded-xl text-sm text-gray-500">تخطَّ</button>
                </>
              ) : (
                <button onClick={closeTour}
                  className="px-8 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: 'linear-gradient(135deg,#26D07C,#159957)', color: '#060D14' }}>
                  انطلق 🚀
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
