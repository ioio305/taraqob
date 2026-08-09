// ── السجل العام — كل إشارات ترقب القوية ونتائجها، أمام الجميع بلا تسجيل دخول ──
// لا حذف، لا تجميل، لا انتقاء: الإشارة تُسجَّل آلياً لحظة ظهورها وتُقيَّم آلياً
// على أسعار السوق الفعلية. هذه صفحة لا يجرؤ عليها من يبيع الوهم.
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface Row {
  created_at: string
  contract_symbol: string
  contract_type: string
  strike: number
  status: string
  summary_ar: string | null
  spx_at_signal: number | null
  target_level: number | null
  target2_level: number | null
  stop_loss_level: number | null
  scenario_stage: string | null
}

const STATUS_AR: Record<string, { label: string; color: string }> = {
  active:      { label: 'نشطة',  color: '#60A5FA' },
  closed_win:  { label: 'ربحت',  color: '#26D07C' },
  closed_loss: { label: 'خسرت',  color: '#F0435A' },
  expired:     { label: 'انتهت', color: '#6E7E8F' },
}

function gradeOf(summary: string | null): string {
  const m = (summary ?? '').match(/^\[(A\+|A)\]/)
  return m ? m[1] : '—'
}

export default async function PublicTrackPage() {
  // زائر أم مسجّل؟ — الزر الختامي يتصرف بذكاء
  let loggedIn = false
  try {
    const { data: { user } } = await (await createClient()).auth.getUser()
    loggedIn = !!user
  } catch { /* زائر */ }

  let rows: Row[] = []
  try {
    const sb = createServiceClient()
    const { data } = await sb
      .from('v2_signals')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    rows = ((data ?? []) as Row[]).filter(r => !r.contract_symbol?.startsWith('TEST_'))
  } catch { /* تُعرض صفحة فارغة بدل خطأ */ }

  const wins   = rows.filter(r => r.status === 'closed_win').length
  const losses = rows.filter(r => r.status === 'closed_loss').length
  const active = rows.filter(r => r.status === 'active').length
  const decided = wins + losses
  const winRate = decided > 0 ? Math.round((wins / decided) * 100) : null

  return (
    <div className="min-h-screen py-8 px-4" dir="rtl"
      style={{ background: '#060D14', fontFamily: '"IBM Plex Sans Arabic", sans-serif' }}>
      <div className="max-w-3xl mx-auto space-y-6">

        <div className="text-center">
          <h1 className="text-2xl font-black text-[#E8D5A3]">السجل الحي العام — ترقّب</h1>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            كل فرصة قوية (A+/A) تُسجَّل هنا آلياً لحظة ظهورها، وتُقيَّم آلياً على أسعار السوق الفعلية.<br />
            لا حذف للخسائر، لا تجميل للأرقام — هذا هو الفرق بيننا وبين قنوات التوصيات.
          </p>
        </div>

        {/* الإحصاءات */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'نسبة الربح', value: winRate != null ? `${winRate}%` : '—', sub: `من ${decided} إشارة محسومة`, color: winRate != null && winRate >= 50 ? '#26D07C' : '#E8D5A3' },
            { label: 'ربحت', value: String(wins), sub: 'اكتملت حركتها', color: '#26D07C' },
            { label: 'خسرت', value: String(losses), sub: 'فقد السيناريو صلاحيته', color: '#F0435A' },
            { label: 'نشطة الآن', value: String(active), sub: 'تحت التقييم', color: '#60A5FA' },
          ].map(x => (
            <div key={x.label} className="rounded-xl p-4 text-center"
              style={{ background: '#0a1929', border: '1px solid #1e3a50' }}>
              <div className="text-xs text-gray-500">{x.label}</div>
              <div className="text-2xl font-black font-mono mt-1" style={{ color: x.color }}>{x.value}</div>
              <div className="text-xs text-gray-600 mt-0.5">{x.sub}</div>
            </div>
          ))}
        </div>

        {/* الجدول */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#0a1929', border: '1px solid #1e3a50' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <th className="py-3 px-3 text-right">التاريخ</th>
                <th className="py-3 px-3 text-right">العقد</th>
                <th className="py-3 px-3 text-center">التصنيف</th>
                <th className="py-3 px-3 text-center">أهداف الأصل / الإلغاء</th>
                <th className="py-3 px-3 text-center">النتيجة</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 50).map((r, i) => {
                const st = STATUS_AR[r.status] ?? { label: r.status, color: '#6E7E8F' }
                return (
                  <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <td className="py-2.5 px-3 text-xs text-gray-500 font-mono">{r.created_at?.slice(0, 10)}</td>
                    <td className="py-2.5 px-3 font-mono text-xs">
                      <span style={{ color: r.contract_type === 'put' ? '#F0435A' : '#26D07C' }}>
                        {r.contract_type === 'put' ? '▼ بوت' : '▲ كول'} {r.strike}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="text-xs font-black px-2 py-0.5 rounded-md"
                        style={{ background: 'rgba(201,148,58,0.15)', color: '#E8D5A3' }}>
                        {gradeOf(r.summary_ar)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center text-xs font-mono text-gray-400">
                      {r.target_level ?? '—'} / {r.target2_level ?? '—'} / {r.stop_loss_level ?? '—'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="text-xs font-bold" style={{ color: st.color }}>{st.label}</span>
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr><td colSpan={5} className="py-8 text-center text-gray-600 text-sm">
                  السجل يمتلئ آلياً مع كل فرصة قوية تظهر — عُد قريباً
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* الصدق الكامل */}
        <div className="rounded-2xl p-4 text-sm text-gray-400 leading-relaxed"
          style={{ background: 'rgba(201,148,58,0.05)', border: '1px solid rgba(201,148,58,0.2)' }}>
          <div className="font-bold text-[#E8D5A3] mb-1">📜 التزام الصدق</div>
          في الاختبار على 8 سنوات لم يرها النظام (2016–2023): نسبة ربح إشارات الدخول 51–53% بتوقع
          +0.25 وحدة مخاطرة — أفضلية حقيقية إحصائياً لكنها ليست ضماناً. النظام يمنع الدخول في أيام
          الانهيارات العنيفة لأنها تخسر تاريخياً. التداول بالعقود يحمل خطر خسارة كامل المبلغ —
          لا تخاطر بمال لا تحتمل خسارته، والقرار النهائي قرارك.
        </div>

        <div className="text-center">
          <a href={loggedIn ? '/v2' : '/register'} className="inline-block px-6 py-3 rounded-xl text-sm font-bold"
            style={{ background: 'linear-gradient(135deg,#C9943A,#8F6415)', color: '#060D14' }}>
            {loggedIn ? '◈ العودة إلى منصتك ←' : '🎁 جرّب ترقب مجاناً 7 أيام ←'}
          </a>
        </div>
      </div>
    </div>
  )
}
