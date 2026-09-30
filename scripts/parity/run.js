/**
 * Web parity: drive the live web app and the web artboard over screen-map.json
 * and write parity-report.json. The loop is harness.js; this names the target.
 *
 *   node scripts/parity/run.js                  # every screen
 *   node scripts/parity/run.js --group "About"  # one group
 *   node scripts/parity/run.js --id about,hub   # named screens
 *   node scripts/parity/run.js --failing        # only what last run flagged
 *   node scripts/parity/run.js --shots          # also save pairs/<id>.{board,live}.png
 *
 * The mobile app's twin is app.js. Run from packages/web.
 */
const path = require('path')
const { runParity } = require('./harness')
const { signIn } = require('./auth')
const { resolveRoute } = require('./routes')

runParity({
  map: path.join(__dirname, 'screen-map.json'),
  report: path.join(__dirname, 'parity-report.json'),
  board: 'http://localhost:8899/SPLAT%20Connect%20-%20Web.dc.html',
  live: process.env.PARITY_LIVE || 'http://localhost:3110',
  // --shots saves a board/live screenshot pair per screen. The fingerprint reads
  // type and radii; layout and composition only show up in a picture.
  pairsDir: path.join(__dirname, 'pairs'),
  boardViewport: { width: 1440, height: 960 },
  liveViewport: { width: 1440, height: 960 },
  liveScope: 'main',
  launchArgs: [],
  signIn,
  prepare: async () => {},
  resolve: resolveRoute,
  compareOpts: () => ({}),
})
