/**
 * Support SPLAT.
 *
 * The lead is the whole page: "the most useful thing you can give is usually
 * not money." That is true and it is also the honest position of a project with
 * no deductible gift recipient status — a donate button would be both the wrong
 * ask and one SPLAT cannot legally make. So the four doors come first, and the
 * funding section says plainly what it cannot accept and what it can.
 *
 * Was a ComingSoon with a notify form, which was the wrong shape entirely:
 * there is nothing here to wait for.
 */
import Link from 'next/link'
import type { Route } from 'next'
import {
  Wrench,
  Package,
  Buildings,
  Lightbulb,
  Check,
  Info,
  ArrowRight,
  Coin,
} from '@phosphor-icons/react/dist/ssr'

export const metadata = {
  title: 'Support SPLAT — SPLAT Connect',
  description:
    'Ways to help a free, volunteer-run platform — most of which are not money.',
}

const WAYS: Array<{
  icon: typeof Wrench
  tint: string
  title: string
  body: string
  cta: string
  href: Route
}> = [
  {
    icon: Wrench,
    tint: 'var(--b100)',
    title: 'Give your skills',
    body:
      'Write a guide, review guides as an OT or engineer, or print a part for a family who has no printer.',
    cta: 'For contributors',
    href: '/get-involved/contributors',
  },
  {
    icon: Package,
    tint: 'var(--tmint)',
    title: 'Give toys and parts',
    body:
      'Battery toys, switches, 3.5 mm jacks, filament. SPLAT does not hold stock, so they go to a partner organisation near you.',
    cta: 'Find one near you',
    href: '/organizations',
  },
  {
    icon: Buildings,
    tint: 'var(--tviolet)',
    title: 'Register your organisation',
    body:
      'Therapy centres, schools and community groups run build days and hand toys to families. That is where the impact happens.',
    cta: 'For organisations',
    href: '/get-involved/organisations',
  },
  {
    icon: Lightbulb,
    tint: 'var(--tcoral)',
    title: 'Send in an idea',
    body: 'A toy you wish existed in adapted form, or a fix for one that keeps breaking.',
    cta: 'Submit an idea',
    href: '/get-involved/submit-an-idea',
  },
]

const BUILD_DAY = [
  'Two to four hours, six to sixteen people, no electronics experience needed',
  'Every toy adapted goes to a family on a partner waitlist the same month',
  'Your team is named on the event page and in the delivery record',
  'The partner organisation handles safety briefings and sign-off',
]

const FUNDING = [
  'Hosting and the guide review programme',
  'Printed guide packs for build days',
  'Travel to train new organisation leaders',
]

export default function SupportPage() {
  return (
    <div>
      <p className="text-[13px] font-extrabold uppercase tracking-[0.1em] text-muted">About</p>
      <h1 className="mt-2.5 font-display text-[clamp(32px,3.6vw,46px)] font-extrabold leading-[1.08] tracking-[-0.02em] text-ink">
        Support SPLAT
      </h1>
      <p className="mt-3 max-w-[60ch] text-lg leading-[1.6] text-muted [text-wrap:pretty]">
        Ready-made adapted toys are scarce and cost several times the toy inside them. SPLAT
        closes that gap with free, reviewed instructions. The most useful thing you can give is
        usually not money.
      </p>

      <div className="mt-9 grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
        {WAYS.map((w) => (
          <Link
            key={w.title}
            href={w.href}
            className="card card-link flex flex-col gap-3 p-6 text-[var(--tink)]"
            style={{ background: w.tint }}
          >
            <w.icon size={34} weight="duotone" aria-hidden="true" />
            <span className="font-display text-[21px] font-extrabold">{w.title}</span>
            <span className="text-sm leading-[1.55] opacity-90">{w.body}</span>
            <span className="mt-auto inline-flex items-center gap-1 text-sm font-extrabold">
              {w.cta}
              <ArrowRight size={14} weight="bold" aria-hidden="true" />
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-11 grid items-start gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <section className="card px-[34px] py-[30px]">
          <h2 className="mb-2 font-display text-[26px] font-extrabold text-ink">
            Host a workplace build day
          </h2>
          <p className="mb-4 text-[15px] leading-[1.6] text-muted">
            A team of eight adapts about twenty toys in an afternoon. A partner organisation
            brings the guides, parts and a leader who has done it before. You bring the people, a
            room with tables and power points, and the toys.
          </p>
          <ul className="mb-5 grid list-none gap-2">
            {BUILD_DAY.map((line) => (
              <li key={line} className="flex items-start gap-2.5 text-[15px] leading-[1.5] text-ink">
                <Check size={16} weight="bold" className="mt-[3px] shrink-0 text-success" aria-hidden="true" />
                {line}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2.5">
            <Link href="/get-involved/events" className="btn btn-primary">
              See how build days run
            </Link>
            <Link href="/contact" className="btn btn-quiet">
              Ask about hosting
            </Link>
          </div>
        </section>

        <section className="rounded-card border border-line bg-[var(--tamber)] px-[34px] py-[30px] text-[var(--tink)]">
          <span className="inline-flex items-center gap-2 rounded-pill bg-surface px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em]">
            <Info size={14} weight="bold" aria-hidden="true" />
            Not tax deductible yet
          </span>
          <h2 className="mb-2 mt-3.5 font-display text-2xl font-extrabold">Funding SPLAT</h2>
          <p className="mb-4 text-[15px] leading-[1.6]">
            SPLAT is not yet a registered charity with deductible gift recipient status, so we do
            not take public donations. If you are a foundation, council or business that wants to
            fund a specific piece of work, talk to us: grants can be received through a partner
            organisation that is.
          </p>
          <ul className="mb-5 grid list-none gap-2">
            {FUNDING.map((line) => (
              <li key={line} className="flex items-start gap-2.5 text-[15px] leading-[1.5]">
                <Coin size={16} weight="fill" className="mt-[3px] shrink-0" aria-hidden="true" />
                {line}
              </li>
            ))}
          </ul>
          <Link
            href="/contact"
            className="inline-flex min-h-12 items-center rounded-pill bg-ink px-5 text-[15px] font-extrabold text-surface"
          >
            Talk to us about funding
          </Link>
        </section>
      </div>

      <p className="mt-9 max-w-[64ch] text-[15px] leading-[1.6] text-muted">
        Cheapest of all: send a guide to a therapist or teacher who has never heard of switch
        toys. Most families find SPLAT because someone did exactly that.
      </p>
    </div>
  )
}
