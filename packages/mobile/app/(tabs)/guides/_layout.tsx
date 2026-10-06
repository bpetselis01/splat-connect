// packages/mobile/app/(tabs)/guides/_layout.tsx
import { Stack } from 'expo-router'
import { useTabFocused } from '../../../lib/use-tab-focused'
import { stackScreenOptions, noBarClearance } from '../../../lib/nav-options'
import { CloseButton } from '../../../components/ui/CloseButton'

// A deep link or notification straight to a pushed screen still lands with
// the list under it: without this the stack held that one screen, so there
// was no back button and the tab bar showed as if it were a tab root.
export const unstable_settings = { initialRouteName: 'index' }

export default function GuidesStackLayout() {
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
      <Stack.Screen name="index" options={{ headerShown: false, ...noBarClearance }} />
      {/*
        formSheet rather than modal: the sheet options below — the grabber
        especially — only apply to formSheet, and the grabber is the whole point.
        The screen already slid up over the library as a `modal`, but drew no
        handle, so nothing said it could be pulled back down. Dismissed, not
        popped, so headerLeft is an ✕ rather than the stack's back chevron.
      */}
      <Stack.Screen
        name="new"
        options={{
          title: 'Add a guide',
          ...noBarClearance,
          presentation: 'formSheet',
          // An opaque header, so the form starts below it: on iOS the sheet's
          // header floated over the top of the content.
          headerTransparent: false,
          sheetGrabberVisible: true,
          // One detent, full height: this is a form, not a peek — a half-height
          // rest position would put Create draft under the fold.
          sheetAllowedDetents: [1.0],
          headerLeft: () => <CloseButton />,
        }}
      />
      {/* Reading pages pad their own scroll content, so the page scrolls behind the bar. */}
      <Stack.Screen name="[id]/index" options={{ title: 'Guide', ...noBarClearance }} />
      <Stack.Screen name="[id]/preview" options={{ title: 'Guide PDF' }} />
      {/* Start building: the whole screen, its own ✕ and progress bar. */}
      <Stack.Screen name="[id]/build" options={{ presentation: 'fullScreenModal', headerShown: false, ...noBarClearance }} />
      <Stack.Screen name="contributor/[id]" options={{ title: 'Contributor', ...noBarClearance }} />
      <Stack.Screen name="organisation/[id]" options={{ title: 'Organisation', ...noBarClearance }} />
    </Stack>
  )
}
