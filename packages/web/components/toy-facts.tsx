/**
 * The board's toy page, under the holder's notes: the four facts (075), the
 * "Built from" card, and — for a visitor who is not signed in — the gate that
 * says what signing in unlocks. Server components; nothing here is stateful.
 */
import Link from 'next/link'
import type { Route } from 'next'
import {
  BookOpen,
  HandHeart,
  LockSimple,
  MapPin,
  Package,
  ShieldCheck,
} from '@phosphor-icons/react/dist/ssr'
import { toyFacts, type ToyDetail } from '@splat-connect/types'

export function ToyFacts({ toy }: { toy: Pick<ToyDetail, 'age_min' | 'age_max' | 'batteries' | 'switch_fitting' | 'volume' | 'guide'> }) {
  const facts = toyFacts(toy)
  if (facts.length === 0 && !toy.guide) return null
  return (
    <div className="flex flex-col gap-4">
      {facts.length > 0 && (
        <dl className="m-0 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {facts.map((f) => (
            <div key={f.k} className="rounded-[18px] border border-line bg-surface p-4 shadow-[var(--shadow-e1)]">
              <dt className="text-[11px] font-extrabold uppercase tracking-[.08em] text-muted">{f.k}</dt>
              <dd className="m-0 mt-[5px] text-[15px] font-extrabold leading-[1.3] text-ink">{f.v}</dd>
            </div>
          ))}
        </dl>
      )}
      {toy.guide && (
        <div className="flex flex-wrap items-center gap-4 rounded-card border border-line bg-brand-tint px-[22px] py-5 sm:flex-nowrap">
          <span
            aria-hidden="true"
            className="grid h-14 w-14 flex-none place-items-center rounded-[18px] bg-surface text-brand-dark shadow-[var(--shadow-e1)]"
          >
            <BookOpen size={30} weight="duotone" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="m-0 text-lg font-extrabold text-ink">Built from {toy.guide.title}</p>
            <p className="m-0 mt-[3px] text-sm leading-[1.5] text-ink">
              Worth reading even if you take this one — it shows how this toy was adapted, and how to make
              your own.
            </p>
          </div>
          <Link href={`/tutorials/${toy.guide.id}` as Route} className="btn btn-quiet min-h-12 flex-none">
            Open the guide
          </Link>
        </div>
      )}
    </div>
  )
}

const UNLOCKS = [
  { label: 'What is in the box', Icon: Package },
  { label: 'Condition & safety', Icon: ShieldCheck },
  { label: 'Handover', Icon: MapPin },
  { label: 'Ask or swap', Icon: HandHeart },
]

export function ToySignInGate({ toyId }: { toyId: string }) {
  const next = encodeURIComponent(`/toy-library/${toyId}`)
  return (
    <section
      aria-labelledby="toy-gate-h"
      className="flex flex-col items-center gap-4 rounded-card border border-line bg-surface p-8 text-center shadow-[var(--shadow-e2),var(--shadow-hi)]"
    >
      <span
        aria-hidden="true"
        className="grid h-16 w-16 place-items-center rounded-card bg-brand-tint text-brand-dark shadow-[var(--shadow-e2)]"
      >
        <LockSimple size={34} weight="duotone" />
      </span>
      <h2 id="toy-gate-h" className="m-0 font-display text-[30px] font-extrabold leading-[1.12] text-ink">
        Sign in to see the rest of this listing
      </h2>
      <p className="m-0 max-w-[46ch] text-base leading-[1.55] text-muted">
        What is in the box, the condition checks and how handover works involve another family — so we
        ask you to sign in before you see them or ask for the toy.
      </p>
      <ul className="m-0 mt-1 flex list-none flex-wrap justify-center gap-2 p-0">
        {UNLOCKS.map(({ label, Icon }) => (
          <li
            key={label}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-sm font-bold text-ink shadow-[var(--shadow-e1)]"
          >
            <Icon size={18} weight="duotone" aria-hidden="true" className="text-brand-dark" />
            {label}
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap justify-center gap-3">
        <Link href={`/login?next=${next}` as Route} className="btn btn-primary">
          Sign in to unlock
        </Link>
        <Link href={`/signup?next=${next}` as Route} className="btn btn-quiet">
          Create a free account
        </Link>
      </div>
      <p className="m-0 text-[13px] font-semibold text-muted">Free forever. No card, no newsletter.</p>
    </section>
  )
}
