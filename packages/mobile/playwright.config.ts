import { defineConfig, devices } from '@playwright/test'

// Local Supabase — well-known, non-secret dev keys (same values as
// packages/api/.env.test). The E2E servers MUST point here, never the cloud
// project. Injected into each webServer's env below; because the API does
// `import 'dotenv/config'` (which does not override existing process.env),
// these win over whatever .env holds — that is the safety boundary.
const SUPABASE_URL = 'http://localhost:54321'
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

// Dedicated E2E ports, deliberately off the dev ports (3100 web / 3101 api in
// the repo-root .env.local, 8081 Expo dev). `reuseExistingServer` below means
// a shared port would silently hand the suite your running dev API — which
// loads packages/api/.env.local and talks to the CLOUD project, defeating the
// safety boundary above. Sharing also left a local-Supabase API on :3101 after
// a run, so the phone showed seed data. Web E2E owns 3104/3105.
const API_PORT = '3102'
const WEB_PORT = '3103'
const WEB_URL = `http://localhost:${WEB_PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  // Safe because every spec provisions its own fixtures and asserts only on rows
  // it created — see docs/superpowers/specs/2026-07-26-e2e-coverage-audit-design.md.
  // A single spec reading a shared seeded account would corrupt other workers
  // mid-run, which is why this was `false` until that dependency was removed.
  fullyParallel: true,
  // 4 locally; 2 on CI, where the free ubuntu-latest runner has 2 cores and
  // oversubscribing turns timeouts into flake.
  workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 1 : 0,
  reporter: 'line',
  use: { baseURL: WEB_URL, trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter @splat-connect/api dev',
      url: `http://localhost:${API_PORT}/api/public/tutorials`,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      env: {
        SUPABASE_URL,
        SUPABASE_ANON_KEY: ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
        API_PORT,
        PORT: API_PORT,
        CORS_ORIGIN: WEB_URL,
      },
    },
    {
      // Serve a static production web build rather than the Metro dev server:
      // no HMR/dev overlays means fast, stable renders (the dev server's
      // transient overlays intercept clicks and cause flaky E2E). EXPO_PUBLIC_*
      // vars are baked in at export time from the env below.
      // --clear is load-bearing: EXPO_PUBLIC_* are inlined at transform time,
      // but Metro's per-module cache key does not include their values. A
      // module that has not changed since an earlier export is served from
      // cache with the OLD value frozen in, so the app silently calls a stale
      // API URL while the rest of the bundle looks correct. Costs a cold
      // transform each run; a wrong-backend E2E run costs far more.
      command: `pnpm exec expo export -p web --clear && pnpm exec serve -s dist -l ${WEB_PORT}`,
      url: WEB_URL,
      timeout: 300_000,
      reuseExistingServer: !process.env.CI,
      env: {
        EXPO_PUBLIC_SUPABASE_URL: SUPABASE_URL,
        EXPO_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY,
        EXPO_PUBLIC_API_URL: `http://localhost:${API_PORT}`,
      },
    },
  ],
})
