import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'ترقّب — قرارات تداول أوضح',
    template: '%s | ترقّب',
  },
  description: 'منصات مستقلة لخيارات SPX والشركات والصناديق، تجمع التوصية والتحليل وخطة الدخول والهدف والوقف في مكان واحد.',
  keywords: ['SPX Options', 'خيارات الأسهم', 'خيارات الصناديق', 'دعم القرار', 'عقود الخيارات'],
  authors: [{ name: 'ترقّب' }],
  robots: 'index, follow',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
  openGraph: {
    title: 'ترقّب — منصة دعم القرار',
    description: 'توصية وتحليل وخطة تداول لخيارات SPX والشركات والصناديق.',
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
