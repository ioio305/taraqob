import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'ترقّب — منصة دعم القرار لعقود SPX Options',
    template: '%s | ترقّب',
  },
  description: 'منصة دعم قرار لعقود SPX Options، ترصد حركة السوق، تقرأ المؤشرات، وتصدر إشارات موثقة عند اكتمال شروط الدخول والخروج والمخاطرة.',
  keywords: ['SPX Options', 'دعم القرار', 'تحليل فني', 'إشارات موثقة', 'عقود الخيارات'],
  authors: [{ name: 'ترقّب' }],
  robots: 'noindex, nofollow', // Beta — not indexed
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
  openGraph: {
    title: 'ترقّب — منصة دعم القرار',
    description: 'إشارات موثقة لعقود المؤشرات',
    type: 'website',
    locale: 'ar_SA',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="icon" href="/logo.png" type="image/png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 4000,
            style: {
              fontFamily: 'IBM Plex Sans Arabic, sans-serif',
              fontSize: '14px',
              direction: 'rtl',
              borderRadius: '10px',
              border: '1px solid #E2E8F0',
              boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            },
            success: {
              iconTheme: { primary: '#2A7B75', secondary: '#fff' },
            },
            error: {
              iconTheme: { primary: '#DC2626', secondary: '#fff' },
            },
          }}
        />
      </body>
    </html>
  )
}
