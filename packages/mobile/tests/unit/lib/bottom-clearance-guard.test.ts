// Bottom-action audit (2026-10-07), made mechanical. Any screen that pins a
// footer / action bar / composer band to the bottom must size it with
// useBottomClearance(), the app's one bottom rule (lib/bottom-clearance.ts).
// A footer that hard-codes its padding sits on the home indicator.
// New hits fail here; the audited "fine" ones are listed below with the reason.
type Entry = { name: string; isDirectory(): boolean }
const fs = require('fs') as { readdirSync(d: string, o: { withFileTypes: true }): Entry[]; readFileSync(f: string, e: 'utf8'): string }
const path = require('path') as { join(...p: string[]): string; resolve(...p: string[]): string; relative(a: string, b: string): string }
declare const __dirname: string
const ROOT = path.resolve(__dirname, '../../..')

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    return e.isDirectory() ? files(p) : /\.tsx$/.test(e.name) ? [p] : []
  })
}

// A StyleSheet key that names a bottom band, or a testID that does.
const BAND = /^\s+(footer|foot|actionBar|bottomBar|band|composer|submitBar|ctaBar|stickyBar):\s*\{|testID="[\w-]*(footer|action-bar)"/m
const USES_RULE = /\b(useBottomClearance|bottomClearance)\(/

// File -> why it is exempt (the 2026-10-07 audit's "fine" rows).
const AUDITED_FINE: Record<string, string> = {
  'components/library/filter-page.tsx': 'band uses insets.bottom + one gutter, the same value as the rule',
  'components/guides/build-mode.tsx': 'band uses inset + 12, the same value as the rule',
  'components/guides/model-screen.tsx': 'overlay chips over the viewer, not a footer',
  'components/map/map-screen.tsx': 'overlay on the map uses tabBarClearance',
  'components/tab-bar.tsx': 'is the tab bar',
  'components/ui/PhotoViewer.tsx': 'overlay caption uses inset + 16',
  'components/builds/makers-wanted-screen.tsx': 'foot is per card, not page bottom',
  'components/guides/picks-row.tsx': 'foot is a row inside a card',
  'components/organisation/org-publish-screen.tsx': 'foot is a caption line in the scroll',
  'components/auth/parts.tsx': 'centred scroll with inset + 32',
}

it('every file with a bottom band sizes it with the shared bottom rule', () => {
  const offenders = ['components', 'app']
    .flatMap((d) => files(path.join(ROOT, d)))
    .filter((f) => {
      const rel = path.relative(ROOT, f)
      const src = fs.readFileSync(f, 'utf8')
      return BAND.test(src) && !USES_RULE.test(src) && !(rel in AUDITED_FINE)
    })
    .map((f) => path.relative(ROOT, f))
  expect(offenders).toEqual([])
})

it('the exemption list holds no file that has gone', () => {
  expect(Object.keys(AUDITED_FINE).filter((rel) => !fs.readdirSync(path.join(ROOT, path.join(rel, '..')), { withFileTypes: true }).some((e) => e.name === path.relative(path.join(ROOT, rel, '..'), path.join(ROOT, rel))))).toEqual([])
})
