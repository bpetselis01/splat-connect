/**
 * Recycling — waste plastic in, filament out.
 *
 * An explainer before a form, and the order is the point. What a contributor is
 * agreeing to is a seven-line declaration about the condition of a bag of
 * plastic, and "worth reading before you start collecting" is the whole reason
 * this page exists rather than a booking screen with a checkbox on it.
 *
 * The credit is described honestly and at length, because it is the one thing
 * on SPLAT that looks like money and is not: it is grams, at one organisation,
 * on their machines, issued by them after they weigh it. Every clause of that
 * is a limit somebody would otherwise discover later.
 *
 * Related files:
 * - app/get-involved/recycling/drop-off/page.tsx: the booking screen
 * - supabase/migrations/063_recycling_declaration.sql: the versioned wording
 */
import Link from 'next/link'
import {
  ArrowRight,
  Buildings,
  Camera,
  Drop,
  Funnel,
  Package,
  Prohibit,
  Question,
  Ruler,
  Scales,
  Sticker,
} from '@phosphor-icons/react/dist/ssr'
import { apiClient } from '@/lib/api-client'
import { getCapabilities } from '@/lib/capabilities'
import { InvolvedIntro, SECONDARY_BTN, TintNote } from '@/components/involved-page'
import { RECYCLING_DECLARATION } from '@splat-connect/types'

export const metadata = {
  title: 'Recycling — SPLAT Connect',
  description:
    'Failed prints and offcuts are the next switch mount. Drop clean waste plastic at an organisation that can extrude it, and earn print credit.',
}

const STEPS = [
  {
    title: 'Sort it and weigh it',
    body: 'Clean, dry, one polymer per bag. Two kilos minimum.',
  },
  {
    title: 'Book a slot and declare it',
    body: 'Tick off the condition list — one bad batch ruins a whole run.',
  },
  {
    title: 'They weigh it at the door',
    body: 'They record the real weight and issue the credit.',
  },
]

// The board's glyph for each declaration line, in RECYCLING_DECLARATION's order.
const DECL_ICONS = [Drop, Sticker, Funnel, Prohibit, Ruler, Question, Camera]

const MIN_LINE = 'Minimum 2 kg a drop — enough to be worth firing up a shredder.'

type OrgRow = { id: string; recycling_materials?: string[] }

function OrgsPanel({ takers }: { takers: number }) {
  return (
    <div className="card mt-8 flex flex-wrap items-center gap-4 px-[26px] py-[22px] shadow-[var(--e1)]">
      <Buildings weight="duotone" aria-hidden="true" className="shrink-0 text-[32px] text-[var(--b600)]" />
      <div className="min-w-[220px] flex-1">
        <p className="font-display text-lg font-extrabold">
          {takers} organisation{takers === 1 ? '' : 's'} take plastic
        </p>
        <p className="mt-1 text-sm leading-[1.5] text-muted">
          Each one publishes the polymers, the machines, the minimum and the door to use.
        </p>
      </div>
      <Link href="/organizations" className="btn min-h-12 border-line bg-[var(--surface)] text-[15px] text-ink">
        Browse organisations <ArrowRight weight="bold" aria-hidden="true" />
      </Link>
    </div>
  )
}

export default async function RecyclingPage() {
  const caps = await getCapabilities()
  const orgs = await apiClient.get<OrgRow[]>('/api/public/organizations').catch(() => [] as OrgRow[])
  const takers = orgs.filter((o) => (o.recycling_materials ?? []).length > 0).length

  if (caps) {
    // The board's signed-in page leads with your own totals — kilos diverted,
    // credit held, badges, your drop-offs. There is no cross-organisation read
    // of a contributor's own drop-offs yet, so those panels are not drawn.
    return (
      <div>
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-[62ch]">
            <span className="text-[13px] font-extrabold uppercase tracking-[.1em] text-brand">
              Get involved
            </span>
            <h1 className="mt-2.5 font-display text-[clamp(34px,4vw,52px)] font-extrabold leading-[1.05] tracking-[-.02em] text-ink">
              Waste plastic in, filament out
            </h1>
            <p className="mt-3.5 text-lg leading-[1.6] text-muted [text-wrap:pretty]">
              Failed prints and offcuts are the next switch mount. Some organisations shred and
              extrude them into filament. {MIN_LINE}
            </p>
          </div>
          <Link href="/get-involved/recycling/drop-off" className="btn btn-primary px-[22px]">
            <Package weight="bold" aria-hidden="true" /> Book a drop-off
          </Link>
        </div>

        <OrgsPanel takers={takers} />

        <h2 className="mb-3.5 mt-[38px] font-display text-[26px] font-extrabold text-ink">How it works</h2>
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(260px,1fr))]">
          {STEPS.map((step, i) => (
            <div key={step.title} className="flex flex-col gap-2 rounded-card border border-line bg-[var(--surface)] px-[22px] py-5">
              <span
                aria-hidden="true"
                className="grid h-[34px] w-[34px] place-items-center rounded-[14px] bg-[var(--b100)] font-display text-base font-extrabold text-[var(--b700)]"
              >
                {i + 1}
              </span>
              <p className="font-display text-[17px] font-extrabold">{step.title}</p>
              <p className="text-sm leading-[1.5] text-muted">{step.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-[22px] flex max-w-[80ch] items-start gap-1.5 rounded-[18px] bg-[var(--tamber)] px-5 py-4 text-[15px] leading-[1.55] text-[var(--tink)]">
          <Scales weight="bold" aria-hidden="true" className="mt-1 shrink-0" />
          Credit is issued by the organisation, at the door, against a real weight on a real
          scale. You cannot claim it yourself and nobody can transfer it — it is a record of
          plastic that arrived, not a currency.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-[900px]">
      <InvolvedIntro
        eyebrow="Get involved"
        title="Waste plastic in, filament out"
        lead="Failed prints and offcuts are the next switch mount. Some organisations shred and extrude them into filament."
      />

      <ol className="mt-[34px] flex list-none flex-col p-0">
        {STEPS.map((step, i) => (
          <li key={step.title} className="grid grid-cols-[auto_1fr] gap-5 pb-[26px]">
            <span
              aria-hidden="true"
              className="grid h-10 w-10 place-items-center rounded-full bg-[var(--tmint)] font-display text-[17px] font-extrabold text-[var(--tink)]"
            >
              {i + 1}
            </span>
            <span>
              <span className="mb-1 block font-display text-xl font-extrabold">{step.title}</span>
              <span className="block max-w-[58ch] text-[15px] leading-[1.55] text-muted">{step.body}</span>
            </span>
          </li>
        ))}
      </ol>

      <TintNote title="What you get back" tint="var(--tmint)">
        Grams of filament credit at the organisation that took your plastic, spendable on their
        printers when a family guide needs parts. About three quarters of what you bring becomes
        usable filament. It is not money, it cannot be transferred, and you cannot issue it
        yourself — the organisation weighs your drop at the door and the credit follows that
        number.
      </TintNote>

      <div className="mt-[22px] rounded-card border border-line bg-[var(--surface)] px-[26px] py-6 shadow-[var(--e1)]">
        <h2 className="mb-1.5 font-display text-xl font-extrabold">What you would be promising</h2>
        <p className="mb-3.5 text-[15px] leading-[1.55] text-muted">
          One contaminated bag can ruin a whole extruder run, so a drop-off comes with a
          declaration. Seven lines, all required — worth reading before you start collecting.
        </p>
        <ul className="m-0 flex list-none flex-wrap gap-2.5 p-0">
          {RECYCLING_DECLARATION.map((line, i) => {
            const Icon = DECL_ICONS[i] ?? Drop
            return (
              <li
                key={line}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-[var(--surface2)] px-3.5 py-2 text-[13.5px] font-bold"
              >
                <Icon weight="bold" aria-hidden="true" className="text-[var(--b600)]" />
                {line}
              </li>
            )
          })}
        </ul>
        <p className="mt-3.5 flex items-center gap-1.5 rounded-[14px] bg-[var(--tamber)] px-[15px] py-3 text-sm font-bold leading-[1.5] text-[var(--tink)]">
          <Scales weight="bold" aria-hidden="true" /> {MIN_LINE}
        </p>
      </div>

      <OrgsPanel takers={takers} />

      <div className="mt-[30px] flex flex-wrap items-center gap-3">
        <Link href="/signup" className="btn btn-primary px-[26px]">
          <Package weight="bold" aria-hidden="true" />
          Create an account to book a drop-off
        </Link>
        <Link href="/printing" className={SECONDARY_BTN}>
          See how printing works
        </Link>
      </div>
      <p className="mt-3 text-[13px] font-semibold text-muted">
        You need an account so the organisation can credit the right person. Free forever. No
        card, no newsletter.
      </p>
    </div>
  )
}
