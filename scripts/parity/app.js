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
  boardViewport: { width: 1440, height: 960 },
  liveViewport: { width: 390, height: 844 },
  // The tab bar and the stack header are chrome the board draws in its frame.
  liveScope: { root: '#root', exclude: '[role="tablist"], header, [role="banner"]' },
  // The parity API's CORS admits the web origin only (packages/api/src/app.ts).
  launchArgs: ['--disable-web-security'],
  signIn: signInApp,
  prepare: dismissIntro,
  resolve: resolveAppRoute,
  // Screens scroll inside their own container; the root is always 844 tall.
  compareOpts: () => ({ height: false }),
})
