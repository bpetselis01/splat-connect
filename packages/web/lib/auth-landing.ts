import type { SignupIntent } from '@splat-connect/types'
import { pendingIntent } from '@splat-connect/types'
import type { createClient } from '@/lib/supabase/client'
import { sanitiseNextPath } from '@/lib/safe-next-path'

/** Where the sign-up tile lands someone the first time they sign in. */
const INTENT_LANDING: Record<SignupIntent, string> = {
  family: '/onboarding/child',
  maker: '/dashboard/tutorials',
}

/**
 * Where a member goes once a session exists, whichever way they got it
 * (password, emailed code, password reset).
 *
 * Everyone shares one dashboard; only the admin area is separate. `next` is
 * only honoured once sanitiseNextPath has confirmed it is a same-origin path.
 * The sign-up tile decides the first landing only, and is spent here whichever
 * way this sign-in goes, so a ?next= detour does not leave it to hijack some
 * later sign-in.
 */
export async function landingAfterSignIn(
  supabase: ReturnType<typeof createClient>,
  next: string | null
): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const intent = pendingIntent(user!.user_metadata)
  if (intent) await supabase.auth.updateUser({ data: { intent_landed: true } })
  const fallback = profile?.role === 'admin' ? '/admin' : '/dashboard'
  return sanitiseNextPath(next) ?? (intent ? INTENT_LANDING[intent] : fallback)
}

/** An auth page URL; params that are empty are left off. */
export function authPath(path: string, params: Record<string, string | null | undefined>): string {
  const query = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1]))
  return query.size ? `${path}?${query}` : path
}
