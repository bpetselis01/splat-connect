/**
 * One organisation, as a card.
 *
 * Shared by the directory and the saved list so a saved organisation looks like
 * the one it was saved from — the same rule the tutorial and toy cards follow,
 * and the reason the saved API returns the same columns the public list does.
 *
 * The save control is an optional island, as it is on every other card: present
 * on the saved list (filled, and clicking it removes the row) and absent from
 * the directory, which has its own arrangement.
 */
import Link from 'next/link'
import { Buildings } from '@phosphor-icons/react/dist/ssr'
import { SaveButton } from '@/components/save-button'
import type { SaveSlug } from '@splat-connect/types'

export type OrgCardOrg = {
  id: string
  name: string
  description: string | null
  suburb?: string | null
  state?: string | null
}

export function OrgCard({
  org,
  save,
}: {
  org: OrgCardOrg
  save?: { slug: SaveSlug; id: string; saved: boolean; signedIn: boolean }
}) {
  const where = [org.suburb, org.state].filter(Boolean).join(' ')
  return (
    <div className="save-host relative">
      <Link href={`/organizations/${org.id}/public`} className="card card-link flex h-full gap-4 p-5">
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-brand-tint text-brand-deep"
        >
          <Buildings className="h-6 w-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="card-title block">{org.name}</span>
          {where && <span className="block text-xs text-muted">{where}</span>}
          {org.description && (
            <span className="mt-1 block text-sm leading-relaxed text-muted">{org.description}</span>
          )}
        </span>
      </Link>
      {save && (
        <SaveButton
          slug={save.slug}
          id={save.id}
          saved={save.saved}
          signedIn={save.signedIn}
          className="absolute right-3 top-3"
        />
      )}
    </div>
  )
}
