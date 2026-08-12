import { defineConfig, devices } from '@playwright/test'

// Local Supabase — well-known, non-secret dev keys (same values as
// packages/api/.env.test and packages/mobile/playwright.config.ts). The E2E
// servers MUST point here, never the cloud project. Injected into each
// webServer's env below; because both Next's built-in env loading and the
// API's `import 'dotenv/config'` do not override existing process.env, these
// win over whatever the packages' own .env.local files hold — that is the
// safety boundary.
const SUPABASE_URL = 'http://localhost:54321'
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

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
  // reducedMotion: Playwright's auto-waiting is asymmetric — actions (click,
  // fill) wait for an element to stop moving, but queries do not. reflow.spec.ts
  // reads two boundingBox() values and asserts their y offsets match within 4px,
  // which a staggered grid mid-flight would exceed. Pinning the preference makes
  // geometry deterministic and exercises the path a real visitor with the OS
  // setting gets. components/reveal.tsx honours it, so reveals stay inert here.
  // reducedMotion via contextOptions, not a top-level use key — it is a
  // newContext option, and 1.61's UseOptions does not surface it directly.
  use: {
    baseURL: WEB_URL,
    trace: 'on-first-retry',
    contextOptions: { reducedMotion: 'reduce' },
  },
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
