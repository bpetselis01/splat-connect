/**
 * The signed-in person's own account: GET /api/me/deletion previews what a
 * deletion would do; DELETE /api/me does it
 * (docs/superpowers/specs/2026-09-30-account-deletion-design.md).
 */
import { Hono } from 'hono'
import type { AuthVariables } from '../middleware/auth.js'
import { createAdminClient } from '../supabase/client.js'
import { deleteAccount } from '../account-deletion.js'
import { revokeApple } from '../apple-revoke.js'
import { sendEmail } from '../mailer.js'

const me = new Hono<{ Variables: AuthVariables }>()

/** Ten minutes: the emailed code or Apple's sheet has to have just happened. */
const FRESH_SECONDS = 600

/** Newest authentication moment in the access token's `amr` claim. The auth
 *  middleware has already verified the token, so reading it is enough. */
export function lastAuthenticatedAt(token: string): number {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1]!, 'base64url').toString())
    const amr = (payload.amr ?? []) as { timestamp?: number }[]
    return Math.max(0, ...amr.map((a) => a.timestamp ?? 0))
  } catch {
    return 0
  }
}

me.get('/deletion', async (c) => {
  const { data, error } = await createAdminClient().rpc('account_deletion_preview', { uid: c.get('userId') })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

me.delete('/', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    confirm?: unknown
    keepCredit?: unknown
    appleAuthorizationCode?: unknown
  }
  if (body.confirm !== 'DELETE') return c.json({ error: 'Type DELETE to confirm.' }, 400)
  if (Date.now() / 1000 - lastAuthenticatedAt(c.get('token')) > FRESH_SECONDS) {
    return c.json({ error: 'reauth_required' }, 403)
  }

  const admin = createAdminClient()
  // Read before the row is gone: the confirmation goes to this address.
  const { data: who } = await admin.from('profiles').select('email').eq('id', c.get('userId')).single()
  const out = await deleteAccount(admin, c.get('userId'), body.keepCredit === true)
  if (out.error === 'sole_leader') {
    const { data } = await admin.rpc('account_deletion_preview', { uid: c.get('userId') })
    return c.json({ error: 'sole_leader', orgs: (data as { soleLedOrgs: unknown }).soleLedOrgs }, 409)
  }
  if (out.error) return c.json({ error: out.error }, 500)

  if (typeof body.appleAuthorizationCode === 'string') await revokeApple(body.appleAuthorizationCode)
  const emailed = who?.email
    ? await sendEmail(
        who.email,
        'Your SPLAT Connect account is deleted',
        [
          'Your SPLAT Connect account was deleted just now, as you asked.',
          '',
          'Gone: your profile, email and sign-in, child profiles, drafts, saved items, photos and pickup address.',
          'Kept without your name: published guides, and other members\' records of exchanges and messages with you.',
          '',
          "If you didn't do this, reply to this email straight away.",
        ].join('\n')
      )
    : false
  // `emailed` lets the done screen say "we emailed a confirmation" only when it's true.
  return c.json({ emailed })
})

export default me
