/**
 * Mobile parity: the app's web export at phone size against the mobile
 * artboard, over app-screen-map.json, into app-parity-report.json. The loop
 * is harness.js, shared with run.js (web). Run from packages/web (Playwright
 * resolves there), with ./scripts/parity/stack.sh up.
 *
 *   node ../../scripts/parity/app.js [--id a,b | --group push | --failing | --shots]
 *
 * The web export cannot see safe areas (react-native-web reports
 * insets.top = 0), native sheets or native fonts; app-shots.js is the picture
 * pass for those.
 */
const path = require('path')
const { runParity } = require('./harness')
const { signInApp, dismissIntro } = require('./auth')
const { resolveAppRoute } = require('./app-routes')

runParity({
  map: path.join(__dirname, 'app-screen-map.json'),
  report: path.join(__dirname, 'app-parity-report.json'),
  board: 'http://localhost:8899/SPLAT%20Connect%20-%20Mobile.dc.html',
  live: process.env.PARITY_APP || 'http://localhost:3112',
  pairsDir: path.join(__dirname, 'pairs', 'app'),
  boardShot: '[data-screen-label]',
  boardScope: { root: '[data-screen-label]', levelSteps: [40, 20, 17] },
  boardViewport: { width: 1440, height: 960 },
  liveViewport: { width: 390, height: 844 },
  // Chrome the board draws in its frame: the floating tab bar, and the stack
  // header's title (React Navigation's is the only heading with aria-level;
  // React Native's own header role renders as a bare <h1 role="heading">).
  // By test id, not role="tablist", which in-content segmented tabs share.
  // levelSteps: the mobile board's scale, h2 at 20-25px and section h3s at 18.
  liveScope: {
    root: '#root',
    exclude: '[data-testid="tab-bar"], header, [role="banner"], [role="heading"][aria-level="1"]',
    levelSteps: [40, 20, 17],
  },
  // The parity API's CORS admits the web origin only (packages/api/src/app.ts).
  launchArgs: ['--disable-web-security'],
  signIn: signInApp,
  // Skip the intro, then wait out any loading skeleton, unless the row holds
  // its request open to measure that skeleton.
  prepare: async (page, s) => {
    await dismissIntro(page)
    if (s.stall) return
    await page
      .locator('[data-testid="skeleton-row"], [data-testid$="-skeleton"]')
      .first()
      .waitFor({ state: 'detached', timeout: 8000 })
      .catch(() => {})
  },
  resolve: resolveAppRoute,
  // Screens scroll inside their own container; the root is always 844 tall.
  compareOpts: () => ({ height: false }),
})
