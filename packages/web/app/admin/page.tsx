/**
 * Admin Dashboard
 * 
 * Hub for admins to manage the platform.
 * Shows stats on pending approvals and reviews needed.
 * Only accessible to users with role='admin'.
 * 
 * Middleware (middleware.ts) ensures:
 * - Requires authentication
 * - Requires role='admin'
 * - Redirects non-admins to home
 * 
 * Stats displayed:
 * 1. Contributors
 *    - Total contributor accounts
 *    - Click to go to the contributors list (delete accounts if needed)
 * 2. Tutorials awaiting review
 *    - Submitted tutorials with status='pending'
 *    - Click to go to tutorial review page
 * 
 * Admin workflows:
 * 1. Remove a contributor:
 *    - Click "Contributors"
 *    - Click "Delete" on the account to remove
 * 
 * 2. Review tutorial:
 *    - Click "Tutorials awaiting review"
 *    - See list of pending tutorials (status='pending')
 *    - Click tutorial to view full details
 *    - Click "Approve" or "Reject"
 *    - If approved: Tutorial visible in public library
 *    - If rejected: Add note explaining why (displayed to contributor)
 * 
 * Related files:
 * - routes/admin.ts: API endpoints for admin operations
 * - routes/contributors.ts: Get contributor profiles
 * - app/admin/contributors: Contributor approval page
 * - app/admin/review: Tutorial review page
 * - middleware.ts: Enforces admin-only access
 */
import Link from 'next/link'
import { apiClient } from '@/lib/api-client'
import type { Tutorial, Profile, Organization } from '@splat-connect/types'

export default async function AdminPage() {
  const [tutorials, contributors, organizations, spotCheck] = await Promise.all([
    apiClient.get<Tutorial[]>('/api/admin/tutorials?status=pending'),
    apiClient.get<Profile[]>('/api/admin/contributors'),
    apiClient.get<Organization[]>('/api/organizations'),
    apiClient.get<Tutorial[]>('/api/admin/spot-check'),
  ])

  const pendingTutorials = tutorials.length
  const totalContributors = contributors.length

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
      label: 'Spot-check',
      count: spotCheck.length,
      href: '/admin/spot-check' as const,
      icon: '🔍',
      hint: 'Audit tutorials that org leaders approved',
    },
  ]

  return (
    <div>
      <h1 className="mb-8 text-2xl font-bold text-ink">Admin dashboard</h1>
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
