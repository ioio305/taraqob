// ── ترجمة عناوين الأخبار الحقيقية إلى عربية فصحى دقيقة ───────────────────────
// شريط الأخبار كان يعرض «معلومة» (فئة الخبر) لا الخبر نفسه، لأن titleAr مولّد
// آلياً من استخراج الكيانات ويتلاشى غالباً إلى الفئة. هنا نترجم العنوان الأصلي
// (الإنجليزي) ترجمة أمينة عبر Claude Haiku، فيصبح الشريط مفيداً كلياً.
//
// نموذج Haiku 4.5 — سريع ورخيص، مناسب لواجهة عامة متكررة (نفس اختيار مسار
// المحادثة src/app/api/v2/chat/route.ts). ذاكرة تخزين على مستوى الوحدة تضمن
// ترجمة كل عنوان مرة واحدة فقط، فالتكلفة محدودة بعدد العناوين الجديدة لا بعدد
// الطلبات. عند غياب المفتاح أو أي فشل → نُبقي titleAr الحالي (تراجع آمن).

import Anthropic from '@anthropic-ai/sdk'
import type { NewsEvent } from '@/app/api/v2/news/route'

const TRANSLATE_MODEL = 'claude-haiku-4-5'
const MAX_CACHE = 500

// English headline → faithful Arabic translation
const cache = new Map<string, string>()

const SYSTEM = `أنت مترجم أخبار مالية محترف. تُرجم كل عنوان خبر إنجليزي إلى عربية فصحى واضحة ودقيقة تنقل معنى الخبر نفسه تماماً — بلا زيادة ولا تفسير ولا اختصار إلى فئة عامة.
قواعد صارمة:
- سطر واحد لكل عنوان، بنفس ترتيب وترقيم المدخل.
- ابدأ كل سطر برقمه ثم نقطة ثم الترجمة فقط (مثال: «1. ...»).
- لا تضف أي تعليق أو علامات أو مصدر.
- أبقِ الأسماء المعروفة كما تُنطق بالعربية (باول، الفيدرالي، ناسداك)، والرموز التقنية القصيرة كما هي عند غياب مقابل شائع.`

export async function translateNewsHeadlines(events: NewsEvent[]): Promise<NewsEvent[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || events.length === 0) return events

  // أخبار السوق تحمل رابطاً (عنوان حقيقي)؛ الأحداث المجدولة رمز قصير — نُبقي فئتها.
  const targets = events
    .filter(e => e.url && e.title && !cache.has(e.title))
    .slice(0, 10)

  if (targets.length > 0) {
    try {
      const client = new Anthropic({ apiKey, maxRetries: 0 })
      const numbered = targets.map((e, i) => `${i + 1}. ${e.title}`).join('\n')
      const res = await client.messages.create(
        {
          model: TRANSLATE_MODEL,
          max_tokens: 900,
          system: SYSTEM,
          messages: [{ role: 'user', content: `ترجم العناوين التالية:\n${numbered}` }],
        },
        { timeout: 8000 },
      )
      const text = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map(b => b.text)
        .join('\n')

      // نطابق كل ترجمة برقمها (أمتن من الاعتماد على الترتيب فقط)
      for (const line of text.split('\n')) {
        const m = line.match(/^\s*(\d+)[.)\-]\s*(.+?)\s*$/)
        if (!m) continue
        const idx = parseInt(m[1], 10) - 1
        const ar = m[2].trim()
        if (idx >= 0 && idx < targets.length && ar) cache.set(targets[idx].title, ar)
      }
    } catch { /* تراجع صامت — نُبقي titleAr الحالي */ }
  }

  // حدّ حجم الذاكرة (نحذف الأقدم)
  if (cache.size > MAX_CACHE) {
    for (const k of [...cache.keys()].slice(0, cache.size - MAX_CACHE)) cache.delete(k)
  }

  return events.map(e => {
    const ar = cache.get(e.title)
    return ar ? { ...e, titleAr: ar } : e
  })
}
