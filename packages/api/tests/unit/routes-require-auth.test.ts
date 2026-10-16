/**
 * Auth is attached by a prefix list in app.ts (AUTHED), so a route mounted
 * under a prefix that list forgot is silently public. This walks every route
 * the app registers and asserts that, outside /api/public and /health, an
 * anonymous request is refused before any handler or database is reached.
 */
import { describe, it, expect } from 'vitest'
import app from '../../src/app.js'

const ID = '00000000-0000-4000-8000-000000000000'
const concrete = (path: string) => path.replace(/:[A-Za-z_]+(\{[^}]*\})?/g, ID).replace(/\*/g, 'x')
const isPublic = (path: string) => path === '/health' || path.startsWith('/api/public')

const routes = app.routes.filter((r) => r.method !== 'ALL' && !isPublic(r.path))

describe('every non-public route refuses an anonymous request', () => {
  it('finds the routes it is meant to police', () => {
    expect(routes.length).toBeGreaterThan(150)
  })

  it.each(routes.map((r) => [r.method, r.path]))('%s %s -> 401', async (method, path) => {
    const res = await app.request(concrete(path), { method })
    expect(res.status).toBe(401)
  })
})
