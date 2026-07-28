/**
 * Terms Acceptance Routes (Protected)
 *
 * Records that a user accepted a version of an agreement. Contains no legal
 * text: the terms themselves are versioned static content under app/legal/,
 * referenced by the version string.
 *
 * Endpoints:
 * - POST /api/agreements
 *   - Body: { agreement_type: 'contributor_terms' | 'org_leader_terms' }
 *   - The version is server-chosen from AGREEMENT_VERSIONS, so a client cannot
 *     claim acceptance of a version that was never published.
 *   - Returns: UserAgreement
 *
 * - GET /api/agreements/me
 *   - The caller's acceptances, so the UI can skip a gate already passed.
 *
 * Security notes:
 * - Writes go through createUserClient. The insert policy pins user_id to
 *   auth.uid(), so one user cannot record an acceptance for another.
 * - There is no update or delete path, by design — an acceptance record that
 *   can be edited is not a record.
 *
 * Related files:
 * - supabase/migrations/007_organizations.sql: user_agreements + has_accepted()
 * - routes/tutorial-orgs.ts: the review grant is gated on org_leader_terms
 * - routes/tutorials.ts: submission is gated on contributor_terms
 */
import { Hono } from 'hono'
import { createUserClient } from '../supabase/user-client.js'
import type { AuthVariables } from '../middleware/auth.js'
import { AGREEMENT_VERSIONS, type AgreementType } from '@splat-connect/types'

const agreements = new Hono<{ Variables: AuthVariables }>()

agreements.get('/me', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('user_agreements')
    .select('*')
    .order('accepted_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

agreements.post('/', async (c) => {
  const body = await c.req.json<{ agreement_type?: string }>()
  const type = body.agreement_type as AgreementType
  if (type !== 'contributor_terms' && type !== 'org_leader_terms') {
    return c.json({ error: 'agreement_type must be contributor_terms or org_leader_terms' }, 400)
  }

  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('user_agreements')
    .insert({
      user_id: c.get('userId'),
      agreement_type: type,
      version: AGREEMENT_VERSIONS[type],
    })
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data, 201)
})

export default agreements
