// packages/mobile/app/(tabs)/explore/challenges/new.tsx
import { useLocalSearchParams } from 'expo-router'
import { SubmitIdeaScreen } from '../../../../components/challenges/submit-idea-screen'

export default function SubmitIdeaRoute() {
  const { from } = useLocalSearchParams<{ from?: string }>()
  return <SubmitIdeaScreen from={from} />
}
