import type {
  SignalStatus, SignalStrategy, RiskLevel,
  MarketBias, SignalUpdateType, IndicatorCode,
  DecisionState, SignalStatusConfig, RiskLevelConfig
} from '@/lib/types'

// ── SIGNAL STATUS ────────────────────────────────────────────

export const SIGNAL_STATUS_CONFIG: Record<SignalStatus, SignalStatusConfig> = {
  draft: {
    label_ar: 'مسودة',
    label_en: 'Draft',
    color: 'text-surface-400',
    bgColor: 'bg-surface-100',
    borderColor: 'border-surface-200',
    dotColor: 'bg-surface-400',
  },
  pending_review: {
    label_ar: 'قيد المراجعة',
    label_en: 'Pending Review',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    dotColor: 'bg-amber-400',
  },
  published: {
    label_ar: 'منشور',
    label_en: 'Published',
    color: 'text-teal-700',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-200',
    dotColor: 'bg-teal-500',
  },
  watch: {
    label_ar: 'مراقبة',
    label_en: 'Watch',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    dotColor: 'bg-blue-500',
  },
  conditional: {
    label_ar: 'دخول مشروط',
    label_en: 'Conditional',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    dotColor: 'bg-amber-500',
  },
  active: {
    label_ar: 'إشارة نشطة',
    label_en: 'Active',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    dotColor: 'bg-emerald-500',
  },
  exit: {
    label_ar: 'خروج',
    label_en: 'Exit',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    dotColor: 'bg-purple-500',
  },
  invalidated: {
    label_ar: 'ملغاة',
    label_en: 'Invalidated',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    dotColor: 'bg-red-500',
  },
  closed: {
    label_ar: 'مغلقة',
    label_en: 'Closed',
    color: 'text-surface-600',
    bgColor: 'bg-surface-100',
    borderColor: 'border-surface-300',
    dotColor: 'bg-surface-500',
  },
  archived: {
    label_ar: 'مؤرشفة',
    label_en: 'Archived',
    color: 'text-surface-400',
    bgColor: 'bg-surface-50',
    borderColor: 'border-surface-200',
    dotColor: 'bg-surface-300',
  },
}

// ── RISK LEVEL ───────────────────────────────────────────────

export const RISK_LEVEL_CONFIG: Record<RiskLevel, RiskLevelConfig> = {
  low: {
    label_ar: 'منخفضة',
    label_en: 'Low',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
  },
  medium: {
    label_ar: 'متوسطة',
    label_en: 'Medium',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
  },
  high: {
    label_ar: 'عالية',
    label_en: 'High',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
  },
  extreme: {
    label_ar: 'قصوى',
    label_en: 'Extreme',
    color: 'text-red-700',
    bgColor: 'bg-red-50',
  },
}

// ── STRATEGY LABELS ──────────────────────────────────────────

export const STRATEGY_LABELS: Record<SignalStrategy, { ar: string; en: string }> = {
  bull_call_debit_spread: {
    ar: 'Bull Call Debit Spread — سبريد شراء صاعد',
    en: 'Bull Call Debit Spread',
  },
  bear_put_debit_spread: {
    ar: 'Bear Put Debit Spread — سبريد شراء هابط',
    en: 'Bear Put Debit Spread',
  },
  bull_put_credit_spread: {
    ar: 'Bull Put Credit Spread — سبريد بيع صاعد',
    en: 'Bull Put Credit Spread',
  },
  bear_call_credit_spread: {
    ar: 'Bear Call Credit Spread — سبريد بيع هابط',
    en: 'Bear Call Credit Spread',
  },
  long_call: {
    ar: 'Long Call — شراء خيار صعود',
    en: 'Long Call',
  },
  long_put: {
    ar: 'Long Put — شراء خيار هبوط',
    en: 'Long Put',
  },
}

// ── MARKET BIAS LABELS ───────────────────────────────────────

export const MARKET_BIAS_LABELS: Record<MarketBias, { ar: string; en: string; color: string }> = {
  bullish: {
    ar: 'صاعد',
    en: 'Bullish',
    color: 'text-emerald-700',
  },
  bearish: {
    ar: 'هابط',
    en: 'Bearish',
    color: 'text-red-700',
  },
  neutral: {
    ar: 'محايد',
    en: 'Neutral',
    color: 'text-surface-500',
  },
  mixed: {
    ar: 'متضارب',
    en: 'Mixed',
    color: 'text-amber-700',
  },
  risk_off: {
    ar: 'تجنب المخاطر',
    en: 'Risk-Off',
    color: 'text-red-700',
  },
}

// ── DECISION STATE LABELS ────────────────────────────────────

export const DECISION_STATE_LABELS: Record<DecisionState, { ar: string; en: string; color: string }> = {
  no_trade: {
    ar: 'لا تداول',
    en: 'No Trade',
    color: 'text-surface-500',
  },
  watch: {
    ar: 'مراقبة',
    en: 'Watch',
    color: 'text-blue-600',
  },
  conditional: {
    ar: 'دخول مشروط',
    en: 'Conditional Entry',
    color: 'text-amber-600',
  },
  active: {
    ar: 'إشارة نشطة',
    en: 'Active Signal',
    color: 'text-emerald-600',
  },
  exit: {
    ar: 'خروج',
    en: 'Exit',
    color: 'text-purple-600',
  },
  invalidated: {
    ar: 'ملغاة',
    en: 'Invalidated',
    color: 'text-red-600',
  },
}

// ── INDICATOR LABELS ─────────────────────────────────────────

export const INDICATOR_LABELS: Record<IndicatorCode, { ar: string; en: string }> = {
  market_regime:      { ar: 'حالة السوق',         en: 'Market Regime' },
  volatility_pressure:{ ar: 'ضغط التذبذب',        en: 'Volatility Pressure' },
  expected_move:      { ar: 'الحركة المتوقعة',    en: 'Expected Move' },
  intraday_momentum:  { ar: 'الزخم اللحظي',       en: 'Intraday Momentum' },
  options_liquidity:  { ar: 'جودة السيولة',        en: 'Options Liquidity' },
  theta_burn:         { ar: 'تآكل الوقت',          en: 'Theta Burn' },
  macro_event:        { ar: 'الأحداث الكلية',     en: 'Macro Events' },
}

// ── SIGNAL UPDATE TYPE LABELS ────────────────────────────────

export const UPDATE_TYPE_LABELS: Record<SignalUpdateType, { ar: string; en: string }> = {
  still_valid:        { ar: 'الإشارة لا تزال صالحة',     en: 'Still Valid' },
  move_to_watch:      { ar: 'تحويل إلى مراقبة',          en: 'Move to Watch' },
  entry_triggered:    { ar: 'تم تفعيل شرط الدخول',       en: 'Entry Triggered' },
  exit_triggered:     { ar: 'تم تفعيل شرط الخروج',       en: 'Exit Triggered' },
  invalidated:        { ar: 'تم إبطال الإشارة',          en: 'Invalidated' },
  closed:             { ar: 'إغلاق الإشارة',             en: 'Signal Closed' },
  reduce_risk:        { ar: 'تخفيض المخاطرة',            en: 'Reduce Risk' },
  take_partial_profit:{ ar: 'أخذ ربح جزئي',              en: 'Take Partial Profit' },
  cancel_setup:       { ar: 'إلغاء الإعداد',             en: 'Cancel Setup' },
  note:               { ar: 'ملاحظة',                    en: 'Note' },
}

// ── NUMBER FORMATTERS ────────────────────────────────────────

export function formatPrice(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined) return '—'
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function formatPercent(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}%`
}

export function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `${Math.round(value)}/100`
}

export function getScoreColor(score: number | null): string {
  if (score === null) return 'text-surface-400'
  if (score >= 70) return 'text-emerald-600'
  if (score >= 50) return 'text-amber-600'
  return 'text-red-600'
}

export function getScoreBgColor(score: number | null): string {
  if (score === null) return 'bg-surface-100'
  if (score >= 70) return 'bg-emerald-50'
  if (score >= 50) return 'bg-amber-50'
  return 'bg-red-50'
}

// ── DATE FORMATTERS ──────────────────────────────────────────

export function formatDate(date: string | null | undefined, lang: 'ar' | 'en' = 'ar'): string {
  if (!date) return '—'
  const d = new Date(date)
  return d.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateTime(date: string | null | undefined, lang: 'ar' | 'en' = 'ar'): string {
  if (!date) return '—'
  const d = new Date(date)
  return d.toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function timeAgo(date: string | null | undefined, lang: 'ar' | 'en' = 'ar'): string {
  if (!date) return '—'
  const now = new Date()
  const d = new Date(date)
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (lang === 'ar') {
    if (diffMins < 1) return 'الآن'
    if (diffMins < 60) return `منذ ${diffMins} دقيقة`
    if (diffHours < 24) return `منذ ${diffHours} ساعة`
    if (diffDays < 7) return `منذ ${diffDays} يوم`
    return formatDate(date, 'ar')
  } else {
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return formatDate(date, 'en')
  }
}
