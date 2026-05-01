import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

// Content Safety Filter — strictly enforced
const BANNED_PHRASES = [
  'مضمون', 'ربح أكيد', 'فرصة لا تعوض', 'ادخل الآن بلا تردد',
  'آمن تمامًا', 'مؤكد', 'ضمان', 'لا خسارة', 'ربح مضمون',
  'guaranteed', 'sure profit', 'risk-free', 'no loss', 'certain win',
]

function filterContent(text: string): string {
  let filtered = text
  BANNED_PHRASES.forEach(phrase => {
    filtered = filtered.replace(new RegExp(phrase, 'gi'), '[تم حذف عبارة غير مناسبة]')
  })
  return filtered
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'غير مصرح' }, { status: 401 })

  const {
    sessionData,
    indicatorScores,
    contract,
    signalDraft,
    decisionOutput,
  } = await request.json()

  // Build context for AI
  const indicatorSummary = (indicatorScores ?? []).map((s: any) => (
    `- ${s.indicator?.name_ar ?? s.code}: ${s.score ?? '—'}/100 — ${s.status_ar ?? s.status ?? '—'}${s.blocks_entry ? ' [يمنع الدخول]' : s.supports_entry ? ' [يدعم]' : ''}`
  )).join('\n')

  const prompt = `أنت محلل مالي متخصص في SPX Options. مهمتك توليد محتوى احترافي لبطاقة إشارة تحليلية.

=== بيانات الجلسة ===
SPX: ${sessionData?.spx_close ?? '—'} | VIX: ${sessionData?.vix ?? '—'} | اتجاه السوق: ${sessionData?.market_bias ?? '—'} | مخاطر الأحداث: ${sessionData?.economic_event_risk ?? '—'}

=== المؤشرات السبعة ===
${indicatorSummary || 'لم تُدخل بعد'}

=== العقد المختار ===
${contract ? `${contract.contract_type === 'call' ? 'Call ↑' : 'Put ↓'} | Strike: ${contract.strike} | DTE: ${contract.dte} | Mid: ${contract.mid?.toFixed(3) ?? '—'} | جودة السيولة: ${contract.contract_quality ?? '—'} (${contract.liquidity_score ?? '—'}/100)` : 'لم يُختر بعد'}

=== الإشارة ===
الاستراتيجية: ${signalDraft?.strategy ?? '—'}
الاتجاه: ${signalDraft?.direction ?? '—'}
شرط الدخول: ${signalDraft?.entry_condition ?? '—'}
نقطة الإبطال: ${signalDraft?.invalidation_level ?? '—'}
خطة الخروج: ${signalDraft?.exit_plan ?? '—'}
الهدف: ${signalDraft?.profit_target ?? '—'}
المخاطرة القصوى: ${signalDraft?.max_risk_percent ?? '—'}%

=== قرار المحرك ===
القرار: ${decisionOutput?.decision ?? '—'} | الدرجة المركبة: ${decisionOutput?.composite_score ?? '—'}/100

المطلوب منك توليد JSON بالشكل التالي بدون أي نص خارج الـ JSON:
{
  "rationale": "سبب الإشارة التفصيلي بالعربية (3-5 جمل) يشرح لماذا هذه الإشارة مناسبة أو تستوجب الحذر، مبني على المؤشرات المحددة",
  "user_summary_ar": "ملخص للمستخدم العادي (2-3 جمل) بلغة مبسطة وآمنة — يشرح حالة الإشارة وشرط الدخول والمخاطرة",
  "risk_assessment": "تقييم موجز للمخاطر (جملتان) يحدد أبرز مخاطر هذه الإشارة",
  "key_warnings": ["تحذير 1", "تحذير 2"] 
}

قواعد صارمة:
- لا تضمن ربحًا أو نتيجة محددة
- استخدم عبارات احتمالية: "قد يكون"، "يُشير إلى"، "سيناريو مرجح"
- إذا كانت البيانات غير مكتملة، اذكر ذلك صراحةً
- الـ user_summary يجب أن يذكر أن الإشارة مشروطة وليست دخولًا مباشرًا`

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    })

    const rawText = message.content[0].type === 'text' ? message.content[0].text : '{}'
    const cleaned = rawText.replace(/```json|```/g, '').trim()

    let parsed
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      // If JSON parsing fails, return structured fallback
      parsed = {
        rationale: filterContent(rawText),
        user_summary_ar: 'الإشارة مشروطة وتستوجب تحقق شرط الدخول قبل أي إجراء.',
        risk_assessment: 'يرجى مراجعة المؤشرات والمخاطر قبل الدخول.',
        key_warnings: [],
      }
    }

    // Apply content filter to all text fields
    return NextResponse.json({
      rationale:        filterContent(parsed.rationale ?? ''),
      user_summary_ar:  filterContent(parsed.user_summary_ar ?? ''),
      risk_assessment:  filterContent(parsed.risk_assessment ?? ''),
      key_warnings:     (parsed.key_warnings ?? []).map(filterContent),
    })
  } catch (err) {
    console.error('AI Rationale Error:', err)
    return NextResponse.json({ error: 'فشل توليد السبب' }, { status: 500 })
  }
}
