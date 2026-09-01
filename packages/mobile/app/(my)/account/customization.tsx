// packages/mobile/app/(my)/account/customization.tsx
import { useLocalSearchParams } from 'expo-router'
import { CustomizationScreen } from '../../../components/profile/customization-screen'

export default function Route() {
  // ?child= pins the screen to one child (the editor home passes it); absent,
  // the hook's original oldest-child behaviour holds for old deep links.
  const { child } = useLocalSearchParams<{ child?: string }>()
  return <CustomizationScreen childId={child} />
}
