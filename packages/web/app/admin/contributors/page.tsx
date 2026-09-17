import { UsersThree } from '@phosphor-icons/react/dist/ssr'
import { apiClient } from '@/lib/api-client'
import { revalidatePath } from 'next/cache'
import type { AdminAccountsResponse } from '@splat-connect/types'

async function deleteContributor(id: string) {
  'use server'
  await apiClient.delete(`/api/admin/contributors/${id}`)
  revalidatePath('/admin/contributors')
  revalidatePath('/admin')
}

export default async function ContributorsPage() {
  const { accounts: all, total } = await apiClient.get<AdminAccountsResponse>('/api/admin/contributors')

  if (all.length === 0) {
    return (
      <div>
        <h1 className="mb-4 title-hub">Accounts</h1>
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <span aria-hidden="true" className="empty-badge text-brand-deep">
  <UsersThree className="h-8 w-8" />
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
      <h1 className="mb-6 title-hub">Accounts</h1>
      {total > all.length && (
        <p className="mb-4 text-sm text-muted">
          Showing the {all.length.toLocaleString()} most recent of {total.toLocaleString()} accounts.
        </p>
      )}
      <div className="overflow-x-auto">
        {/* ACCOUNT | JOINED, as the board draws this queue. Its CAPABILITY,
            GUIDES and TOYS columns are absent: /api/admin/contributors returns
            name, email and created_at and nothing to fill them with. */}
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="eyebrow pb-2 pr-3 text-muted">Account</th>
              <th scope="col" className="eyebrow whitespace-nowrap pb-2 pr-3 text-right text-muted">
                Joined
              </th>
              <th scope="col" className="pb-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {all.map((p) => (
              <tr
                key={p.id}
                data-testid="contributor-row"
                className="border-b border-line align-middle last:border-0"
              >
                <td className="py-3 pr-3">
                  <span className="card-title block">{p.name}</span>
                  <span className="block text-xs text-muted">{p.email}</span>
                </td>
                <td className="whitespace-nowrap py-3 pr-3 text-right text-sm tabular-nums text-muted">
                  {new Date(p.created_at).toLocaleDateString()}
                </td>
                <td className="py-3 text-right">
                  <form action={deleteContributor.bind(null, p.id)}>
                    <button type="submit" className="btn btn-danger btn-sm">
                      Delete
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
