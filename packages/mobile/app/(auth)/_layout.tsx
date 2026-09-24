import { useEffect } from 'react'
import { Redirect, Stack } from 'expo-router'
import { pendingIntent, type SignupIntent } from '@splat-connect/types'
import { useAuth } from '../../lib/auth-context'
import { supabase } from '../../lib/supabase'

/** Where the sign-up tile lands someone the first time they sign in: the
 *  child profile flow, or My tutorials. Web's login page has the same map. */
const INTENT_LANDING: Record<SignupIntent, '/account' | '/tutorials'> = {
  family: '/account',
  maker: '/tutorials',
}

export default function AuthLayout() {
  const { session, loading } = useAuth()
  // Read off the session before the write below lands, so this sign-in still
  // sees the intent; the write is what makes it the only one that does.
  const intent = pendingIntent(session?.user.user_metadata)

  useEffect(() => {
    if (intent) void supabase.auth.updateUser({ data: { intent_landed: true } })
  }, [intent])

  if (loading) return null
  if (session) return <Redirect href={intent ? INTENT_LANDING[intent] : '/guides'} />
  return <Stack screenOptions={{ headerShown: false }} />
}
