'use client'

// ── مساعد ترقّب: محادثة ذكية + قاموس المصطلحات + صيد لطيف للعملاء ────────────
// يستبدل زر «؟» القديم. يظهر كزر عائم أسفل يمين. وضعان:
//   visitor  → في الصفحة التسويقية (يعرّف بالقيمة ويشجّع على التجربة/ترك البريد)
//   member   → داخل المنصة (يشرح الميزات والمصطلحات)

import { useState, useRef, useEffect } from 'react'
import { GLOSSARY } from './BeginnerGuide'

type Msg = { role: 'user' | 'assistant'; content: string }

const QUICK_VISITOR = [
  'ما هي منصة ترقّب باختصار؟',
  'هل التوصيات مضمونة الربح؟',
  'كم تكلفة الاشتراك؟',
  'كيف أبدأ التجربة المجانية؟',
]
const QUICK_MEMBER = [
  'ما معنى الدلتا؟',
  'متى لا أدخل الصفقة؟',
  'كيف يعمل حارس الانهيارات؟',
  'ما الفرق بين الباقات؟',
]

const GREETING_VISITOR = 'أهلاً 👋 أنا مساعد ترقّب. اسأل. أجاوب بصدق وباختصار.'
const GREETING_MEMBER = 'أهلاً 👋 اسأل عن أي مصطلح أو ميزة. أو افتح القاموس فوق.'

export function AssistantWidget({ context = 'visitor' }: { context?: 'visitor' | 'member' }) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'chat' | 'glossary'>('chat')
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailBox, setEmailBox] = useState(false)
  const [email, setEmail] = useState('')
  const [emailDone, setEmailDone] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  // بطاقة التعريف الاختيارية (زائر فقط): اسم + بريد + جوال، تظهر أول المحادثة
  const [cardDone, setCardDone] = useState(context === 'member')
  const [cName, setCName] = useState('')
  const [cEmail, setCEmail] = useState('')
  const [cPhone, setCPhone] = useState('')
  const [cErr, setCErr] = useState<string | null>(null)
  const [cBusy, setCBusy] = useState(false)

  const greeting = context === 'member' ? GREETING_MEMBER : GREETING_VISITOR
  const quick = context === 'member' ? QUICK_MEMBER : QUICK_VISITOR

  useEffect(() => {
    if (context !== 'visitor') return
    try { if (localStorage.getItem('taraqob_lead_card')) setCardDone(true) } catch { /* تجاهل */ }
  }, [context])

  function dismissCard() {
    setCardDone(true)
    try { localStorage.setItem('taraqob_lead_card', '1') } catch { /* تجاهل */ }
  }

  async function submitCard() {
    if (!cEmail.trim()) { setCErr('البريد ناقص'); return }
    setCBusy(true); setCErr(null)
    try {
      const res = await fetch('/api/v2/leads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cName.trim(), email: cEmail.trim(), phone: cPhone.trim(), source: 'chat' }),
      })
      const d = await res.json()
      if (d.ok) dismissCard()
      else { setCErr(d.error ?? 'تعذّر الحفظ'); setCBusy(false) }
    } catch { setCErr('تعذّر الاتصال'); setCBusy(false) }
  }

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, loading])

  async function send(text: string) {
    const q = text.trim()
    if (!q || loading) return
    const next = [...messages, { role: 'user' as const, content: q }]
    setMessages(next)
    setInput('')
    setLoading(true)
    try {
      const res = await fetch('/api/v2/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, context }),
      })
      const data = await res.json()
      setMessages([...next, { role: 'assistant', content: data.reply ?? 'تعذّر الرد الآن.' }])
    } catch {
      setMessages([...next, { role: 'assistant', content: 'تعذّر الاتصال — جرّب مرة أخرى.' }])
    } finally {
      setLoading(false)
    }
  }

  async function submitEmail() {
    const e = email.trim()
    if (!e) return
    try {
      const res = await fetch('/api/v2/leads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e, source: 'chat' }),
      })
      const data = await res.json()
      if (data.ok) { setEmailDone(true); setEmail('') }
    } catch { /* تجاهل */ }
  }

  // موضع الزر: نرفعه فوق شريط التنقّل السفلي في وضع العضو على الجوال
  const btnBottom = context === 'member' ? 'bottom-20 lg:bottom-4' : 'bottom-4'

  return (
    <>
      {/* الزر العائم */}
      {!open && (
        <button onClick={() => setOpen(true)}
          className={`fixed ${btnBottom} right-4 z-40 flex items-center gap-2 pl-4 pr-3 py-3 rounded-full shadow-xl transition-transform hover:scale-105`}
          style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}
          aria-label="مساعد ترقّب">
          <span className="text-lg">💬</span>
          <span className="text-sm font-bold hidden sm:inline">مساعد ترقّب</span>
        </button>
      )}

      {/* اللوحة */}
      {open && (
        <div className={`fixed ${btnBottom} right-4 z-50 w-[92vw] max-w-sm rounded-2xl overflow-hidden flex flex-col`}
          style={{ background: '#0A1420', border: '1px solid rgba(201,148,58,0.35)', boxShadow: '0 24px 70px rgba(0,0,0,0.55)', height: 'min(560px, 78vh)' }}
          dir="rtl">

          {/* الرأس + التبويبات */}
          <div className="shrink-0" style={{ background: 'rgba(13,27,42,0.95)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center justify-between px-4 pt-3">
              <div className="flex items-center gap-2">
                <span className="text-base">💬</span>
                <span className="text-sm font-bold text-[#E8D5A3]">مساعد ترقّب</span>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white text-lg leading-none">✕</button>
            </div>
            <div className="flex gap-1 px-3 pt-2">
              {([['chat', 'محادثة'], ['glossary', 'القاموس']] as const).map(([k, label]) => (
                <button key={k} onClick={() => setTab(k)}
                  className="px-3 py-2 text-xs font-bold rounded-t-lg transition-colors"
                  style={{
                    color: tab === k ? '#E8D5A3' : '#5E6E7F',
                    borderBottom: tab === k ? '2px solid #C9943A' : '2px solid transparent',
                  }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* بطاقة التعريف الاختيارية — أول شيء يراه الزائر */}
          {tab === 'chat' && !cardDone && (
            <div className="flex-1 overflow-y-auto px-4 py-5">
              <div className="text-center mb-4">
                <div className="text-3xl mb-2">👋</div>
                <h3 className="text-base font-bold text-white mb-1">عرّفنا بنفسك</h3>
                <p className="text-xs leading-relaxed" style={{ color: '#8595A5' }}>
                  نرسل لك الفرص القوية وملخّص السوق. اختياري — تقدر تتخطّى وتسأل مباشرة.
                </p>
              </div>
              <div className="space-y-2">
                <input value={cName} onChange={e => setCName(e.target.value)} placeholder="اسمك"
                  className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
                <input value={cEmail} onChange={e => setCEmail(e.target.value)} type="email" dir="ltr" placeholder="بريدك"
                  onKeyDown={e => { if (e.key === 'Enter') submitCard() }}
                  className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none text-left"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
                <input value={cPhone} onChange={e => setCPhone(e.target.value)} type="tel" dir="ltr" placeholder="جوالك (واتساب)"
                  onKeyDown={e => { if (e.key === 'Enter') submitCard() }}
                  className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none text-left"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
                {cErr && <p className="text-xs" style={{ color: '#F87171' }}>{cErr}</p>}
                <button onClick={submitCard} disabled={cBusy}
                  className="w-full py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#26D07C,#159957)', color: '#060D14' }}>
                  {cBusy ? '...' : 'سجّلني — وابدأ'}
                </button>
                <button onClick={dismissCard}
                  className="w-full py-2 text-xs" style={{ color: '#5E6E7F' }}>
                  تخطَّ وتحدّث مباشرة ←
                </button>
              </div>
            </div>
          )}

          {/* تبويب المحادثة */}
          {tab === 'chat' && cardDone && (
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
                {/* ترحيب */}
                <Bubble role="assistant">{greeting}</Bubble>

                {/* اقتراحات سريعة قبل أي رسالة */}
                {messages.length === 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {quick.map(qq => (
                      <button key={qq} onClick={() => send(qq)}
                        className="text-xs px-2.5 py-1.5 rounded-full transition-colors"
                        style={{ background: 'rgba(201,148,58,0.1)', border: '1px solid rgba(201,148,58,0.3)', color: '#E8D5A3' }}>
                        {qq}
                      </button>
                    ))}
                  </div>
                )}

                {messages.map((m, i) => <Bubble key={i} role={m.role}>{m.content}</Bubble>)}
                {loading && <Bubble role="assistant"><span className="opacity-60">يكتب…</span></Bubble>}

                {/* دعوة للتجربة (زائر فقط، بعد أول تبادل) */}
                {context === 'visitor' && messages.length >= 2 && !loading && (
                  <a href="/register"
                    className="block text-center text-xs font-bold py-2.5 rounded-xl mt-1"
                    style={{ background: 'linear-gradient(135deg,#26D07C,#159957)', color: '#060D14' }}>
                    🎁 ابدأ تجربتك المجانية — 7 أيام كاملة
                  </a>
                )}
              </div>

              {/* صندوق ترك البريد (زائر) */}
              {context === 'visitor' && (
                <div className="shrink-0 px-3 pb-2">
                  {emailDone ? (
                    <div className="text-xs text-center py-2 rounded-lg"
                      style={{ background: 'rgba(38,208,124,0.1)', border: '1px solid rgba(38,208,124,0.3)', color: '#34D399' }}>
                      ✓ شكراً — سيصلك ملخّصنا الأسبوعي
                    </div>
                  ) : emailBox ? (
                    <div className="flex gap-1.5">
                      <input value={email} onChange={e => setEmail(e.target.value)}
                        type="email" dir="ltr" placeholder="you@example.com"
                        onKeyDown={e => { if (e.key === 'Enter') submitEmail() }}
                        className="flex-1 rounded-lg px-3 py-2 text-xs text-white outline-none text-left"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
                      <button onClick={submitEmail}
                        className="text-xs font-bold px-3 rounded-lg"
                        style={{ background: 'rgba(201,148,58,0.2)', border: '1px solid rgba(201,148,58,0.4)', color: '#E8D5A3' }}>
                        أرسل
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setEmailBox(true)}
                      className="w-full text-xs py-1.5 rounded-lg transition-colors"
                      style={{ color: '#8595A5' }}>
                      📧 اترك بريدك لملخّص السوق الأسبوعي
                    </button>
                  )}
                </div>
              )}

              {/* الإدخال */}
              <div className="shrink-0 flex gap-1.5 px-3 pb-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>
                <input value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') send(input) }}
                  placeholder="اكتب سؤالك…"
                  className="flex-1 rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
                <button onClick={() => send(input)} disabled={loading || !input.trim()}
                  className="text-sm font-bold px-4 rounded-xl disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
                  ↑
                </button>
              </div>
            </>
          )}

          {/* تبويب القاموس */}
          {tab === 'glossary' && (
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
              {GLOSSARY.map(g => (
                <div key={g.term} className="rounded-xl p-3"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="text-sm font-bold text-white mb-1">{g.icon} {g.term}</div>
                  <p className="text-sm text-gray-400 leading-relaxed">{g.simple}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}

function Bubble({ role, children }: { role: 'user' | 'assistant'; children: React.ReactNode }) {
  const isUser = role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-start' : 'justify-end'}`}>
      <div className="max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap"
        style={isUser
          ? { background: 'rgba(201,148,58,0.15)', border: '1px solid rgba(201,148,58,0.25)', color: '#F0E4C8' }
          : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#D5DCE4' }}>
        {children}
      </div>
    </div>
  )
}
