// packages/mobile/app/(tabs)/explore/challenges/[id].tsx
import { useLocalSearchParams } from 'expo-router'
import { ChallengeDetailScreen } from '../../../../components/challenges/detail-screen'

export default function ChallengeDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <ChallengeDetailScreen id={id} />
}
