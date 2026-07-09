import type { NextConfig } from 'next'

// API_PORT comes from the repo-root .env.local (loaded by the `dev` script via
// dotenv-cli) — API_URL / NEXT_PUBLIC_API_URL derive from it unless overridden.
const apiPort = process.env.API_PORT ?? '3101'

const nextConfig: NextConfig = {
  env: {
    API_URL: process.env.API_URL ?? `http://localhost:${apiPort}`,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? `http://localhost:${apiPort}`,
  },
  typedRoutes: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

export default nextConfig
