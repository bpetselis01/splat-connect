// R5: no phone screen takes the first organisation a person leads. The acting
// org (lib/acting-org.tsx) is the one place that decides.
type Entry = { name: string; isDirectory(): boolean }
const fs = require('fs') as { readdirSync(d: string, o: { withFileTypes: true }): Entry[]; readFileSync(f: string, e: 'utf8'): string }
const path = require('path') as { join(...p: string[]): string; resolve(...p: string[]): string }
declare const __dirname: string
const ROOT = path.resolve(__dirname, '../../..')

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    return e.isDirectory() ? files(p) : /\.tsx?$/.test(e.name) ? [p] : []
  })
}

const BANNED = /ledOrgs(\?\.)?\[0\]/
export const offends = (source: string) => BANNED.test(source)

it('no screen or component reads ledOrgs[0]', () => {
  const offenders = ['app', 'components'].flatMap((d) => files(path.join(ROOT, d))).filter((f) => offends(fs.readFileSync(f, 'utf8')))
  expect(offenders).toEqual([])
})

it('the check catches a planted ledOrgs[0]', () => {
  expect(offends('const org = caps?.ledOrgs[0]')).toBe(true)
  expect(offends('const id = ledOrgs[0]?.id')).toBe(true)
  expect(offends('const org = useActingOrg().org')).toBe(false)
})
