/**
 * The board's one lifecycle vocabulary for My tutorials, My toys and Design
 * challenges, so the same word always means the same thing on all three:
 * Needs you (your move) · Live (public) · Waiting (someone else's move) ·
 * Hidden (only you can see it) — plus Declined and Handed over.
 *
 * Two pieces: the pill a card wears, and the segmented stage filter above the
 * grid. The filter is links rather than buttons — `?stage=` in the URL — so
 * the page stays a server component and a filtered view can be shared.
 */
import Link from 'next/link'
import type { Route } from 'next'
import {
  BellRinging,
  Broadcast,
  EyeSlash,
  Gift,
  HourglassMedium,
  XCircle,
} from '@phosphor-icons/react/dist/ssr'

export type StageKey = 'needsyou' | 'live' | 'waiting' | 'hidden' | 'declined' | 'gone'

export const STAGE: Record<StageKey, { label: string; tint: string; fg: string; Icon: typeof Gift }> = {
  needsyou: { label: 'Needs you', tint: 'var(--tcoral)', fg: 'var(--tink)', Icon: BellRinging },
  live: { label: 'Live', tint: 'var(--tok)', fg: 'var(--tink)', Icon: Broadcast },
  waiting: { label: 'Waiting', tint: 'var(--tamber)', fg: 'var(--tink)', Icon: HourglassMedium },
  hidden: { label: 'Hidden', tint: 'var(--surface2)', fg: 'var(--muted)', Icon: EyeSlash },
  declined: { label: 'Declined', tint: 'var(--tviolet)', fg: 'var(--tink)', Icon: XCircle },
  gone: { label: 'Handed over', tint: 'var(--tmint)', fg: 'var(--tink)', Icon: Gift },
}

/** `label` overrides the stage's own word, e.g. "Draft" for a hidden guide. */
export function StagePill({ stage, label }: { stage: StageKey; label?: string }) {
  const s = STAGE[stage]
  return (
    <span className="stage-pill" style={{ background: s.tint, color: s.fg }}>
      <s.Icon weight="bold" aria-hidden="true" />
      {label ?? s.label}
    </span>
  )
}

export type StageOption = { id: string; label: string; n: number; divider?: boolean }

export function StageFilter({
  label,
  basePath,
  current,
  options,
}: {
  /** The group's accessible name, e.g. "Filter tutorials by stage". */
  label: string
  basePath: string
  current: string
  options: StageOption[]
}) {
  return (
    <div role="group" aria-label={label} className="seg-track">
      {options.map((o) => (
        <span key={o.id} className="contents">
          {o.divider && <span aria-hidden="true" className="seg-track__div" />}
          <Link
            href={(o.id === 'all' ? basePath : `${basePath}?stage=${o.id}`) as Route}
            aria-current={current === o.id ? 'true' : undefined}
            className="seg-track__opt"
            scroll={false}
          >
            {o.label}
            <span className="seg-track__n">{o.n}</span>
          </Link>
        </span>
      ))}
    </div>
  )
}

/** The board's "Nothing at that stage." with its way back to everything. */
export function StageNone({ basePath, note }: { basePath: string; note: string }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <p className="text-base font-extrabold text-ink">Nothing at that stage.</p>
      <p className="mt-1.5 max-w-[34ch] text-sm leading-relaxed text-muted">{note}</p>
      <Link href={basePath as Route} className="btn btn-quiet mt-5" scroll={false}>
        Show everything
      </Link>
    </div>
  )
}
