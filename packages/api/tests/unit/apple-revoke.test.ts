import { describe, it, expect, vi, afterEach } from 'vitest'
import { generateKeyPairSync, verify } from 'node:crypto'
import { clientSecret, revokeApple } from '../../src/apple-revoke.js'

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' })
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()

afterEach(() => vi.unstubAllEnvs())

describe('clientSecret', () => {
  it('is an ES256 JWT Apple can verify, from a key stored with escaped newlines', () => {
    const jwt = clientSecret('TEAM123456', 'KEY1234567', pem.replace(/\n/g, '\\n'), 'com.splatconnect.mobile')
    const [head, body, sig] = jwt.split('.')
    expect(JSON.parse(Buffer.from(head!, 'base64url').toString())).toEqual({ alg: 'ES256', kid: 'KEY1234567' })
    const claims = JSON.parse(Buffer.from(body!, 'base64url').toString())
    expect(claims).toMatchObject({ iss: 'TEAM123456', aud: 'https://appleid.apple.com', sub: 'com.splatconnect.mobile' })
    const ok = verify('sha256', Buffer.from(`${head}.${body}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig!, 'base64url'))
    expect(ok).toBe(true)
  })
})

describe('revokeApple', () => {
  it('does nothing, and says so, when the key is not configured', async () => {
    vi.stubEnv('APPLE_TEAM_ID', '')
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    expect(await revokeApple('code')).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
