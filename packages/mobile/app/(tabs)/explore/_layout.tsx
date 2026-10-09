// packages/mobile/app/(tabs)/explore/_layout.tsx
import { Stack } from 'expo-router'
import { useTabFocused } from '../../../lib/use-tab-focused'
import { headerLeftSlot, headerRightSlot, stackScreenOptions } from '../../../lib/nav-options'
import { CloseButton } from '../../../components/ui/CloseButton'
import { BackButton } from '../../../components/ui/BackButton'
import { HeaderAddButton } from '../../../components/ui/HeaderAddButton'

// A deep link or notification straight to a pushed screen still lands with
// the list under it: without this the stack held that one screen, so there
// was no back button and the tab bar showed as if it were a tab root.
export const unstable_settings = { initialRouteName: 'index' }

/** Explore has no tab of its own — it is reached from Me — so its root still
 *  gets the board's back button, and one with nothing behind it goes to Me. */
export default function ExploreStackLayout() {
  // A hidden tab keeps its stack while another tab is in front, so the next
  // visit pushed onto the last one. Unmounted while another tab shows, the
  // stack starts fresh with just the screen opened, and Back falls through to
  // the tab history (backBehavior="history" in (tabs)/_layout).
  if (!useTabFocused()) return null
  return (
    <Stack screenOptions={stackScreenOptions}>
      {/* The board draws Explore under the drill-down header, not a tab
          root's greeting: it is a place you visit from Me. */}
      <Stack.Screen name="index" options={{ title: 'Explore' }} />
      <Stack.Screen name="learn/index" options={{ title: 'Learn' }} />
      {/* Overridden per-article by article-screen.tsx's own <Stack.Screen>
          once the slug resolves; this is the fallback for an unknown one. */}
      <Stack.Screen name="learn/[slug]" options={{ title: 'Guide' }} />
      <Stack.Screen
        name="challenges/index"
        options={{
          title: 'Design challenges',
          ...headerRightSlot(() => <HeaderAddButton label="Submit an idea" href="/explore/challenges/new" />),
        }}
      />
      {/* The brief carries its own title, so the header stays generic rather
          than repeating a long challenge name in a narrow bar. */}
      <Stack.Screen name="challenges/[id]" options={{ title: 'Challenge' }} />
      <Stack.Screen name="challenges/new" options={{ title: 'Submit an idea' }} />
      <Stack.Screen name="recycling" options={{ title: 'Recycling' }} />
      <Stack.Screen name="makers-wanted/index" options={{ title: 'Makers wanted' }} />
      {/* A one-shot form, so a sheet over the board rather than a push — the
          same formSheet treatment as guides/new, for the same reasons. */}
      <Stack.Screen
        name="makers-wanted/new"
        options={{
          title: 'Ask for a build',
          presentation: 'formSheet',
          // An opaque header, so the form starts below it: on iOS the sheet's
          // header floated over the top of the content.
          headerTransparent: false,
          sheetGrabberVisible: true,
          sheetAllowedDetents: [1.0],
          ...headerLeftSlot(() => <CloseButton />),
        }}
      />
      <Stack.Screen name="about" options={{ title: 'About SPLAT' }} />
    </Stack>
  )
}
