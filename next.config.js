/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', 'taraqob-five.vercel.app', 'taraqob.vercel.app'],
    },
  },
}

module.exports = nextConfig