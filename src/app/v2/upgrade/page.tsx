import { redirect } from 'next/navigation'

// صفحة الباقات صارت محايدة في /upgrade (خارج واجهة الأوبشن). الوسيط يحوّل هذا المسار
// قبل الوصول إلى هنا؛ هذا تحويل احتياطي فقط.
export default function LegacyUpgradeRedirect() {
  redirect('/upgrade?market=us')
}
