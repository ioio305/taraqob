// ── إشعارات تليجرام — تصلك الفرصة أينما كنت ─────────────────────────────────
// التفعيل: أنشئ بوتاً عبر @BotFather ثم أضف في إعدادات Vercel:
//   TELEGRAM_BOT_TOKEN = مفتاح البوت
//   TELEGRAM_CHAT_ID   = رقم محادثتك (أرسل رسالة للبوت ثم افتح
//                        api.telegram.org/bot<المفتاح>/getUpdates لتجده)
// بدون المتغيرين، الدالة تتجاهل الإرسال بصمت — لا تكسر شيئاً.

import { underlyingFromContract } from './underlying'
import type { AlertLifecycleEvent } from './alertLifecycle'

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
  spx_at_signal?: number | null; reason?: string; expiry?: string | null; dte?: number | null
  bid?: number | null; ask?: number | null; max_entry_price?: number | null
  valid_until?: string | null; risk_budget_pct?: number | null; contract_stop_price?: number | null
  contract_target_price?: number | null
  target2_level?: number | null
  opportunity_window?: string | null
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
  if (s.max_entry_price != null) lines.push(`${RLM}📌 <b>أقصى سعر شراء:</b> <b>${ltr('$' + s.max_entry_price)}</b>`)
  if (s.bid != null && s.ask != null) {
    const mid = (s.bid + s.ask) / 2
    const spread = mid > 0 ? Math.round(((s.ask - s.bid) / mid) * 100) : null
    lines.push(`${RLM}💧 <b>السيولة:</b> ${ltr('$' + s.bid + ' / $' + s.ask)}${spread != null ? ` · فرق ${ltr(spread + '%')}` : ''}`)
  }
  if (s.expiry)                  lines.push(`${RLM}📅 <b>الانتهاء:</b> ${ltr(s.expiry)}${s.dte != null ? ` · ${ltr(s.dte + ' DTE')}` : ''}`)
  if (s.target_level != null)    lines.push(`${RLM}📈 <b>هدف الأصل الأول:</b> ${s.target_level} <i>${ltr('(' + underlying + ')')}</i>`)
  if (s.target2_level != null)   lines.push(`${RLM}📈 <b>هدف الأصل الثاني:</b> ${s.target2_level} <i>${ltr('(' + underlying + ')')}</i>`)
  if (s.stop_loss_level != null) lines.push(`${RLM}📉 <b>إلغاء السيناريو:</b> ${s.stop_loss_level} <i>${ltr('(' + underlying + ')')}</i>`)
  if (s.opportunity_window)      lines.push(`${RLM}⏳ <b>نافذة الفرصة:</b> ${s.opportunity_window}`)
  if (s.contract_stop_price != null) lines.push(`${RLM}🛡️ <b>حماية طارئة للعقد:</b> <b>${ltr('$' + s.contract_stop_price)}</b>`)
  if (s.entry_price != null && s.contract_stop_price != null) {
    const maxLoss = Math.max(0, Math.round((s.entry_price - s.contract_stop_price) * 100))
    lines.push(`${RLM}🧮 <b>الخسارة المخططة للعقد:</b> ${ltr('$' + maxLoss)}`)
  }
  if (s.risk_budget_pct != null) lines.push(`${RLM}🛡️ <b>سقف مخاطرة المحفظة:</b> ${ltr(s.risk_budget_pct + '%')}`)
  if (s.valid_until) {
    const time = new Date(s.valid_until).toLocaleTimeString('ar-SA', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit' })
    lines.push(`${RLM}⏱️ <b>صلاحية السيناريو:</b> حتى ${ltr(time)} بتوقيت الرياض`)
  }
  if (s.spx_at_signal != null)   lines.push(`${RLM}📊 <b>${underlying} عند الإشارة:</b> ${ltr(s.spx_at_signal)}`)
  if (s.reason) {
    lines.push('', `${RLM}💡 <b>لماذا هذه الفرصة؟</b>`, `${RLM}<blockquote>${s.reason}</blockquote>`)
  }
  lines.push(`${RLM}${DIV}`, `${RLM}⚠️ <i>راجع المنصة قبل الدخول — القرار قرارك</i>`)
  return lines.join('\n')
}

export function formatLifecycleMessage(input: {
  underlying: string
  contractType: 'call' | 'put'
  strike: number
  price?: number | null
  score?: number | null
  target1?: number | null
  target2?: number | null
  invalidation?: number | null
  events: AlertLifecycleEvent[]
}): string {
  const typeAr = input.contractType === 'put' ? 'بوت' : 'كول'
  const lines = [
    `${RLM}🔔 <b>تحديث مهم — ترقّب</b>`,
    `${RLM}━━━━━━━━━━━━`,
    `${RLM}<b>${ltr(input.underlying)}</b> · ${typeAr} ${ltr(input.strike)}`,
  ]
  for (const event of input.events) {
    lines.push(`${RLM}• <b>${event.title}:</b> ${event.detail}`)
  }
  if (input.price != null) lines.push(`${RLM}📍 <b>الأصل الآن:</b> ${ltr(input.price.toFixed(2))}`)
  if (input.score != null) lines.push(`${RLM}🎯 <b>درجة الفرصة:</b> ${ltr(input.score + '/100')}`)
  if (input.target1 != null) lines.push(`${RLM}① <b>الهدف الأول:</b> ${ltr(input.target1)}`)
  if (input.target2 != null) lines.push(`${RLM}② <b>الهدف الثاني:</b> ${ltr(input.target2)}`)
  if (input.invalidation != null) lines.push(`${RLM}🛑 <b>إلغاء السيناريو:</b> ${ltr(input.invalidation)}`)
  lines.push(`${RLM}━━━━━━━━━━━━`, `${RLM}⚠️ <i>راجع المنصة قبل اتخاذ القرار.</i>`)
  return lines.join('\n')
}
