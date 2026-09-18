/**
 * Every state a control can be in, drawn at rest — a real route in the
 * prototype (/design-system/states) and the screen that settles an argument
 * about what hover is supposed to do.
 *
 * The sibling /design-system sheet shows each control once and leaves hover,
 * focus and active to the pointer. That is fine for "what does a chip look
 * like" and useless for "what does a PRESSED chip look like", because you
 * cannot hold six controls in six states at once with one mouse. So this page
 * forces each state instead, via `data-state` on the control and the block of
 * rules in app/globals.css that mirrors each real pseudo-class selector onto
 * it.
 *
 * Forced, not faked: every rule in that block is the real rule with
 * `[data-state='…']` added to its selector group, so a state can only drift
 * here if it drifts in the product too. The alternative — inline styles
 * transcribing the artboard — would have been a picture of the design system
 * rather than a rendering of it, and would have stayed green through exactly
 * the regressions this page exists to catch.
 *
 * What it caught on the way in, all three live: buttons padded 20px against
 * the artboard's 22px; the primary darkening to --b700 on hover, which is the
 * loading fill, so a hovered button and a sending one were indistinguishable;
 * and Pixel's whole diagonal press block still outranking Soft Pop's
 * scale(.96), so the press in the stylesheet had never once been on screen.
 *
 * Source of truth: the artboard's own `stateRows` table, captured in
 * docs/superpowers/specs/2026-09-16-soft-pop-extraction.md §2.
 */
import Link from 'next/link'
import { Badge, type BadgeStatus } from '@/components/badge'

export const metadata = { title: 'Interaction states — SPLAT Connect' }

/** The state a row forces. `rest` is the control with nothing added. */
type Forced = 'rest' | 'hover' | 'focus' | 'active' | 'disabled' | 'loading'

type Item = {
  /** The mono caption above the control. */
  label: string
  /** What the control says. Defaults to the row's own text. */
  text?: string
  className?: string
  force?: Forced
  /** A status pill: read-only, so it renders through the real Badge. */
  status?: BadgeStatus
  pressed?: boolean
}

type Row = { name: string; note: string; items: Item[] }

const ROWS: Row[] = [
  {
    name: 'Primary button',
    note: 'The main action on any screen. One per view.',
    items: [
      { label: 'default', className: 'btn btn-primary' },
      { label: 'hover', className: 'btn btn-primary', force: 'hover' },
      { label: 'focus', className: 'btn btn-primary', force: 'focus' },
      { label: 'active', className: 'btn btn-primary', force: 'active' },
      { label: 'disabled', className: 'btn btn-primary', force: 'disabled' },
      { label: 'loading', className: 'btn btn-primary', force: 'loading', text: 'Sending…' },
    ].map((i) => ({ text: 'Request this toy', ...i }) as Item),
  },
  {
    name: 'Secondary button',
    note: 'Everything that is not the main action.',
    items: [
      { label: 'default', className: 'btn btn-quiet' },
      { label: 'hover', className: 'btn btn-quiet', force: 'hover' },
      { label: 'focus', className: 'btn btn-quiet', force: 'focus' },
      { label: 'active', className: 'btn btn-quiet', force: 'active' },
      { label: 'disabled', className: 'btn btn-quiet', force: 'disabled' },
    ].map((i) => ({ text: 'Save', ...i }) as Item),
  },
  {
    name: 'Destructive',
    note: 'Delete, suspend, unpublish. Never the default focus.',
    items: [
      { label: 'default', className: 'btn btn-danger' },
      { label: 'hover', className: 'btn btn-danger', force: 'hover' },
      { label: 'focus', className: 'btn btn-danger', force: 'focus' },
    ].map((i) => ({ text: 'Delete', ...i }) as Item),
  },
  {
    name: 'Filter chip',
    note: 'Multi-select, always reversible.',
    items: [
      { label: 'off', className: 'chip', text: 'Easy' },
      { label: 'on', className: 'chip', text: 'Easy', pressed: true },
      { label: 'focus', className: 'chip', text: 'Easy', force: 'focus' },
    ],
  },
  {
    name: 'Status pill',
    note: 'Read-only. Tint carries meaning, text repeats it.',
    // The artboard's four, mapped onto the statuses that actually carry those
    // tints in the product — `rejected` is what it draws as "Returned", which
    // is the word a contributor sees on their own guide.
    items: [
      { label: 'published', status: 'published', text: 'Published' },
      { label: 'pending', status: 'pending', text: 'Pending' },
      { label: 'returned', status: 'rejected', text: 'Returned' },
      { label: 'draft', status: 'draft', text: 'Draft' },
    ],
  },
]

function Control({ item }: { item: Item }) {
  // The real component, so a tone that drifts in components/badge.tsx drifts
  // here too — the same reason the buttons below take real class names.
  if (item.status) return <Badge status={item.status} label={item.text} />

  return (
    <button
      type="button"
      className={item.className}
      data-state={item.force && item.force !== 'rest' ? item.force : undefined}
      // The real attributes, not a lookalike: `disabled` and
      // `aria-pressed` are what the stylesheet's own selectors read, so
      // these two states need no forcing at all.
      disabled={item.force === 'disabled'}
      data-loading={item.force === 'loading' ? 'true' : undefined}
      aria-pressed={item.pressed}
    >
      {item.text}
    </button>
  )
}

export default function InteractionStatesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="eyebrow text-muted">Soft Pop</p>
        <h1 className="mt-1.5 font-display text-4xl font-extrabold tracking-tight text-ink">
          Interaction states
        </h1>
        <p className="mt-2.5 max-w-[60ch] text-[17px] leading-relaxed text-muted">
          Every state a control can be in, so a developer never has to guess. Hover and focus
          the live examples — they behave exactly as they do in the product.
        </p>
        <p className="mt-2 text-sm text-muted">
          The resting sheet is at{' '}
          <Link href="/design-system" className="font-bold text-brand-dark underline">
            /design-system
          </Link>
          .
        </p>
      </div>

      <div className="flex flex-col gap-[22px]">
        {ROWS.map((row) => (
          <section key={row.name} className="card p-6">
            <h2 className="font-display text-xl font-extrabold text-ink">{row.name}</h2>
            <p className="mb-[18px] mt-1 text-sm text-muted">{row.note}</p>
            <div className="flex flex-wrap items-center gap-3.5">
              {row.items.map((item) => (
                <div key={item.label} className="flex flex-col items-start gap-2">
                  <span className="eyebrow text-muted">{item.label}</span>
                  <Control item={item} />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
