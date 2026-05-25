import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function AdminPage() {
  const supabase = await createClient()

  const [{ count: pendingContributors }, { count: pendingTutorials }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('approved', false)
        .eq('role', 'contributor'),
      supabase
        .from('tutorials')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),
    ])

  const cards = [
    {
      label: 'Pending contributor requests',
      count: pendingContributors ?? 0,
      href: '/admin/contributors',
      color: 'border-orange-400',
    },
    {
      label: 'Tutorials awaiting review',
      count: pendingTutorials ?? 0,
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
