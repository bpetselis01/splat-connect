/**
 * The stepper, and it is navigation rather than decoration.
 *
 * Geometry is measured off the artboard's exchanges screen, not transcribed:
 * 28px circle, 3px bar, 14px/800 label, 13px/400 caption, all inside an inset
 * at 18px radius on the canvas behind a hairline.
 *
 * Two rules from the brief are enforced by the shape of this API rather than by
 * asking callers to remember them.
 *
 * **Every row carries its own captions.** `caption` is required per step, so
 * there is nowhere to put a shared caption map. The bug that guards against is
 * real and specific: a global map renders the live record's wording into every
 * other row, so a list of five exchanges all claim "They said yes". Making the
 * field per-step means you cannot express that mistake.
 *
 * **A record that ended early stops where it stopped.** `stop` exists for
 * exactly that: earlier steps stay `done`, the step it died at takes `stop`
 * with the reason as its caption, the ones it never reached say so, and the
 * final step still closes. Such a record must never show a `now` dot — it is
 * not in progress, it is over. Derive these from the record's real status
 * vocabulary; if the data does not store a stage, that is a schema change and
 * belongs in SUPABASE.md before any of this renders.
 */
import { Check, DotOutline, Minus, X } from '@phosphor-icons/react/dist/ssr'

export type StageState = 'done' | 'now' | 'todo' | 'stop'

export interface Stage {
  /** Stable key — the record's own status token, not the label. */
  key: string
  /** The step name. Fixed vocabulary; reuse words, never invent synonyms. */
  label: string
  /** This record's own wording for this step. Never shared between rows. */
  caption: string
  state: StageState
}

/** bg / icon colour per state, and the ring the current step wears. */
const TONE: Record<StageState, { bg: string; fg: string; ring?: string }> = {
  done: { bg: 'var(--b600)', fg: 'var(--onbrand)' },
  now: { bg: 'var(--amber)', fg: 'var(--tink)', ring: '0 0 0 4px var(--tamber)' },
  todo: { bg: 'var(--surface2)', fg: 'var(--muted)' },
  stop: { bg: 'var(--surface2)', fg: 'var(--muted)' },
}

const GLYPH: Record<StageState, typeof Check> = {
  done: Check,
  now: DotOutline,
  todo: Minus,
  stop: X,
}

export function StageRail({
  stages,
  onSelect,
  label = 'Progress',
}: {
  stages: Stage[]
  /** Steppers move the record. Omit on a read-only view and steps render inert. */
  onSelect?: (stage: Stage) => void
  label?: string
}) {
  return (
    <ol
      aria-label={label}
      className="grid list-none gap-2.5 rounded-[var(--radius-panel)] border border-line bg-canvas p-4 px-[18px]"
      style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}
    >
      {stages.map((stage, i) => {
        const tone = TONE[stage.state]
        const Glyph = GLYPH[stage.state]
        const interactive = Boolean(onSelect)
        // The bar belongs to the step on its left, so the last one has none.
        const barDone = stages[i + 1] && stages[i + 1].state !== 'todo'
        return (
          <li key={stage.key} className="min-w-0">
            <button
              type="button"
              disabled={!interactive}
              onClick={interactive ? () => onSelect?.(stage) : undefined}
              aria-current={stage.state === 'now' ? 'step' : undefined}
              className="flex w-full flex-col items-start gap-1.5 bg-transparent p-0 text-left disabled:cursor-default"
            >
              <span className="flex w-full items-center gap-2">
                <span
                  aria-hidden="true"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full"
                  style={{ background: tone.bg, color: tone.fg, boxShadow: tone.ring }}
                >
                  <Glyph size={15} weight="bold" />
                </span>
                {i < stages.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="h-[3px] min-w-0 flex-1 rounded-full"
                    style={{ background: barDone ? 'var(--b600)' : 'var(--surface2)' }}
                  />
                )}
              </span>
              <span className="text-sm font-extrabold text-ink">{stage.label}</span>
              <span className="text-[13px] leading-[1.4] text-muted">{stage.caption}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
