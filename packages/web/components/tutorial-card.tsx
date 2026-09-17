import { BoundaryLink } from './boundary-link'
import { SaveButton, type SaveProps } from './save-button'
import { BookOpen } from '@phosphor-icons/react/dist/ssr'
import { CardPhoto } from './card-photo'
import { Badge } from './badge'
import { BackingSummary } from './backing-state'
import { KIND_LABEL, MATURITY_LABEL, type Tutorial, type TutorialOrg } from '@splat-connect/types'

/** GET /api/public/tutorials embeds accepted backing on every row. Only the
 *  fields the card reads, so a recommendation's embedded target — a pick of
 *  the tutorial — can be a card too. */
type Listed = Pick<Tutorial, 'id' | 'title' | 'difficulty' | 'kind' | 'toy_photo_url'> & {
  description?: string | null
  maturity?: Tutorial['maturity']
  tutorial_orgs?: TutorialOrg[]
}

/*
 * Title is 18px Nunito 800, measured off the artboard's library cards — NOT the
 * 20px Baloo 2 the brief gives for a card title. That line is about RecordCard,
 * the list row for a record with a process. A library card is a different
 * object: many of them tile a grid and are scanned rather than read, so the
 * display face would shout. Two card titles, two sizes, both from the board.
 */
export function TutorialCard({ tutorial, save }: { tutorial: Listed; save?: SaveProps }) {
  const backed = (tutorial.tutorial_orgs ?? []).some((b) => b.status === 'accepted')
  const card = (
    // BoundaryLink because this card also renders on /dashboard/saved/tutorials,
    // where /tutorials/[id] is a crossing out of the rail. On the public lists it
    // is not a crossing and this falls through to next/link unchanged.
    <BoundaryLink
      href={`/tutorials/${tutorial.id}`}
      data-testid="tutorial-card"
      className="card card-link flex flex-col overflow-hidden"
    >
      <CardPhoto src={tutorial.toy_photo_url} icon={BookOpen} tint="var(--color-brand-soft)" />
      {/* Chips, then title, then blurb, then whatever is true of this one —
          the board's order. Title-first put the least scannable line at the top
          of a grid of twelve: you read the difficulty to decide whether the
          title is worth reading, not the other way round. */}
      <div className="flex flex-1 flex-col gap-2 px-4 pb-[18px] pt-4">
        <div className="flex flex-wrap gap-1.5">
          <Badge status={tutorial.difficulty} />
          <Badge status={tutorial.kind} label={KIND_LABEL[tutorial.kind]} />
          {tutorial.maturity && tutorial.maturity !== 'complete' && (
            <Badge status={tutorial.maturity} label={MATURITY_LABEL[tutorial.maturity]} />
          )}
        </div>
        <p className="card-title-grid line-clamp-2">{tutorial.title}</p>
        {tutorial.description && (
          <p className="line-clamp-2 text-sm leading-[1.45] text-muted">{tutorial.description}</p>
        )}
        {/* Only when an organisation actually backed it. BackingSummary's
            "Reviewed by SPLAT" fallback is for the contributor's own pages, where
            the review path means something; on a public card it is internal jargon
            to a parent, and the absence of a badge is the correct signal. */}
        {backed && (
          <div className="mt-auto pt-1.5">
            <BackingSummary backing={tutorial.tutorial_orgs ?? []} />
          </div>
        )}
      </div>
    </BoundaryLink>
  )

  /*
   * No wrapper at all when saving is off, so every existing call site renders
   * byte-identically. That default is load-bearing rather than tidy: this card
   * also appears on pages that show your OWN work, where a save button reads as
   * a bug. Default-off keeps those correct by doing nothing, instead of by
   * remembering to switch something off.
   *
   * The island is a SIBLING of the anchor, never inside it — a <button> within
   * an <a> is invalid HTML with an ambiguous click target.
   */
  if (!save) return card

  return (
    <div className="save-host relative">
      {card}
      <SaveButton {...save} className="absolute right-2.5 top-2.5" />
    </div>
  )
}
