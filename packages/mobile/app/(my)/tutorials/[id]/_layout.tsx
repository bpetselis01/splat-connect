// packages/mobile/app/(my)/tutorials/[id]/_layout.tsx
//
// One provider for the whole editor stack, so a section's save is already
// reflected on the hub when you go back — no refetch on focus, and no second
// copy of the draft to fall out of step with the first.
import { WithHome } from '../../../../components/ui/HomeButton'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { TutorialDraftProvider, useDraft } from '../../../../lib/use-tutorial-draft'
import { stackScreenOptions } from '../../../../lib/nav-options'
import { SaveChip, SAVE_CHIP_LABEL } from '../../../../components/my-tutorials/sections/save-chip'
import { BackButton } from '../../../../components/ui/BackButton'

/**
 * The hub's back control, and the reason it is declared rather than inherited.
 *
 * guides/new.tsx reaches the editor with router.replace, which crosses from
 * (tabs) into (my) and discards the screen it came from — so the stack has no
 * entry behind the hub and the native chevron never renders. The editor is also
 * reachable from My tutorials and from a notification, so leaning on whatever
 * happens to be on the stack is exactly what broke: the same screen had a back
 * button or not depending on how you arrived. This names the fallback destination,
 * and is labelled Back like every other: back is wherever the editor was opened from.
 */
function HubBackButton() {
  const router = useRouter()
  return (
    <BackButton onPress={() => (router.canGoBack() ? router.back() : router.replace('/tutorials'))} />
  )
}

export default function TutorialEditorLayout() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return (
    <TutorialDraftProvider id={id}>
      <EditorStack />
    </TutorialDraftProvider>
  )
}

// Inside the provider, so the header can read the draft: iOS draws a round
// button for a header item even when the chip renders nothing, so the item
// exists only while there is something to say.
function EditorStack() {
  const { saveState } = useDraft()
  return (
    <Stack
      screenOptions={{
        ...stackScreenOptions,
        headerBackTitle: 'Back',
        // The save chip belongs to the header, not to the top of each
        // section's scroll: it is the only feedback autosave has, and in the
        // body it shifted the content by a line every time it changed. One
        // declaration here covers all seven screens, and it sits inside the
        // provider so it reads the same draft they write.
        headerRight: () => <WithHome>{SAVE_CHIP_LABEL[saveState] ? <SaveChip /> : null}</WithHome>,
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: 'Edit guide', headerLeft: () => <HubBackButton /> }}
      />
      <Stack.Screen name="details" options={{ title: 'Details' }} />
      <Stack.Screen name="steps" options={{ title: 'Steps' }} />
      <Stack.Screen name="safety" options={{ title: 'Safety' }} />
      <Stack.Screen name="suits" options={{ title: 'Who it suits' }} />
      <Stack.Screen name="picks" options={{ title: 'Worth a look' }} />
      <Stack.Screen name="parts" options={{ title: 'Parts' }} />
      <Stack.Screen name="tools" options={{ title: 'Tools' }} />
      <Stack.Screen name="files" options={{ title: 'Files' }} />
      <Stack.Screen name="stl" options={{ title: '3D print files' }} />
      <Stack.Screen name="backing" options={{ title: 'Backing' }} />
    </Stack>
  )
}
