/**
 * Contract guard: every endpoint the mobile app calls through apiClient must be
 * a route the API registers, under the same HTTP method. Mobile unit tests mock
 * apiClient and API tests never read mobile source, so a renamed route or a
 * typo'd path was invisible until a phone got a 404.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import app from '../../src/app.js'

const MOBILE = '../mobile'
const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []
  )

// "/api/toys/:id{[0-9a-f-]+}/photos" -> segments, params as null
const patterns = app.routes
  .filter((r) => r.method !== 'ALL')
  .map((r) => ({ method: r.method, segs: r.path.split('/').map((s) => (s.startsWith(':') ? null : s)) }))

const CALL = /apiClient\.(get|post|patch|put|delete)(?:<[^()]*?>)?\(\s*([`'"])(\/api\/[^`'"]*)\2/g

function matches(method: string, path: string) {
  const want = path.split('/')
  return patterns.some(
    (p) =>
      p.method === method.toUpperCase() &&
      p.segs.length === want.length &&
      p.segs.every((s, i) => s === null || s === want[i] || want[i] === '\u0000')
  )
}

describe('mobile -> API contract', () => {
  const calls = ['lib', 'components', 'app'].flatMap((d) =>
    walk(join(MOBILE, d)).flatMap((f) =>
      [...readFileSync(f, 'utf8').matchAll(CALL)].map((m) => ({
        f,
        method: m[1],
        // ${id} is one segment; a trailing ${query} is no segment at all
        path: m[3].replace(/(?<=[^/])\$\{[^}]*\}$/, '').replace(/\$\{[^}]*\}/g, '\u0000').split('?')[0].replace(/\/$/, ''),
        raw: m[3],
      }))
    )
  )

  it('finds the calls it is meant to police', () => {
    expect(calls.length).toBeGreaterThan(60)
  })

  it('every call names a registered route and method', () => {
    expect(calls.filter((c) => !matches(c.method, c.path)).map((c) => `${c.f}: ${c.method.toUpperCase()} ${c.raw}`)).toEqual([])
  })
})
