import type { NextConfig } from 'next'
import path from 'node:path'

// API_PORT comes from the repo-root .env.local (loaded by the `dev` script via
// dotenv-cli) — API_URL / NEXT_PUBLIC_API_URL derive from it unless overridden.
const apiPort = process.env.API_PORT ?? '3101'

const nextConfig: NextConfig = {
  // Pin the workspace root to the monorepo. Without this, a stray lockfile
  // higher up the tree (e.g. ~/package-lock.json) makes Next infer the wrong
  // root and turbopack mis-resolves the pnpm-stored native CSS binaries.
  turbopack: {
    root: path.join(import.meta.dirname, '..', '..'),
  },
  env: {
    API_URL: process.env.API_URL ?? `http://localhost:${apiPort}`,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? `http://localhost:${apiPort}`,
  },
  typedRoutes: true,
  // Runs before middleware, so /my-tutorials never reaches the route table.
  // Permanent: the page merged into /dashboard, it did not move temporarily.
  async redirects() {
    return [{ source: '/my-tutorials', destination: '/dashboard', permanent: true }]
  },
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
