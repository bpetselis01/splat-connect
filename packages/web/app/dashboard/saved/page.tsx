/**
 * The saved hub: one card per type you can save, with how many you have kept.
 *
 * The board draws one group of four. It used to be "Ready now" and "Coming
 * soon"; organisations went live on 2026-09-17 and printable parts is still
 * enum-only, so the second group had shrunk to one card the board does not
 * draw. /dashboard/saved/parts still exists for anything that links there.
 *
 * Related files:
 * - app/dashboard/saved/[type]/page.tsx: the lists these cards lead to
 * - lib/saves.ts: getSavedIds, the counts
 * - packages/types/src/index.ts: SAVE_SLUGS, which decides what is live
 */
import type { Route } from 'next'
import { Buildings, ClipboardText, FileText, Package } from '@phosphor-icons/react/dist/ssr'
import { requireCapabilities } from '@/lib/require-capabilities'
import { getSavedIds } from '@/lib/saves'
import { BoundaryLink } from '@/components/boundary-link'
import type { SaveSlug } from '@splat-connect/types'

export const metadata = {
  title: 'Saved — SPLAT Connect',
}

const CARDS: Array<{ slug: SaveSlug; label: string; blurb: string; tint: string; Icon: typeof Package }> = [
  { slug: 'tutorials', label: 'Tutorials', blurb: 'Guides you kept to build later.', tint: 'var(--b100)', Icon: FileText },
  { slug: 'toys', label: 'Toys', blurb: 'Toys you are considering asking for.', tint: 'var(--tmint)', Icon: Package },
  { slug: 'challenges', label: 'Design challenges', blurb: 'Challenges you want to come back to.', tint: 'var(--tcoral)', Icon: ClipboardText },
  { slug: 'organisations', label: 'Organisations', blurb: 'Groups whose work you want to follow.', tint: 'var(--tamber)', Icon: Buildings },
]

export default async function SavedHub() {
  await requireCapabilities()
  const ids = await getSavedIds()

  return (
    <div>
      <h1 className="title-hub">Saved</h1>
      <p className="mt-2.5 max-w-[58ch] text-[17px] text-muted">
        Everything you kept to come back to, grouped by the kind of thing it is.
      </p>

      <h2 className="mt-[42px] font-display text-2xl font-extrabold text-ink">Saved</h2>
      <p className="mb-[18px] mt-0.5 text-sm text-muted">
        Everything you can save today, from anywhere they appear on the site.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CARDS.map((c) => (
          <BoundaryLink
            key={c.slug}
            href={`/dashboard/saved/${c.slug}` as Route}
            className="card card-link flex flex-col p-6"
          >
            <span className="mb-3 flex items-center justify-between">
              <span
                aria-hidden="true"
                className="grid h-[46px] w-[46px] place-items-center rounded-[14px]"
                style={{ background: c.tint, color: 'var(--tink)' }}
              >
                <c.Icon size={25} weight="duotone" />
              </span>
              <span className="font-display text-[26px] font-extrabold text-muted">
                {ids?.[c.slug]?.length ?? 0}
              </span>
            </span>
            <span className="mb-1 block font-display text-[19px] font-extrabold text-ink">
              {c.label}
            </span>
            <span className="block text-sm leading-[1.5] text-muted">{c.blurb}</span>
          </BoundaryLink>
        ))}
      </div>
    </div>
  )
}
