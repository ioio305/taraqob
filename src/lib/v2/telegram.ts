// ── إشعارات تليجرام — تصلك الفرصة أينما كنت ─────────────────────────────────
// التفعيل: أنشئ بوتاً عبر @BotFather ثم أضف في إعدادات Vercel:
//   TELEGRAM_BOT_TOKEN = مفتاح البوت
//   TELEGRAM_CHAT_ID   = رقم محادثتك (أرسل رسالة للبوت ثم افتح
//                        api.telegram.org/bot<المفتاح>/getUpdates لتجده)
// بدون المتغيرين، الدالة تتجاهل الإرسال بصمت — لا تكسر شيئاً.

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

// رسالة فرصة جاهزة بصيغة موحدة
export function formatSignalMessage(s: {
  grade: string; contract_symbol: string; contract_type?: string; strike: number
  entry_price?: number | null; stop_loss_level?: number | null; target_level?: number | null
  spx_at_signal?: number | null; reason?: string
}): string {
  const typeAr = s.contract_type === 'put' ? 'بوت' : 'كول'
  const lines = [
    `🚨 <b>فرصة ${s.grade} — ترقب</b>`,
    `العقد: ${typeAr} ${s.strike} (${s.contract_symbol})`,
  ]
  if (s.entry_price != null)      lines.push(`الدخول: $${s.entry_price}`)
  if (s.stop_loss_level != null)  lines.push(`الوقف (SPX): ${s.stop_loss_level}`)
  if (s.target_level != null)     lines.push(`الهدف (SPX): ${s.target_level}`)
  if (s.spx_at_signal != null)    lines.push(`SPX عند الإشارة: ${s.spx_at_signal}`)
  if (s.reason)                   lines.push(`السبب: ${s.reason}`)
  lines.push('', '⚠️ راجع المنصة قبل الدخول — القرار قرارك')
  return lines.join('\n')
}
