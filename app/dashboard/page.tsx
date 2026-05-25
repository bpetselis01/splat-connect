import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { DifficultyBadge } from '@/components/difficulty-badge'
import type { Tutorial, TutorialStatus, Difficulty } from '@/lib/types'

const statusStyles: Record<TutorialStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileRow?.role !== 'contributor') redirect('/')

  const { data } = await supabase
    .from('tutorial_contributors')
    .select('tutorials(id, title, status, difficulty, rejection_note)')
    .eq('profile_id', user.id)
    .order('added_at', { ascending: false })

  const tutorials = (
    data?.map((row: { tutorials: unknown }) => row.tutorials).filter(Boolean) ?? []
  ) as Tutorial[]

  const pendingCount = tutorials.filter((t) => t.status === 'pending').length
  const approvedCount = tutorials.filter((t) => t.status === 'approved').length
  const rejectedCount = tutorials.filter((t) => t.status === 'rejected').length
  const recentTutorials = tutorials.slice(0, 5)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link
          href="/upload"
          className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600"
        >
          + New tutorial
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white border rounded-xl p-5 text-center">
          <p className="text-3xl font-bold text-yellow-600">{pendingCount}</p>
          <p className="text-sm text-gray-500 mt-1">Pending</p>
        </div>
        <div className="bg-white border rounded-xl p-5 text-center">
          <p className="text-3xl font-bold text-green-600">{approvedCount}</p>
          <p className="text-sm text-gray-500 mt-1">Approved</p>
        </div>
        <div className="bg-white border rounded-xl p-5 text-center">
          <p className="text-3xl font-bold text-red-600">{rejectedCount}</p>
          <p className="text-sm text-gray-500 mt-1">Rejected</p>
        </div>
      </div>

      <h2 className="text-lg font-semibold mb-3">Recent tutorials</h2>

      {recentTutorials.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-4">You haven&apos;t submitted any tutorials yet.</p>
          <Link
            href="/upload"
            className="inline-block bg-orange-500 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600"
          >
            Upload your first tutorial
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {recentTutorials.map((t) => (
            <div
              key={t.id}
              className="bg-white border rounded-xl p-4 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <DifficultyBadge difficulty={t.difficulty as Difficulty} />
                <div>
                  <p className="font-semibold text-sm">{t.title}</p>
                  {t.rejection_note && (
                    <p className="text-xs text-red-600 mt-0.5">
                      Feedback: {t.rejection_note}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Link
                  href={`/tutorials/${t.id}/edit`}
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  Edit
                </Link>
                <Link
                  href={`/tutorials/${t.id}`}
                  className="text-xs font-semibold text-gray-500 hover:underline"
                >
                  View
                </Link>
                <span
                  className={`text-xs font-bold px-2 py-1 rounded-full ${statusStyles[t.status]}`}
                >
                  {t.status.toUpperCase()}
                </span>
              </div>
            </div>
          ))}
          {tutorials.length > 5 && (
            <Link
              href="/my-tutorials"
              className="text-center text-sm text-blue-600 hover:underline pt-1"
            >
              View all {tutorials.length} tutorials →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
