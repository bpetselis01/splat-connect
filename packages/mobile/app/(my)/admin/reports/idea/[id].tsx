// packages/mobile/app/(my)/admin/reports/idea/[id].tsx
import { useLocalSearchParams } from 'expo-router'
import { IdeaReportDetailScreen } from '../../../../../components/admin/idea-report-detail-screen'

export default function AdminIdeaReportRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <IdeaReportDetailScreen reportId={id} />
}
