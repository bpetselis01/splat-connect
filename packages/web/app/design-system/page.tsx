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
        <h1 className="title-hub">Components & states</h1>
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


      {/* The board's sheet carries these six and live's did not, which is a
          particular kind of wrong on the page whose job is to show what the
          design system contains. Every example is a resting render — the states
          needing a pointer live at /design-system/states. */}
      <Section title="Inputs" blurb="Sunk into the canvas, not raised onto white. 48px, 14px radius.">
        <div className="grid max-w-xl gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-ink">Toy name</span>
            <input className="field" defaultValue="Light-up drum" readOnly />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-ink">Condition</span>
            <select className="field" defaultValue="good">
              <option value="good">Good</option>
              <option value="like-new">Like new</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-ink">What needs to change</span>
            <textarea
              className="field"
              rows={3}
              defaultValue="The button is too stiff for Leo to press."
              readOnly
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-bold text-ink">Disabled</span>
            <input className="field" defaultValue="Not editable" disabled />
          </label>
        </div>
      </Section>

      <Section title="Selection controls" blurb="A 44px target around every one, however small it draws.">
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2.5 text-sm text-ink">
            <input type="checkbox" defaultChecked readOnly className="h-5 w-5 accent-[var(--color-brand)]" />
            Switch-adapted
          </label>
          <label className="flex items-center gap-2.5 text-sm text-ink">
            <input type="checkbox" readOnly className="h-5 w-5 accent-[var(--color-brand)]" />
            Needs a mount
          </label>
          <fieldset className="flex flex-col gap-2 border-0 p-0">
            <legend className="text-sm font-bold text-ink">Offer</legend>
            <label className="flex items-center gap-2.5 text-sm text-ink">
              <input type="radio" name="ds-offer" defaultChecked readOnly className="h-5 w-5 accent-[var(--color-brand)]" />
              Lend it
            </label>
            <label className="flex items-center gap-2.5 text-sm text-ink">
              <input type="radio" name="ds-offer" readOnly className="h-5 w-5 accent-[var(--color-brand)]" />
              Give it away
            </label>
          </fieldset>
        </div>
      </Section>

      <Section title="Feedback" blurb="Tint carries the register; the sentence carries the meaning.">
        <div className="flex max-w-xl flex-col gap-3">
          <p className="rounded-card bg-success-soft px-4 py-3 text-sm leading-relaxed text-ink">
            Saved. Northside Therapy Collective has been asked to review it.
          </p>
          <p className="rounded-card bg-honey-soft px-4 py-3 text-sm leading-relaxed text-ink">
            This guide has no safety notes yet. Add them before you submit.
          </p>
          <p className="rounded-card bg-danger-soft px-4 py-3 text-sm leading-relaxed text-ink">
            That code did not match. Ask them to read it again.
          </p>
        </div>
      </Section>

      <Section title="Skeletons & progress" blurb="Shapes the size of what is coming, never a spinner.">
        <div className="flex max-w-xl flex-col gap-4">
          <div className="card flex flex-col gap-2 p-4">
            <span className="block h-4 w-2/5 rounded-pill bg-sunken" />
            <span className="block h-3 w-4/5 rounded-pill bg-sunken" />
            <span className="block h-3 w-3/5 rounded-pill bg-sunken" />
          </div>
          <div>
            <p className="eyebrow text-muted">Course progress</p>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={16}
              aria-valuenow={6}
              aria-label="Course progress"
              className="mt-2 h-2 w-full overflow-hidden rounded-pill bg-sunken"
            >
              <div className="h-full rounded-pill bg-brand-dark" style={{ width: '37.5%' }} />
            </div>
          </div>
        </div>
      </Section>

      <Section title="Elevation & radii" blurb="Four steps of depth, and the radii that go with them.">
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            ['e1', 'var(--shadow-e1)', 'Field'],
            ['e2', 'var(--shadow-e2)', 'Card'],
            ['e3', 'var(--shadow-e3)', 'Popover'],
            ['e4', 'var(--shadow-e4)', 'Dialog'],
          ].map(([name, shadow, use]) => (
            <div
              key={name}
              className="rounded-card border border-line bg-surface p-4"
              style={{ boxShadow: shadow }}
            >
              <p className="numeral text-[20px] text-ink">{name}</p>
              <p className="text-xs text-muted">{use}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-4">
          {[
            ['field', '14px'],
            ['panel', '18px'],
            ['card', '24px'],
            ['pill', '999px'],
          ].map(([name, size]) => (
            <div key={name} className="flex flex-col items-center gap-1.5">
              <span
                className="block h-14 w-14 border border-line bg-sunken"
                style={{ borderRadius: `var(--radius-${name})` }}
              />
              <span className="text-xs text-muted">
                {name} · {size}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title={'Mascot — "Splat" the bear'} blurb="Used for encouragement and empty states, never for status.">
        <div className="flex flex-wrap items-center gap-6">
          <span className="grid h-24 w-24 place-items-center rounded-card bg-brand-tint text-5xl">
            🧸
          </span>
          <p className="max-w-prose text-sm leading-relaxed text-muted">
            The bear turns up when a page has nothing to show yet, and when somebody
            finishes something. It never carries state — a toy is not &ldquo;bear
            coloured&rdquo;, it is accepted or it is not.
          </p>
        </div>
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
