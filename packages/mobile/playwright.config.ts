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

const API_PORT = '3101'
const WEB_PORT = '8081'
const WEB_URL = `http://localhost:${WEB_PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
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
      command: `pnpm exec expo export -p web && pnpm exec serve -s dist -l ${WEB_PORT}`,
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
