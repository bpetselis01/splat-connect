// packages/mobile/app/printing/_layout.tsx
// 3D printing, reached from a guide or the Explore card — never a tab, so it
// sits at the root beside (tabs) and (my) rather than inside either stack.
import { Redirect, Stack } from 'expo-router'
import { stackScreenOptions } from '../../lib/nav-options'
import { useAuthGate } from '../../lib/use-auth-gate'
import { CloseButton } from '../../components/ui/CloseButton'

export default function PrintingLayout() {
  // (my), (tabs), (onboarding) and printing are root siblings and each screen is
  // its own deep link, so every one of them runs the gate.
  const gate = useAuthGate()
  if (gate === 'loading') return null
  if (gate !== 'ok') return <Redirect href={gate} />

  return (
    <Stack screenOptions={{ ...stackScreenOptions, headerBackTitle: 'Back' }}>
      <Stack.Screen name="index" options={{ title: 'Find a printer' }} />
      {/* A modal, not a push: a one-shot form over the printers you picked,
          dismissed with an ✕ rather than gone back from. */}
      <Stack.Screen
        name="request"
        options={{ title: 'Request a print', presentation: 'modal', headerLeft: () => <CloseButton /> }}
      />
      <Stack.Screen name="jobs/[id]" options={{ title: 'Print job' }} />
      <Stack.Screen name="basics" options={{ title: 'Printing basics' }} />
    </Stack>
  )
}
