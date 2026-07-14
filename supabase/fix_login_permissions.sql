GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

INSERT INTO user_profiles (id, email, role, is_active, subscription_tier)
SELECT id, email, 'admin'::user_role, true, 'alpha'::subscription_tier
FROM auth.users
WHERE email = 'mr.a.alfaifi@gmail.com'
ON CONFLICT (id) DO UPDATE
SET role = 'admin'::user_role,
    is_active = true,
    subscription_tier = 'alpha'::subscription_tier,
    updated_at = now();

INSERT INTO user_profiles (id, email, role, is_active, subscription_tier)
SELECT id, email, 'admin'::user_role, true, 'alpha'::subscription_tier
FROM auth.users
WHERE email = 'nif305@gmail.com'
ON CONFLICT (id) DO UPDATE
SET role = 'admin'::user_role,
    is_active = true,
    subscription_tier = 'alpha'::subscription_tier,
    updated_at = now();
