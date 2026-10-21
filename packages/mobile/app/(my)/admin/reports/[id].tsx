// packages/mobile/app/(my)/admin/reports/[id].tsx
import { useLocalSearchParams } from 'expo-router'
import { MemberReportDetailScreen } from '../../../../components/admin/member-report-detail-screen'

export default function AdminReportDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <MemberReportDetailScreen reportId={id} />
}
