// packages/mobile/app/(tabs)/explore/_layout.tsx
import { Stack, useRouter } from 'expo-router'
import { stackScreenOptions } from '../../../lib/nav-options'
import { CloseButton } from '../../../components/ui/CloseButton'
import { BackButton } from '../../../components/ui/BackButton'

/** Explore has no tab of its own — it is reached from Me — so its root still
 *  gets the board's back button, and one with nothing behind it goes to Me. */
function ExploreBack() {
  const router = useRouter()
  return <BackButton onPress={() => (router.canGoBack() ? router.back() : router.navigate('/me'))} />
}

export default function ExploreStackLayout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      {/* The board draws Explore under the drill-down header, not a tab
          root's greeting: it is a place you visit from Me. */}
      <Stack.Screen name="index" options={{ title: 'Explore', headerLeft: () => <ExploreBack /> }} />
      <Stack.Screen name="learn/index" options={{ title: 'Learn' }} />
      {/* Overridden per-article by article-screen.tsx's own <Stack.Screen>
          once the slug resolves; this is the fallback for an unknown one. */}
      <Stack.Screen name="learn/[slug]" options={{ title: 'Guide' }} />
      <Stack.Screen name="challenges/index" options={{ title: 'Design challenges' }} />
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
          sheetGrabberVisible: true,
          sheetAllowedDetents: [1.0],
          headerLeft: () => <CloseButton />,
        }}
      />
      <Stack.Screen name="about" options={{ title: 'About SPLAT' }} />
    </Stack>
  )
}
