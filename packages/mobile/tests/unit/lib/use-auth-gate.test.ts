import type { Session } from '@supabase/supabase-js'
import { gateFor } from '../../../lib/use-auth-gate'

jest.mock('../../../lib/auth-context', () => ({ useAuth: jest.fn() }))

const session = {} as Session

describe('gateFor', () => {
  it('waits while the session loads', () => {
    expect(gateFor({ loading: true, session: null, hasContributorTerms: null })).toBe('loading')
  })
  it('sends a signed-out visitor to Welcome', () => {
    expect(gateFor({ loading: false, session: null, hasContributorTerms: null })).toBe('/welcome')
  })
  it('sends an account that has not accepted to the terms gate', () => {
    expect(gateFor({ loading: false, session, hasContributorTerms: false })).toBe('/terms')
  })
  it('never redirects on an unknown terms state', () => {
    expect(gateFor({ loading: false, session, hasContributorTerms: null })).toBe('ok')
  })
  it('lets an accepted account through', () => {
    expect(gateFor({ loading: false, session, hasContributorTerms: true })).toBe('ok')
  })
  it('skips the terms check for the terms gate itself', () => {
    expect(gateFor({ loading: false, session, hasContributorTerms: false }, false)).toBe('ok')
  })
})
