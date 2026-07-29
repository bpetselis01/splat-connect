import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

const authed = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } })

// Pins the fix for the truncation bug: GET /api/admin/contributors used to
// return a bare array, ascending, with no limit — so PostgREST's max_rows
// (1000) silently dropped the newest accounts once the table grew past it.
describe('GET /api/admin/contributors', () => {
  let admin: TestUser
  let older: TestUser
  let newer: TestUser

  beforeAll(async () => {
    admin = await createTestUser('admin')
    older = await createTestUser('contributor')
    // Guarantee distinct created_at ordering regardless of clock resolution.
    await new Promise((r) => setTimeout(r, 50))
    newer = await createTestUser('contributor')
  })

  afterAll(async () => {
    await deleteTestUser(admin.id)
    await deleteTestUser(older.id)
    await deleteTestUser(newer.id)
  })

  it('returns { accounts, total } with a numeric total', async () => {
    const res = await app.request('/api/admin/contributors', authed(admin.token))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { accounts: unknown[]; total: number }
    expect(Array.isArray(body.accounts)).toBe(true)
    expect(typeof body.total).toBe('number')
  })

  it('total matches an independent service-role count of non-admin profiles', async () => {
    const { count, error } = await adminClient()
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .neq('role', 'admin')
    expect(error).toBeNull()

    const res = await app.request('/api/admin/contributors', authed(admin.token))
    const body = (await res.json()) as { total: number }

    // Pins the behaviour this fix depends on: count: 'exact' alongside
    // .limit() reports the full matching count, not the limited page length.
    expect(body.total).toBe(count)
  })

  it('orders newest first', async () => {
    const res = await app.request('/api/admin/contributors', authed(admin.token))
    const body = (await res.json()) as { accounts: Array<{ id: string }> }
    const ids = body.accounts.map((a) => a.id)
    expect(ids.indexOf(newer.id)).toBeLessThan(ids.indexOf(older.id))
  })

  it('never returns more accounts than the limit', async () => {
    const res = await app.request('/api/admin/contributors', authed(admin.token))
    const body = (await res.json()) as { accounts: unknown[]; total: number }
    expect(body.accounts.length).toBeLessThanOrEqual(1000)
    expect(body.accounts.length).toBeLessThanOrEqual(body.total)
  })
})
