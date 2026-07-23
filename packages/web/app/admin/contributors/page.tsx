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
        <h1 className="text-2xl font-bold mb-4">Contributors</h1>
        <p className="text-gray-400">No contributors yet.</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Contributors</h1>
      <div className="flex flex-col gap-3">
        {all.map((p) => (
          <div
            key={p.id}
            className="bg-white border rounded-xl p-4 flex items-center justify-between gap-4"
          >
            <div>
              <p className="font-semibold text-sm">{p.name}</p>
              <p className="text-xs text-gray-500">{p.email}</p>
              <p className="text-xs text-gray-400">
                Joined {new Date(p.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <form action={deleteContributor.bind(null, p.id)}>
                <button
                  type="submit"
                  className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-red-200"
                >
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
