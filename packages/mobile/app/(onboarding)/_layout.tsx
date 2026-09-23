// The child profile wizard sits outside (my) and (tabs): a first run, one
// question a screen. Same session gate as (my)/_layout.tsx —
// /api/child-profiles needs a signed-in account.
import { Redirect, Stack } from 'expo-router'
import { stackScreenOptions } from '../../lib/nav-options'
import { useAuth } from '../../lib/auth-context'

export default function OnboardingLayout() {
  const { session, loading } = useAuth()
  if (loading) return null
  if (!session) return <Redirect href="/sign-in" />

  return (
    <Stack screenOptions={{ ...stackScreenOptions, headerBackTitle: 'Back' }}>
      <Stack.Screen name="child" options={{ title: 'Child profile' }} />
    </Stack>
  )
}
