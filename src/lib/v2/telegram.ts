// ── إشعارات تليجرام — تصلك الفرصة أينما كنت ─────────────────────────────────
// التفعيل: أنشئ بوتاً عبر @BotFather ثم أضف في إعدادات Vercel:
//   TELEGRAM_BOT_TOKEN = مفتاح البوت
//   TELEGRAM_CHAT_ID   = رقم محادثتك (أرسل رسالة للبوت ثم افتح
//                        api.telegram.org/bot<المفتاح>/getUpdates لتجده)
// بدون المتغيرين، الدالة تتجاهل الإرسال بصمت — لا تكسر شيئاً.

import { underlyingFromContract } from './underlying'

export async function sendTelegram(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return false
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })
    return res.ok
  } catch {
    return false
  }
}

// ── ضبط الاتجاه العربي في تيليجرام ─────────────────────────────────────────
// تيليجرام يحدد اتجاه كل سطر من أول حرف قوي فيه، فتقلب الرموز اللاتينية
// الأسطرَ المختلطة لليسار. الحل: علامة RLM غير مرئية في بداية كل سطر،
// وعزل المقاطع اللاتينية (LRI/PDI) حتى تثبت في مكانها داخل النص العربي.
const RLM = '‏'
const LRI = '⁦', PDI = '⁩'
const ltr = (t: string | number) => `${LRI}${t}${PDI}`

// رسالة فرصة جاهزة بصيغة موحدة — تصميم عربي RTL بأيقونات وتسلسل بصري واضح
export function formatSignalMessage(s: {
  grade: string; contract_symbol: string; contract_type?: string; strike: number
  entry_price?: number | null; stop_loss_level?: number | null; target_level?: number | null
  spx_at_signal?: number | null; reason?: string
}): string {
  const isPut      = s.contract_type === 'put'
  const typeAr     = isPut ? 'بوت' : 'كول'
  const typeIcon   = isPut ? '🔴' : '🟢'
  const gradeIcon  = s.grade === 'A+' ? '🏆' : '⚡'
  const underlying = underlyingFromContract(s.contract_symbol)
  const DIV        = '━━━━━━━━━━━━'

  const lines = [
    `${RLM}${gradeIcon} <b>فرصة ${s.grade} — ترقّب</b>`,
    `${RLM}${DIV}`,
    `${RLM}${typeIcon} <b>${typeAr} ${s.strike}</b> · <b>${ltr(underlying)}</b>`,
    `${RLM}<code>${s.contract_symbol}</code>`,
    '',
  ]
  if (s.entry_price != null)     lines.push(`${RLM}💵 <b>الدخول:</b> <b>${ltr('$' + s.entry_price)}</b>`)
  if (s.target_level != null)    lines.push(`${RLM}🎯 <b>الهدف:</b> ${s.target_level} <i>${ltr('(' + underlying + ')')}</i>`)
  if (s.stop_loss_level != null) lines.push(`${RLM}🛑 <b>الوقف:</b> ${s.stop_loss_level} <i>${ltr('(' + underlying + ')')}</i>`)
  if (s.spx_at_signal != null)   lines.push(`${RLM}📊 <b>${underlying} عند الإشارة:</b> ${ltr(s.spx_at_signal)}`)
  if (s.reason) {
    lines.push('', `${RLM}💡 <b>لماذا هذه الفرصة؟</b>`, `${RLM}<blockquote>${s.reason}</blockquote>`)
  }
  lines.push(`${RLM}${DIV}`, `${RLM}⚠️ <i>راجع المنصة قبل الدخول — القرار قرارك</i>`)
  return lines.join('\n')
}
