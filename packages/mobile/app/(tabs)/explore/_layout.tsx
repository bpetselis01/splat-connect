// packages/mobile/app/(tabs)/explore/_layout.tsx
import { Stack } from 'expo-router'
import { stackScreenOptions } from '../../../lib/nav-options'

export default function ExploreStackLayout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      {/*
        The tab root draws its own ScreenHeader (title, subtitle, logo), so the
        native header here would be a second stacked title. Drill-down screens
        keep theirs — that is where the back affordance lives.
      */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="learn/index" options={{ title: 'Learn' }} />
      {/* Overridden per-article by article-screen.tsx's own <Stack.Screen>
          once the slug resolves; this is the fallback for an unknown one. */}
      <Stack.Screen name="learn/[slug]" options={{ title: 'Guide' }} />
      <Stack.Screen name="challenges/index" options={{ title: 'Design challenges' }} />
      {/* The brief carries its own title, so the header stays generic rather
          than repeating a long challenge name in a narrow bar. */}
      <Stack.Screen name="challenges/[id]" options={{ title: 'Challenge' }} />
      <Stack.Screen name="challenges/new" options={{ title: 'Submit an idea' }} />
      <Stack.Screen name="about" options={{ title: 'About SPLAT' }} />
    </Stack>
  )
}
