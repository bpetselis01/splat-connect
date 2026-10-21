import { useRef } from 'react'
import { Redirect, Stack } from 'expo-router'
import { useAuth } from '../../lib/auth-context'
import { takeReturnTo } from '../../lib/return-to'

// The signed-out stack: Welcome, Create account, Sign in, the code screen and
// the two reset steps. A session means one of them just worked — Guides runs
// the terms gate from there.
export default function AuthLayout() {
  const { session, loading, resetting } = useAuth()
  // Taken once: a re-render of this layout must not find the target already gone.
  const back = useRef<string | null>(null)
  if (loading) return null
  if (session && !resetting) {
    back.current ??= takeReturnTo() ?? '/home'
    return <Redirect href={back.current as never} />
  }
  return <Stack screenOptions={{ headerShown: false }} initialRouteName="welcome" />
}
