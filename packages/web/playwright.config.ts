import { defineConfig, devices } from '@playwright/test'
import {
  LOCAL_SUPABASE_URL as SUPABASE_URL,
  LOCAL_SUPABASE_ANON_KEY as ANON_KEY,
  LOCAL_SUPABASE_SERVICE_ROLE_KEY as SERVICE_ROLE_KEY,
} from '../../supabase/local-dev-keys'

// The E2E servers MUST point at local Supabase, never the cloud project.
// Injected into each webServer's env below; because both Next's built-in env
// loading and the API's `import 'dotenv/config'` do not override existing
// process.env, these win over whatever the packages' own .env.local files
// hold — that is the safety boundary.

// Dedicated E2E ports, deliberately off the dev ports (3100 web / 3101 api in
// the repo-root .env.local). `reuseExistingServer` below means a shared port
// would silently hand the suite your running dev servers — which load their
// own .env.local files and talk to the CLOUD project, defeating the safety
// boundary above. Mobile E2E owns 3102/3103.
const API_PORT = '3104'
const WEB_PORT = '3105'
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
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, grepInvert: /@responsive/ },
    {
      // The app reflows below `sm`: the nav drops its links to a second row, the
      // library grid steps down to two columns, dashboard rows wrap. Every other
      // test runs at desktop width, so none of them would notice a nav that
      // clips its own links.
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
      grep: /@responsive/,
    },
  ],
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
      // Build + serve a production bundle rather than `next dev`: the dev
      // server's HMR overlay intercepts clicks and causes flaky E2E (same
      // reasoning as packages/mobile/playwright.config.ts, adapted for Next).
      // NEXT_PUBLIC_* vars are inlined at build time, so they must be present
      // for both halves of this command.
      command:
        'pnpm --filter @splat-connect/web build && pnpm --filter @splat-connect/web start',
      url: WEB_URL,
      timeout: 180_000,
      reuseExistingServer: !process.env.CI,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY,
        API_URL: `http://localhost:${API_PORT}`,
        NEXT_PUBLIC_API_URL: `http://localhost:${API_PORT}`,
        PORT: WEB_PORT,
      },
    },
  ],
})
