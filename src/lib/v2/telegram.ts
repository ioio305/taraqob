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

// رسالة فرصة جاهزة بصيغة موحدة — تصميم غني بأيقونات وتسلسل بصري واضح
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
    `${gradeIcon} <b>فرصة ${s.grade} — ترقّب</b>`,
    DIV,
    `${typeIcon} <b>${typeAr} ${s.strike}</b> · <b>${underlying}</b>`,
    `<code>${s.contract_symbol}</code>`,
    '',
  ]
  if (s.entry_price != null)     lines.push(`💵 <b>الدخول:</b> $${s.entry_price}`)
  if (s.target_level != null)    lines.push(`🎯 <b>الهدف:</b> ${s.target_level} <i>(${underlying})</i>`)
  if (s.stop_loss_level != null) lines.push(`🛑 <b>الوقف:</b> ${s.stop_loss_level} <i>(${underlying})</i>`)
  if (s.spx_at_signal != null)   lines.push(`📊 <b>${underlying} عند الإشارة:</b> ${s.spx_at_signal}`)
  if (s.reason) {
    lines.push('', `💡 <b>لماذا هذه الفرصة؟</b>`, `<blockquote>${s.reason}</blockquote>`)
  }
  lines.push(DIV, '⚠️ <i>راجع المنصة قبل الدخول — القرار قرارك</i>')
  return lines.join('\n')
}
