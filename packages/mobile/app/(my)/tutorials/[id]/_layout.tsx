// packages/mobile/app/(my)/tutorials/[id]/_layout.tsx
//
// One provider for the whole editor stack, so a section's save is already
// reflected on the hub when you go back — no refetch on focus, and no second
// copy of the draft to fall out of step with the first.
import { Stack, useLocalSearchParams } from 'expo-router'
import { TutorialDraftProvider } from '../../../../lib/use-tutorial-draft'
import { stackScreenOptions } from '../../../../lib/nav-options'

export default function TutorialEditorLayout() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return (
    <TutorialDraftProvider id={id}>
      <Stack screenOptions={{ ...stackScreenOptions, headerBackTitle: 'Back' }}>
        <Stack.Screen name="index" options={{ title: 'Edit guide' }} />
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
