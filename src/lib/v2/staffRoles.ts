// ── أدوار الحسابات وصلاحياتها — مصدر واحد للحقيقة (المرحلة ٢ · 2026-11-10) ──────
// المالك (admin): تحكّم كامل، يرى كل الأسواق وكل الأقسام وسجل حركات المستخدمين،
//   ويمنح «مشرف عام» و«دعم فني» لأي عدد من الحسابات.
// مشرف عام (moderator): يدير المستخدمين العاديين وباقاتهم في كل سوق، ويرى الأسواق كلها.
// دعم فني (support): يطّلع على المستخدمين واشتراكاتهم ويساعدهم (إشعار/تصحيح اسم) دون
//   تغيير باقات أو أدوار، ولا يتجاوز الاشتراكات.
// القيمة 'admin' في قاعدة البيانات تعني «المالك» (حفاظاً على البيانات والسياسات القائمة).

export type StaffRole = 'admin' | 'moderator' | 'support'
export type AccountRole = StaffRole | 'user'

export const ROLE_INFO: Record<AccountRole, { label: string; color: string; description: string }> = {
  admin:     { label: 'المالك',   color: '#C9943A', description: 'تحكّم كامل: كل الأسواق والأقسام وسجل الحركات ومنح الأدوار.' },
  moderator: { label: 'مشرف عام', color: '#60A5FA', description: 'يدير المستخدمين وباقاتهم في السوقين ويرى الأسواق كلها.' },
  support:   { label: 'دعم فني',  color: '#26D07C', description: 'يطّلع على المستخدمين واشتراكاتهم ويساعدهم دون تغيير الباقات.' },
  user:      { label: 'مستخدم',   color: '#7C8A99', description: 'يستخدم السوق المشترك فيه حسب باقته فقط.' },
}

// الأدوار التي يمنحها المالك من اللوحة. «المالك» لا يُمنح من الواجهة حمايةً للحساب.
export const GRANTABLE_ROLES: AccountRole[] = ['user', 'moderator', 'support']

export function normalizeAccountRole(value: unknown): AccountRole {
  return value === 'admin' || value === 'moderator' || value === 'support' ? value : 'user'
}

/** يدخل لوحة الإدارة (المالك + مشرف عام + دعم فني). */
export function isPanelStaff(role: unknown): boolean {
  const r = normalizeAccountRole(role)
  return r !== 'user'
}

/** يرى كل الأسواق دون اشتراك (المالك + مشرف عام). الدعم الفني لا يتجاوز الاشتراكات. */
export function bypassesSubscriptions(role: unknown): boolean {
  const r = normalizeAccountRole(role)
  return r === 'admin' || r === 'moderator'
}

export type Permission =
  | 'panel.view'        // دخول لوحة الإدارة والنظرة العامة
  | 'users.view'        // قائمة المستخدمين وتفاصيلهم واشتراكاتهم
  | 'users.profile'     // تصحيح الاسم
  | 'users.status'      // تفعيل/تعطيل حساب
  | 'users.email'       // تغيير البريد
  | 'users.password'    // رابط/تعيين كلمة مرور
  | 'users.notify'      // إرسال إشعار لمستخدم
  | 'users.broadcast'   // إشعار جماعي
  | 'users.invite'      // دعوة مستخدم جديد
  | 'plans.assign'      // تخصيص الباقة لكل سوق
  | 'roles.assign'      // منح/سحب الأدوار (الفريق)
  | 'activity.view'     // سجل حركات المستخدمين والإدارة

const MATRIX: Record<StaffRole, ReadonlySet<Permission>> = {
  admin: new Set<Permission>([
    'panel.view', 'users.view', 'users.profile', 'users.status', 'users.email', 'users.password',
    'users.notify', 'users.broadcast', 'users.invite', 'plans.assign', 'roles.assign', 'activity.view',
  ]),
  moderator: new Set<Permission>([
    'panel.view', 'users.view', 'users.profile', 'users.status',
    'users.notify', 'users.broadcast', 'users.invite', 'plans.assign',
  ]),
  support: new Set<Permission>([
    'panel.view', 'users.view', 'users.profile', 'users.notify',
  ]),
}

export function can(role: unknown, permission: Permission): boolean {
  const r = normalizeAccountRole(role)
  return r !== 'user' && MATRIX[r].has(permission)
}

/**
 * من يحق له التعديل على حساب بعينه: المالك على أي حساب غير مالك،
 * وغير المالك على المستخدمين العاديين فقط (لا يعدّل زميلاً في الفريق).
 */
export function canManageTarget(actorRole: unknown, targetRole: unknown): boolean {
  const actor = normalizeAccountRole(actorRole)
  const target = normalizeAccountRole(targetRole)
  if (actor === 'user') return false
  if (target === 'admin') return false
  if (actor === 'admin') return true
  return target === 'user'
}

/** الأدوار التي يحق للفاعل دعوة حساب جديد بها. */
export function invitableRoles(actorRole: unknown): AccountRole[] {
  const actor = normalizeAccountRole(actorRole)
  if (actor === 'admin') return GRANTABLE_ROLES
  if (can(actor, 'users.invite')) return ['user']
  return []
}
