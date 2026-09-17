/**
 * Organisations directory.
 *
 * Exists so "Riverside Therapy backed this" is a name with something behind it —
 * for a contributor deciding who to ask, and for a parent reading a badge.
 *
 * Suspended organisations are listed and marked rather than hidden: one vanishing
 * from a directory is unexplainable to someone who expected to find it, and their
 * name is still on work they already backed.
 *
 * Related files:
 * - packages/api/src/routes/public.ts: GET /api/public/organizations
 * - app/organizations/[id]/page.tsx: one organisation, plus its leader's workspace
 * - components/edit-backing-section.tsx: where a contributor acts on this
 */
import { Buildings } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import type { Organization } from '@splat-connect/types'

/** The board cycles its directory bands through the tint set rather than
 *  giving every organisation the same blue. */
const BAND_TINTS = ['var(--b100)', 'var(--tmint)', 'var(--tamber)', 'var(--tviolet)', 'var(--tcoral)']

/** Two letters, the way the board's avatars and its directory bands both do it. */
function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

export default async function OrganizationsPage() {
  let orgs: Organization[] = []
  try {
    const res = await fetch(`${process.env.API_URL}/api/public/organizations`, {
      cache: 'no-store',
    })
    if (res.ok) orgs = await res.json()
  } catch {
    orgs = []
  }

  if (orgs.length === 0) {
    return (
      <div>
        <h1 className="mb-4 title-hub">Organisations</h1>
        <div className="flex flex-col items-center px-6 py-16 text-center">
          <span aria-hidden="true" className="empty-badge text-brand-deep">
  <Buildings className="h-8 w-8" />
</span>
          <p className="mt-4 font-bold text-ink">No organisations yet.</p>
          <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">
            Organisations are set up by SPLAT. Once one exists, you can ask it to
            back a project when you submit.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* No eyebrow: the board draws one because it has no breadcrumb, and
          this layout already renders "← Impact" directly above. Two lines
          saying Impact is one more than the page needs. */}
      <h1 className="title-article">Organisations</h1>
      <p className="mt-3 max-w-[62ch] text-lg leading-[1.6] text-muted">
        The therapy centres, schools and services standing behind the work. An
        organisation&apos;s name on a guide means one of its leaders read it and vouched for
        it.
      </p>

      {/* A directory is a grid of cards on the board, not a stack of full-width
          bars: an organisation you are deciding whether to ask is a thing you
          compare against its neighbours, and a bar makes every row look the
          same weight. The 16:7 initial band is the board's stand-in for a logo
          nobody has uploaded. */}
      <div className="mt-7 grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
        {orgs.map((org, i) => (
          <Link
            key={org.id}
            href={`/organizations/${org.id}/public`}
            className="card card-link flex flex-col overflow-hidden"
          >
            <span
              aria-hidden="true"
              className="grid aspect-[16/7] place-items-center font-display text-[34px] font-extrabold opacity-75"
              style={{ background: BAND_TINTS[i % BAND_TINTS.length], color: 'var(--tink)' }}
            >
              {initials(org.name)}
            </span>
            <span className="flex flex-1 flex-col px-5 pb-5 pt-[18px]">
              <span className="mb-1.5 flex flex-wrap items-center gap-2">
                <span className="font-display text-lg font-extrabold text-ink">{org.name}</span>
                {org.status === 'suspended' && (
                  <span className="badge bg-sunken text-muted">SUSPENDED</span>
                )}
              </span>
              {org.description && (
                <span className="line-clamp-2 text-[13px] font-semibold leading-relaxed text-muted">
                  {org.description}
                </span>
              )}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
