import { Redirect, Stack } from 'expo-router'
import { useAuth } from '../../lib/auth-context'

// The signed-out stack: Welcome, Create account, Sign in, the code screen and
// the two reset steps. A session means one of them just worked — Guides runs
// the terms gate from there.
export default function AuthLayout() {
  const { session, loading } = useAuth()
  if (loading) return null
  if (session) return <Redirect href="/guides" />
  return <Stack screenOptions={{ headerShown: false }} initialRouteName="welcome" />
}
