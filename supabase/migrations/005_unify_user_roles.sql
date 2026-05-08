-- Migration: Unify all non-staff roles into a single 'user' role
-- Run this in Supabase SQL Editor to permanently fix the role enum

-- Step 1: Add 'user' to the enum (safe if already exists)
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'user';

-- Step 2: Collapse all legacy role variants to 'user'
-- (free, pro, quant, beta_user, analyst → user)
UPDATE user_profiles
SET role = 'user'
WHERE role IN ('free', 'pro', 'quant', 'beta_user', 'analyst');

-- Step 3: Update the default for new rows
ALTER TABLE user_profiles ALTER COLUMN role SET DEFAULT 'user';

-- Step 4: Update invitations default if column exists
UPDATE invitations SET role = 'user' WHERE role IN ('free', 'pro', 'quant', 'beta_user', 'analyst');
