// The phone is not the test runtime. Three bugs reached the device while every
// unit and web e2e test stayed green; each is now a mechanical guard here.
//  1. Hermes ships a smaller runtime than Node/Chromium (Intl.RelativeTimeFormat
//     crashed the Inbox, 2026-09-01).
//  2. iOS SecureStore refuses keys outside [A-Za-z0-9._-] (a ':' broke recents,
//     2026-10-05); web uses localStorage so e2e cannot see it.
//  3. A worklet calling a JS function ("[Worklets] Tried to synchronously call a
//     Remote Function", 2026-10-06) passes jest, tsc and web.
// The key builders sit beside auth-context, which builds a Supabase client on import.
jest.mock('../../../lib/auth-context', () => ({ useAuth: () => ({}) }))
jest.mock('../../../lib/capabilities', () => ({ useCapabilities: () => ({}) }))
import { RECENTS_KEY, recentsKeyFor } from '../../../lib/recents'
import { homeKey } from '../../../lib/home-shortcuts'
import { ticksKey } from '../../../lib/guide-progress'
import { LEARN_PROGRESS_KEY } from '../../../lib/learn'
import { ACTING_ORG_KEY } from '../../../lib/acting-org'

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
const source = () =>
  ['lib', 'components', 'app'].flatMap((d) => files(path.join(ROOT, d))).map((f) => ({ rel: path.relative(ROOT, f), src: fs.readFileSync(f, 'utf8') }))

describe('SecureStore keys', () => {
  const SAFE = /^[A-Za-z0-9._-]+$/
  const uuid = '3babf3f0-908f-46cb-bf9c-b5a575c3bec8'

  it('every key builder yields only letters, digits, dot, dash, underscore', () => {
    const keys = [
      RECENTS_KEY, recentsKeyFor(uuid), homeKey(uuid), homeKey(null), LEARN_PROGRESS_KEY, ACTING_ORG_KEY,
      ...(['steps', 'tools', 'parts'] as const).map((k) => ticksKey(k, uuid)),
    ]
    for (const k of keys) expect(k).toMatch(SAFE)
  })

  it('only the files whose keys are checked above touch the on-device store', () => {
    const users = source().filter((s) => /resolveAuthStorage\(/.test(s.src)).map((s) => s.rel).sort()
    // A new consumer must add its key builder to the test above, then list itself here (supabase* hold the library's own fixed key).
    expect(users).toEqual(['lib/acting-org.tsx', 'lib/guide-progress.ts', 'lib/home-shortcuts.ts', 'lib/learn.ts', 'lib/recents.ts', 'lib/supabase-storage.ts', 'lib/supabase.ts'])
  })
})

describe('Hermes-safe runtime', () => {
  // Not in Hermes, or not reliably. Intl.RelativeTimeFormat is allowed only where it is feature-detected.
  const BANNED = /Intl\.(PluralRules|ListFormat|DisplayNames|Segmenter)|structuredClone|\.groupBy\(|Array\.fromAsync|Promise\.withResolvers/
  it('no source uses a global Hermes may not have', () => {
    const hits = source().filter((s) => BANNED.test(s.src)).map((s) => s.rel)
    expect(hits).toEqual([])
  })
  it('new Intl.RelativeTimeFormat is only built behind a typeof check', () => {
    const hits = source()
      .filter((s) => /new Intl\.RelativeTimeFormat/.test(s.src) && !/typeof Intl\.RelativeTimeFormat === 'function'/.test(s.src))
      .map((s) => s.rel)
    expect(hits).toEqual([])
  })
})

describe('worklets', () => {
  const HOOKS = /\b(useAnimatedStyle|useDerivedValue|useAnimatedProps|useAnimatedScrollHandler|useAnimatedReaction)\(/g
  /** The text of each worklet hook call, up to its matching close paren. */
  const bodies = (src: string) =>
    [...src.matchAll(HOOKS)].map((m) => {
      let depth = 0
      for (let i = m.index! + m[0].length - 1; i < src.length; i++) {
        if (src[i] === '(') depth++
        else if (src[i] === ')' && --depth === 0) return src.slice(m.index!, i + 1)
      }
      return src.slice(m.index!)
    })

  it('finds the worklets it is meant to police', () => {
    expect(source().flatMap((s) => bodies(s.src)).length).toBeGreaterThan(8)
  })
  it('no worklet calls a theme function (theme.spacing(), theme.shadow()); compute it outside', () => {
    const hits = source().flatMap((s) =>
      bodies(s.src).filter((b) => /\btheme\.\w+(\.\w+)*\(/.test(b)).map((b) => `${s.rel}: ${b.split('\n')[0]}`)
    )
    expect(hits).toEqual([])
  })
})
