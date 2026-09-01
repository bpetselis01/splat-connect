// packages/mobile/app/(my)/account/child/[id].tsx
import { useLocalSearchParams } from 'expo-router'
import { ChildEditorHome } from '../../../../components/profile/child-editor-home'

export default function ChildEditorRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <ChildEditorHome childId={id} />
}
