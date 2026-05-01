import MarketSessionForm from '@/components/market/SessionForm'
import Link from 'next/link'

export default function NewSessionPage() {
  return (
    <div className="p-5 md:p-6 max-w-3xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/sessions"
          className="text-surface-400 hover:text-navy-900 transition-colors">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-navy-900">جلسة سوق جديدة</h1>
          <p className="text-xs text-surface-400 mt-0.5">أدخل بيانات الجلسة لبدء التحليل</p>
        </div>
      </div>
      <MarketSessionForm mode="create" redirectTo="/admin/sessions" />
    </div>
  )
}
