// Every text size comes from theme.type, so buttons and components read the
// same size wherever they sit (Byron, 2026-10-05). A raw number fails here.
// Typed requires, as home-shortcuts.test.tsx does: the app's tsconfig has no Node types.
type Entry = { name: string; isDirectory(): boolean }
const fs = require('fs') as { readdirSync(d: string, o: { withFileTypes: true }): Entry[]; readFileSync(f: string, e: 'utf8'): string }
const path = require('path') as { join(...p: string[]): string; resolve(...p: string[]): string; relative(a: string, b: string): string }

declare const __dirname: string
const ROOT = path.resolve(__dirname, '../../..')

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    return e.isDirectory() ? files(p) : /\.tsx?$/.test(e.name) ? [p] : []
  })
}

it('no fontSize is a raw number; each is a theme.type step', () => {
  const raw = ['components', 'app', 'lib'].flatMap((d) =>
    files(path.join(ROOT, d)).flatMap((f) =>
      fs
        .readFileSync(f, 'utf8')
        .split('\n')
        .map((line, i) => (/fontSize\s*[:=]\s*\{?\s*\d/.test(line) ? `${path.relative(ROOT, f)}:${i + 1}  ${line.trim()}` : null))
        .filter((x): x is string => !!x)
    )
  )
  expect(raw).toEqual([])
})
