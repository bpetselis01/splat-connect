// packages/mobile/app/(my)/admin/review/[id].tsx
import { useLocalSearchParams } from 'expo-router'
import { ReviewDetailScreen } from '../../../../components/organisation/review-detail-screen'

export default function AdminReviewDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <ReviewDetailScreen tutorialId={id} admin />
}
