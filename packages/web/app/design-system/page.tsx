/**
 * The component sheet. A real route in the prototype (/design-system), and the
 * page a developer opens instead of guessing what a control looks like.
 *
 * Ported from `SPLAT Design System - Soft Pop.dc.html` in the artboard project,
 * which is the authoritative sheet — not the design-system project of the same
 * name, which still serves the retired Pixel system. The board's own page is
 * Foundations plus the four patterns everything else is assembled from; the
 * primitive specimens below that are ours, because a developer opening this
 * page wants to see a <select> too and the board never draws one.
 *
 * Deliberately a server component with no state: every example is a resting
 * render, and the states that need a pointer (hover, focus, active) are the
 * browser's job to show. The prototype has a second screen for those at
 * /design-system/states.
 */
import {
  ArrowBendDownRight,
  ChatCircleDots,
  Dog,
  Drop,
  HandTap,
  Tag,
} from '@phosphor-icons/react/dist/ssr'
import { RecordCard } from '@/components/record-card'
import { StageRailCard } from '@/components/stage-rail-card'
import { CostPanel } from '@/components/cost-panel'
import { Disclosure } from '@/components/disclosure'
import { Badge } from '@/components/badge'
import { SplatMascot } from '@/components/splat-mascot'
import type { Stage } from '@/components/stage-rail'
import { Alert } from '@/components/alert'

export const metadata = { title: 'Component sheet — SPLAT Connect' }

const live: Stage[] = [
  { key: 'requested', label: 'Requested', caption: '28 August', state: 'done' },
  { key: 'accepted', label: 'Accepted', caption: 'Northside said yes', state: 'done' },
  { key: 'handover', label: 'Handover', caption: 'Waiting on your code', state: 'now' },
  { key: 'closed', label: 'Closed', caption: 'Not yet', state: 'todo' },
]

// The same four steps on a record that stopped. Its captions are its own.
const stopped: Stage[] = [
  { key: 'requested', label: 'Requested', caption: '12 July', state: 'done' },
  { key: 'accepted', label: 'Accepted', caption: 'Declined — toy already promised', state: 'stop' },
  { key: 'handover', label: 'Handover', caption: 'Never got here', state: 'todo' },
  { key: 'closed', label: 'Closed', caption: 'Closed 13 July', state: 'done' },
]

/** The eleven brand steps, drawn as the board draws them. */
const RAMP = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const
const TINTS = ['coral', 'amber', 'violet', 'mint', 'ok', 'bad'] as const

/* The four control heights, each rendered at the weight it is used at: the
   specimen has to BE the height it names, or the sheet is a list of numbers. */
const HEIGHTS: Array<{ label: string; h: number; className: string; style?: React.CSSProperties }> = [
  { label: '36 quiet', h: 36, className: 'text-brand-deep' },
  {
    label: '44 secondary',
    h: 44,
    className: 'border border-line bg-surface text-ink',
    style: { boxShadow: 'var(--shadow-e1)' },
  },
  {
    label: '48 standard',
    h: 48,
    className: 'border border-line bg-surface text-ink',
    style: { boxShadow: 'var(--shadow-e1)' },
  },
  {
    label: '52 primary',
    h: 52,
    className: 'text-[var(--onbrand)]',
    style: { background: 'var(--b600)', boxShadow: 'var(--shadow-glow), var(--shadow-hi)' },
  },
]

const RADII: Array<[string, string]> = [
  ['pill', 'var(--radius-pill)'],
  ['14', 'var(--radius-field)'],
  ['18', 'var(--radius-inset)'],
  ['24', 'var(--radius-card)'],
]

/** The stage action the board draws: a tint pill, not a second button. */
function StageAction({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-pill px-[13px] py-1.5 text-[13px] font-extrabold"
      style={{ background: 'var(--tmint)', color: 'var(--tink)' }}
    >
      <ArrowBendDownRight size={15} weight="fill" aria-hidden="true" />
      {children}
    </span>
  )
}

function Section({ title, blurb, children }: { title: string; blurb?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3.5">
      <h2 className="font-display text-[22px] font-extrabold text-ink">{title}</h2>
      {blurb ? <p className="max-w-[66ch] text-[15px] text-muted">{blurb}</p> : null}
      {children}
    </section>
  )
}

export default function DesignSystemPage() {
  return (
    <main className="mx-auto flex max-w-[1100px] flex-col gap-[34px] px-7 pb-16 pt-8">
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="eyebrow text-muted">Design system · replaces Pixel</p>
          <h1 className="mt-2 title-hub">SPLAT Connect — Soft Pop</h1>
          <p className="mt-2 max-w-[60ch] text-[17px] leading-[1.55] text-muted [text-wrap:pretty]">
            The tokens and the four patterns the whole product is built from, rendering off the
            updated design-system stylesheet.
          </p>
        </div>
        <span className="flex flex-none items-center gap-3">
          <span
            aria-hidden="true"
            className="grid h-11 w-11 place-items-center rounded-[var(--radius-field)] text-white"
            style={{
              background: 'linear-gradient(145deg, var(--brand-400), var(--brand-600))',
              boxShadow: 'var(--shadow-glow), var(--shadow-hi)',
            }}
          >
            <HandTap size={24} weight="fill" />
          </span>
          <span className="font-display text-[22px] font-extrabold leading-none tracking-[-0.01em] text-ink">
            SPLAT <span className="text-brand-dark">Connect</span>
          </span>
        </span>
      </header>

      <Section title="Foundations">
        <div className="flex flex-wrap gap-2.5">
          {RAMP.map((step) => (
            <span
              key={step}
              className="flex h-14 min-w-0 flex-[1_1_60px] items-end rounded-[var(--radius-field)] px-2 py-1.5 text-[10px] font-extrabold"
              style={{
                background: `var(--brand-${step})`,
                color: step >= 500 ? '#ffffff' : 'var(--ink)',
              }}
            >
              {step}
            </span>
          ))}
        </div>

        <div className="flex flex-wrap gap-2.5">
          {TINTS.map((name) => (
            <span
              key={name}
              className="min-w-0 flex-[1_1_90px] rounded-[var(--radius-field)] px-3.5 py-3 text-[11px] font-extrabold uppercase tracking-[0.04em]"
              style={{ background: `var(--t${name})`, color: 'var(--tink)' }}
            >
              {name}
            </span>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          {HEIGHTS.map((spec) => (
            <span
              key={spec.label}
              className={`inline-flex items-center rounded-pill px-[18px] text-sm font-extrabold ${spec.className}`}
              style={{ minHeight: spec.h, ...spec.style }}
            >
              {spec.label}
            </span>
          ))}
          <span className="flex-1" />
          {RADII.map(([label, value]) => (
            <span
              key={label}
              className="grid h-[52px] w-16 place-items-end justify-center border border-line bg-surface pb-[5px] text-[10px] font-extrabold text-muted"
              style={{ borderRadius: value, boxShadow: 'var(--shadow-e2), var(--shadow-hi)' }}
            >
              {label}
            </span>
          ))}
        </div>
      </Section>

      <Section
        title="A · RecordCard"
        blurb="Every repeating record is one of these. Head row, the record's own stage rail, then one filled primary and the stage action on the right."
      >
        <RecordCard
          icon={<Drop size={24} weight="duotone" />}
          tint="var(--tmint)"
          title="Bubble machine"
          meta="Donation · Northside Therapy Collective · requested 28 Aug"
          pill={<Badge status="pending" label="Waiting on you" />}
          stages={live}
          note="Northside: “Any time Saturday works for us.”"
          primary={
            <button type="button" className="btn btn-primary">
              <ChatCircleDots size={18} weight="fill" aria-hidden="true" />
              Thread
            </button>
          }
          secondary={
            <button type="button" className="btn btn-quiet">
              <Tag size={18} weight="bold" aria-hidden="true" />
              View the listing
            </button>
          }
          stageAction={<StageAction>Send your code</StageAction>}
        />
        <RecordCard
          icon={<Dog size={24} weight="duotone" />}
          tint="var(--tviolet)"
          title="Plush dog with a big button"
          meta="Family covers parts · Westmead Toy Hub · 12 Jul"
          pill={<Badge status="withdrawn" label="Declined" />}
          stages={stopped}
          note="Westmead: “Sorry — this one went out last week.”"
          primary={
            <button type="button" className="btn btn-primary">
              <ChatCircleDots size={18} weight="fill" aria-hidden="true" />
              Thread
            </button>
          }
          secondary={
            <button type="button" className="btn btn-quiet">
              <Tag size={18} weight="bold" aria-hidden="true" />
              View the listing
            </button>
          }
        />
      </Section>

      <Section
        title="B · StageRail, joined to StageFacts"
        blurb="On a detail page the rail is a full-width card butted onto a facts panel. Four facts, about this stage only."
      >
        <StageRailCard
          stages={live}
          facts={{
            title: 'Handover',
            facts: [
              { label: 'Your code', value: '4821' },
              { label: 'Meeting at', value: 'Northside clinic, Chatswood' },
              { label: 'Agreed', value: 'Sat 6 Sep, 10am' },
              { label: 'Parts', value: 'Donation — no cost to you' },
            ],
          }}
        />
      </Section>

      <Section
        title="C · Disclosure, inside D · CostPanel"
        blurb="The decision stays visible — the total and the settle state. The evidence collapses."
      >
        <CostPanel
          lines={[
            {
              id: 'ds-switch',
              description: 'Switch + lead',
              amount_cents: 1800,
              claiming: true,
              settled_at: null,
            },
            {
              id: 'ds-postage',
              description: 'Postage',
              amount_cents: 650,
              claiming: true,
              settled_at: null,
            },
          ]}
          settlement={{
            note: 'I had the toy already, so it is just the switch and postage.',
            note_by: 'ds-other',
            method: 'Bank transfer on handover',
            receipt_path: null,
          }}
          noteByName="Northside Therapy Collective"
          viewerOwes
          transactionId="design-system-sheet"
        />
      </Section>

      {/* Past here is ours, not the board's: the sheet above is the four
          patterns, and these are the primitives they are assembled from. Every
          example is a resting render — the states needing a pointer live at
          /design-system/states. */}
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

      <Section title="Inputs" blurb="44px on --surface, 0 14px, a 14px radius and a hairline.">
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
          <Alert tone="ok">Saved. Northside Therapy Collective has been asked to review it.</Alert>
          <Alert tone="warn">This guide has no safety notes yet. Add them before you submit.</Alert>
          <Alert tone="bad">That code did not match. Ask them to read it again.</Alert>
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

      {/* The radii live in Foundations above — this is the depth ladder only. */}
      <Section title="Elevation" blurb="Four steps, and the thing each one is for.">
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
      </Section>

      <Section title="Disclosure, on its own" blurb="Keep the decision visible. Hide the evidence.">
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

      <Section title={'Mascot — "Splat" the bear'} blurb="Used for encouragement and empty states, never for status.">
        <div className="flex flex-wrap items-center gap-6">
          <SplatMascot width={120} />
          <p className="max-w-prose text-sm leading-relaxed text-muted">
            The bear turns up when a page has nothing to show yet, and when somebody
            finishes something. It never carries state — a toy is not &ldquo;bear
            coloured&rdquo;, it is accepted or it is not.
          </p>
        </div>
      </Section>
    </main>
  )
}
