/**
 * The rail and its facts, joined into one object.
 *
 * On a list row the rail is an inset panel. On a detail page it is a card in
 * its own right with a facts panel welded underneath — the brief's geometry:
 * the rail keeps the top two corners and loses its bottom border, the panel
 * keeps the bottom two and gains a dashed top. The dash is what says "same
 * object, second part" rather than "two cards that happen to touch".
 *
 * The facts belong to the stage the record is AT, not to the record in general.
 * A completed exchange does not want a handover code; an exchange waiting on an
 * answer does not want a meeting place. Passing a whole `StageFacts` in, derived
 * in one place from the row, is what keeps that true — see lib/exchange-stages.
 */
import { StageRail, type Stage } from '@/components/stage-rail'
import type { StageFacts } from '@/lib/exchange-stages'

export function StageRailCard({ stages, facts }: { stages: Stage[]; facts: StageFacts }) {
  return (
    <section aria-label="Progress and details">
      <div className="rounded-t-[var(--radius-card)] border border-line border-b-0 bg-surface px-[22px] pb-[18px] pt-5 shadow-[var(--shadow-e2),var(--shadow-hi)]">
        {/* The rail inside a card drops its own inset chrome — it is already in
            a box, and a panel inside a panel reads as a mistake. */}
        <div className="[&>ol]:border-0 [&>ol]:bg-transparent [&>ol]:p-0">
          <StageRail stages={stages} />
        </div>
      </div>

      {/* No --hi on the lower half: the inset highlight reads as the top edge
          of a fresh card, and this half is the bottom of the one above. */}
      <div className="rounded-b-[var(--radius-card)] border border-t border-dashed border-line bg-surface px-[22px] pb-5 pt-[18px] shadow-[var(--shadow-e2)]">
        <h3 className="eyebrow text-muted">{facts.title}</h3>
        <dl className="mt-3 grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
          {facts.facts.map((fact) => (
            <div key={fact.label} className="min-w-0">
              <dt className="text-[13px] font-extrabold text-muted">{fact.label}</dt>
              <dd className="mt-1 text-[15px] font-bold text-ink">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
