'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner, Alert } from '@/components/ui'
import { UPDATE_TYPE_LABELS } from '@/lib/utils/constants'
import toast from 'react-hot-toast'

const UPDATE_TYPES = [
  { value: 'still_valid',         label: 'الإشارة لا تزال صالحة',     status: null,         color: 'text-teal-700 bg-teal-50 border-teal-200' },
  { value: 'move_to_watch',       label: 'تحويل إلى مراقبة',          status: 'watch',       color: 'text-blue-700 bg-blue-50 border-blue-200' },
  { value: 'entry_triggered',     label: 'تم تفعيل شرط الدخول',       status: 'active',      color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  { value: 'exit_triggered',      label: 'تم تفعيل شرط الخروج',       status: 'exit',        color: 'text-purple-700 bg-purple-50 border-purple-200' },
  { value: 'invalidated',         label: 'تم إبطال الإشارة',          status: 'invalidated', color: 'text-red-700 bg-red-50 border-red-200' },
  { value: 'closed',              label: 'إغلاق الإشارة ✓',           status: 'closed',      color: 'text-surface-700 bg-surface-100 border-surface-200' },
  { value: 'reduce_risk',         label: 'تخفيض المخاطرة',            status: null,          color: 'text-amber-700 bg-amber-50 border-amber-200' },
  { value: 'take_partial_profit', label: 'أخذ ربح جزئي',              status: null,          color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  { value: 'cancel_setup',        label: 'إلغاء الإعداد',             status: 'invalidated', color: 'text-red-700 bg-red-50 border-red-200' },
  { value: 'note',                label: 'ملاحظة',                    status: null,          color: 'text-surface-600 bg-surface-50 border-surface-200' },
]

export default function SignalUpdatePage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [updateType, setUpdateType] = useState('')
  const [content, setContent] = useState('')
  const [closeReason, setCloseReason] = useState('')
  const [wasPlanFollowed, setWasPlanFollowed] = useState<boolean | null>(null)
  const [postCloseNotes, setPostCloseNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isClosing = updateType === 'closed'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!updateType || !content.trim()) {
      setError('نوع التحديث والمحتوى مطلوبان')
      return
    }
    setError(null)
    setLoading(true)

    try {
      const body: any = {
        update_type: updateType,
        content,
        content_ar: content,
      }

      if (isClosing) {
        body.close_reason      = closeReason || null
        body.was_plan_followed = wasPlanFollowed
        body.post_close_notes  = postCloseNotes || null
      }

      const res = await fetch(`/api/signals/${params.id}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      toast.success('تم إضافة التحديث')
      router.push(`/admin/signals/${params.id}`)
      router.refresh()
    } catch (err: any) {
      setError(err.message || 'خطأ في الحفظ')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-5 md:p-6 max-w-2xl animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-surface-400 hover:text-navy-900">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-bold text-navy-900">إضافة تحديث للإشارة</h1>
          <p className="text-xs text-surface-400 mt-0.5">
            التحديث لا يمكن تعديله أو حذفه بعد الحفظ
          </p>
        </div>
      </div>

      {error && <Alert type="error" title="خطأ">{error}</Alert>}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5 mt-4">

        {/* Update Type */}
        <div className="card p-5">
          <label className="field-label">نوع التحديث *</label>
          <div className="grid grid-cols-2 gap-2">
            {UPDATE_TYPES.map(type => (
              <label key={type.value}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer
                  text-sm font-medium transition-all duration-150
                  ${updateType === type.value
                    ? `${type.color} ring-2 ring-teal-400 ring-offset-1`
                    : 'border-surface-200 text-surface-600 hover:border-surface-300 bg-white'}`}>
                <input type="radio" name="update_type" value={type.value}
                  checked={updateType === type.value}
                  onChange={() => setUpdateType(type.value)}
                  className="sr-only"
                />
                <span className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${
                  updateType === type.value ? 'border-teal-500 bg-teal-500' : 'border-surface-300'
                }`} />
                <span className="text-xs leading-tight">{type.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="card p-5">
          <label className="field-label">محتوى التحديث *</label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={4}
            required
            placeholder="أكتب التحديث بوضوح ودقة. هذا النص سيُعرض للمستخدمين..."
            className="field-input resize-none"
          />
          <div className="text-[11px] text-surface-400 mt-1">
            {content.length} حرف — يُنصح بالوضوح والإيجاز
          </div>
        </div>

        {/* Close Fields */}
        {isClosing && (
          <div className="card p-5 border-surface-300">
            <div className="text-sm font-bold text-navy-900 mb-4">تفاصيل الإغلاق</div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="field-label">سبب الإغلاق</label>
                <select value={closeReason}
                  onChange={e => setCloseReason(e.target.value)}
                  className="field-input">
                  <option value="">اختر السبب...</option>
                  <option value="profit_target_hit">بلوغ هدف الربح</option>
                  <option value="invalidation_hit">تحقق شرط الإبطال</option>
                  <option value="time_expired">انتهاء الوقت</option>
                  <option value="manual_exit">خروج يدوي</option>
                  <option value="no_entry">لم يتحقق شرط الدخول</option>
                </select>
              </div>
              <div>
                <label className="field-label">هل تم الالتزام بالخطة؟</label>
                <div className="flex gap-3 mt-1">
                  {[
                    { v: true,  l: 'نعم — تم الالتزام' },
                    { v: false, l: 'لا — تم الخروج مبكرًا' },
                  ].map(item => (
                    <label key={String(item.v)}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border cursor-pointer
                        text-sm font-medium transition-all
                        ${wasPlanFollowed === item.v
                          ? 'border-teal-400 bg-teal-50 text-teal-700'
                          : 'border-surface-200 text-surface-600 hover:border-surface-300'}`}>
                      <input type="radio" checked={wasPlanFollowed === item.v}
                        onChange={() => setWasPlanFollowed(item.v)} className="sr-only" />
                      {item.l}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="field-label">ملاحظات ما بعد الإغلاق</label>
                <textarea value={postCloseNotes}
                  onChange={e => setPostCloseNotes(e.target.value)}
                  rows={2} placeholder="دروس مستفادة، ملاحظات..."
                  className="field-input resize-none text-sm" />
              </div>
            </div>
          </div>
        )}

        {/* Warning */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
          ⚠ هذا التحديث لا يمكن حذفه أو تعديله بعد الحفظ. تأكد من المحتوى قبل المتابعة.
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => router.back()} className="btn-ghost">إلغاء</button>
          <button type="submit" disabled={loading || !updateType || !content.trim()}
            className="btn-primary gap-2">
            {loading ? <Spinner size="sm" /> : null}
            حفظ التحديث
          </button>
        </div>

      </form>
    </div>
  )
}
