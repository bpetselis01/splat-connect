/**
 * 122: site content is written through the API only. An admin's own
 * PostgREST session can read it but not write it — the admin PUT is the one
 * writer, and it checks the Learn outline and refuses a stale save. Selects
 * through the admin client too, so a repaired-not-run 122 fails here.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

const KEY = 'test-direct-write'
let admin: TestUser

const userClient = (token: string) =>
  createClient(process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321', process.env.SUPABASE_ANON_KEY ?? '', {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

beforeAll(async () => {
  admin = await createTestUser('admin')
})

afterAll(async () => {
  await adminClient().from('site_content').delete().eq('key', KEY)
  await deleteTestUser(admin.id)
})

describe('site_content writes (122)', () => {
  it("refuses an admin's direct insert, update and delete", async () => {
    const sb = userClient(admin.token)
    const ins = await sb.from('site_content').insert({ key: KEY, value: { a: 1 } })
    expect(ins.error).not.toBeNull()

    await adminClient().from('site_content').insert({ key: KEY, value: { a: 1 } })
    const upd = await sb.from('site_content').update({ value: { a: 2 } }).eq('key', KEY).select()
    expect(upd.data ?? []).toHaveLength(0)
    const del = await sb.from('site_content').delete().eq('key', KEY).select()
    expect(del.data ?? []).toHaveLength(0)

    const { data } = await adminClient().from('site_content').select('value').eq('key', KEY).single()
    expect(data!.value).toEqual({ a: 1 })
    // Reads are unchanged.
    const read = await sb.from('site_content').select('value').eq('key', KEY).single()
    expect(read.data!.value).toEqual({ a: 1 })
  })

  it('still saves through the admin API', async () => {
    const res = await app.request(`/api/admin/content/${KEY}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${admin.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: { a: 3 } }),
    })
    expect(res.status).toBe(200)
    const { data } = await adminClient().from('site_content').select('value').eq('key', KEY).single()
    expect(data!.value).toEqual({ a: 3 })
  })
})
