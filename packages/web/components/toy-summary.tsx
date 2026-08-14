/**
 * The photo grid + fact list for one toy — shared by the owner's own Review
 * step (ToyReviewPanel in toy-editor.tsx) and the public toy detail page.
 * No owner name here: the owner's own review has no need to name themselves,
 * and the public page renders that above this component instead.
 */
import { ToyPhotoGrid } from '@/components/toy-photo-viewer'
import type { Toy } from '@splat-connect/types'

export function ToySummary({ toy }: { toy: Toy }) {
  return (
    <div className="flex flex-col gap-4">
      <ToyPhotoGrid
        coverPhotoUrl={toy.cover_photo_url}
        switchPhotoUrls={toy.switch_adapted ? toy.switch_photo_urls : []}
      />

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
