import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ترقب — النسخة المطورة',
  description: 'منصة تحليل عقود SPX Options',
}

export default function V2Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-navy-950 font-sans" dir="rtl">
      {children}
    </div>
  )
}
