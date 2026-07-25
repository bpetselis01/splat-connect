// packages/mobile/app/(tabs)/profile/_layout.tsx
import { Stack } from 'expo-router'
import { stackScreenOptions } from '../../../lib/nav-options'

export default function ProfileStackLayout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      {/* See the home stack: the tab root supplies its own ScreenHeader. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="ability" options={{ title: 'Ability Profile' }} />
      <Stack.Screen name="everyday-needs" options={{ title: 'Everyday Needs' }} />
      <Stack.Screen name="customization" options={{ title: 'Customization Metrics' }} />
    </Stack>
  )
}
