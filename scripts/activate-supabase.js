const fs = require('fs')
const { createClient } = require('@supabase/supabase-js')

function loadEnv() {
  const path = '.env.local'
  if (!fs.existsSync(path)) throw new Error('.env.local غير موجود')
  return Object.fromEntries(
    fs.readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .filter(line => line && !line.trim().startsWith('#') && line.includes('='))
      .map(line => {
        const i = line.indexOf('=')
        return [line.slice(0, i).trim(), line.slice(i + 1).trim()]
      })
  )
}

async function main() {
  const env = loadEnv()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('مفاتيح Supabase غير مكتملة في .env.local')

  const host = new URL(url).host
  console.log(`Supabase host: ${host}`)

  try {
    await fetch(`${url}/rest/v1/`, { headers: { apikey: serviceKey } })
  } catch (err) {
    throw new Error(`لا يمكن الوصول إلى مشروع Supabase (${host}). حدّث NEXT_PUBLIC_SUPABASE_URL والمفاتيح أولاً.`)
  }

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })
  const requiredTables = ['user_profiles', 'v2_signals', 'notifications', 'invitations']

  for (const table of requiredTables) {
    const { error, count } = await supabase.from(table).select('*', { count: 'exact', head: true })
    if (error) {
      console.log(`MISSING ${table}: ${error.message}`)
    } else {
      console.log(`OK ${table}: ${count ?? 0}`)
    }
  }

  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (usersError) throw new Error(`تعذر قراءة مستخدمي Auth: ${usersError.message}`)

  const users = usersData.users
  if (users.length === 0) {
    console.log('لا يوجد مستخدمون في Supabase Auth بعد.')
    return
  }

  const { data: profiles, error: profilesError } = await supabase
    .from('user_profiles')
    .select('id')
    .in('id', users.map(u => u.id))

  if (profilesError) {
    console.log('تعذر قراءة user_profiles. شغّل supabase/activate_database.sql أولاً.')
    throw new Error(profilesError.message)
  }

  const existing = new Set((profiles ?? []).map(p => p.id))
  const missing = users.filter(user => !existing.has(user.id))
  if (missing.length === 0) {
    console.log('كل مستخدمي Auth لديهم user_profiles. قاعدة الدخول جاهزة.')
    return
  }

  const rows = missing.map(user => ({
    id: user.id,
    email: user.email,
    is_active: true,
  }))

  const { error: insertError } = await supabase.from('user_profiles').insert(rows)
  if (insertError) throw new Error(`تعذر إنشاء البروفايلات الناقصة: ${insertError.message}`)
  console.log(`تم إنشاء ${rows.length} بروفايل ناقص. جرّب تسجيل الدخول الآن.`)
}

main().catch(err => {
  console.error(`ERROR: ${err.message}`)
  process.exit(1)
})
