// packages/mobile/app/(my)/tutorials/[id]/_layout.tsx
//
// One provider for the whole editor stack, so a section's save is already
// reflected on the hub when you go back — no refetch on focus, and no second
// copy of the draft to fall out of step with the first.
import { Pressable } from 'react-native'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { TutorialDraftProvider } from '../../../../lib/use-tutorial-draft'
import { stackScreenOptions } from '../../../../lib/nav-options'
import { SaveChip } from '../../../../components/my-tutorials/sections/save-chip'
import { theme } from '../../../../lib/theme'

/**
 * The hub's back control, and the reason it is declared rather than inherited.
 *
 * guides/new.tsx reaches the editor with router.replace, which crosses from
 * (tabs) into (my) and discards the screen it came from — so the stack has no
 * entry behind the hub and the native chevron never renders. The editor is also
 * reachable from My tutorials and from a notification, so leaning on whatever
 * happens to be on the stack is exactly what broke: the same screen had a back
 * button or not depending on how you arrived. This names the destination.
 */
function HubBackButton() {
  const router = useRouter()
  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/tutorials'))}
      accessibilityRole="button"
      accessibilityLabel="My tutorials"
      hitSlop={8}
    >
      <Ionicons name="chevron-back" size={26} color={theme.colors.primary} />
    </Pressable>
  )
}

export default function TutorialEditorLayout() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return (
    <TutorialDraftProvider id={id}>
      <Stack
        screenOptions={{
          ...stackScreenOptions,
          headerBackTitle: 'Back',
          // The save chip belongs to the header, not to the top of each
          // section's scroll: it is the only feedback autosave has, and in the
          // body it shifted the content by a line every time it changed. One
          // declaration here covers all seven screens, and it sits inside the
          // provider so it reads the same draft they write.
          headerRight: () => <SaveChip />,
        }}
      >
        <Stack.Screen
          name="index"
          options={{ title: 'Edit guide', headerLeft: () => <HubBackButton /> }}
        />
        <Stack.Screen name="details" options={{ title: 'Details' }} />
        <Stack.Screen name="safety" options={{ title: 'Safety' }} />
        <Stack.Screen name="parts" options={{ title: 'Parts' }} />
        <Stack.Screen name="tools" options={{ title: 'Tools' }} />
        <Stack.Screen name="files" options={{ title: 'Files' }} />
        <Stack.Screen name="stl" options={{ title: '3D print files' }} />
      </Stack>
    </TutorialDraftProvider>
  )
}
