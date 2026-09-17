/**
 * The component sheet. A real route in the prototype (/design-system), and the
 * page a developer opens instead of guessing what a control looks like.
 *
 * Deliberately a server component with no state: every example is a resting
 * render, and the states that need a pointer (hover, focus, active) are the
 * browser's job to show. The prototype has a second screen for those at
 * /design-system/states.
 */
import { Gift, ArrowsLeftRight, ChatCircle } from '@phosphor-icons/react/dist/ssr'
import { RecordCard } from '@/components/record-card'
import { Disclosure } from '@/components/disclosure'
import { Badge } from '@/components/badge'
import type { Stage } from '@/components/stage-rail'

export const metadata = { title: 'Component sheet — SPLAT Connect' }

const live: Stage[] = [
  { key: 'requested', label: 'Requested', caption: 'Asked 2 Sep', state: 'done' },
  { key: 'accepted', label: 'Accepted', caption: 'They said yes', state: 'done' },
  { key: 'handover', label: 'Handover', caption: 'Agree a time', state: 'now' },
  { key: 'closed', label: 'Closed', caption: 'Both confirm to close', state: 'todo' },
]

// The same four steps on a record that stopped. Its captions are its own.
const stopped: Stage[] = [
  { key: 'requested', label: 'Requested', caption: 'Asked 1 Sep', state: 'done' },
  { key: 'accepted', label: 'Accepted', caption: 'They said no', state: 'stop' },
  { key: 'handover', label: 'Handover', caption: 'Never got here', state: 'todo' },
  { key: 'closed', label: 'Closed', caption: 'Closed 3 Sep', state: 'done' },
]

function Section({ title, blurb, children }: { title: string; blurb: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="font-display text-2xl font-extrabold text-ink">{title}</h2>
        <p className="text-sm text-muted">{blurb}</p>
      </div>
      {children}
    </section>
  )
}

export default function DesignSystemPage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-12 px-6 py-10">
      <header>
        <p className="text-xs font-extrabold uppercase tracking-widest text-muted">Soft Pop</p>
        <h1 className="font-display text-4xl font-extrabold text-ink">Components & states</h1>
        <p className="max-w-prose text-muted">
          Every shared control, at rest. Hover and focus them to see the rest.
        </p>
      </header>

      <Section title="Buttons" blurb="One filled primary per view. Everything else is an outline.">
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-primary">Request this toy</button>
          <button type="button" className="btn btn-quiet">Save</button>
          <button type="button" className="btn btn-danger">Delete</button>
          <button type="button" className="btn btn-soft">Maybe later</button>
          <button type="button" className="btn btn-sm btn-quiet">Skip for now</button>
          <button type="button" className="btn btn-primary" disabled>Request this toy</button>
        </div>
      </Section>

      <Section title="Status pills" blurb="Read-only. The tint carries meaning and the word repeats it.">
        <div className="flex flex-wrap items-center gap-2">
          <Badge status="published" />
          <Badge status="pending" />
          <Badge status="rejected" />
          <Badge status="draft" />
          <Badge status="accepted" />
        </div>
      </Section>

      <Section
        title="Record card"
        blurb="Every list row for a record with a process. The list shape — never the detail shape."
      >
        <RecordCard
          icon={<Gift size={22} weight="duotone" />}
          tint="var(--tmint)"
          title="Bubble machine"
          meta="Donation with Northside Therapy Collective · 2 Sep"
          pill={<Badge status="accepted" />}
          stages={live}
          note="Thursday after three works for us. Ask at reception for Rachel."
          primary={
            <button type="button" className="btn btn-primary">
              <ChatCircle size={18} weight="fill" aria-hidden="true" />
              Thread
            </button>
          }
          stageAction={
            <button type="button" className="btn btn-quiet">Confirm handover</button>
          }
        />
        <RecordCard
          icon={<ArrowsLeftRight size={22} weight="duotone" />}
          tint="var(--tviolet)"
          title="Vibrating cushion"
          meta="Exchange with Priya Nadarajah · 1 Sep"
          pill={<Badge status="withdrawn" />}
          stages={stopped}
          primary={
            <button type="button" className="btn btn-primary">
              <ChatCircle size={18} weight="fill" aria-hidden="true" />
              Thread
            </button>
          }
        />
      </Section>

      <Section title="Disclosure" blurb="Keep the decision visible. Hide the evidence.">
        <div className="rounded-[var(--radius-card)] border border-line bg-surface shadow-e1">
          <Disclosure summary="Build details">
            <dl className="grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted">Parts</dt>
                <dd className="text-ink">6 × M3 bolt, 1 × 3.5 mm socket</dd>
              </div>
              <div>
                <dt className="text-muted">Printed by</dt>
                <dd className="text-ink">Northside Therapy Collective</dd>
              </div>
            </dl>
          </Disclosure>
        </div>
      </Section>
    </main>
  )
}
