// ============================================================
// TARAQOB — Core TypeScript Types
// ============================================================

// ── USER TYPES ──────────────────────────────────────────────

export type UserRole = 'admin' | 'analyst' | 'beta_user'

export interface UserProfile {
  id: string
  email: string
  full_name: string | null
  full_name_ar: string | null
  role: UserRole
  is_active: boolean
  invited_by: string | null
  avatar_url: string | null
  preferences: UserPreferences
  joined_at: string
  last_seen_at: string | null
  created_at: string
  updated_at: string
}

export interface UserPreferences {
  language: 'ar' | 'en'
  theme: 'light' | 'dark'
}

// ── MARKET SESSION TYPES ─────────────────────────────────────

export type MarketBias = 'bullish' | 'bearish' | 'neutral' | 'mixed' | 'risk_off'
export type EventRisk = 'clear' | 'caution' | 'high_risk' | 'block'
export type VwapStatus = 'above' | 'below' | 'at'

export interface MarketSession {
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
  vwap_status: VwapStatus | null
  opening_range_high: number | null
  opening_range_low: number | null
  expected_move_upper: number | null
  expected_move_lower: number | null
  expected_move_points: number | null
  economic_event_risk: EventRisk
  market_bias: MarketBias | null
  notes: string | null
  ai_market_summary: string | null
  ai_summary_ar: string | null
  is_trading_day: boolean
  session_status: 'open' | 'closed' | 'holiday'
  created_by: string | null
  created_at: string
  updated_at: string
}

// ── INDICATOR TYPES ──────────────────────────────────────────

export type IndicatorCode =
  | 'market_regime'
  | 'volatility_pressure'
  | 'expected_move'
  | 'intraday_momentum'
  | 'options_liquidity'
  | 'theta_burn'
  | 'macro_event'

export interface IndicatorDefinition {
  id: string
  code: IndicatorCode
  name_ar: string
  name_en: string
  description_ar: string | null
  description_en: string | null
  default_weight: number
  sort_order: number
  is_active: boolean
}

export interface IndicatorScore {
  id: string
  session_id: string
  indicator_id: string
  score: number | null
  status: string | null
  status_ar: string | null
  weight: number | null
  inputs: Record<string, unknown>
  interpretation: string | null
  interpretation_ar: string | null
  supports_entry: boolean | null
  blocks_entry: boolean | null
  block_reason: string | null
  analyst_notes: string | null
  ai_explanation: string | null
  ai_explanation_ar: string | null
  last_updated_by: string | null
  created_at: string
  updated_at: string
  // Joined
  indicator?: IndicatorDefinition
}

// ── CONTRACT TYPES ───────────────────────────────────────────

export type ContractType = 'call' | 'put'
export type ContractQuality = 'good' | 'acceptable' | 'weak' | 'avoid'
export type ExecutionRisk = 'low' | 'medium' | 'high'

export interface OptionContract {
  id: string
  session_id: string
  contract_type: ContractType
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
  contract_quality: ContractQuality | null
  execution_risk: ExecutionRisk | null
  notes: string | null
  is_selected: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

// ── SIGNAL TYPES ─────────────────────────────────────────────

export type SignalStatus =
  | 'draft'
  | 'pending_review'
  | 'published'
  | 'watch'
  | 'conditional'
  | 'active'
  | 'exit'
  | 'invalidated'
  | 'closed'
  | 'archived'

export type SignalDirection = 'bullish' | 'bearish' | 'neutral'

export type SignalStrategy =
  | 'bull_call_debit_spread'
  | 'bear_put_debit_spread'
  | 'bull_put_credit_spread'
  | 'bear_call_credit_spread'
  | 'long_call'
  | 'long_put'

export type RiskLevel = 'low' | 'medium' | 'high' | 'extreme'

export type DecisionState =
  | 'no_trade'
  | 'watch'
  | 'conditional'
  | 'active'
  | 'exit'
  | 'invalidated'

export interface Signal {
  id: string
  signal_ref: string
  session_id: string | null
  asset: string
  direction: SignalDirection | null
  strategy: SignalStrategy | null
  status: SignalStatus
  market_bias: MarketBias | null
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
  risk_level: RiskLevel | null
  confidence_score: number | null
  composite_indicator_score: number | null
  decision_state: DecisionState | null
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
  close_reason: string | null
  was_plan_followed: boolean | null
  post_close_notes: string | null
  created_at: string
  updated_at: string
  // Joined
  session?: MarketSession
  selected_contract?: OptionContract
  updates?: SignalUpdate[]
  result?: SignalResult
}

// ── SIGNAL UPDATE TYPES ──────────────────────────────────────

export type SignalUpdateType =
  | 'still_valid'
  | 'move_to_watch'
  | 'entry_triggered'
  | 'exit_triggered'
  | 'invalidated'
  | 'closed'
  | 'reduce_risk'
  | 'take_partial_profit'
  | 'cancel_setup'
  | 'note'

export interface SignalUpdate {
  id: string
  signal_id: string
  update_type: SignalUpdateType
  new_status: SignalStatus | null
  content: string
  content_ar: string | null
  is_notified: boolean
  notified_at: string | null
  created_by: string | null
  created_at: string
  // Joined
  author?: UserProfile
}

// ── SIGNAL RESULT TYPES ──────────────────────────────────────

export type SignalOutcome = 'win' | 'loss' | 'breakeven' | 'invalidated' | 'no_entry'

export interface SignalResult {
  id: string
  signal_id: string
  outcome: SignalOutcome
  pnl_percent: number | null
  entry_price_actual: number | null
  exit_price_actual: number | null
  max_adverse_move: number | null
  duration_minutes: number | null
  rule_adherence_score: number | null
  post_analysis: string | null
  post_analysis_ar: string | null
  recorded_by: string | null
  created_at: string
}

// ── DECISION ENGINE TYPES ────────────────────────────────────

export interface DecisionEngineOutput {
  decision: DecisionState
  composite_score: number
  blocking_rules: string[]
  supporting_indicators: IndicatorCode[]
  warning_indicators: IndicatorCode[]
  conflict_score: number
  conflict_detected: boolean
  confidence: number
  rationale_points: string[]
  rationale_points_ar: string[]
  timestamp: string
}

// ── PERFORMANCE TYPES ────────────────────────────────────────

export interface PerformanceSnapshot {
  id: string
  snapshot_date: string
  period: 'daily' | 'weekly' | 'monthly' | 'all_time'
  total_signals: number
  closed_signals: number
  open_signals: number
  invalidated_signals: number
  no_entry_signals: number
  win_count: number
  loss_count: number
  win_rate: number | null
  avg_gain_percent: number | null
  avg_loss_percent: number | null
  max_drawdown: number | null
  avg_duration_minutes: number | null
  rule_adherence_rate: number | null
  best_strategy: SignalStrategy | null
  worst_strategy: SignalStrategy | null
  breakdown_by_strategy: Record<string, unknown>
  breakdown_by_regime: Record<string, unknown>
  breakdown_by_risk_level: Record<string, unknown>
  ai_weekly_report: string | null
  ai_weekly_report_ar: string | null
  created_at: string
}

// ── UI HELPER TYPES ──────────────────────────────────────────

export interface SignalStatusConfig {
  label_ar: string
  label_en: string
  color: string
  bgColor: string
  borderColor: string
  dotColor: string
}

export interface RiskLevelConfig {
  label_ar: string
  label_en: string
  color: string
  bgColor: string
}

// Audit Log
export interface AuditLog {
  id: string
  actor_id: string | null
  actor_email: string | null
  action: string
  entity_type: string
  entity_id: string | null
  entity_ref: string | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
  actor?: UserProfile
}
