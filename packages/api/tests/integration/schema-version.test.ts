/**
 * The API knows which migration it was written against and which one its
 * database has, and says so on /health. Against a stack that is current the two
 * agree; a stack missing a migration file's columns would report `behind`
 * here instead of 500ing route by route (the 088 inbox outage).
 */
import { readdirSync } from 'node:fs'
import { describe, it, expect, vi } from 'vitest'
import app from '../../src/app.js'

describe('schema version', () => {
  it('/health reports the database at the repo\'s newest migration', async () => {
    const newest = readdirSync('../../supabase/migrations').map((f) => f.slice(0, 3)).sort().at(-1)
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { status: string; schema: { code: string | null; db: string | null; behind: boolean } }
    expect(body.schema).toEqual({ code: newest, db: newest, behind: false })
  })

  it('/health shows no schema detail in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    try {
      const res = await app.request('/health')
      expect(await res.json()).toEqual({ status: 'ok' })
    } finally {
      vi.unstubAllEnvs()
    }
  })
})
