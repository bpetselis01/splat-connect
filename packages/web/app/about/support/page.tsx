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
  Gift,
  Buildings,
  Lightbulb,
  Check,
  Info,
  ArrowRight,
} from '@phosphor-icons/react/dist/ssr'
import { ORG_FACTS } from '@/lib/org-facts'

export const metadata = {
  title: 'Support SPLAT — SPLAT Connect',
  description:
    'Ways to help a free, volunteer-run platform — most of which are not money.',
}

const WAYS: Array<{ icon: typeof Wrench; title: string; body: string; cta: string; href: Route }> = [
  {
    icon: Wrench,
    title: 'Give your skills',
    body:
      'Write a guide, review guides as an OT or engineer, or print a part for a family who has no printer.',
    cta: 'For contributors',
    href: '/get-involved/contributors',
  },
  {
    icon: Gift,
    title: 'Give toys and parts',
    body:
      'Battery toys, switches, 3.5 mm jacks, filament. SPLAT does not hold stock, so they go to a partner organisation near you.',
    cta: 'Find one near you',
    href: '/organizations',
  },
  {
    icon: Buildings,
    title: 'Register your organisation',
    body:
      'Therapy centres, schools and community groups run build days and hand toys to families. That is where the impact happens.',
    cta: 'For organisations',
    href: '/get-involved/organisations',
  },
  {
    icon: Lightbulb,
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
      <p className="eyebrow text-muted">About</p>
      <h1 className="mt-1.5 title-hub">Support SPLAT</h1>
      <p className="mt-2 max-w-prose text-base leading-relaxed text-muted">
        Ready-made adapted toys are scarce and cost several times the toy inside them. SPLAT
        closes that gap with free, reviewed instructions. The most useful thing you can give is
        usually not money.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {WAYS.map((w) => (
          <Link key={w.title} href={w.href} className="card card-link flex flex-col gap-2 p-5">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 items-center justify-center rounded-card bg-brand-tint text-brand-deep"
            >
              <w.icon className="h-5 w-5" />
            </span>
            <span className="font-display text-lg font-extrabold text-ink">{w.title}</span>
            <span className="flex-1 text-sm leading-relaxed text-muted">{w.body}</span>
            <span className="inline-flex items-center gap-1 text-sm font-bold text-brand-dark">
              {w.cta}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </span>
          </Link>
        ))}
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="title-detail">Host a workplace build day</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            A team of eight adapts about twenty toys in an afternoon. A partner organisation
            brings the guides, parts and a leader who has done it before. You bring the people, a
            room with tables and power points, and the toys.
          </p>
          <ul className="mt-4 flex list-none flex-col gap-2">
            {BUILD_DAY.map((line) => (
              <li key={line} className="flex items-start gap-2 text-sm text-ink">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                {line}
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/get-involved/events" className="btn btn-quiet btn-sm">
              See how build days run
            </Link>
            <Link href="/contact" className="btn btn-quiet btn-sm">
              Ask about hosting
            </Link>
          </div>
        </section>

        <section className="card p-6">
          <span className="badge bg-honey-soft text-ink">
            <Info className="h-3.5 w-3.5" aria-hidden="true" />
            Not tax deductible yet
          </span>
          <h2 className="title-detail mt-2">Funding SPLAT</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            SPLAT is not yet a registered charity with deductible gift recipient status, so we do
            not take public donations. If you are a foundation, council or business that wants to
            fund a specific piece of work, talk to us: grants can be received through a partner
            organisation that is.
          </p>
          <ul className="mt-4 flex list-none flex-col gap-2">
            {FUNDING.map((line) => (
              <li key={line} className="flex items-start gap-2 text-sm text-ink">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-dark" aria-hidden="true" />
                {line}
              </li>
            ))}
          </ul>
          <p className="mt-5">
            <a href={`mailto:${ORG_FACTS.contactEmail}`} className="btn btn-primary btn-sm">
              Talk to us about funding
            </a>
          </p>
        </section>
      </div>

      <p className="mt-8 max-w-prose text-base leading-relaxed text-ink">
        Cheapest of all: send a guide to a therapist or teacher who has never heard of switch
        toys. Most families find SPLAT because someone did exactly that.
      </p>
    </div>
  )
}
