// packages/mobile/app/(tabs)/profile/_layout.tsx
import { Stack } from 'expo-router'

export default function ProfileStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="index" options={{ title: 'Profile' }} />
      <Stack.Screen name="ability" options={{ title: 'Ability Profile' }} />
      <Stack.Screen name="everyday-needs" options={{ title: 'Everyday Needs' }} />
      <Stack.Screen name="customization" options={{ title: 'Customization Metrics' }} />
    </Stack>
  )
}
