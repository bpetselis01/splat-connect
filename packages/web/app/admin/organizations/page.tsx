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
import { Buildings, Plus, X } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import type { Route } from 'next'
import type { ReactNode } from 'react'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { tintFor } from '@/components/card-photo'
import { apiClient } from '@/lib/api-client'
import type { Organization, OrgLeader, AdminAccountsResponse } from '@splat-connect/types'

async function createOrg(formData: FormData) {
  'use server'
  await apiClient.post('/api/admin/organizations', {
    name: formData.get('name'),
    description: formData.get('description') || null,
    leader_user_id: formData.get('leader_user_id'),
  })
  revalidatePath('/admin/organizations')
  revalidatePath('/admin')
  // Out of the ?new=1 drawer and back to the list the new row is in.
  redirect('/admin/organizations')
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

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')

/**
 * The board's side drawer, without client JavaScript: it is open because the
 * address says so (?new=1, ?manage=<id>), and the backdrop and the X are links
 * back to the plain list. Server actions inside it work unchanged.
 */
function Drawer({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[70] flex justify-end">
      <Link
        href="/admin/organizations"
        aria-label="Close"
        className="absolute inset-0 bg-[rgba(28,37,48,.34)]"
      />
      <div
        role="dialog"
        aria-label={title}
        className="relative h-full w-[460px] max-w-[92vw] overflow-auto border-l-[length:var(--bw)] border-line bg-surface p-7 shadow-[var(--shadow-e4)]"
      >
        <div className="flex items-start justify-between gap-3.5">
          <div>
            <h2 className="m-0 font-display text-2xl font-extrabold text-ink">{title}</h2>
            {sub && <p className="mt-1.5 text-sm text-muted">{sub}</p>}
          </div>
          <Link
            href="/admin/organizations"
            aria-label="Close"
            className="grid h-10 w-10 flex-none place-items-center rounded-full border-[length:var(--bw)] border-line bg-surface text-ink"
          >
            <X size={18} aria-hidden="true" />
          </Link>
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  )
}

export default async function AdminOrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ manage?: string; new?: string }>
}) {
  const { manage, new: creating } = await searchParams
  const [orgs, accounts] = await Promise.all([
    apiClient.get<OrgWithLeaders[]>('/api/organizations'),
    apiClient.get<AdminAccountsResponse>('/api/admin/contributors'),
  ])
  const contributors = accounts.accounts

  // No per-organisation fetch. The list endpoint embeds org_leaders, so this is
  // one request at fifty organisations instead of fifty-one.
  const detailed = orgs as OrgWithLeaders[]
  const nameFor = (id: string) =>
    contributors.find((c) => c.id === id)?.name ||
    contributors.find((c) => c.id === id)?.email ||
    // A leader outside the accounts list (an admin, or past its 1000-row cap).
    // Never the raw id: that is not something a person can act on.
    'Unlisted account'
  const managed = manage ? detailed.find((o) => o.id === manage) : undefined

  const contributorOptions = contributors.map((c) => (
    <option key={c.id} value={c.id}>
      {c.name || c.email}
    </option>
  ))

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="title-hub">Organisations</h1>
          <p className="mt-2 text-[15px] text-muted">
            Create organisations, appoint leaders, suspend.
          </p>
        </div>
        <Link href={'/admin/organizations?new=1' as Route} className="btn btn-primary min-h-12 text-[15px]">
          <Plus size={18} weight="bold" aria-hidden="true" /> New organisation
        </Link>
      </div>

      {detailed.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <span aria-hidden="true" className="empty-badge text-brand-deep">
            <Buildings className="h-8 w-8" />
          </span>
          <p className="mt-4 font-bold text-ink">No organisations yet.</p>
          <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">
            Create one to start delegating tutorial review.
          </p>
        </div>
      ) : (
        /* ORGANISATION | STATUS | LEADERS, as the board draws it. Its BACKED
           and TOYS counts are absent: /api/organizations returns neither. */
        <div className="admin-table-card">
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Organisation</th>
                  <th scope="col">Status</th>
                  <th scope="col">Leaders</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {detailed.map((org) => {
                  const leaders = org.org_leaders ?? []
                  const state =
                    org.status === 'suspended'
                      ? { label: 'Suspended', tint: 'var(--tbad)' }
                      : leaders.length === 0
                        ? { label: 'No leader', tint: 'var(--tamber)' }
                        : { label: 'Active', tint: 'var(--tok)' }
                  const names = leaders.map((l) => nameFor(l.user_id))
                  return (
                    <tr key={org.id}>
                      <td>
                        <span className="flex items-center gap-3">
                          <span
                            aria-hidden="true"
                            className="grid h-10 w-10 flex-none place-items-center rounded-[14px] text-[13px] font-extrabold text-ink"
                            style={{ background: tintFor(org.id) }}
                          >
                            {initials(org.name)}
                          </span>
                          <span>
                            <span className="block font-extrabold">{org.name}</span>
                            {(org.suburb || org.state) && (
                              <span className="block text-xs text-muted">
                                {[org.suburb, org.state].filter(Boolean).join(', ')}
                              </span>
                            )}
                          </span>
                        </span>
                      </td>
                      <td>
                        <span className="admin-tag px-2.5 py-[3px]" style={{ background: state.tint }}>
                          {state.label}
                        </span>
                      </td>
                      <td className="text-muted">
                        {names.length === 0
                          ? '—'
                          : names.length > 2
                            ? `${names.slice(0, 2).join(', ')}, +${names.length - 2}`
                            : names.join(', ')}
                      </td>
                      <td className="text-right">
                        <Link
                          href={`/admin/organizations?manage=${org.id}` as Route}
                          className="btn btn-quiet btn-sm font-bold shadow-none"
                        >
                          Manage
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {creating && (
        <Drawer title="New organisation">
          <form action={createOrg} className="flex flex-col gap-3">
            <div>
              <label htmlFor="name" className="field-label">
                Name
              </label>
              <input id="name" name="name" required className="field bg-canvas" />
            </div>
            <div>
              <label htmlFor="description" className="field-label">
                Description
              </label>
              <textarea id="description" name="description" rows={2} className="field bg-canvas" />
            </div>
            <div>
              <label htmlFor="leader_user_id" className="field-label">
                First leader
              </label>
              <select id="leader_user_id" name="leader_user_id" required defaultValue="" className="field bg-canvas">
                <option value="" disabled hidden>
                  Select a contributor…
                </option>
                {contributorOptions}
              </select>
              <p className="mt-1 text-xs text-muted">
                Required. An organisation with no leader cannot answer any request, so it would
                sit in the picker doing nothing. Only contributors can lead.
              </p>
            </div>
            <p className="text-xs leading-relaxed text-muted">
              Creating the organisation grants review authority straight away — its leaders can
              approve tutorials as soon as they accept the leader terms. There is no second
              approval step.
            </p>
            <button type="submit" className="btn btn-primary">
              Create organisation
            </button>
          </form>
        </Drawer>
      )}

      {managed && (
        <Drawer
          title={managed.name}
          sub={[managed.description, [managed.suburb, managed.state].filter(Boolean).join(', ')]
            .filter(Boolean)
            .join(' · ')}
        >
          {(() => {
            const leaders = managed.org_leaders ?? []
            return (
              <>
                <h3 className="mb-3 font-display text-lg font-extrabold text-ink">
                  Leaders ({leaders.length})
                </h3>
                {leaders.length === 0 ? (
                  <p className="mb-4 text-sm text-muted">
                    None. This organisation cannot answer any request until it has one.
                  </p>
                ) : (
                  <ul className="mb-4 flex list-none flex-col gap-2.5">
                    {leaders.map((l) => {
                      const name = nameFor(l.user_id)
                      return (
                        <li
                          key={l.user_id}
                          className="flex items-center gap-3 rounded-[18px] border-[length:var(--bw)] border-line bg-canvas px-3.5 py-3"
                        >
                          <span
                            aria-hidden="true"
                            className="grid h-[38px] w-[38px] flex-none place-items-center rounded-full text-[13px] font-extrabold text-ink"
                            style={{ background: tintFor(l.user_id) }}
                          >
                            {initials(name)}
                          </span>
                          <span className="min-w-0 flex-1 text-sm font-extrabold">{name}</span>
                          <form action={removeLeader}>
                            <input type="hidden" name="orgId" value={managed.id} />
                            <input type="hidden" name="user_id" value={l.user_id} />
                            <button type="submit" className="btn btn-danger btn-sm text-xs font-bold shadow-none">
                              Remove
                            </button>
                          </form>
                        </li>
                      )
                    })}
                  </ul>
                )}

                <form action={addLeader} className="mb-7 flex gap-2.5">
                  <input type="hidden" name="orgId" value={managed.id} />
                  <label htmlFor="new-leader" className="sr-only">
                    New leader
                  </label>
                  <select id="new-leader" name="user_id" required defaultValue="" className="field flex-1 bg-canvas">
                    <option value="" disabled hidden>
                      Select a contributor…
                    </option>
                    {contributorOptions}
                  </select>
                  <button type="submit" className="btn btn-primary btn-md">
                    Appoint
                  </button>
                </form>

                <h3 className="mb-2.5 font-display text-lg font-extrabold text-ink">Danger zone</h3>
                <div className="rounded-[18px] border-[length:var(--bw)] border-line bg-[var(--tbad)] px-5 py-[18px]">
                  <p className="mb-3 text-sm leading-[1.55] text-ink">
                    A suspended organisation stays visible and keeps its guides, but cannot
                    approve new ones.
                  </p>
                  <form action={setStatus}>
                    <input type="hidden" name="id" value={managed.id} />
                    <input
                      type="hidden"
                      name="status"
                      value={managed.status === 'active' ? 'suspended' : 'active'}
                    />
                    <button type="submit" className="btn btn-danger btn-md">
                      {managed.status === 'active' ? 'Suspend organisation' : 'Reactivate organisation'}
                    </button>
                  </form>
                </div>
              </>
            )
          })()}
        </Drawer>
      )}
    </div>
  )
}
