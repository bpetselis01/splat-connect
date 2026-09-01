// packages/mobile/app/(my)/account/everyday-needs.tsx
import { useLocalSearchParams } from 'expo-router'
import { EverydayNeedsScreen } from '../../../components/profile/everyday-needs-screen'

export default function Route() {
  // ?child= pins the screen to one child (the editor home passes it); absent,
  // the hook's original oldest-child behaviour holds for old deep links.
  const { child } = useLocalSearchParams<{ child?: string }>()
  return <EverydayNeedsScreen childId={child} />
}
