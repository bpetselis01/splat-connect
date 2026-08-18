import { describe, it, expect } from 'vitest'
import app from '../../../src/app.js'

const post = (body: unknown) =>
  app.request('/api/public/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

describe('POST /api/public/notify', () => {
  it('accepts a registration with no Authorization header', async () => {
    const res = await post({ email: `notify-${Date.now()}@example.com`, featureKey: 'requests' })
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('rejects a feature key that is not on the allowlist', async () => {
    const res = await post({ email: 'x@example.com', featureKey: 'not-a-feature' })
    expect(res.status).toBe(400)
  })

  it('rejects a malformed email', async () => {
    const res = await post({ email: 'nope', featureKey: 'requests' })
    expect(res.status).toBe(400)
  })

  it('rejects a missing body field', async () => {
    const res = await post({ featureKey: 'requests' })
    expect(res.status).toBe(400)
  })

  // Two responses would leak whether an address is already on a list, and a
  // duplicate is not something the visitor needs to hear about.
  it('treats a duplicate registration as success', async () => {
    const email = `dupe-${Date.now()}@example.com`
    const first = await post({ email, featureKey: 'events' })
    const second = await post({ email, featureKey: 'events' })
    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
  })

  it('lets the same address register for two different features', async () => {
    const email = `multi-${Date.now()}@example.com`
    expect((await post({ email, featureKey: 'news' })).status).toBe(200)
    expect((await post({ email, featureKey: 'map' })).status).toBe(200)
  })
})
