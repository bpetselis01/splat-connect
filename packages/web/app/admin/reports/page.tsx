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
    <div>
      <h1 className="title-hub">Reports</h1>
      <p className="mb-6 mt-2 max-w-prose text-sm leading-relaxed text-muted">
        Private problem reports from members. Safety sits at the top whatever its age. The person
        reported is never told who filed it.
      </p>
      <AdminReports reports={reports} />
    </div>
  )
}
