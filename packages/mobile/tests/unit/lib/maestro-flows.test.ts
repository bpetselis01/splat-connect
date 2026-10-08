// The device (Maestro) flows need a JDK and a simulator, so CI cannot run them
// yet. This keeps them honest in the meantime: a flow that names a testID, a
// label or a subflow the app no longer has fails here, not on a phone.
// The tag lines on each flow are checked by scripts/journeys/check.mjs.
type Entry = { name: string; isDirectory(): boolean }
const fs = require('fs') as {
  readdirSync(d: string, o: { withFileTypes: true }): Entry[]
  readFileSync(f: string, e: 'utf8'): string
  existsSync(f: string): boolean
}
const path = require('path') as { join(...p: string[]): string; resolve(...p: string[]): string; relative(a: string, b: string): string; dirname(p: string): string }
declare const __dirname: string
const ROOT = path.resolve(__dirname, '../../..')
const MAESTRO = path.join(ROOT, '.maestro')

function walk(dir: string, re: RegExp): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    return e.isDirectory() ? walk(p, re) : re.test(e.name) ? [p] : []
  })
}
const flows = walk(MAESTRO, /\.ya?ml$/)
const appSrc = ['app', 'components', 'lib'].flatMap((d) => walk(path.join(ROOT, d), /\.tsx?$/)).map((f) => fs.readFileSync(f, 'utf8')).join('\n')
// Strings that exist only in seeded data, not in the app's source.
const seedSrc = [...walk(path.join(ROOT, 'scripts'), /\.m?js$/), ...walk(path.join(MAESTRO, 'scripts'), /\.js$/)]
  .map((f) => fs.readFileSync(f, 'utf8')).join('\n')
// Strings that exist only on the phone's OS or dev tooling.
const SYSTEM = ['Not Now', 'Open debugger to view warnings', 'Close']

const lines = (f: string) => fs.readFileSync(f, 'utf8').split('\n').map((l, i) => ({ l, n: i + 1 }))
const rel = (f: string) => path.relative(ROOT, f)

it('finds the flows it is meant to police', () => {
  expect(flows.length).toBeGreaterThanOrEqual(15)
})

describe.each(flows.map((f) => [rel(f), f]))('%s', (_name, f) => {
  const src = fs.readFileSync(f, 'utf8')
  const isFlow = /appId:/.test(src)

  it('is shaped like a Maestro flow (appId, a --- separator, no tabs)', () => {
    if (!isFlow) return
    expect(src).toMatch(/^appId: com\.splatconnect\.mobile$/m)
    expect(src).toMatch(/^---$/m)
    expect(src).not.toMatch(/\t/)
  })

  it('runs only subflows and scripts that exist', () => {
    const missing = lines(f)
      .flatMap(({ l }) => {
        const m = l.match(/^\s*(?:-\s*)?(?:runFlow|runScript|file):\s*(\S+\.(?:ya?ml|js))\s*$/)
        return m ? [m[1]] : []
      })
      .filter((p) => !fs.existsSync(path.resolve(path.dirname(f), p)))
    expect(missing).toEqual([])
  })

  it('taps and asserts only testIDs the app renders', () => {
    const missing = lines(f)
      .flatMap(({ l }) => {
        const m = l.match(/^\s*(?:-\s*)?id:\s*"([^"]+)"/)
        return m ? [m[1]] : []
      })
      .filter((id) => !appSrc.includes(`"${id}"`) && !appSrc.includes(`'${id}'`))
    expect(missing).toEqual([])
  })

  it('looks for text the app (or the seeded data) can show', () => {
    const missing = lines(f)
      .flatMap(({ l }) => {
        const m = l.match(/^\s*(?:-\s*)?(?:text|tapOn|assertVisible|assertNotVisible):\s*"([^"]+)"/)
        return m ? [m[1]] : []
      })
      // the literal run before any regex syntax: "Inbox(, .*)?" -> "Inbox"
      .map((t) => t.split(/[.*+?()|[\]\\${]/)[0].trim())
      .filter((lit) => lit.length >= 3 && !SYSTEM.includes(lit))
      // Labels built from templates ("Step ${n} of ${total}") or seeded names fall
      // back to a word check: every word of four letters or more must exist somewhere.
      .filter((lit) => {
        if (appSrc.includes(lit) || seedSrc.includes(lit)) return false
        const words = lit.match(/[A-Za-z]{4,}/g) ?? []
        return words.some((w) => !appSrc.toLowerCase().includes(w.toLowerCase()) && !seedSrc.toLowerCase().includes(w.toLowerCase()))
      })
    expect(missing).toEqual([])
  })
})
