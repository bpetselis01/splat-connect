import { describe, it, expect, vi } from 'vitest'
import { apiMessage, isTermsRequired, makeApiClient } from '@splat-connect/types'

// A response as api-core reads it: ok, status and clone().json() for the error body.
const refused = (status: number, body: () => Promise<unknown>) =>
  vi.fn().mockResolvedValue({ ok: false, status, clone: () => ({ json: body }) })

async function failure(status: number, body: () => Promise<unknown>, onTermsRequired?: () => void) {
  globalThis.fetch = refused(status, body) as unknown as typeof fetch
  const client = makeApiClient({ getToken: async () => 't', baseUrl: () => 'http://api', onTermsRequired })
  return client.post('/api/x', {}).catch((e: unknown) => e)
}

describe('isTermsRequired', () => {
  it('is true for a 403 whose JSON body says terms_required', async () => {
    const onTermsRequired = vi.fn()
    const err = await failure(403, async () => ({ error: 'terms_required', version: '2' }), onTermsRequired)
    expect(isTermsRequired(err)).toBe(true)
    expect(onTermsRequired).toHaveBeenCalledTimes(1)
  })

  it('is false for a 403 with a non-JSON body', async () => {
    const onTermsRequired = vi.fn()
    const err = await failure(403, async () => { throw new SyntaxError('Unexpected token <') }, onTermsRequired)
    expect(isTermsRequired(err)).toBe(false)
    expect(onTermsRequired).not.toHaveBeenCalled()
  })

  it('is false for a plain 403', async () => {
    const err = await failure(403, async () => ({ error: 'Forbidden' }))
    expect(isTermsRequired(err)).toBe(false)
  })

  it('is false for the same code on another status, and for a non-error', async () => {
    expect(isTermsRequired(await failure(400, async () => ({ error: 'terms_required' })))).toBe(false)
    expect(isTermsRequired(null)).toBe(false)
  })
})

describe('apiMessage for a terms refusal', () => {
  it('says to accept the contributor terms instead of the raw code', async () => {
    const err = await failure(403, async () => ({ error: 'terms_required' }))
    expect(apiMessage(err, 'fallback')).toBe('Accept the contributor terms to continue')
  })
})
