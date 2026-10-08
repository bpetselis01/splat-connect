/**
 * Every /api route must be named in at least one integration test. Unit tests
 * with a mocked Supabase cannot see RLS, grants or column drift, so a route with
 * no integration test is a route nothing real has ever called.
 *
 * It is a ratchet: UNTESTED lists the routes that predate the guard (found
 * 2026-10-08). A new route must come with an integration test; when one of
 * these gains one, delete it from the list (the second test insists).
 * The match is on path only, not method.
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
  'POST /api/toy-transactions/print-at-event',
  'GET /api/organizations/:id/pickup',
  'PATCH /api/organizations/:id/pickup',
  'POST /api/ideas/:id/reports',
  'POST /api/exchange-costs/:transactionId/receipt',
])

const walk = (d: string): string[] =>
  readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]))
const src = walk('tests/integration').filter((f) => f.endsWith('.ts')).map((f) => readFileSync(f, 'utf8')).join('\n')

const routes = app.routes.filter((r) => r.method !== 'ALL' && r.path.startsWith('/api'))
const mentioned = (path: string) =>
  new RegExp(path.split('/').map((s) => (s.startsWith(':') ? String.raw`[^/'"\x60]+` : s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('/')).test(src)
const key = (r: { method: string; path: string }) => `${r.method} ${r.path}`

describe('integration coverage of the API surface', () => {
  it('finds the routes it is meant to police', () => {
    expect(routes.length).toBeGreaterThan(200)
  })
  it('every route outside the known list is named in an integration test', () => {
    expect(routes.filter((r) => !mentioned(r.path) && !UNTESTED.has(key(r))).map(key)).toEqual([])
  })
  it('the known list holds only routes that are still untested', () => {
    const live = new Set(routes.map(key))
    expect([...UNTESTED].filter((k) => !live.has(k) || mentioned(k.split(' ')[1]))).toEqual([])
  })
})
