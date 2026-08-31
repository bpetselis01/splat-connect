// packages/mobile/app/(tabs)/toy-library/_layout.tsx
import { Stack } from 'expo-router'
import { stackScreenOptions } from '../../../lib/nav-options'

export default function ToyLibraryStackLayout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      {/*
        The tab root draws its own ScreenHeader (title, subtitle, logo), so the
        native header here would be a second stacked title. Drill-down screens
        keep theirs — that is where the back affordance lives.
      */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: 'Toy' }} />
      <Stack.Screen name="organisations" options={{ title: 'Organisations' }} />
      <Stack.Screen name="organisation/[id]" options={{ title: 'Organisation' }} />
    </Stack>
  )
}
