/**
 * The picture pass: every mapped screen on the iOS simulator, beside the
 * board. It sees what the web export cannot: safe areas (react-native-web
 * reports insets.top = 0), native sheets and native fonts. Run from
 * packages/web, with the parity stack up, the app installed on the booted
 * simulator, Metro serving it against the parity API, and board shots from
 * `app.js --shots`.
 *
 *   node ../../scripts/parity/app-shots.js [--id a,b]       # shoot and stitch
 *   node ../../scripts/parity/app-shots.js --record f.json  # merge judged findings
 *
 * Judged findings are [{ id, what, board, live }]; they enter
 * app-parity-report.json as type 'picture', through the row's exemptions.
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const { provision, cleanup, adminClient } = require('./auth')
const { seed, unseed } = require('./seed')
const { resolveAppRoute } = require('./app-routes')
const { explain } = require('./compare')

const ROOT = path.resolve(__dirname, '../..')
const MAP = JSON.parse(fs.readFileSync(path.join(__dirname, 'app-screen-map.json'), 'utf8'))
const REPORT = path.join(__dirname, 'app-parity-report.json')
const OUT = path.join(__dirname, 'pairs', 'app')
const FLOWS = path.join(ROOT, 'packages/mobile/.maestro/parity')
// Maestro needs Java 17+; the machine default is 11. Homebrew's 17 unless
// JAVA_HOME already names one.
const JDK17 = '/opt/homebrew/opt/openjdk@17'
const maestroEnv = { ...process.env, ...(!process.env.JAVA_HOME && fs.existsSync(JDK17) && { JAVA_HOME: JDK17 }) }
const argv = process.argv.slice(2)
const flag = (n) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : null)

function record(file) {
  const judged = JSON.parse(fs.readFileSync(file, 'utf8'))
  const report = JSON.parse(fs.readFileSync(REPORT, 'utf8'))
  for (const row of report.screens) {
    const mine = judged
      .filter((j) => j.id === row.id)
      .map((j) => ({ type: 'picture', severity: 'medium', what: j.what, board: j.board, live: j.live }))
    const rules = (MAP.find((s) => s.id === row.id)?.explained || []).filter((r) => r.type === 'picture')
    const { findings, explained } = explain(mine, rules)
    row.findings = [...row.findings.filter((f) => f.type !== 'picture' && f.type !== 'stale-exemption'), ...findings]
    row.explained = [...(row.explained || []).filter((f) => f.type !== 'picture'), ...explained]
  }
  const all = report.screens
  Object.assign(report.summary, {
    findings: all.reduce((n, r) => n + r.findings.length, 0),
    explained: all.reduce((n, r) => n + (r.explained?.length || 0), 0),
    clean: all.filter((r) => !r.findings.length && !r.error).length,
    withFindings: all.filter((r) => r.findings.length).length,
    picture: all.reduce((n, r) => n + r.findings.filter((f) => f.type === 'picture').length, 0),
  })
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 1))
  console.log(JSON.stringify(report.summary, null, 1))
}

async function shoot() {
  const ids = flag('--id')?.split(',')
  const screens = MAP.filter((s) => !s.skip && (!ids || ids.includes(s.id)))
  const roles = [...new Set(screens.flatMap((s) => [s.role, s.seedRole]).filter(Boolean))]
  const users = roles.length ? await provision(roles) : {}
  const db = adminClient()
  fs.mkdirSync(OUT, { recursive: true })
  try {
    const seeded = roles.length ? await seed(db, users) : {}
    const byRole = new Map()
    for (const s of screens) {
      const role = s.role || 'guest'
      if (!byRole.has(role)) byRole.set(role, [])
      byRole.get(role).push(s)
    }
    for (const [role, mine] of byRole) {
      const steps = ['appId: com.splatconnect.mobile', '---', '- runFlow: sign-in.yaml']
      for (const s of mine) {
        const route = await resolveAppRoute(s, { seeded, db, cache: new Map() })
        if (!route) continue
        steps.push(
          `- openLink: "splatconnect:/${route}"`,
          // iOS asks before a deep link opens the app.
          '- runFlow: confirm-open.yaml',
          '- tapOn:\n    text: "Skip intro"\n    optional: true',
          '- waitForAnimationToEnd',
          `- takeScreenshot: "${s.id}.ios"`
        )
      }
      const flow = path.join(FLOWS, `_run-${role}.yaml`)
      fs.writeFileSync(flow, steps.join('\n') + '\n')
      const u = users[role]
      // Maestro files screenshots under its own output tree; collect them.
      const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'parity-shots-'))
      try {
        execFileSync(
          'maestro',
          ['test', flow, '--test-output-dir', tmp, '--env', `EMAIL=${u?.email || ''}`, '--env', `PASSWORD=${u?.password || ''}`],
          { stdio: 'inherit', env: maestroEnv }
        )
      } finally {
        fs.unlinkSync(flow)
        for (const f of fs.readdirSync(tmp, { recursive: true }))
          if (String(f).endsWith('.ios.png')) fs.copyFileSync(path.join(tmp, f), path.join(OUT, path.basename(String(f))))
        fs.rmSync(tmp, { recursive: true, force: true })
      }
    }
  } finally {
    await unseed(db).catch(() => {})
    if (Object.keys(users).length) await cleanup(users)
  }
  execFileSync(
    'python3',
    [
      path.join(__dirname, 'sidebyside.py'),
      '--dir', OUT,
      '--live-suffix', 'ios',
      '--out', path.join(__dirname, 'pairs', 'app-ios'),
      '--scale', '1',
      '--match-width',
      ...screens.map((s) => s.id),
    ],
    { stdio: 'inherit' }
  )
}

;(flag('--record') ? Promise.resolve(record(flag('--record'))) : shoot()).catch((e) => {
  console.error(e)
  process.exit(1)
})
