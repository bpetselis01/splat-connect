/**
 * Reports — private problem reports from members, and reports against a person
 * inside a design challenge. Two tables, two tabs (?tab=ideas), deliberately not merged.
 */
import Link from 'next/link'
import { apiClient } from '@/lib/api-client'
import { AdminReports, type MemberReport } from '@/components/admin-reports'
import { AdminIdeaReports, type IdeaReport } from '@/components/admin-idea-reports'

export const metadata = { title: 'Reports — SPLAT Connect' }

export default async function AdminReportsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const ideas = (await searchParams).tab === 'ideas'
  const reports = ideas ? [] : await apiClient.get<MemberReport[]>('/api/admin/member-reports').catch(() => [] as MemberReport[])
  const ideaReports = ideas ? await apiClient.get<IdeaReport[]>('/api/admin/reports').catch(() => [] as IdeaReport[]) : []

  return (
    <div className="max-w-[1000px]">
      <h1 className="title-hub">Reports</h1>
      <p className="mt-1.5 mb-[22px] max-w-[62ch] text-base text-muted">
        {ideas
          ? 'Reports against a person in a design challenge. They are hidden from the reporter until you decide.'
          : 'Private problem reports from members. Safety sits at the top whatever its age. The person reported is never told who filed it.'}
      </p>
      <nav aria-label="Kind of report" className="mb-4 flex gap-2">
        <Link href="/admin/reports" aria-current={ideas ? undefined : 'page'} className={`btn btn-md ${ideas ? 'btn-quiet' : 'btn-primary'}`}>
          Member reports
        </Link>
        <Link href="/admin/reports?tab=ideas" aria-current={ideas ? 'page' : undefined} className={`btn btn-md ${ideas ? 'btn-primary' : 'btn-quiet'}`}>
          Idea reports
        </Link>
      </nav>
      {ideas ? <AdminIdeaReports reports={ideaReports} /> : <AdminReports reports={reports} />}
    </div>
  )
}
