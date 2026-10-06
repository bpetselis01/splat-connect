// packages/mobile/app/(tabs)/toy-library/_layout.tsx
import { Stack } from 'expo-router'
import { useTabFocused } from '../../../lib/use-tab-focused'
import { stackScreenOptions } from '../../../lib/nav-options'

// A deep link or notification straight to a pushed screen still lands with
// the list under it: without this the stack held that one screen, so there
// was no back button and the tab bar showed as if it were a tab root.
export const unstable_settings = { initialRouteName: 'index' }

export default function ToyLibraryStackLayout() {
  // A hidden tab keeps its stack while another tab is in front, so the next
  // visit pushed onto the last one. Unmounted while another tab shows, the
  // stack starts fresh with just the screen opened, and Back falls through to
  // the tab history (backBehavior="history" in (tabs)/_layout).
  if (!useTabFocused()) return null
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
