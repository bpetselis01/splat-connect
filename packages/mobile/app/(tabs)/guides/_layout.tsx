// packages/mobile/app/(tabs)/guides/_layout.tsx
import { Stack } from 'expo-router'
import { stackScreenOptions } from '../../../lib/nav-options'

export default function GuidesStackLayout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      {/*
        The tab root draws its own ScreenHeader (title, subtitle, logo), so the
        native header here would be a second stacked title. Drill-down screens
        keep theirs — that is where the back affordance lives.
      */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="new" options={{ title: 'Add a guide', presentation: 'modal' }} />
      <Stack.Screen name="[id]/index" options={{ title: 'Guide' }} />
      <Stack.Screen name="[id]/preview" options={{ title: 'Preview' }} />
      <Stack.Screen name="contributor/[id]" options={{ title: 'Contributor' }} />
      <Stack.Screen name="organisation/[id]" options={{ title: 'Organisation' }} />
    </Stack>
  )
}
