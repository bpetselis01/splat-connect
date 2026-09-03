/**
 * The fact list for one toy, under whatever the caller shows the photos in —
 * shared by the owner's own Review step (ToyReviewPanel in toy-editor.tsx) and
 * the public toy detail page. No owner name here: the owner's own review has no
 * need to name themselves, and the public page renders that above this
 * component instead.
 *
 * `photos` is a slot rather than a flag because the two callers genuinely want
 * different things: a reviewer checking their own listing wants all five at
 * once, and a stranger deciding whether to ask for the toy wants to look
 * through them one at a time.
 */
import type { ReactNode } from 'react'
import type { Toy } from '@splat-connect/types'

export function ToySummary({ toy, photos }: { toy: Toy; photos: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      {photos}

      <dl className="flex flex-col gap-2 text-sm">
        <div>
          <dt className="font-semibold text-ink">Name</dt>
          <dd>{toy.name}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">Condition</dt>
          <dd>{toy.condition} / 10</dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">Description</dt>
          <dd>{toy.description || '—'}</dd>
        </div>
        <div>
          <dt className="font-semibold text-ink">Switch-adapted</dt>
          <dd>{toy.switch_adapted ? 'Yes' : 'No'}</dd>
        </div>
      </dl>
    </div>
  )
}
