export default function Loading() {
  return (
    <div className="min-h-[55vh] animate-pulse space-y-5 p-5" dir="rtl" aria-label="جارٍ تحميل الصفحة">
      <div className="h-8 w-48 rounded-lg" style={{ background: 'rgba(255,255,255,.08)' }} />
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-32 rounded-2xl" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.06)' }} />
        ))}
      </div>
      <div className="h-72 rounded-2xl" style={{ background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.06)' }} />
    </div>
  )
}
