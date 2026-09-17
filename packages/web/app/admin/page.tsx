import Link from 'next/link'
import { apiClient } from '@/lib/api-client'
import type {
  Tutorial,
  AdminAccountsResponse,
  Organization,
  ToyIdea,
  OrganizationRequest,
} from '@splat-connect/types'

type Counted = Array<Record<string, unknown>>

export default async function AdminPage() {
  const [tutorials, accounts, organizations, spotCheck, ideas, orgRequests] = await Promise.all([
    apiClient.get<Tutorial[]>('/api/admin/tutorials?status=pending'),
    apiClient.get<AdminAccountsResponse>('/api/admin/contributors'),
    apiClient.get<Organization[]>('/api/organizations'),
    apiClient.get<Tutorial[]>('/api/admin/spot-check'),
    apiClient.get<ToyIdea[]>('/api/admin/ideas'),
    // Degrades to empty rather than taking the dashboard down: an admin who
    // came here to answer a report does not care that one count is missing.
    apiClient
      .get<OrganizationRequest[]>('/api/admin/organization-requests')
      .catch(() => [] as OrganizationRequest[]),
  ])

  // The 065 queues, all degrading to empty for the same reason as the
  // organisation requests above: an admin who came here to answer a safety
  // report does not care that one count is missing.
  const [inbox, memberReports, buildRequests, printJobs] = await Promise.all([
    apiClient.get<Counted>('/api/admin/inbox').catch(() => [] as Counted),
    apiClient.get<Counted>('/api/admin/member-reports').catch(() => [] as Counted),
    apiClient.get<Counted>('/api/admin/build-requests').catch(() => [] as Counted),
    apiClient.get<Counted>('/api/admin/print-jobs').catch(() => [] as Counted),
  ])

  const pendingTutorials = tutorials.length
  const totalContributors = accounts.total
  const pendingIdeas = ideas.filter((i) => i.status === 'pending').length
  const pendingOrgRequests = orgRequests.filter((r) => r.status === 'pending').length

  const cards = [
    {
      label: 'Accounts',
      count: totalContributors,
      href: '/admin/contributors' as const,
      icon: '👥',
      hint: 'Review and remove accounts',
    },
    {
      label: 'Tutorials awaiting review',
      count: pendingTutorials,
      href: '/admin/review' as const,
      icon: '📋',
      hint: 'Approve or reject submitted tutorials',
    },
    {
      label: 'Organisations',
      count: organizations.length,
      href: '/admin/organizations' as const,
      icon: '🏢',
      hint: 'Create organisations, appoint leaders, suspend',
    },
    {
      label: 'Organisation requests',
      count: pendingOrgRequests,
      href: '/admin/organization-requests' as const,
      icon: '🏗️',
      hint: 'Approve one and the organisation is created with its first leader',
    },
    {
      label: 'Spot-check',
      count: spotCheck.length,
      href: '/admin/spot-check' as const,
      icon: '🔍',
      hint: 'Audit tutorials that org leaders approved',
    },
    {
      label: 'Design challenges awaiting review',
      count: pendingIdeas,
      href: '/admin/ideas' as const,
      icon: '💡',
      hint: 'Publish or reject submitted ideas',
    },
    {
      label: 'Inbox',
      count: inbox.filter((m) => m.status === 'open').length,
      href: '/admin/inbox' as const,
      icon: '📨',
      hint: 'Contact-form messages. Safety jumps the queue',
    },
    {
      label: 'Reports',
      count: memberReports.filter((r) => r.status !== 'resolved').length,
      href: '/admin/reports' as const,
      icon: '🚩',
      hint: 'Private problem reports. Safety sorts to the top whatever its age',
    },
    {
      label: 'Build requests needing a look',
      count: buildRequests.filter((b) => b.unclaimed_too_long || b.claimed_and_silent).length,
      href: '/admin/build-requests' as const,
      icon: '🔨',
      hint: 'Unclaimed for two weeks, or claimed and silent for ten days',
    },
    {
      label: 'Stalled print jobs',
      count: printJobs.filter((j) => j.stalled).length,
      href: '/admin/print-jobs' as const,
      icon: '🖨️',
      hint: 'Accepted but not moved in ten days',
    },
    {
      label: 'Site content',
      count: 4,
      href: '/admin/content' as const,
      icon: '📝',
      hint: 'Home page, About, the Learn outline and the four legal documents',
    },
  ]

  return (
    <div>
      <h1 className="mb-8 title-hub">Admin dashboard</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="card card-link p-6">
            <div className="flex items-start gap-4">
              <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-tint text-2xl">
                {c.icon}
              </span>
              <div>
                <p className="text-3xl font-bold text-ink">{c.count}</p>
                <p className="text-sm font-bold text-ink">{c.label}</p>
                <p className="mt-1 text-sm text-muted">{c.hint}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
