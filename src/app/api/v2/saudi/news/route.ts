import { NextResponse } from 'next/server'
import type { NewsEvent } from '@/app/api/v2/news/route'

export const revalidate = 600

// أخبار السوق السعودي بالعربية (أرقام، مال، الاقتصادية…) من Google News — بنفس شكل أخبار الأوبشن
// كي يعرضها شريط الأخبار نفسه. التأثير تقديري من كلمات الخبر.
const FEED = 'https://news.google.com/rss/search?q=' + encodeURIComponent('تاسي OR "تداول السعودية" OR "السوق السعودية" OR "سوق الأسهم السعودية" when:2d') + '&hl=ar&gl=SA&ceid=SA:ar'

const HIGH = /تعليق|إيقاف|شطب|انهيار|هبوط حاد|ارتفاع حاد|الفائدة|أرباح|خسائر|توزيع|اكتتاب|إدراج|استحواذ|اندماج|زيادة رأس المال|تخفيض رأس المال/
const MID = /نتائج|صفقة|عقد|ترسية|توصية|صناعة السوق|انتقال|تاسي|المؤشر العام|نمو/

function decode(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
}

function shortSource(src: string): string {
  if (/ارقام|أرقام|argaam/i.test(src)) return 'أرقام'
  if (/مال/.test(src)) return 'مال'
  if (/الاقتصادية/.test(src)) return 'الاقتصادية'
  if (/العربية/.test(src)) return 'العربية'
  if (/الشرق/.test(src)) return 'الشرق'
  return src.split(/[:\-–|]/)[0].trim().slice(0, 18)
}

export async function GET() {
  try {
    const res = await fetch(FEED, { headers: { 'User-Agent': 'Mozilla/5.0' }, next: { revalidate: 600 } })
    if (!res.ok) throw new Error(String(res.status))
    const xml = await res.text()
    const now = Date.now()
    const seen = new Set<string>()
    const events: NewsEvent[] = []
    for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const it = m[1]
      const rawTitle = decode(it.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '')
      const source = decode(it.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? '')
      const link = decode(it.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? '')
      const date = Date.parse(it.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? '')
      // العنوان ينتهي بـ « - اسم المصدر» — نحذفه.
      const title = rawTitle.replace(/\s+-\s+[^-]+$/, '').trim()
      if (!title || !Number.isFinite(date) || seen.has(title)) continue
      seen.add(title)
      const impact = HIGH.test(title) ? 70 : MID.test(title) ? 40 : 15
      events.push({
        id: `sa-${date}-${events.length}`, title, titleAr: title, source: shortSource(source),
        publishedAt: new Date(date).toISOString(), isUpcoming: false, minutesAway: Math.round((date - now) / 60000),
        impact, spxImpact: 0, category: 'saudi', reason: '', url: link || null,
      })
    }
    events.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    return NextResponse.json({ events: events.slice(0, 25), fetchedAt: new Date().toISOString() })
  } catch {
    return NextResponse.json({ events: [], fetchedAt: new Date().toISOString() })
  }
}
