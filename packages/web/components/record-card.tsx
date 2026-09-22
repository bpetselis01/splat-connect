/**
 * Every list row that represents a record with a life of its own — an exchange,
 * a build, a print request, a printer's job.
 *
 * Measured off the artboard: 20px padding, 14px gap, 24px radius, --surface
 * behind a hairline at --e2 + --hi. Head row is a 48px tinted tile, a 20px
 * Baloo 2 title over one meta line, and a status pill hard right.
 *
 * Two shape rules the brief is explicit about, both of which are easy to break
 * by accident:
 *
 * **This is the list shape, never the detail shape.** A detail page is a
 * full-width header, a cost panel, a rail joined to a stage-facts panel, and a
 * thread beside a sticky aside. Reaching for this component there produces a
 * compact card pretending to be a page.
 *
 * **Exactly one filled brand primary in the action row.** On a record that is a
 * conversation, that primary is Thread — because the thing you almost always
 * want is to go and read it. Everything else is an outline secondary, and the
 * stage-specific action sits right of a spacer so it lands away from the
 * primary and cannot be hit on the way past.
 *
 * Never render repeated records as a table, and never summarise them with a
 * four-tile stat grid; stats are a chip row.
 */
import type { ReactNode } from 'react'
import { StageRail, type Stage } from '@/components/stage-rail'

export function RecordCard({
  icon,
  tint = 'var(--b100)',
  title,
  meta,
  sub,
  pill,
  stages,
  onStageSelect,
  note,
  primary,
  secondary,
  stageAction,
}: {
  /** Duotone glyph for the tile. Decorative — the title carries the meaning. */
  icon: ReactNode
  /** Tile tint. One of the --t* tokens, keyed to what kind of record this is. */
  tint?: string
  title: ReactNode
  /** One line: parts · counterparty · when. Not two, and never a paragraph. */
  meta: ReactNode
  /** An optional quieter line under the meta, e.g. "On behalf of <org>". */
  sub?: ReactNode
  /** Status pill, right-aligned. Use <Badge/>, which already knows the tones. */
  pill?: ReactNode
  /** Omit entirely on a record with no process — do not render an empty rail. */
  stages?: Stage[]
  onStageSelect?: (stage: Stage) => void
  /** One quiet line between the rail and the actions, e.g. the latest message. */
  note?: ReactNode
  /** The single filled primary. On a conversation record this is Thread. */
  primary?: ReactNode
  secondary?: ReactNode
  /** Right-aligned, past the spacer: the action this stage affords. */
  stageAction?: ReactNode
}) {
  // The board's 24px card radius and 18px tile, value for value. --e2 is paired
  // with --hi, the inset highlight that keeps a card from reading as a flat
  // rectangle on the canvas.
  return (
    <article
      className="flex flex-col gap-3.5 rounded-[var(--radius-card)] border border-line bg-surface p-5"
      style={{ boxShadow: 'var(--shadow-e2), var(--shadow-hi)' }}
    >
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden="true"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-[var(--radius-inset)]"
          style={{ background: tint, color: 'var(--tink)' }}
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl font-extrabold tracking-[-0.01em] text-ink">{title}</h3>
          <p className="mt-[3px] truncate text-sm font-semibold text-muted">{meta}</p>
          {sub ? <p className="mt-[3px] text-[13px] text-muted">{sub}</p> : null}
        </div>
        {pill ? <div className="shrink-0">{pill}</div> : null}
      </div>

      {stages?.length ? <StageRail stages={stages} onSelect={onStageSelect} /> : null}

      {note ? <p className="truncate text-sm text-muted">{note}</p> : null}

      {primary || secondary || stageAction ? (
        <div className="flex flex-wrap items-center gap-2">
          {primary}
          {secondary}
          <span className="flex-1" />
          {stageAction}
        </div>
      ) : null}
    </article>
  )
}
