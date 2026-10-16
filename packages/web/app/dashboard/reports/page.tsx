/**
 * My reports: the problems you told SPLAT about, with any note that came back.
 * Private to you; the person reported is never told who filed it.
 */
import { requireCapabilities } from '@/lib/require-capabilities'
import { apiClient } from '@/lib/api-client'
import { MyReportsList, type MyReport } from '@/components/my-reports-list'

export const metadata = { title: 'My reports — SPLAT Connect' }

export default async function MyReportsPage() {
  await requireCapabilities()
  const reports = await apiClient.get<MyReport[]>('/api/reports')

  return (
    <div className="max-w-[860px]">
      <h1 className="title-hub">My reports</h1>
      <p className="dash-head__lede dash-head__lede--lg max-w-[62ch]">
        Problems you told SPLAT about, and what happened. The person you reported is never told it was you.
      </p>
      <div className="mt-5">
        <MyReportsList reports={reports} />
      </div>
    </div>
  )
}
