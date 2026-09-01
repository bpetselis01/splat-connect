// packages/mobile/app/(my)/account/ability.tsx
import { useLocalSearchParams } from 'expo-router'
import { AbilityScreen } from '../../../components/profile/ability-screen'

export default function Route() {
  // ?child= pins the screen to one child (the editor home passes it); absent,
  // the hook's original oldest-child behaviour holds for old deep links.
  const { child } = useLocalSearchParams<{ child?: string }>()
  return <AbilityScreen childId={child} />
}
