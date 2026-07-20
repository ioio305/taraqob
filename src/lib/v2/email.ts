// ── مكتبة البريد: القالب الذهبي + إرسال عبر Resend + قوالب الحملات ──────────
// تُستخدم من: النشرة الأسبوعية (digest) والحملات الترويجية.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://trqob.com'
const FROM = process.env.EMAIL_FROM || 'ترقّب <news@trqob.com>'

// القالب الذهبي: غلاف داكن أنيق بهوية ترقّب — يقبل جسماً داخلياً ورابط إلغاء
export function emailShell(opts: { title: string; body: string; unsubscribeUrl?: string }): string {
  const { title, body, unsubscribeUrl } = opts
  return `
<div dir="rtl" style="font-family: Arial, 'Segoe UI', sans-serif; background:#060D14; padding:24px 0;">
  <div style="max-width:600px; margin:0 auto; background:#0A1420; border:1px solid rgba(201,148,58,0.25); border-radius:16px; overflow:hidden;">
    <div style="text-align:center; padding:26px 24px 6px;">
      <div style="display:inline-block; background:linear-gradient(135deg,#C9943A,#8F6415); border-radius:12px; padding:9px 18px;">
        <span style="font-size:19px; font-weight:bold; color:#060D14;">ترقّب</span>
      </div>
    </div>
    <div style="padding:8px 28px 26px;">
      <h1 style="color:#E8D5A3; font-size:20px; margin:14px 0 16px; text-align:center;">${title}</h1>
      <div style="color:#C6CFD8; font-size:15px; line-height:1.9;">${body}</div>
    </div>
    <div style="padding:16px 28px; border-top:1px solid rgba(255,255,255,0.05); text-align:center;">
      <p style="color:#3A4756; font-size:11px; line-height:1.7; margin:0;">
        ترقّب أداة دعم قرار تعليمية لعقود SPX — ليست توصية استثمارية ولا ضمان ربح.
        ${unsubscribeUrl ? `<br/><a href="${unsubscribeUrl}" style="color:#5E6E7F; text-decoration:underline;">إلغاء الاشتراك من النشرة</a>` : ''}
      </p>
    </div>
  </div>
</div>`.trim()
}

// زر أساسي ذهبي
export function emailButton(text: string, href: string): string {
  return `<div style="text-align:center; margin:24px 0;">
    <a href="${href}" style="background:linear-gradient(135deg,#C9943A,#8F6415); color:#060D14; padding:13px 30px; border-radius:12px; text-decoration:none; font-weight:bold; font-size:15px; display:inline-block;">${text}</a>
  </div>`
}

// إرسال دفعة عبر Resend (حتى 100 رسالة/طلب). يرجع العدد المُرسَل + أخطاء فعلية.
export async function sendResendBatch(
  emails: { to: string; subject: string; html: string }[],
): Promise<{ sent: number; skipped: boolean; errors: string[] }> {
  const key = process.env.RESEND_API_KEY
  if (!key) return { sent: 0, skipped: true, errors: ['RESEND_API_KEY غير مضبوط في البيئة'] }

  let sent = 0
  const errors: string[] = []
  for (let i = 0; i < emails.length; i += 100) {
    const chunk = emails.slice(i, i + 100).map(e => ({
      from: FROM, to: [e.to], subject: e.subject, html: e.html,
    }))
    try {
      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(chunk),
      })
      const txt = await res.text()
      if (res.ok) sent += chunk.length
      else errors.push(`HTTP ${res.status}: ${txt.slice(0, 400)}`)
    } catch (e: any) {
      errors.push(String(e?.message ?? e).slice(0, 200))
    }
  }
  return { sent, skipped: false, errors }
}

// ── النشرة الأسبوعية: تُبنى من أرقام حقيقية فقط ──────────────────────────────
export function digestBody(stats: {
  weekCount: number; wins: number; losses: number; winRate: number | null
  topLine: string
}): string {
  const { weekCount, wins, losses, winRate, topLine } = stats
  const stat = (label: string, value: string, color: string) =>
    `<td style="text-align:center; padding:10px;">
       <div style="font-size:24px; font-weight:bold; color:${color};">${value}</div>
       <div style="font-size:12px; color:#5E6E7F; margin-top:2px;">${label}</div>
     </td>`
  return `
    <p style="margin:0 0 6px;">${topLine}</p>
    <table style="width:100%; margin:18px 0; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:12px;">
      <tr>
        ${stat('فرص هذا الأسبوع', String(weekCount), '#E8D5A3')}
        ${stat('ربحت', String(wins), '#26D07C')}
        ${stat('خسرت', String(losses), '#F0435A')}
        ${stat('نسبة النجاح', winRate != null ? winRate + '%' : '—', '#60A5FA')}
      </tr>
    </table>
    <p style="color:#8595A5; font-size:13px;">
      كل فرصة تُسجَّل آلياً لحظة ظهورها وتُقيَّم على أسعار السوق الفعلية — بلا حذف للخسائر ولا تجميل للأرقام.
    </p>
    ${emailButton('افتح السجل العام كاملاً ←', `${APP_URL}/track`)}
  `.trim()
}

// ── ثلاث حملات ترويجية جاهزة (لاستخدام يدوي لاحقاً) ─────────────────────────
export type Campaign = { subject: string; body: string }

export const CAMPAIGNS: Record<string, () => Campaign> = {
  // 1) ترحيب بمن ترك بريده
  welcome: () => ({
    subject: 'أهلاً بك في ترقّب — إليك ما نقدّمه بصدق',
    body: `
      <p>سعدنا باهتمامك بمنصة <b style="color:#E8D5A3;">ترقّب</b>.</p>
      <p>نحن لا نبيع وعوداً. نقدّم أداة قرار لعقود SPX تُخبرك <b>متى تدخل، وكم تشتري، ومتى تخرج</b> — بأسعار حقيقية وأرقام مثبتة على 8 سنوات من الاختبار (نسبة نجاح 51% خارج العينة، فرق حقيقي متواضع لا وعد بالثراء).</p>
      <p>أفضل طريقة لتحكم بنفسك: جرّبها 7 أيام كاملة — مجاناً، وبلا بطاقة.</p>
      ${emailButton('ابدأ تجربتك المجانية ←', `${APP_URL}/register`)}
    `.trim(),
  }),
  // 2) الدليل: السجل العام
  proof: () => ({
    subject: 'لماذا نعرض خسائرنا؟ — السجل العام لترقّب',
    body: `
      <p>أغلب قنوات التوصيات تحذف صفقاتها الخاسرة وتُبقي الرابحة.</p>
      <p>في ترقّب، كل فرصة قوية تُسجَّل <b>آلياً</b> لحظة ظهورها وتُقيَّم <b>آلياً</b> على أسعار السوق الفعلية — الرابحة والخاسرة معاً، أمام الجميع، بلا تسجيل دخول.</p>
      <p>هذه الشفافية هي الفرق. احكم بنفسك:</p>
      ${emailButton('شاهد السجل العام ←', `${APP_URL}/track`)}
    `.trim(),
  }),
  // 3) ميزة: حارس الانهيارات
  feature: () => ({
    subject: 'الميزة التي تحميك من أسوأ أيامك',
    body: `
      <p>أخطر ما في المضاربة ليس الصفقة الخاسرة — بل الدخول في يوم انهيار.</p>
      <p><b style="color:#E8D5A3;">حارس الانهيارات</b> في ترقّب يوقف توصيات الدخول <b>تلقائياً</b> في الأيام العنيفة جداً (مثل انهيار كورونا) — لأن التاريخ أثبت أنها أيام خاسرة مهما بدت الفرصة مغرية.</p>
      <p>هذه القاعدة وحدها هي الفرق بين متداول يبقى ومتداول يحترق.</p>
      ${emailButton('اكتشف بقية ما يحميك ←', `${APP_URL}/register`)}
    `.trim(),
  }),
}
