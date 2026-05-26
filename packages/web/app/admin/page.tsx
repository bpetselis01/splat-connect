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
      href: '/admin/contributors',
      color: 'border-orange-400',
    },
    {
      label: 'Tutorials awaiting review',
      count: pendingTutorials,
      href: '/admin/review',
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
