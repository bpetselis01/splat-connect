/**
 * "Also worth a look" on a toy's page (102): what the API resolved — the
 * holder's other listed toys, or their hand-picked toys and guides.
 */
import type { Route } from 'next'
import { BookOpen, Gift } from '@phosphor-icons/react/dist/ssr'
import { PICK_KIND_LABEL, type ToyPick } from '@splat-connect/types'
import { BoundaryLink } from '@/components/boundary-link'
import { tintFor } from '@/components/card-photo'

export function ToyPicks({ picks, holder }: { picks: ToyPick[]; holder: string | null }) {
  if (picks.length === 0) return null
  return (
    <section aria-labelledby="toy-rec-h" className="flex flex-col gap-4 border-t border-line pt-[26px]">
      <div>
        <h2 id="toy-rec-h" className="m-0 font-display text-[26px] font-extrabold text-ink">
          Also worth a look
        </h2>
        <p className="m-0 mt-1.5 max-w-[58ch] text-[15px] leading-[1.5] text-muted">
          {`Picked by ${holder ?? 'the holder'} — what else they have listed, and the guides behind it.`}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {picks.map((p) => {
          const Icon = p.kind === 'toy' ? Gift : BookOpen
          const href = (p.kind === 'toy' ? `/toy-library/${p.id}` : `/tutorials/${p.id}`) as Route
          return (
            <BoundaryLink key={`${p.kind}:${p.id}`} href={href} className="rec-card">
              <span aria-hidden="true" className="rec-card__band" style={{ background: tintFor(p.id) }}>
                <Icon size={46} weight="duotone" />
              </span>
              <span className="rec-card__body">
                <span className="eyebrow text-muted">{PICK_KIND_LABEL[p.kind]}</span>
                <span className="text-[17px] font-extrabold leading-[1.3] text-ink">{p.title}</span>
                {p.meta && <span className="mt-auto pt-2 text-[13px] font-extrabold text-brand-deep">{p.meta}</span>}
              </span>
            </BoundaryLink>
          )
        })}
      </div>
    </section>
  )
}
