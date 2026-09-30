/**
 * Revoking SPLAT's Sign in with Apple grant when an account is deleted — Apple
 * requires it (developer.apple.com/support/offering-account-deletion-in-your-app).
 *
 * The app hands over a fresh authorization code from Apple's sheet; it is
 * exchanged for a refresh token, which is then revoked. Both calls need a
 * client secret: a short ES256 JWT signed with the team's Sign in with Apple
 * key. Node's crypto signs it, so no JWT dependency.
 *
 * Returns false (never throws) when the key is not configured or Apple
 * refuses: the account is already deleted by the time this runs, and the
 * person must not be told otherwise.
 */
import { createPrivateKey, sign } from 'node:crypto'

const APPLE = 'https://appleid.apple.com'
const b64 = (v: string | Buffer) => Buffer.from(v).toString('base64url')

export function clientSecret(teamId: string, keyId: string, privateKey: string, clientId: string) {
  const now = Math.floor(Date.now() / 1000)
  const head = b64(JSON.stringify({ alg: 'ES256', kid: keyId }))
  const body = b64(JSON.stringify({ iss: teamId, iat: now, exp: now + 300, aud: APPLE, sub: clientId }))
  const key = createPrivateKey(privateKey.replace(/\\n/g, '\n'))
  const sig = sign('sha256', Buffer.from(`${head}.${body}`), { key, dsaEncoding: 'ieee-p1363' })
  return `${head}.${body}.${b64(sig)}`
}

// PENDING(apple-revoke): returns false until APPLE_TEAM_ID / APPLE_KEY_ID /
// APPLE_PRIVATE_KEY / APPLE_CLIENT_ID are set on the API (wizard stage 12).
export async function revokeApple(authorizationCode: string): Promise<boolean> {
  const { APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY, APPLE_CLIENT_ID } = process.env
  if (!APPLE_TEAM_ID || !APPLE_KEY_ID || !APPLE_PRIVATE_KEY || !APPLE_CLIENT_ID) return false
  try {
    const secret = clientSecret(APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY, APPLE_CLIENT_ID)
    const form = (fields: Record<string, string>) => ({
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: APPLE_CLIENT_ID, client_secret: secret, ...fields }),
    })
    const tokenRes = await fetch(`${APPLE}/auth/token`, form({ code: authorizationCode, grant_type: 'authorization_code' }))
    const { refresh_token } = (await tokenRes.json()) as { refresh_token?: string }
    if (!refresh_token) return false
    const revoked = await fetch(`${APPLE}/auth/revoke`, form({ token: refresh_token, token_type_hint: 'refresh_token' }))
    return revoked.ok
  } catch (e) {
    console.error('Apple revoke failed', e)
    return false
  }
}
