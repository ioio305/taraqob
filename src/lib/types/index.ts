// ============================================================
// TARAQOB — Types
// Updated Role System
// ============================================================

export type UserRole = 'admin' | 'moderator' | 'free' | 'pro' | 'quant'

export type UserProfile = {
  id:           string
  email:        string
  full_name:    string | null
  full_name_ar: string | null
  role:         UserRole
  is_active:    boolean
  invited_by:   string | null
  avatar_url:   string | null
  preferences:  { language: string; theme: string }
  joined_at:    string
  last_seen_at: string | null
  created_at:   string
  updated_at:   string
}

export type PlanFeatures = {
  indicators:     number   // كم مؤشر يرى
  entryZone:      boolean  // منطقة الدخول
  exitTarget:     boolean  // هدف الخروج
  stopLoss:       boolean  // وقف الخسارة
  holdDays:       boolean  // مدة الاحتفاظ
  riskProfile:    boolean  // تصنيف المخاطرة
  breakEven:      boolean  // معادلة التعادل
  compareContracts: boolean // مقارنة العقود
  sharedRooms:    boolean  // غرف مشتركة
  alerts:         boolean  // تنبيهات
  history:        boolean  // سجل التحليلات
  unlimited:      boolean  // تحليلات غير محدودة
}

export const PLAN_FEATURES: Record<UserRole, PlanFeatures> = {
  admin: {
    indicators: 10, entryZone: true, exitTarget: true, stopLoss: true,
    holdDays: true, riskProfile: true, breakEven: true, compareContracts: true,
    sharedRooms: true, alerts: true, history: true, unlimited: true,
  },
  moderator: {
    indicators: 10, entryZone: true, exitTarget: true, stopLoss: true,
    holdDays: true, riskProfile: true, breakEven: true, compareContracts: true,
    sharedRooms: true, alerts: true, history: true, unlimited: true,
  },
  free: {
    indicators: 10, entryZone: true, exitTarget: true, stopLoss: false,
    holdDays: false, riskProfile: false, breakEven: false, compareContracts: false,
    sharedRooms: false, alerts: false, history: false, unlimited: false,
  },
  pro: {
    indicators: 10, entryZone: true, exitTarget: true, stopLoss: true,
    holdDays: true, riskProfile: true, breakEven: false, compareContracts: true,
    sharedRooms: false, alerts: true, history: true, unlimited: true,
  },
  quant: {
    indicators: 10, entryZone: true, exitTarget: true, stopLoss: true,
    holdDays: true, riskProfile: true, breakEven: true, compareContracts: true,
    sharedRooms: true, alerts: true, history: true, unlimited: true,
  },
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin:     'مدير النظام',
  moderator: 'مشرف',
  free:      'مجاني',
  pro:       'محترف',
  quant:     'متقدم',
}

export const ROLE_COLORS: Record<UserRole, string> = {
  admin:     'text-gold-700 bg-gold-50 border-gold-200',
  moderator: 'text-purple-700 bg-purple-50 border-purple-200',
  free:      'text-surface-600 bg-surface-50 border-surface-200',
  pro:       'text-teal-700 bg-teal-50 border-teal-200',
  quant:     'text-navy-700 bg-navy-50 border-navy-200',
}

// Legacy types kept for compatibility
export type Signal = {
  id: string
  signal_ref: string | null
  session_id: string | null
  asset: string
  direction: string | null
  strategy: string | null
  status: string
  market_bias: string | null
  entry_condition: string | null
  entry_range_low: number | null
  entry_range_high: number | null
  entry_notes: string | null
  entry_notes_ar: string | null
  invalidation_level: number | null
  invalidation_condition: string | null
  invalidation_condition_ar: string | null
  exit_plan: string | null
  exit_plan_ar: string | null
  profit_target: number | null
  max_risk_percent: number | null
  risk_level: string | null
  confidence_score: number | null
  composite_indicator_score: number | null
  decision_state: string | null
  rationale: string | null
  ai_generated_summary: string | null
  user_summary: string | null
  user_summary_ar: string | null
  analyst_notes: string | null
  selected_contract_id: string | null
  expiry: string | null
  indicator_snapshot: Record<string, unknown>
  decision_engine_output: Record<string, unknown>
  market_snapshot: Record<string, unknown>
  risk_rules_check: Record<string, unknown>
  created_by: string | null
  submitted_by: string | null
  submitted_at: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  published_by: string | null
  published_at: string | null
  closed_by: string | null
  closed_at: string | null
  archived_by: string | null
  archived_at: string | null
  close_reason: string | null
  was_plan_followed: boolean | null
  post_close_notes: string | null
  created_at: string
  updated_at: string
}

export type MarketSession = {
  id: string
  session_date: string
  spx_open: number | null
  spx_high: number | null
  spx_low: number | null
  spx_close: number | null
  spx_previous_close: number | null
  spx_change_percent: number | null
  vix: number | null
  vwap_level: number | null
  vwap_status: string | null
  opening_range_high: number | null
  opening_range_low: number | null
  expected_move_upper: number | null
  expected_move_lower: number | null
  expected_move_points: number | null
  economic_event_risk: string
  market_bias: string | null
  notes: string | null
  ai_market_summary: string | null
  ai_summary_ar: string | null
  is_trading_day: boolean
  session_status: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export type SignalUpdate = {
  id: string
  signal_id: string
  update_type: string
  new_status: string | null
  content: string
  content_ar: string | null
  is_notified: boolean
  notified_at: string | null
  created_by: string | null
  created_at: string
}

export type OptionContract = {
  id: string
  session_id: string
  contract_type: string
  expiry: string
  dte: number | null
  strike: number
  bid: number | null
  ask: number | null
  mid: number | null
  last_price: number | null
  delta: number | null
  gamma: number | null
  theta: number | null
  vega: number | null
  iv: number | null
  iv_rank: number | null
  volume: number | null
  open_interest: number | null
  liquidity_score: number | null
  contract_quality: string | null
  execution_risk: string | null
  notes: string | null
  is_selected: boolean | null
  created_by: string | null
  created_at: string
  updated_at: string
}
