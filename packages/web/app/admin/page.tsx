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
 * 1. Pending contributor requests
 *    - New users awaiting account approval
 *    - Click to go to contributor approval page
 * 2. Tutorials awaiting review
 *    - Submitted tutorials with status='pending'
 *    - Click to go to tutorial review page
 * 
 * Admin workflows:
 * 1. Approve contributor:
 *    - Click "Pending contributor requests"
 *    - See list of unapproved users
 *    - Click user to view profile
 *    - Click "Approve" button
 *    - User's approved status changed to true
 *    - User can now create tutorials
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
import type { Tutorial, Profile } from '@splat-connect/types'

export default async function AdminPage() {
  const [tutorials, contributors] = await Promise.all([
    apiClient.get<Tutorial[]>('/api/admin/tutorials?status=pending'),
    apiClient.get<Profile[]>('/api/admin/contributors'),
  ])

  const pendingTutorials = tutorials.length
  const pendingContributors = contributors.filter((c) => !c.approved).length

  const cards = [
    {
      label: 'Pending contributor requests',
      count: pendingContributors,
      href: '/admin/contributors' as const,
      color: 'border-orange-400',
    },
    {
      label: 'Tutorials awaiting review',
      count: pendingTutorials,
      href: '/admin/review' as const,
      color: 'border-blue-400',
    },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold mb-8">Admin dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className={`bg-white border-l-4 ${c.color} rounded-xl p-6 hover:shadow-md transition-shadow`}
          >
            <p className="text-4xl font-bold mb-1">{c.count}</p>
            <p className="text-sm text-gray-600">{c.label}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
