// ── مكتبة البريد: القالب الذهبي + إرسال عبر Resend + قوالب الحملات ──────────
// تُستخدم من: النشرة الأسبوعية (digest) والحملات الترويجية.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://trqob.com'
const FROM = process.env.EMAIL_FROM || 'ترقّب <news@trqob.com>'

// غلاف موحّد متوافق مع أشهر تطبيقات البريد، ويثبت الشعار واسم «ترقّب» في كل رسالة.
export function emailShell(opts: { title: string; body: string; unsubscribeUrl?: string; preheader?: string }): string {
  const { title, body, unsubscribeUrl, preheader = title } = opts
  return `<!doctype html>
<html lang="ar" dir="rtl">
  <body style="margin:0; padding:0; background:#050B12; font-family:Arial,'Segoe UI',Tahoma,sans-serif;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">${preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%; background:#050B12;">
      <tr>
        <td align="center" style="padding:28px 12px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%; max-width:600px; background:#0A1420; border:1px solid #263748; border-radius:20px; overflow:hidden;">
            <tr>
              <td align="center" style="padding:28px 24px 22px; background:#0D1B2A; border-bottom:1px solid #263748;">
                <img src="${APP_URL}/logo.png" alt="شعار ترقّب" width="88" style="display:block; width:88px; height:auto; margin:0 auto 10px; border:0;" />
                <div style="font-size:27px; line-height:1.2; font-weight:800; color:#F1D58A; letter-spacing:1px;">ترقّب</div>
                <div style="margin-top:6px; font-size:11px; color:#2ED39A; letter-spacing:2px;">منصة دعم القرار لعقود المؤشرات</div>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 30px 26px;">
                <h1 style="margin:0 0 18px; color:#FFFFFF; font-size:22px; line-height:1.5; text-align:center;">${title}</h1>
                <div style="color:#C6D0DB; font-size:15px; line-height:1.9; text-align:right;">${body}</div>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:18px 26px 22px; background:#08111B; border-top:1px solid #1B2A39;">
                <div style="width:52px; height:3px; margin:0 auto 14px; background:#C9943A; border-radius:99px;"></div>
                <p style="margin:0; color:#718096; font-size:11px; line-height:1.8;">
                  ترقّب أداة دعم قرار تعليمية — ليست توصية استثمارية ولا ضمان ربح.
                  ${unsubscribeUrl ? `<br/><a href="${unsubscribeUrl}" style="color:#94A3B8; text-decoration:underline;">إلغاء الاشتراك من النشرة</a>` : ''}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim()
}

// زر أساسي ذهبي
export function emailButton(text: string, href: string): string {
  return `<div style="text-align:center; margin:24px 0;">
    <a href="${href}" style="background:#D6AA4A; background-image:linear-gradient(135deg,#F1D58A,#C9943A); color:#07111A; padding:14px 32px; border:1px solid #F1D58A; border-radius:12px; text-decoration:none; font-weight:800; font-size:15px; display:inline-block;">${text}</a>
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
