// The child profile wizard sits outside (my) and (tabs): a first run, one
// question a screen. Same session gate as (my)/_layout.tsx —
// /api/child-profiles needs a signed-in account.
import { Redirect, Stack } from 'expo-router'
import { stackScreenOptions } from '../../lib/nav-options'
import { useAuthGate } from '../../lib/use-auth-gate'

export default function OnboardingLayout() {
  // (my), (tabs), (onboarding) and printing are root siblings and each screen is
  // its own deep link, so every one of them runs the gate.
  const gate = useAuthGate()
  if (gate === 'loading') return null
  if (gate !== 'ok') return <Redirect href={gate} />

  return (
    <Stack screenOptions={{ ...stackScreenOptions, headerBackTitle: 'Back' }}>
      <Stack.Screen name="child" options={{ title: 'Child profile' }} />
    </Stack>
  )
}
