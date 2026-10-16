// packages/mobile/app/(my)/admin/ideas/[id].tsx
import { useLocalSearchParams } from 'expo-router'
import { IdeaReviewDetailScreen } from '../../../../components/admin/idea-review-detail-screen'

export default function AdminIdeaDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <IdeaReviewDetailScreen ideaId={id} />
}
