// packages/mobile/app/(tabs)/home/_layout.tsx
import { Stack } from 'expo-router'

export default function HomeStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="index" options={{ title: 'Tutorials' }} />
      <Stack.Screen name="[id]/index" options={{ title: 'Tutorial' }} />
      <Stack.Screen name="[id]/preview" options={{ title: 'Preview' }} />
    </Stack>
  )
}
