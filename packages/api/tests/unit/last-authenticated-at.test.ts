import { describe, it, expect } from 'vitest'
import { lastAuthenticatedAt } from '../../src/routes/me.js'

const token = (payload: unknown) => `h.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.s`

describe('lastAuthenticatedAt', () => {
  it('takes the newest amr entry', () => {
    expect(lastAuthenticatedAt(token({ amr: [{ method: 'password', timestamp: 10 }, { method: 'otp', timestamp: 99 }] }))).toBe(99)
  })
  it('is 0 for a token with no amr, so the route asks to re-authenticate', () => {
    expect(lastAuthenticatedAt(token({}))).toBe(0)
    expect(lastAuthenticatedAt('garbage')).toBe(0)
  })
})
