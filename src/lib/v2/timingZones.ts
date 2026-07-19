// ── نوافذ التوقيت — متى تكون جلسة نيويورك في صفك؟ ──────────────────────────
// خلاصة خبرة جماعية للمضاربين اليوميين: الافتتاح خادع، منتصف الظهيرة راكد،
// و10:00-11:30 هي النافذة الذهبية (استقر الاتجاه وما زالت السيولة غزيرة).
// معلومة توجيهية فقط — لا تمنع أي دخول.

export interface TimingZone {
  zone: 'closed' | 'warmup' | 'golden' | 'quiet' | 'active' | 'closing'
  label: string
  advice: string
  color: string
  icon: string
}

export function timingZone(): TimingZone {
  const ny = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const day = ny.getDay()
  const mins = ny.getHours() * 60 + ny.getMinutes()

  if (day === 0 || day === 6 || mins < 9 * 60 + 30 || mins >= 16 * 60) {
    return { zone: 'closed', label: 'السوق مغلق', advice: 'وقت التخطيط لا التنفيذ — راجع خطة اليوم', color: '#6E7E8F', icon: '🌙' }
  }
  if (mins < 10 * 60) {
    return { zone: 'warmup', label: 'الافتتاح — لم يستقر', advice: 'أول نصف ساعة خادعة: الفجوات تُختبر والاتجاه لم يتضح. الصبر هنا يوفر خسائر', color: '#F59E0B', icon: '⏳' }
  }
  if (mins < 11 * 60 + 30) {
    return { zone: 'golden', label: 'النافذة الذهبية', advice: 'أفضل وقت في الجلسة: الاتجاه اتضح والسيولة غزيرة — نفّذ خطتك بثقة', color: '#26D07C', icon: '🥇' }
  }
  if (mins < 14 * 60) {
    return { zone: 'quiet', label: 'ركود الظهيرة', advice: 'سيولة أخف وحركة خادعة — قلّل الحجم أو انتظر عودة النشاط بعد 14:00', color: '#60A5FA', icon: '😴' }
  }
  if (mins < 15 * 60) {
    return { zone: 'active', label: 'نشاط العصر', advice: 'السيولة تعود — نافذة ثانية جيدة لمن فاتته الذهبية', color: '#26D07C', icon: '⚡' }
  }
  return { zone: 'closing', label: 'ساعة الختام', advice: 'تسارع وتقلب عنيف قرب الإغلاق — للخبير فقط، وعقود اليوم نفسه هنا شديدة الخطورة', color: '#F0435A', icon: '🔥' }
}
