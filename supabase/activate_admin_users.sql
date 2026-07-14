INSERT INTO user_profiles (id, email, role, is_active, subscription_tier)
SELECT id, email, 'admin'::user_role, true, 'alpha'::subscription_tier
FROM auth.users
WHERE email IN ('nif305@gmail.com', 'mr.a.alfaifi@gmail.com')
ON CONFLICT (id) DO UPDATE
SET role = 'admin'::user_role,
    is_active = true,
    subscription_tier = 'alpha'::subscription_tier,
    updated_at = now();
