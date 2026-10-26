/**
 * The contributor-terms gate. A member who has not accepted the current
 * version of the contributor terms cannot make the writes in TERMS_GATED;
 * app.ts attaches requireContributorTerms to each of them, after auth. Reads,
 * POST /api/agreements, and following or thanking an organisation stay open.
 * Admins are not exempt. Both clients read `terms_required` and route the
 * member to the terms screen (isTermsRequired in @splat-connect/types).
 */
import type { Context, MiddlewareHandler } from 'hono'
import { AGREEMENT_VERSIONS } from '@splat-connect/types'
import { createUserClient } from './supabase/client.js'
import type { AuthVariables } from './middleware/auth.js'

type Method = 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/**
 * Written exactly as the router registers each path, parameter names included;
 * terms.test.ts fails on a line here that matches no route.
 */
export const TERMS_GATED: readonly { method: Method; path: string }[] = [
  { method: 'POST', path: '/api/tutorials' },
  { method: 'PUT', path: '/api/tutorials/:id/steps' },

  { method: 'POST', path: '/api/toy-transactions' },
  { method: 'POST', path: '/api/toy-transactions/build' },
  { method: 'POST', path: '/api/toy-transactions/print' },
  { method: 'POST', path: '/api/toy-transactions/print-at-event' },
  { method: 'POST', path: '/api/toy-transactions/:id/messages' },
  { method: 'POST', path: '/api/toy-transactions/:id/accept' },
  { method: 'POST', path: '/api/toy-transactions/:id/claim' },
  { method: 'POST', path: '/api/toy-transactions/:id/questions' },

  { method: 'POST', path: '/api/organizations/:id/conversations/mine/messages' },
  { method: 'POST', path: '/api/organizations/conversations/:cid/messages' },
  { method: 'POST', path: '/api/organizations/:id/leaders' },
  { method: 'PATCH', path: '/api/organizations/:id/pickup' },
  { method: 'PATCH', path: '/api/organizations/:id/profile' },
  { method: 'PUT', path: '/api/organizations/:id/doors' },
  { method: 'PUT', path: '/api/organizations/:id/rate-lines' },
  { method: 'POST', path: '/api/organizations/:id/events' },
  { method: 'PATCH', path: '/api/organizations/:orgId/events/:id' },
  { method: 'DELETE', path: '/api/organizations/:orgId/events/:id' },
  { method: 'PUT', path: '/api/organizations/:orgId/events/:id/questions' },
  { method: 'POST', path: '/api/organizations/:id/stories' },
  { method: 'PATCH', path: '/api/organizations/:orgId/stories/:id' },
  { method: 'DELETE', path: '/api/organizations/:orgId/stories/:id' },
  { method: 'POST', path: '/api/organizations/:id/recycling' },
  { method: 'PATCH', path: '/api/organizations/:orgId/recycling/:id' },
  { method: 'POST', path: '/api/organizations/requests' },
]

/** Fails closed: a lookup that errors counts as not accepted, and is logged so an outage shows. */
export async function hasAcceptedContributorTerms(c: Context<{ Variables: AuthVariables }>) {
  const { data, error } = await createUserClient(c.get('token'))
    .from('user_agreements')
    .select('id')
    .eq('user_id', c.get('userId'))
    .eq('agreement_type', 'contributor_terms')
    .eq('version', AGREEMENT_VERSIONS.contributor_terms)
    .limit(1)
  if (error) {
    console.error(`[terms] lookup failed route=${c.req.method} ${c.req.path} user=${c.get('userId')}:`, error.message)
    return false
  }
  return (data ?? []).length > 0
}

export const termsRequired = (c: Context) =>
  c.json({ error: 'terms_required', version: AGREEMENT_VERSIONS.contributor_terms }, 403)

export const requireContributorTerms: MiddlewareHandler<{ Variables: AuthVariables }> = async (c, next) => {
  if (!(await hasAcceptedContributorTerms(c))) return termsRequired(c)
  await next()
}
