import { MagnifyingGlass, UsersThree } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import type { Route } from 'next'
import { apiClient } from '@/lib/api-client'
import { revalidatePath } from 'next/cache'
import { tintFor } from '@/components/card-photo'
import type { AdminAccountsResponse, Organization, OrgLeader } from '@splat-connect/types'
import { initials } from '@splat-connect/types'

async function deleteContributor(id: string) {
  'use server'
  await apiClient.delete(`/api/admin/contributors/${id}`)
  revalidatePath('/admin/contributors')
  revalidatePath('/admin')
}

type Cap = 'all' | 'contributors' | 'leaders'

// `Mar 2025` — the board's JOINED cell.
const joined = (iso: string) =>
  new Intl.DateTimeFormat('en-AU', { month: 'short', year: 'numeric', timeZone: 'Australia/Sydney' })
    .format(new Date(iso))
    .replace('Sept', 'Sep')

export default async function ContributorsPage({
  searchParams,
}: {
  searchParams: Promise<{ cap?: string; q?: string }>
}) {
  const { cap: capParam, q = '' } = await searchParams
  const [{ accounts: all, total }, orgs] = await Promise.all([
    apiClient.get<AdminAccountsResponse>('/api/admin/contributors'),
    // Leadership is the one capability the data knows. It rides on the
    // organisations list, which embeds org_leaders.
    apiClient
      .get<Array<Organization & { org_leaders?: OrgLeader[] }>>('/api/organizations')
      .catch(() => []),
  ])
  const leaders = new Set(
    (Array.isArray(orgs) ? orgs : []).flatMap((o) => (o.org_leaders ?? []).map((l) => l.user_id))
  )

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

  const cap: Cap = capParam === 'leaders' || capParam === 'contributors' ? capParam : 'all'
  const needle = q.trim().toLowerCase()
  const counts = { all: all.length, leaders: all.filter((p) => leaders.has(p.id)).length }
  const filters: Array<[Cap, string, number]> = [
    ['all', 'All', counts.all],
    ['contributors', 'Contributors', counts.all - counts.leaders],
    ['leaders', 'Leaders', counts.leaders],
  ]
  const shown = all.filter(
    (p) =>
      (cap === 'all' || (cap === 'leaders') === leaders.has(p.id)) &&
      (!needle || `${p.name} ${p.email}`.toLowerCase().includes(needle))
  )
  const href = (c: Cap) => {
    const params = new URLSearchParams()
    if (c !== 'all') params.set('cap', c)
    if (q) params.set('q', q)
    const qs = params.toString()
    return (qs ? `/admin/contributors?${qs}` : '/admin/contributors') as Route
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="title-hub">Accounts</h1>
          <p className="mt-2 text-[15px] text-muted">
            Review and remove accounts. {total.toLocaleString()} total.
            {total > all.length &&
              ` Showing the ${all.length.toLocaleString()} most recent.`}
          </p>
        </div>
        {/* A GET form: the search is part of the address, and the page stays a
            server component. */}
        <form role="search" action="/admin/contributors" className="relative flex items-center">
          {cap !== 'all' && <input type="hidden" name="cap" value={cap} />}
          <MagnifyingGlass size={16} aria-hidden="true" className="absolute left-3.5 text-muted" />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by name or email"
            aria-label="Search accounts"
            className="h-[46px] w-[300px] max-w-full rounded-[var(--radius-pill)] border-[length:var(--bw)] border-line bg-surface pr-3.5 pl-10 text-[15px] font-medium text-ink shadow-[var(--shadow-e1)]"
          />
        </form>
      </div>

      <nav aria-label="Filter accounts" className="mb-5 flex flex-wrap gap-2">
        {filters.map(([key, label, n]) => {
          const on = key === cap
          return (
            <Link
              key={key}
              href={href(key)}
              aria-current={on ? 'page' : undefined}
              className="inline-flex min-h-11 items-center gap-1 rounded-full border-[length:var(--bw)] border-line px-[15px] text-sm font-bold no-underline"
              style={{
                background: on ? 'var(--b600)' : 'var(--surface)',
                color: on ? 'var(--onbrand)' : 'var(--ink)',
              }}
            >
              {label} <span className="opacity-65">{n}</span>
            </Link>
          )
        })}
      </nav>

      {/* ACCOUNT | CAPABILITY | JOINED, as the board draws it. Its GUIDES and
          TOYS counts are absent: /api/admin/contributors returns neither. */}
      <div className="admin-table-card">
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Account</th>
                <th scope="col">Capability</th>
                <th scope="col">Joined</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => {
                const leader = leaders.has(p.id)
                return (
                  <tr key={p.id} data-testid="contributor-row">
                    <td>
                      <span className="flex items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="grid h-10 w-10 flex-none place-items-center rounded-full text-sm font-extrabold text-ink"
                          style={{ background: tintFor(p.id) }}
                        >
                          {initials(p.name || p.email, '?')}
                        </span>
                        <span className="min-w-0">
                          <span className="block font-extrabold">{p.name}</span>
                          <span className="block font-mono text-xs text-muted">{p.email}</span>
                        </span>
                      </span>
                    </td>
                    <td>
                      <span
                        className="admin-tag px-2.5 py-[3px]"
                        style={{ background: leader ? 'var(--tmint)' : 'var(--b100)' }}
                      >
                        {leader ? 'Leader' : 'Contributor'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap text-muted">{joined(p.created_at)}</td>
                    <td className="text-right">
                      <form action={deleteContributor.bind(null, p.id)}>
                        <button type="submit" className="btn btn-danger btn-sm font-bold shadow-none">
                          Remove
                        </button>
                      </form>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {shown.length === 0 && (
          <p className="border-t-[length:var(--bw)] border-line p-6 text-center text-muted">
            No accounts match.
          </p>
        )}
      </div>
    </div>
  )
}
