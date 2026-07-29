import { apiClient } from '@/lib/api-client'
import { revalidatePath } from 'next/cache'
import type { Profile } from '@splat-connect/types'

async function deleteContributor(id: string) {
  'use server'
  await apiClient.delete(`/api/admin/contributors/${id}`)
  revalidatePath('/admin/contributors')
  revalidatePath('/admin')
}

export default async function ContributorsPage() {
  const all = await apiClient.get<Profile[]>('/api/admin/contributors')

  if (all.length === 0) {
    return (
      <div>
        <h1 className="mb-4 text-2xl font-bold text-ink">Accounts</h1>
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <span aria-hidden="true" className="empty-badge">
            👥
          </span>
          <p className="mt-4 font-bold text-ink">No accounts yet.</p>
          <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">
            Accounts appear here once someone signs up.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-ink">Accounts</h1>
      <div className="flex flex-col gap-3">
        {all.map((p) => (
          <div
            key={p.id}
            data-testid="contributor-row"
            className="card flex flex-wrap items-center justify-between gap-4 p-4"
          >
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink">{p.name}</p>
              <p className="text-xs text-muted">{p.email}</p>
              <p className="mt-0.5 text-xs text-muted">
                Joined {new Date(p.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <form action={deleteContributor.bind(null, p.id)}>
                <button type="submit" className="btn btn-danger btn-sm">
                  Delete
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
