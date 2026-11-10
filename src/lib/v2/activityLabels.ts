// أسماء حركات السجل بعربية بسيطة (للعرض فقط). كل حركة مسجّلة في audit_logs:
// حركات المستخدمين entity_type = 'user_activity'، وإجراءات الفريق غير ذلك.

export const USER_ACTIVITY = 'user_activity'

export const ACTIVITY_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  // حركات المستخدمين
  login:                  { label: 'تسجيل دخول',          icon: '→', color: '#26D07C' },
  market_enter:           { label: 'دخول إلى السوق',       icon: '◉', color: '#60A5FA' },
  market_switch:          { label: 'تبديل السوق',          icon: '⇄', color: '#60A5FA' },
  market_locked:          { label: 'محاولة دخول سوق غير مشترك فيه', icon: '🔒', color: '#F59E0B' },
  logout:                 { label: 'تسجيل خروج',          icon: '←', color: '#7C8A99' },
  checkout_start:         { label: 'بدء الاشتراك (دفع)',   icon: '💳', color: '#C9943A' },
  subscription_activated: { label: 'تفعيل اشتراك مدفوع',   icon: '✓', color: '#26D07C' },
  // إجراءات الفريق
  admin_set_market_plan:  { label: 'تغيير باقة سوق',       icon: '◆', color: '#C9943A' },
  admin_set_role:         { label: 'تغيير الدور',          icon: '◈', color: '#A78BFA' },
  admin_set_active:       { label: 'تفعيل/تعطيل حساب',     icon: '⏻', color: '#F59E0B' },
  admin_update_profile:   { label: 'تعديل بيانات حساب',    icon: '✎', color: '#7C8A99' },
  admin_notify:           { label: 'إرسال إشعار',          icon: '🔔', color: '#60A5FA' },
  reset_password_link:    { label: 'رابط إعادة كلمة المرور', icon: '🔑', color: '#F59E0B' },
  set_password:           { label: 'تعيين كلمة مرور',       icon: '🔑', color: '#F59E0B' },
  invite_user:            { label: 'دعوة حساب جديد',        icon: '✉', color: '#26D07C' },
  update_user:            { label: 'تعديل مستخدم (قديم)',   icon: '✎', color: '#7C8A99' },
}

export function activityLabel(action: string) {
  return ACTIVITY_LABELS[action] ?? { label: action, icon: '•', color: '#7C8A99' }
}
