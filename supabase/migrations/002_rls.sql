-- ============================================================
-- TARAQOB PLATFORM — RLS POLICIES
-- Migration 002: Row Level Security
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE user_profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations              ENABLE ROW LEVEL SECURITY;
ALTER TABLE economic_events          ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_sessions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE indicator_definitions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE indicator_scores         ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_rules               ENABLE ROW LEVEL SECURITY;
ALTER TABLE option_contracts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE signals                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_updates           ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_results           ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_snapshots    ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs               ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS user_role AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT get_my_role() = 'admin'
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_analyst_or_admin()
RETURNS BOOLEAN AS $$
  SELECT get_my_role() IN ('admin', 'analyst')
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================================
-- USER PROFILES
-- ============================================================

-- Users can read their own profile
CREATE POLICY "user_profiles_read_own" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

-- Admin can read all profiles
CREATE POLICY "user_profiles_admin_read_all" ON user_profiles
  FOR SELECT USING (is_admin());

-- Users can update their own profile (limited fields)
CREATE POLICY "user_profiles_update_own" ON user_profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admin can update any profile
CREATE POLICY "user_profiles_admin_update" ON user_profiles
  FOR UPDATE USING (is_admin());

-- System creates profile on signup (via trigger, uses service role)
CREATE POLICY "user_profiles_insert_trigger" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================================
-- INVITATIONS
-- ============================================================

CREATE POLICY "invitations_admin_all" ON invitations
  FOR ALL USING (is_admin());

-- Allow reading invitation by token (for signup flow)
CREATE POLICY "invitations_read_by_token" ON invitations
  FOR SELECT USING (true); -- filtered in application layer

-- ============================================================
-- ECONOMIC EVENTS
-- ============================================================

CREATE POLICY "economic_events_read_authenticated" ON economic_events
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "economic_events_write_internal" ON economic_events
  FOR ALL USING (is_analyst_or_admin());

-- ============================================================
-- MARKET SESSIONS
-- ============================================================

-- All authenticated users can read sessions
CREATE POLICY "market_sessions_read_all" ON market_sessions
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only admin/analyst can create/update
CREATE POLICY "market_sessions_write_internal" ON market_sessions
  FOR INSERT WITH CHECK (is_analyst_or_admin());

CREATE POLICY "market_sessions_update_internal" ON market_sessions
  FOR UPDATE USING (is_analyst_or_admin());

-- ============================================================
-- INDICATOR DEFINITIONS
-- ============================================================

-- All authenticated users can read definitions
CREATE POLICY "indicator_defs_read_all" ON indicator_definitions
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only admin can modify definitions
CREATE POLICY "indicator_defs_admin_write" ON indicator_definitions
  FOR ALL USING (is_admin());

-- ============================================================
-- INDICATOR SCORES
-- ============================================================

-- Only admin/analyst can see raw scores
CREATE POLICY "indicator_scores_internal_read" ON indicator_scores
  FOR SELECT USING (is_analyst_or_admin());

CREATE POLICY "indicator_scores_internal_write" ON indicator_scores
  FOR ALL USING (is_analyst_or_admin());

-- ============================================================
-- RISK RULES
-- ============================================================

CREATE POLICY "risk_rules_read_all" ON risk_rules
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "risk_rules_admin_write" ON risk_rules
  FOR ALL USING (is_admin());

-- ============================================================
-- OPTION CONTRACTS
-- ============================================================

-- Only admin/analyst can see/manage contracts
CREATE POLICY "contracts_internal_read" ON option_contracts
  FOR SELECT USING (is_analyst_or_admin());

CREATE POLICY "contracts_internal_write" ON option_contracts
  FOR ALL USING (is_analyst_or_admin());

-- ============================================================
-- SIGNALS
-- ============================================================

-- Beta users can only see published signals (not draft/pending)
CREATE POLICY "signals_beta_read" ON signals
  FOR SELECT USING (
    get_my_role() = 'beta_user'
    AND status NOT IN ('draft', 'pending_review', 'archived')
  );

-- Admin/Analyst can see all signals
CREATE POLICY "signals_internal_read" ON signals
  FOR SELECT USING (is_analyst_or_admin());

-- Admin/Analyst can create signals
CREATE POLICY "signals_create" ON signals
  FOR INSERT WITH CHECK (is_analyst_or_admin());

-- Admin/Analyst can update signals (with business logic in app layer)
CREATE POLICY "signals_internal_update" ON signals
  FOR UPDATE USING (is_analyst_or_admin());

-- Only admin can archive
CREATE POLICY "signals_admin_archive" ON signals
  FOR UPDATE USING (
    is_admin() AND NEW.status = 'archived'
  );

-- ============================================================
-- SIGNAL UPDATES
-- ============================================================

-- Beta users can read updates for published signals only
CREATE POLICY "signal_updates_beta_read" ON signal_updates
  FOR SELECT USING (
    get_my_role() = 'beta_user'
    AND EXISTS (
      SELECT 1 FROM signals s
      WHERE s.id = signal_id
      AND s.status NOT IN ('draft', 'pending_review', 'archived')
    )
  );

-- Admin/Analyst can read all updates
CREATE POLICY "signal_updates_internal_read" ON signal_updates
  FOR SELECT USING (is_analyst_or_admin());

-- Admin/Analyst can insert updates (NO update/delete — enforced by trigger)
CREATE POLICY "signal_updates_insert" ON signal_updates
  FOR INSERT WITH CHECK (is_analyst_or_admin());

-- ============================================================
-- SIGNAL RESULTS
-- ============================================================

-- All authenticated users can read results (for performance tracker)
CREATE POLICY "signal_results_read_all" ON signal_results
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only admin can write results
CREATE POLICY "signal_results_admin_write" ON signal_results
  FOR ALL USING (is_admin());

-- ============================================================
-- PERFORMANCE SNAPSHOTS
-- ============================================================

-- All authenticated users can read performance
CREATE POLICY "performance_read_all" ON performance_snapshots
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only admin can write snapshots
CREATE POLICY "performance_admin_write" ON performance_snapshots
  FOR ALL USING (is_admin());

-- ============================================================
-- NOTIFICATION PREFERENCES
-- ============================================================

-- Users can manage their own preferences
CREATE POLICY "notif_prefs_own" ON notification_preferences
  FOR ALL USING (user_id = auth.uid());

-- Admin can read all
CREATE POLICY "notif_prefs_admin_read" ON notification_preferences
  FOR SELECT USING (is_admin());

-- ============================================================
-- NOTIFICATION LOG
-- ============================================================

-- Users can read their own notifications
CREATE POLICY "notif_log_own_read" ON notification_log
  FOR SELECT USING (user_id = auth.uid());

-- Admin can read all
CREATE POLICY "notif_log_admin_read" ON notification_log
  FOR SELECT USING (is_admin());

-- System inserts (service role)
CREATE POLICY "notif_log_insert" ON notification_log
  FOR INSERT WITH CHECK (is_admin());

-- ============================================================
-- AUDIT LOGS
-- ============================================================

-- Only admin can read audit logs
CREATE POLICY "audit_admin_read" ON audit_logs
  FOR SELECT USING (is_admin());

-- System inserts audit logs (service role bypasses RLS)
-- Application uses service role client for audit logging
