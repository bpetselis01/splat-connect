// packages/mobile/app/printing/_layout.tsx
// 3D printing, reached from a guide or the Explore card — never a tab, so it
// sits at the root beside (tabs) and (my) rather than inside either stack.
import { Redirect, Stack } from 'expo-router'
import { stackScreenOptions } from '../../lib/nav-options'
import { useAuth } from '../../lib/auth-context'
import { CloseButton } from '../../components/ui/CloseButton'

export default function PrintingLayout() {
  // /api/printers needs a session, and every screen here is its own deep link —
  // the same gate as (my)/_layout.tsx.
  const { session, loading } = useAuth()
  if (loading) return null
  if (!session) return <Redirect href="/sign-in" />

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
