/**
 * The signed-in person's own account: GET /api/me/deletion previews what a
 * deletion would do; DELETE /api/me does it
 * (docs/superpowers/specs/2026-09-30-account-deletion-design.md).
 */
import { Hono } from 'hono'
import type { AuthVariables } from '../middleware/auth.js'
import { createAdminClient, createUserClient } from '../supabase/client.js'
import { deleteAccount } from '../account-deletion.js'
import { revokeApple } from '../apple-revoke.js'
import { sendEmail } from '../mailer.js'
import type { MeCounts } from '@splat-connect/types'

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

/** "N builds logged" on My SPLAT (091). RLS shows a member only their own rows. */
me.get('/builds', async (c) => {
  const { count, error } = await createUserClient(c.get('token'))
    .from('tutorial_builds')
    .select('tutorial_id', { count: 'exact', head: true })
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ builds: count ?? 0 })
})

/**
 * me-count-badges: every number on My SPLAT in one call. Each is a head count
 * through the caller's own client, so RLS scopes it exactly as the list it
 * badges. A count whose query fails is logged and reads 0: one bad table must
 * not take the whole tab down.
 */
me.get('/counts', async (c) => {
  const sb = createUserClient(c.get('token'))
  const uid = c.get('userId')
  const head = { count: 'exact', head: true } as const
  const n = async (label: string, q: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
    const { count, error } = await q
    if (error) {
      console.error(`[me/counts] ${label} failed:`, error.message)
      return 0
    }
    return count ?? 0
  }

  const { data: led } = await sb.from('org_leaders').select('org_id').eq('user_id', uid)
  const orgIds = (led ?? []).map((r) => r.org_id as string)
  const { data: printers } = await sb
    .from('printers')
    .select('id, owner_id')
    .or(orgIds.length ? `owner_id.eq.${uid},owner_org_id.in.(${orgIds.join(',')})` : `owner_id.eq.${uid}`)
  const minePrinters = (printers ?? []).filter((p) => p.owner_id === uid).map((p) => p.id as string)
  const orgPrinters = (printers ?? []).filter((p) => p.owner_id !== uid).map((p) => p.id as string)
  const jobsOn = (ids: string[], label: string) =>
    ids.length
      ? n(label, sb.from('toy_transactions').select('id', head).eq('type', 'print').eq('status', 'requested').in('printer_id', ids))
      : Promise.resolve(0)

  const review = async () => {
    if (!orgIds.length) return 0
    const { data, error } = await sb
      .from('tutorial_orgs')
      .select('status, tutorials!inner(status)')
      .in('org_id', orgIds)
      .in('status', ['pending', 'accepted'])
    if (error) {
      console.error('[me/counts] review failed:', error.message)
      return 0
    }
    // Web's rule: a request to answer, or one accepted on a guide still in review.
    return (data ?? []).filter(
      (r) => r.status === 'pending' || (r.tutorials as unknown as { status: string }).status === 'pending'
    ).length
  }

  const [tutorials, ideasMine, ideasJoined, makers, printRequests, printJobs, reviewCount, intake, orgOrders] = await Promise.all([
    n('tutorials', sb.from('tutorials').select('id, tutorial_contributors!inner(profile_id)', head).eq('tutorial_contributors.profile_id', uid).eq('status', 'rejected')),
    // 108 hides toy_ideas.author_id from members, so this one counts through
    // the admin client, scoped by hand, exactly as GET /api/ideas/mine reads.
    n('ideas', createAdminClient().from('toy_ideas').select('id', head).eq('author_id', uid).in('status', ['pending', 'challenge'])),
    n('joined', sb.from('toy_idea_participants').select('idea_id, toy_ideas!inner(status)', head).eq('profile_id', uid).is('removed_at', null).eq('toy_ideas.status', 'challenge')),
    n('makers', sb.from('toy_transactions').select('id', head).eq('type', 'build').eq('status', 'requested').is('owner_id', null).is('owner_org_id', null).neq('requester_id', uid)),
    n('print requests', sb.from('toy_transactions').select('id', head).eq('type', 'print').eq('requester_id', uid).in('status', ['requested', 'accepted'])),
    jobsOn(minePrinters, 'print jobs'),
    review(),
    orgIds.length ? n('intake', sb.from('recycling_dropoffs').select('id', head).in('org_id', orgIds).eq('status', 'booked')) : Promise.resolve(0),
    jobsOn(orgPrinters, 'org orders'),
  ])

  const counts: MeCounts = {
    tutorials,
    challenges: ideasMine + ideasJoined,
    makers,
    printRequests,
    printJobs,
    review: reviewCount,
    intake,
    orgOrders,
  }
  return c.json(counts)
})

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
