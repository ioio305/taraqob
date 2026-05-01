'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Spinner } from '@/components/ui'
import toast from 'react-hot-toast'

interface SignalActionsProps {
  signalId: string
  signalRef: string
  currentStatus: string
  isPending: boolean
  isDraft: boolean
  isPublished: boolean
  isClosed: boolean
}

export default function SignalActions({
  signalId, signalRef, currentStatus, isPending, isDraft, isPublished, isClosed
}: SignalActionsProps) {
  const router = useRouter()
  const [publishing, setPublishing] = useState(false)
  const [rejecting, setRejecting] = useState(false)

  async function handlePublish() {
    if (!confirm(`هل أنت متأكد من نشر الإشارة ${signalRef}؟\n\nبعد النشر لا يمكن تعديلها.`)) return
    setPublishing(true)
    try {
      const res = await fetch(`/api/signals/${signalId}/publish`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        const errorMsg = data.fields ? `${data.error}:\n${data.fields.join('\n')}` : data.error
        toast.error(errorMsg)
        return
      }
      toast.success(`تم نشر الإشارة ${signalRef} ✓`)
      router.refresh()
    } catch {
      toast.error('خطأ في النشر')
    } finally {
      setPublishing(false)
    }
  }

  async function handleReject() {
    const reason = window.prompt('سبب الرفض (سيُرسل للمحلل):')
    if (!reason) return
    setRejecting(true)
    try {
      const res = await fetch(`/api/signals/${signalId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'draft' }),
      })
      if (!res.ok) throw new Error()

      // Add update note
      await fetch(`/api/signals/${signalId}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          update_type: 'note',
          content: `تم إعادة المسودة للمراجعة: ${reason}`,
          content_ar: `تم إعادة المسودة للمراجعة: ${reason}`,
        }),
      })

      toast.success('تم إرجاع الإشارة للمحلل')
      router.refresh()
    } catch {
      toast.error('خطأ في الرفض')
    } finally {
      setRejecting(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      {/* Publish Button */}
      {(isPending || isDraft) && !isClosed && (
        <>
          {isPending && (
            <button
              onClick={handleReject}
              disabled={rejecting}
              className="btn-secondary btn-sm gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              {rejecting ? <Spinner size="sm" /> : null}
              إرجاع للمحلل
            </button>
          )}
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="btn-primary btn-sm gap-1.5 bg-emerald-600 hover:bg-emerald-700"
          >
            {publishing ? <Spinner size="sm" /> : (
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
            )}
            {publishing ? 'جارٍ النشر...' : 'نشر الإشارة'}
          </button>
        </>
      )}

      {/* Add Update Button (for published signals) */}
      {isPublished && !isClosed && (
        <a
          href={`/admin/signals/${signalId}/update`}
          className="btn-secondary btn-sm gap-1.5"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          إضافة تحديث
        </a>
      )}
    </div>
  )
}
