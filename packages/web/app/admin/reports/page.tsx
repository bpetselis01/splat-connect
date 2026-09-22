/**
 * Reports — private problem reports from members.
 */
import { apiClient } from '@/lib/api-client'
import { AdminReports, type MemberReport } from '@/components/admin-reports'

export const metadata = { title: 'Reports — SPLAT Connect' }

export default async function AdminReportsPage() {
  const reports = await apiClient
    .get<MemberReport[]>('/api/admin/member-reports')
    .catch(() => [] as MemberReport[])

  return (
    <div className="max-w-[1000px]">
      <h1 className="title-hub">Reports</h1>
      <p className="mt-1.5 mb-[22px] max-w-[62ch] text-base text-muted">
        Private problem reports from members. Safety sits at the top whatever its age. The person
        reported is never told who filed it.
      </p>
      <AdminReports reports={reports} />
    </div>
  )
}
