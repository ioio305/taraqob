import type { MetadataRoute } from 'next'

// تثبيت ترقب على الجوال كتطبيق (أضف إلى الشاشة الرئيسية)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ترقّب — منصة قرار عقود SPX',
    short_name: 'ترقّب',
    description: 'توصيات SPX بأسعار حقيقية، إدارة مخاطرة، ومساعد خروج — بصدق مثبت',
    start_url: '/v2',
    display: 'standalone',
    background_color: '#060D14',
    theme_color: '#0D1B2A',
    dir: 'rtl',
    lang: 'ar',
    icons: [
      { src: '/logo.png', sizes: '192x192', type: 'image/png' },
      { src: '/logo.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
