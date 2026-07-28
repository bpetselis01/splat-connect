/**
 * Admin Organisations
 *
 * The only surface in the product that creates an organisation or grants
 * leadership. Contributors cannot do either: the RLS insert policies on
 * organizations and org_leaders are is_admin(), so there is no other path.
 *
 * Creating an organisation grants review authority immediately — status is set to
 * 'active' on create and there is no second approve step. The submit copy says so,
 * because "create" reads as harmless and this one is not.
 *
 * Related files:
 * - packages/api/src/routes/admin.ts: the four endpoints behind this page
 * - supabase/migrations/007_organizations.sql: the admin-only write policies
 * - app/org/[orgId]: where a leader appointed here ends up
 */
import { revalidatePath } from 'next/cache'
import { apiClient } from '@/lib/api-client'
import type { Organization, OrgLeader, Profile } from '@splat-connect/types'

async function createOrg(formData: FormData) {
  'use server'
  await apiClient.post('/api/admin/organizations', {
    name: formData.get('name'),
    description: formData.get('description') || null,
    leader_user_id: formData.get('leader_user_id'),
  })
  revalidatePath('/admin/organizations')
  revalidatePath('/admin')
}

async function setStatus(formData: FormData) {
  'use server'
  const id = formData.get('id') as string
  await apiClient.patch(`/api/admin/organizations/${id}`, {
    status: formData.get('status'),
  })
  revalidatePath('/admin/organizations')
}

async function addLeader(formData: FormData) {
  'use server'
  const orgId = formData.get('orgId') as string
  await apiClient.post(`/api/admin/organizations/${orgId}/leaders`, {
    user_id: formData.get('user_id'),
  })
  revalidatePath('/admin/organizations')
}

async function removeLeader(formData: FormData) {
  'use server'
  const orgId = formData.get('orgId') as string
  const userId = formData.get('user_id') as string
  await apiClient.delete(`/api/admin/organizations/${orgId}/leaders/${userId}`)
  revalidatePath('/admin/organizations')
}

type OrgWithLeaders = Organization & { org_leaders?: OrgLeader[] }

export default async function AdminOrganizationsPage() {
  const [orgs, contributors] = await Promise.all([
    apiClient.get<Organization[]>('/api/organizations'),
    apiClient.get<Profile[]>('/api/admin/contributors'),
  ])

  const detailed = await Promise.all(
    orgs.map((o) => apiClient.get<OrgWithLeaders>(`/api/organizations/${o.id}`))
  )
  const nameFor = (id: string) =>
    contributors.find((c) => c.id === id)?.name ||
    contributors.find((c) => c.id === id)?.email ||
    id

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold text-ink">Organisations</h1>

      <section className="card">
        <h2 className="mb-3 text-lg font-semibold text-ink">Create an organisation</h2>
        <form action={createOrg} className="space-y-3">
          <div>
            <label htmlFor="name" className="block font-medium text-ink">
              Name
            </label>
            <input id="name" name="name" required className="mt-1 w-full" />
          </div>
          <div>
            <label htmlFor="description" className="block font-medium text-ink">
              Description
            </label>
            <textarea id="description" name="description" rows={2} className="mt-1 w-full" />
          </div>
          <div>
            <label htmlFor="leader_user_id" className="block font-medium text-ink">
              First leader
            </label>
            <select id="leader_user_id" name="leader_user_id" required className="mt-1 w-full">
              <option value="">Choose a contributor…</option>
              {contributors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name || c.email}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted">
              Required. An organisation with no leader cannot answer any request, so
              it would sit in the picker doing nothing. Only contributors can lead.
            </p>
          </div>
          <p className="text-xs leading-relaxed text-muted">
            Creating the organisation grants review authority straight away — its
            leaders can approve tutorials as soon as they accept the leader terms.
            There is no second approval step.
          </p>
          <button type="submit" className="btn btn-accent">
            Create organisation
          </button>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold text-ink">
          All organisations ({detailed.length})
        </h2>
        {detailed.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span aria-hidden="true" className="empty-badge">
              🏢
            </span>
            <p className="mt-4 font-bold text-ink">No organisations yet.</p>
            <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">
              Create one above to start delegating tutorial review.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {detailed.map((org) => {
              const leaders = org.org_leaders ?? []
              return (
                <li key={org.id} className="card">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink">{org.name}</p>
                      {org.description && (
                        <p className="mt-1 text-sm text-muted">{org.description}</p>
                      )}
                    </div>
                    <span className={org.status === 'active' ? 'badge' : 'badge badge-muted'}>
                      {org.status}
                    </span>
                  </div>

                  <form action={setStatus} className="mt-3">
                    <input type="hidden" name="id" value={org.id} />
                    <input
                      type="hidden"
                      name="status"
                      value={org.status === 'active' ? 'suspended' : 'active'}
                    />
                    <button type="submit" className="btn">
                      {org.status === 'active' ? 'Suspend' : 'Reactivate'}
                    </button>
                  </form>

                  <div className="mt-4">
                    <p className="font-medium text-ink">Leaders ({leaders.length})</p>
                    {leaders.length === 0 ? (
                      <p className="mt-1 text-sm text-muted">
                        None. This organisation cannot answer any request until it has
                        one.
                      </p>
                    ) : (
                      <ul className="mt-2 space-y-1">
                        {leaders.map((l) => (
                          <li key={l.user_id} className="flex items-center gap-3">
                            <span>{nameFor(l.user_id)}</span>
                            <form action={removeLeader}>
                              <input type="hidden" name="orgId" value={org.id} />
                              <input type="hidden" name="user_id" value={l.user_id} />
                              <button type="submit" className="btn btn-sm">
                                Remove
                              </button>
                            </form>
                          </li>
                        ))}
                      </ul>
                    )}

                    <form action={addLeader} className="mt-3 flex gap-2">
                      <input type="hidden" name="orgId" value={org.id} />
                      <select name="user_id" required className="flex-1">
                        <option value="">Add a leader…</option>
                        {contributors
                          .filter((c) => !leaders.some((l) => l.user_id === c.id))
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name || c.email}
                            </option>
                          ))}
                      </select>
                      <button type="submit" className="btn">
                        Add
                      </button>
                    </form>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
