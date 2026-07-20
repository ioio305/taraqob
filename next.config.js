/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        'trqob.com',
        'www.trqob.com',
        'taraqob.vercel.app',
        'taraqob.netlify.app',
      ],
    },
  },
}

module.exports = nextConfig
