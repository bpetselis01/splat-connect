// A typo'd route renders expo-router's "Unmatched Route" on the phone and no
// unit test notices, because they mock the router. Every route the app names
// as a string literal must be a file in app/, found the way expo-router finds it.
import { myRoute } from '../../../lib/my-routes'
import { buildNav } from '@splat-connect/types'

type Entry = { name: string; isDirectory(): boolean }
const fs = require('fs') as { readdirSync(d: string, o: { withFileTypes: true }): Entry[]; readFileSync(f: string, e: 'utf8'): string }
const path = require('path') as { join(...p: string[]): string; resolve(...p: string[]): string; relative(a: string, b: string): string }
declare const __dirname: string
const ROOT = path.resolve(__dirname, '../../..')

function walk(dir: string, url: string, out: Set<string>, srcs: string[]) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, /^\(.+\)$/.test(e.name) ? url : `${url}/${e.name}`, out, srcs)
    else if (/\.tsx$/.test(e.name) && !e.name.startsWith('_') && !e.name.startsWith('+')) {
      const n = e.name.replace(/\.tsx$/, '')
      out.add(n === 'index' ? url || '/' : `${url}/${n}`)
    }
  }
}
const routes = new Set<string>()
walk(path.join(ROOT, 'app'), '', routes, [])

const served = (route: string) => {
  const want = route.split(/[?#]/)[0].replace(/\/$/, '') || '/'
  const w = want.split('/')
  return [...routes].some((r) => {
    const h = r.split('/')
    return h.length === w.length && h.every((seg, i) => seg === w[i] || w[i] === '\u0000' || /^\[.+\]$/.test(seg))
  })
}

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name)
    return e.isDirectory() ? files(p) : /\.tsx?$/.test(e.name) ? [p] : []
  })
}

it('every my-routes target is an app route', () => {
  const caps: any = {
    profile: { name: 'B', role: 'admin' }, isAdmin: true, ledOrgs: [{ id: 'o', name: 'A' }],
    unread: { tutorials: 0, exchanges: 0, challenges: 0, organisations: 0, total: 0 }, exchangeActions: 0,
  }
  const targets = buildNav(caps).flatMap((g) => g.rows.map((r) => myRoute(r.href)))
  expect(targets.filter((t) => !served(t))).toEqual([])
})

it('every route literal passed to the router is an app route', () => {
  // router.push('/x'), router.replace('/x'), router.navigate('/x'), href="/x", href: '/x'
  const CALL = /(?:router\.(?:push|replace|navigate)\(\s*|href[=:]\s*\{?\s*)(['"`])(\/[^'"`]*)/g
  const bad: string[] = []
  let seen = 0
  for (const d of ['components', 'app', 'lib']) {
    for (const f of files(path.join(ROOT, d))) {
      for (const m of fs.readFileSync(f, 'utf8').matchAll(CALL)) {
        seen++
        const r = m[2].replace(/\$\{[^}]*\}/g, '\u0000').split(/[?#]/)[0].replace(/\/$/, '') || '/'
        if (!served(r)) bad.push(`${path.relative(ROOT, f)}  ${m[2]}`)
      }
    }
  }
  expect(seen).toBeGreaterThan(30)
  expect(bad).toEqual([])
})
