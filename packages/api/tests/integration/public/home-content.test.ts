import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { adminClient } from '../../helpers/auth.js'

const BASE = 'http://localhost'
const KEYS = ['home-hero', 'home-numbers', 'home-scenes'] as const

describe('GET /api/public/content/home', () => {
  // The three rows are the site's real home copy, so put back whatever was
  // there rather than deleting it.
  let before: Array<{ key: string; value: unknown }> = []

  beforeAll(async () => {
    const admin = adminClient()
    const { data } = await admin.from('site_content').select('key, value').in('key', [...KEYS])
    before = data ?? []
    await admin.from('site_content').upsert([
      { key: 'home-hero', value: { headline: 'Press it.' } },
      { key: 'home-scenes', value: { scenes: [{ title: 'At home', line: 'A line.' }] } },
    ])
    await admin.from('site_content').delete().eq('key', 'home-numbers')
  })

  afterAll(async () => {
    const admin = adminClient()
    await admin.from('site_content').delete().in('key', [...KEYS])
    if (before.length) await admin.from('site_content').insert(before)
  })

  it('gives a guest the saved home sections, and null for one never saved', async () => {
    const res = await app.request(`${BASE}/api/public/content/home`)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      hero: { headline: 'Press it.' },
      numbers: null,
      scenes: { scenes: [{ title: 'At home', line: 'A line.' }] },
    })
  })
})
