// packages/mobile/app/(tabs)/guides/_layout.tsx
import { Stack } from 'expo-router'
import { stackScreenOptions } from '../../../lib/nav-options'
import { CloseButton } from '../../../components/ui/CloseButton'

export default function GuidesStackLayout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      {/*
        The tab root draws its own ScreenHeader (title, subtitle, logo), so the
        native header here would be a second stacked title. Drill-down screens
        keep theirs — that is where the back affordance lives.
      */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
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
          presentation: 'formSheet',
          sheetGrabberVisible: true,
          // One detent, full height: this is a form, not a peek — a half-height
          // rest position would put Create draft under the fold.
          sheetAllowedDetents: [1.0],
          headerLeft: () => <CloseButton />,
        }}
      />
      <Stack.Screen name="[id]/index" options={{ title: 'Guide' }} />
      <Stack.Screen name="[id]/preview" options={{ title: 'Preview' }} />
      <Stack.Screen name="contributor/[id]" options={{ title: 'Contributor' }} />
      <Stack.Screen name="organisation/[id]" options={{ title: 'Organisation' }} />
    </Stack>
  )
}
