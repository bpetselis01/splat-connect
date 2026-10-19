/**
 * 120 (wizard-steps): what a child enjoys, and three optional measurements,
 * kept on the child profile. Limits are checked twice — a 400 sentence from
 * the API, a CHECK in the table. The measurements are the child's private
 * data (APP 3): only the parent reads them back.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let parent: TestUser
let stranger: TestUser

const authed = (token: string, init: RequestInit = {}) => ({
  ...init,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
})

// Below the API, straight to PostgREST — the only other way in.
const directClient = (token?: string) =>
  createClient(process.env.SUPABASE_URL ?? 'http://localhost:54321', process.env.SUPABASE_ANON_KEY ?? '', {
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
    auth: { persistSession: false },
  })

beforeAll(async () => {
  parent = await createTestUser('contributor')
  stranger = await createTestUser('contributor')
})

afterAll(async () => {
  await adminClient().from('child_profiles').delete().eq('parent_id', parent.id)
  await deleteTestUser(parent.id)
  await deleteTestUser(stranger.id)
})

describe('120 child profile play and measurements', () => {
  it('the three new columns exist', async () => {
    const { error } = await adminClient().from('child_profiles').select('enjoys, reach_cm, tray_mm').limit(1)
    expect(error).toBeNull()
  })

  it('saves what the child enjoys, once each, and the three measurements', async () => {
    const res = await app.request('/api/child-profiles', authed(parent.token, {
      method: 'POST',
      body: JSON.stringify({ enjoys: ['light', 'calm', 'light'], palm_width_mm: 62, reach_cm: 30, tray_mm: 15 }),
    }))
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ enjoys: ['light', 'calm'], palm_width_mm: 62, reach_cm: 30, tray_mm: 15 })
  })

  it('Z07 PATCH edits and clears them', async () => {
    const created = (await (await app.request('/api/child-profiles', authed(parent.token, {
      method: 'POST',
      body: JSON.stringify({ enjoys: ['sound'], reach_cm: 30 }),
    }))).json()) as { id: string }
    const res = await app.request(`/api/child-profiles/${created.id}`, authed(parent.token, {
      method: 'PATCH',
      body: JSON.stringify({ enjoys: [], reach_cm: null, tray_mm: 20 }),
    }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ enjoys: [], reach_cm: null, tray_mm: 20 })
  })

  it('400s with a sentence on a value outside its vocabulary or range', async () => {
    for (const body of [
      { enjoys: ['loud'] },
      { enjoys: 'light' },
      { palm_width_mm: 10 },
      { palm_width_mm: '62' },
      { reach_cm: 200 },
      { tray_mm: 0 },
    ]) {
      const res = await app.request('/api/child-profiles', authed(parent.token, { method: 'POST', body: JSON.stringify(body) }))
      expect(res.status, JSON.stringify(body)).toBe(400)
      expect(((await res.json()) as { error: string }).error).toMatch(/must be/)
    }
  })

  it('the table refuses an out-of-range measurement written past the API', async () => {
    const { error } = await adminClient()
      .from('child_profiles')
      .insert({ parent_id: parent.id, tray_mm: 500 })
    expect(error?.code).toBe('23514') // check_violation
  })

  it('neither anon nor another member can read them', async () => {
    const anon = await directClient().from('child_profiles').select('enjoys, palm_width_mm, reach_cm, tray_mm')
    expect(anon.data ?? []).toEqual([])
    const other = await directClient(stranger.token)
      .from('child_profiles')
      .select('enjoys, palm_width_mm, reach_cm, tray_mm')
      .eq('parent_id', parent.id)
    expect(other.data ?? []).toEqual([])
    const api = await app.request('/api/child-profiles', authed(stranger.token))
    expect(await api.json()).toEqual([])
  })
})
