'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Spinner } from '@/components/ui'
import toast from 'react-hot-toast'

interface Prefs {
  email_signal_published:   boolean
  email_signal_updated:     boolean
  email_signal_closed:      boolean
  email_signal_invalidated: boolean
  email_daily_summary:      boolean
  email_weekly_report:      boolean
  telegram_enabled:         boolean
  telegram_chat_id:         string
}

const DEFAULT_PREFS: Prefs = {
  email_signal_published:   true,
  email_signal_updated:     true,
  email_signal_closed:      true,
  email_signal_invalidated: true,
  email_daily_summary:      false,
  email_weekly_report:      false,
  telegram_enabled:         false,
  telegram_chat_id:         '',
}

function Toggle({
  label, description, checked, onChange, disabled
}: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-surface-100 last:border-0">
      <div>
        <div className="text-sm font-medium text-navy-900">{label}</div>
        {description && <div className="text-xs text-surface-400 mt-0.5">{description}</div>}
        {disabled && <div className="text-[11px] text-amber-600 mt-0.5">قريبًا</div>}
      </div>
      <button
        type="button"
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${
          disabled ? 'opacity-40 cursor-not-allowed' :
          checked ? 'bg-teal-500' : 'bg-surface-300'
        }`}
      >
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all duration-200 ${
          checked ? 'right-0.5' : 'left-0.5'
        }`} />
      </button>
    </div>
  )
}

export default function NotificationsPage() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setUserId(user.id)
      supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setPrefs({
              email_signal_published:   data.email_signal_published   ?? true,
              email_signal_updated:     data.email_signal_updated     ?? true,
              email_signal_closed:      data.email_signal_closed      ?? true,
              email_signal_invalidated: data.email_signal_invalidated ?? true,
              email_daily_summary:      data.email_daily_summary      ?? false,
              email_weekly_report:      data.email_weekly_report      ?? false,
              telegram_enabled:         data.telegram_enabled         ?? false,
              telegram_chat_id:         data.telegram_chat_id         ?? '',
            })
          }
          setLoading(false)
        })
    })
  }, [])

  async function handleSave() {
    if (!userId) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from('notification_preferences')
      .upsert({ user_id: userId, ...prefs }, { onConflict: 'user_id' })

    if (error) {
      toast.error('خطأ في الحفظ')
    } else {
      toast.success('تم حفظ التفضيلات')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 max-w-lg animate-fade-in">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-navy-900">إعدادات التنبيهات</h1>
        <p className="text-xs text-surface-400 mt-0.5">
          تحكم في متى وكيف تتلقى إشعارات ترقّب
        </p>
      </div>

      {/* Email Notifications */}
      <div className="card p-5 mb-4">
        <div className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-1">
          البريد الإلكتروني
        </div>
        <Toggle
          label="نشر إشارة جديدة"
          description="إشعار فور نشر إشارة"
          checked={prefs.email_signal_published}
          onChange={v => setPrefs(p => ({ ...p, email_signal_published: v }))}
        />
        <Toggle
          label="تحديث الإشارة"
          description="إشعار عند إضافة أي تحديث"
          checked={prefs.email_signal_updated}
          onChange={v => setPrefs(p => ({ ...p, email_signal_updated: v }))}
        />
        <Toggle
          label="إغلاق الإشارة"
          description="إشعار عند إغلاق الإشارة وتوثيق النتيجة"
          checked={prefs.email_signal_closed}
          onChange={v => setPrefs(p => ({ ...p, email_signal_closed: v }))}
        />
        <Toggle
          label="إبطال الإشارة"
          description="إشعار فوري عند إبطال الإشارة"
          checked={prefs.email_signal_invalidated}
          onChange={v => setPrefs(p => ({ ...p, email_signal_invalidated: v }))}
        />
        <Toggle
          label="ملخص يومي"
          description="تقرير موجز في نهاية كل جلسة"
          checked={prefs.email_daily_summary}
          onChange={v => setPrefs(p => ({ ...p, email_daily_summary: v }))}
        />
        <Toggle
          label="تقرير أسبوعي"
          description="تقرير أداء أسبوعي كل أحد"
          checked={prefs.email_weekly_report}
          onChange={v => setPrefs(p => ({ ...p, email_weekly_report: v }))}
        />
      </div>

      {/* Telegram */}
      <div className="card p-5 mb-6 opacity-70">
        <div className="text-xs font-semibold text-surface-400 uppercase tracking-wide mb-1">
          Telegram
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3">
          <div className="text-xs text-amber-800">
            تنبيهات Telegram ستكون متاحة في الإصدار التالي من المنصة
          </div>
        </div>
        <Toggle
          label="تفعيل Telegram"
          description="تلقي التنبيهات على Telegram"
          checked={false}
          onChange={() => {}}
          disabled
        />
      </div>

      {/* Save */}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="btn-primary w-full justify-center gap-2"
      >
        {saving ? <Spinner size="sm" /> : null}
        حفظ التفضيلات
      </button>
    </div>
  )
}
