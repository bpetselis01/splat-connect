// The one decision every signed-in layout makes: wait, send a signed-out
// visitor to Welcome, send an account that has not accepted the contributor
// terms to the terms gate, or let it through.
//
// Only `false` means not accepted — null is "not fetched yet" or "the fetch
// failed", and redirecting on it would flash the gate at accepted accounts.
import type { Session } from '@supabase/supabase-js'
import { useAuth } from './auth-context'

export type Gate = 'loading' | '/welcome' | '/terms' | 'ok'

export function gateFor(
  auth: { loading: boolean; session: Session | null; hasContributorTerms: boolean | null },
  checkTerms = true
): Gate {
  if (auth.loading) return 'loading'
  if (!auth.session) return '/welcome'
  if (checkTerms && auth.hasContributorTerms === false) return '/terms'
  return 'ok'
}

export function useAuthGate(checkTerms = true): Gate {
  return gateFor(useAuth(), checkTerms)
}
