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
  'GET /api/public/tutorials/stats',
  'GET /api/public/makers/:id',
  'DELETE /api/admin/contributors/:id',
  'GET /api/admin/build-requests',
  'GET /api/admin/print-jobs',
  'PATCH /api/toys/:id/publish',
  'GET /api/organizations/:id/pickup',
  'PATCH /api/organizations/:id/pickup',
  'POST /api/exchange-costs/:transactionId/receipt',
  // Hidden by the path-only match; the stricter mentioned() (unit 5a, commit 1) found them.
  // Also found by commit 1, beyond the four: only another method on the same path is tested.
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
  // Tested through a helper whose method the matcher cannot see (path built by thanks(), method fixed in json()).
  'POST /api/tutorials/:id/thanks',
  'POST /api/toy-transactions/:id/approve-work',
])

const walk = (d: string): string[] =>
  readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]))
const src = walk('tests/integration').filter((f) => f.endsWith('.ts')).map((f) => readFileSync(f, 'utf8')).join('\n')

const routes = app.routes.filter((r) => r.method !== 'ALL' && r.path.startsWith('/api'))
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const verbsIn = (text: string) =>
  METHODS.filter((m) => new RegExp(String.raw`\b${m}\b|\b${m.toLowerCase()}\(${m === 'POST' ? '|uploadRequest\\(' : ''}`, 'i').test(text))
// A call is the path's line plus what follows up to the next call, test or 8
// lines; the method may also sit in the two lines before the path.
const callWindow = (lines: string[], i: number) => {
  let end = i + 1
  while (end < lines.length && end < i + 8 && !/\/api\/|app\.request\(|^\s*(it|describe)\(/.test(lines[end])) end++
  return lines.slice(Math.max(0, i - 2), end).join('\n')
}
/**
 * Call forms the suite uses, all matched:
 *  app.request('/api/x', { method: 'POST' })       method on a later line of the call
 *  json(token, 'PATCH', body) / send('PATCH', p)   method as a helper argument
 *  post('/api/x', ...) / get(`/api/x`)             method as the helper's name
 *  uploadRequest('/api/x', token, file)          the multipart upload helper, always a POST
 *  app.request('/api/x', { headers })              no method token at all: a GET
 */
export const mentioned = (route: string, text = src) => {
  const [method, path] = route.split(' ')
  const re = new RegExp(path.split('/').map((s) => (s.startsWith(':') ? String.raw`[^/'"\x60]+` : s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('/'))
  const lines = text.split('\n')
  return lines.some((l, i) => {
    if (!re.test(l)) return false
    const verbs = verbsIn(callWindow(lines, i))
    return verbs.includes(method) || (method === 'GET' && verbs.length === 0)
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
  ].join('\n')
  it('reads the method from an options object, a helper argument, a helper name or its absence', () => {
    expect(['DELETE /api/x', 'PATCH /api/y', 'POST /api/z', 'GET /api/w'].map((r) => mentioned(r, sample))).toEqual([true, true, true, true])
  })
  it('does not let another method on the same path cover a route', () => {
    expect([mentioned('GET /api/x', sample), mentioned('POST /api/y', sample), mentioned('DELETE /api/w', sample)]).toEqual([false, false, false])
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
