// packages/mobile/app/(my)/organisation/[tutorialId].tsx
import { useLocalSearchParams } from 'expo-router'
import { ReviewDetailScreen } from '../../../components/organisation/review-detail-screen'

export default function ReviewDetailRoute() {
  const { tutorialId } = useLocalSearchParams<{ tutorialId: string }>()
  return <ReviewDetailScreen tutorialId={tutorialId} />
}
