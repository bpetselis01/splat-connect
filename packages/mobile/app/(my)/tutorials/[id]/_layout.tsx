// packages/mobile/app/(my)/tutorials/[id]/_layout.tsx
//
// One provider for the whole editor stack, so a section's save is already
// reflected on the hub when you go back — no refetch on focus, and no second
// copy of the draft to fall out of step with the first.
import { Stack, useLocalSearchParams } from 'expo-router'
import { TutorialDraftProvider, useDraft } from '../../../../lib/use-tutorial-draft'
import { headerLeftSlot, headerRightSlot, stackScreenOptions } from '../../../../lib/nav-options'
import { SaveChip, SAVE_CHIP_LABEL } from '../../../../components/my-tutorials/sections/save-chip'
import { CloseToTabsButton } from '../../../../components/ui/CloseButton'

/** The hub's ✕ saves whatever the debounce still holds, then closes. */
function HubCloseButton() {
  const { flush } = useDraft()
  return <CloseToTabsButton beforeClose={flush} />
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
        // Every editor screen closes through the draft, so a tap inside the
        // 250ms debounce is saved rather than dropped on unmount.
        ...headerLeftSlot(() => <HubCloseButton />),
        // The save chip belongs to the header, not to the top of each
        // section's scroll: it is the only feedback autosave has, and in the
        // body it shifted the content by a line every time it changed. One
        // declaration here covers all seven screens, and it sits inside the
        // provider so it reads the same draft they write.
        ...(SAVE_CHIP_LABEL[saveState] ? headerRightSlot(() => <SaveChip />) : {}),
      }}
    >
      <Stack.Screen
        name="index"
        options={{ title: 'Edit guide' }}
      />
      <Stack.Screen name="details" options={{ title: 'Details' }} />
      <Stack.Screen name="steps" options={{ title: 'Steps' }} />
      <Stack.Screen name="safety" options={{ title: 'Safety' }} />
      <Stack.Screen name="suits" options={{ title: 'Who it suits' }} />
      <Stack.Screen name="picks" options={{ title: 'Worth a look' }} />
      <Stack.Screen name="parts" options={{ title: 'Parts' }} />
      <Stack.Screen name="tools" options={{ title: 'Tools' }} />
      <Stack.Screen name="photos" options={{ title: 'Photos' }} />
      <Stack.Screen name="files" options={{ title: 'Files' }} />
      <Stack.Screen name="stl" options={{ title: '3D print files' }} />
      <Stack.Screen name="backing" options={{ title: 'Backing' }} />
      <Stack.Screen name="collaborators" options={{ title: 'Collaborators' }} />
    </Stack>
  )
}
