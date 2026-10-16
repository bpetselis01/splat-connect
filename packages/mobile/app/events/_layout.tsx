// packages/mobile/app/events/_layout.tsx
// One event and what follows from it. Beside (tabs) and (my) at the root, with
// no gate of its own: the detail page is public, so a guest can read it. The
// register and print screens check for a session themselves.
import { Stack } from 'expo-router'
import { stackScreenOptions } from '../../lib/nav-options'

export default function EventsLayout() {
  return (
    <Stack screenOptions={{ ...stackScreenOptions, headerBackTitle: 'Back' }}>
      <Stack.Screen name="[id]/index" options={{ title: 'Event' }} />
      <Stack.Screen name="[id]/register" options={{ title: 'Register' }} />
      <Stack.Screen name="[id]/print" options={{ title: 'Print parts' }} />
    </Stack>
  )
}
