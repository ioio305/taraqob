-- ============================================================
-- TARAQOB — Migration 004: Update Role System
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. إضافة الأدوار الجديدة للـ ENUM
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'moderator';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'free';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'pro';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'quant';

-- 2. تحديث المستخدمين القديمين
-- beta_user → free
UPDATE user_profiles SET role = 'free' WHERE role = 'beta_user';

-- analyst → moderator (يمكن تغييره لاحقاً)
UPDATE user_profiles SET role = 'moderator' WHERE role = 'analyst';

-- 3. تحديث جدول invitations
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'moderator' cascade;

-- 4. تحديث الـ RLS helper functions
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT get_my_role() = 'admin'
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_admin_or_moderator()
RETURNS BOOLEAN AS $$
  SELECT get_my_role() IN ('admin', 'moderator')
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_paid_user()
RETURNS BOOLEAN AS $$
  SELECT get_my_role() IN ('admin', 'moderator', 'pro', 'quant')
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- 5. تحديث default role للمستخدمين الجدد
ALTER TABLE user_profiles ALTER COLUMN role SET DEFAULT 'free';

-- 6. تحديث invitations default
ALTER TABLE invitations ALTER COLUMN role SET DEFAULT 'free';

-- تحقق
SELECT role, COUNT(*) as count
FROM user_profiles
GROUP BY role
ORDER BY count DESC;
