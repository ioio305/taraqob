/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', 'taraqob.vercel.app'],
    },
  },
  images: {
    remotePatterns: [],
  },
}

module.exports = nextConfig
