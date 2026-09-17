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
import { Recycle, Buildings, Check, Scales, Warning } from '@phosphor-icons/react/dist/ssr'
import { apiClient } from '@/lib/api-client'
import { getCapabilities } from '@/lib/capabilities'
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

type OrgRow = { id: string; recycling_materials?: string[] }

export default async function RecyclingPage() {
  const caps = await getCapabilities()
  const orgs = await apiClient.get<OrgRow[]>('/api/public/organizations').catch(() => [] as OrgRow[])
  const takers = orgs.filter((o) => (o.recycling_materials ?? []).length > 0).length

  return (
    <div>
      <p className="eyebrow text-muted">Get involved</p>
      <h1 className="mt-1.5 title-hub">Waste plastic in, filament out</h1>
      <p className="mt-2 max-w-prose text-base leading-relaxed text-muted">
        Failed prints and offcuts are the next switch mount. Some organisations shred and
        extrude them into filament.
      </p>

      <ol className="mt-8 flex flex-col gap-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="card flex items-start gap-4 p-4">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-tint font-display text-sm font-extrabold text-brand-deep"
            >
              {i + 1}
            </span>
            <span>
              <span className="card-title block">{step.title}</span>
              <span className="block text-sm leading-relaxed text-muted">{step.body}</span>
            </span>
          </li>
        ))}
      </ol>

      <section className="mt-10">
        <h2 className="title-detail flex items-center gap-2">
          <Scales className="h-5 w-5 text-brand-dark" aria-hidden="true" />
          What you get back
        </h2>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
          Grams of filament credit at the organisation that took your plastic, spendable on
          their printers when a family guide needs parts. About three quarters of what you bring
          becomes usable filament. It is not money, it cannot be transferred, and you cannot
          issue it yourself — the organisation weighs your drop at the door and the credit
          follows that number.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="title-detail">What you would be promising</h2>
        <p className="mb-4 mt-2 max-w-prose text-sm leading-relaxed text-muted">
          One contaminated bag can ruin a whole extruder run, so a drop-off comes with a
          declaration. Seven lines, all required — worth reading before you start collecting.
        </p>
        <ul className="card flex flex-col gap-2 p-5">
          {RECYCLING_DECLARATION.map((line) => (
            <li key={line} className="flex items-start gap-2 text-sm text-ink">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-dark" aria-hidden="true" />
              {line}
            </li>
          ))}
        </ul>
        <p className="mt-3 flex items-start gap-2 text-sm text-muted">
          <Warning className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Minimum 2 kg a drop — enough to be worth firing up a shredder.
        </p>
      </section>

      <aside className="card mt-10 flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center">
        <span aria-hidden="true" className="empty-badge shrink-0 text-brand-deep">
          <Buildings className="h-7 w-7" />
        </span>
        <div className="flex-1">
          <p className="font-display text-lg font-extrabold text-ink">
            {takers} organisation{takers === 1 ? '' : 's'} take plastic
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Each one publishes the polymers, the machines, the minimum and the door to use.
          </p>
        </div>
        <Link href="/organizations" className="btn btn-quiet btn-sm shrink-0">
          Browse organisations
        </Link>
      </aside>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link
          href={caps ? '/get-involved/recycling/drop-off' : '/signup'}
          className="btn btn-primary"
        >
          <Recycle className="h-4 w-4" aria-hidden="true" />
          {caps ? 'Book a drop-off' : 'Create an account to book a drop-off'}
        </Link>
        <Link href="/printing" className="btn btn-quiet">
          See how printing works
        </Link>
      </div>
      {!caps && (
        <p className="mt-2 text-sm text-muted">
          You need an account so the organisation can credit the right person. Free forever. No
          card, no newsletter.
        </p>
      )}
    </div>
  )
}
