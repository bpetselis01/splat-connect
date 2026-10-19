/**
 * Every /api route must be named in at least one integration test. Unit tests
 * with a mocked Supabase cannot see RLS, grants or column drift, so a route with
 * no integration test is a route nothing real has ever called.
 *
 * It is a ratchet: UNTESTED lists the routes that predate the guard (found
 * 2026-10-08). A new route must come with an integration test; when one of
 * these gains one, delete it from the list (the second test insists).
 * The match is on method and path: the method token must sit in the same call
 * as the path or in the two lines before it.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import app from '../../src/app.js'

const UNTESTED = new Set([
  'GET /api/public/makers/:id',
  'DELETE /api/admin/contributors/:id',
  'GET /api/admin/build-requests',
  'GET /api/admin/print-jobs',
  'PATCH /api/toys/:id/publish',
  'GET /api/organizations/:id/pickup',
  'PATCH /api/organizations/:id/pickup',
  'POST /api/exchange-costs/:transactionId/receipt',
  'DELETE /api/tutorials/:id/parts',
  'DELETE /api/tutorials/:id/tools',
  'DELETE /api/tutorials/:id/safety-notes',
  'DELETE /api/tutorials/:id/recommendations',
  'DELETE /api/organizations/invites/:inviteId',
  'DELETE /api/organizations/:orgId/events/:id',
  'GET /api/organizations/:orgId/events/:id/questions',
  'GET /api/organizations/:id/stories',
  'DELETE /api/organizations/:orgId/stories/:id',
  'GET /api/organizations/requests',
])

const walk = (d: string): string[] =>
  readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]))
const files = walk('tests/integration').filter((f) => f.endsWith('.ts')).map((f) => readFileSync(f, 'utf8'))

const routes = app.routes.filter((r) => r.method !== 'ALL' && r.path.startsWith('/api'))
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const verbsIn = (text: string) =>
  METHODS.filter((m) => new RegExp(String.raw`\b${m}\b|\b${m.toLowerCase()}\(${m === 'POST' ? '|uploadRequest\\(' : ''}`, 'i').test(text))
// A helper that fixes its own method: (...) => ({ method: 'POST', ... }) or a block that returns { method: 'POST', ... }
const fixedMethodHelpers = (text: string) =>
  [...text.matchAll(/const (\w+) = \([^)]*\) =>\s*(?:\(\{|\{[\s\S]{0,300}?return \{)\s*method: '(\w+)'/g)].map((m) => [m[1], m[2]] as const)
const depth = (l: string) => (l.match(/\(/g)?.length ?? 0) - (l.match(/\)/g)?.length ?? 0)
// The statement holding line i: a line that starts with the path is an
// argument, so the call opens on one of the two lines before it; the
// statement runs to its closing paren, at most 8 lines.
const statement = (lines: string[], i: number) => {
  let s = i
  if (/^\s*['"`]\//.test(lines[i]) && depth(lines[i]) <= 0)
    for (let k = i - 1; k >= Math.max(0, i - 2); k--) if (depth(lines[k]) > 0) { s = k; break }
  let d = 0
  let e = s
  while (e < lines.length && e < s + 8) {
    d += depth(lines[e++])
    if (d <= 0 && e > i) break
  }
  return lines.slice(s, e).join('\n')
}
/**
 * Call forms the suite uses, all matched:
 *  app.request('/api/x', { method: 'POST' })       method on a later line of the call
 *  json(token, 'PATCH', body) / send('PATCH', p)   method as a helper argument
 *  post('/api/x', ...) / get(`/api/x`)             method as the helper's name
 *  json(token, body) with json fixed to POST       a helper that returns { method: 'X' }
 *  uploadRequest('/api/x', token, file)          the multipart upload helper, always a POST
 *  app.request('/api/x', { headers })              no method token at all: a GET
 * A path a helper builds (thanks(id)) is not seen; the test also calls it literally once.
 */
export const mentioned = (route: string, texts: string[] = files) => {
  const [method, path] = route.split(' ')
  const re = new RegExp(path.split('/').map((s) => (s.startsWith(':') ? String.raw`[^/'"\x60]+` : s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('/'))
  return texts.some((text) => {
    const lines = text.split('\n')
    const helpers = fixedMethodHelpers(text)
    return lines.some((l, i) => {
      if (!re.test(l)) return false
      const st = statement(lines, i)
      const verbs = [...verbsIn(st), ...helpers.filter(([n]) => new RegExp(String.raw`\b${n}\(`).test(st)).map(([, m]) => m)]
      return verbs.includes(method) || (method === 'GET' && verbs.length === 0)
    })
  })
}
const key = (r: { method: string; path: string }) => `${r.method} ${r.path}`

describe('mentioned()', () => {
  const sample = [
    "app.request('/api/w', { headers })",
    '',
    '',
    "await app.request('/api/x', {",
    "  method: 'DELETE',",
    '})',
    "app.request('/api/y', json(token, 'PATCH', {}))",
    "const r = await post('/api/z', body)",
    'const j = (t: string) => ({ method: \'PUT\', t })',
    'await app.request(',
    "  '/api/v',",
    '  j(token)',
    ')',
  ].join('\n')
  it('reads the method from an options object, a helper argument, a helper name or its absence', () => {
    expect(['DELETE /api/x', 'PATCH /api/y', 'POST /api/z', 'GET /api/w', 'PUT /api/v'].map((r) => mentioned(r, [sample]))).toEqual([true, true, true, true, true])
  })
  it('does not let another method on the same path cover a route', () => {
    expect([mentioned('GET /api/x', [sample]), mentioned('POST /api/y', [sample]), mentioned('DELETE /api/w', [sample])]).toEqual([false, false, false])
  })
})

describe('integration coverage of the API surface', () => {
  it('finds the routes it is meant to police', () => {
    expect(routes.length).toBeGreaterThan(200)
  })
  it('every route outside the known list is named in an integration test', () => {
    expect(routes.filter((r) => !mentioned(key(r)) && !UNTESTED.has(key(r))).map(key)).toEqual([])
  })
  it('the known list holds only routes that are still untested', () => {
    const live = new Set(routes.map(key))
    expect([...UNTESTED].filter((k) => !live.has(k) || mentioned(k))).toEqual([])
  })
})
