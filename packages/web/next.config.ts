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
  // The phone reaches the dev server over Tailscale (see the mobile .env.local,
  // which pins the same IP). Next dev blocks cross-origin requests to its own
  // /_next assets from unlisted origins, which silently breaks hydration on
  // that host — nothing interactive works, and sign-in falls back to a native
  // GET submit. Update alongside the mobile .env.local if the IP changes.
  allowedDevOrigins: ['100.102.50.23'],
  // Runs before middleware, so /my-tutorials never reaches the route table.
  // Permanent: the page merged into /dashboard/tutorials, it did not move
  // temporarily. (/dashboard itself is the account hub, not the tutorial list.)
  async redirects() {
    return [
      { source: '/my-tutorials', destination: '/dashboard/tutorials', permanent: true },
      // 3D printing became a product pillar on 2026-08-20. This article was the
      // only real printing content on the site, so it moved out of Learn to
      // anchor the new section. Permanent: inbound links and search results
      // should follow it, not keep pointing at Learn.
      {
        source: '/learn/3d-printing-basics',
        destination: '/printing/basics',
        permanent: true,
      },
    ]
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
