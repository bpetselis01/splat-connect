/**
 * Terms acceptance records. No legal text here — the terms are versioned
 * static content under app/legal/, referenced by version string; the server
 * chooses the version from AGREEMENT_VERSIONS. No update or delete path, by
 * design: an acceptance record must not be editable. contributor_terms gates
 * tutorial submission; org_leader_terms gates review grants.
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
