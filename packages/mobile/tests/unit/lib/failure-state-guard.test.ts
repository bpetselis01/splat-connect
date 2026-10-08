// Offline / failure states (2026-10-07 audit), made mechanical. Every screen
// that loads with apiClient.get must have a failure test: the load rejects, the
// screen says so, Try again re-fetches, and nothing reaches console.error (in
// dev that is a red LogBox screen). A new fetching screen with no failure test
// fails here. Convention: tests/unit/**/<name>-failure.test.tsx importing the
// screen; EXEMPT / COVERED_ELSEWHERE hold the rest, each with a reason.
type Entry = { name: string; isDirectory(): boolean }
const fs = require('fs') as { readdirSync(d: string, o: { withFileTypes: true }): Entry[]; readFileSync(f: string, e: 'utf8'): string }
const path = require('path') as { join(...p: string[]): string; resolve(...p: string[]): string; relative(a: string, b: string): string }
declare const __dirname: string
const ROOT = path.resolve(__dirname, '../../..')

const files = (dir: string, re: RegExp): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    return e.isDirectory() ? files(p, re) : re.test(e.name) ? [p] : []
  })
const read = (f: string) => fs.readFileSync(f, 'utf8')

// Screen file -> a test that is not named *-failure but does the same job.
const COVERED_ELSEWHERE: Record<string, string> = {
  'components/inbox/inbox-screen.tsx': 'tests/unit/components/inbox/inbox-edges.test.tsx',
}
// Screen file -> why it needs no failure test of its own.
// Their GET is a secondary lookup; the test proves the screen still works and logs nothing.
const EXEMPT: Record<string, string> = {
  'app/(tabs)/guides/new.tsx': 'GET only runs after the draft exists; the editor opens regardless',
  'components/organisation/org-invites.tsx': 'a failed GET just hides the invites card',
  'components/profile/child-done.tsx': 'a failed GET drops the match sentence; heading and button stay',
}
const SECONDARY_TESTS = ['guides-new-failure', 'org-invites-failure', 'child-done-failure']

const screens = ['components', 'app']
  .flatMap((d) => files(path.join(ROOT, d), /\.tsx$/))
  .filter((f) => /apiClient\.get\b/.test(read(f)))
  .map((f) => path.relative(ROOT, f))
const failureTests = files(path.join(ROOT, 'tests/unit'), /failure.*\.test\.tsx$/).map((f) => ({ f, src: read(f) }))

it('finds the fetching screens it is meant to police', () => {
  expect(screens.length).toBeGreaterThan(20)
  expect(failureTests.length).toBeGreaterThan(15)
})

it('every fetching screen has a failure test', () => {
  const missing = screens.filter((s) => {
    if (s in EXEMPT || s in COVERED_ELSEWHERE) return false
    const base = path.relative(path.join(ROOT, s, '..'), path.join(ROOT, s)).replace(/\.tsx$/, '')
    return !failureTests.some((t) => t.src.includes(`/${base}'`))
  })
  expect(missing).toEqual([])
})

it('each failure test rejects the load, asks for Try again, and watches console.error', () => {
  const weak = failureTests
    .filter((t) => !SECONDARY_TESTS.some((n) => t.f.includes(n)))
    .filter((t) => !(/mockRejected|Promise\.reject|rejects/.test(t.src) && /Try again/.test(t.src) && /console/.test(t.src)))
    .map((t) => path.relative(ROOT, t.f))
  expect(weak).toEqual([])
})

it('the elsewhere / exempt lists name real screens and real tests', () => {
  for (const [s, t] of Object.entries(COVERED_ELSEWHERE)) {
    expect(screens).toContain(s)
    expect(read(path.join(ROOT, t))).toMatch(/Try again/)
  }
  for (const s of Object.keys(EXEMPT)) expect(screens).toContain(s)
})
