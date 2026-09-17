/**
 * The homepage, rebuilt against the Soft Pop artboard (#home) rather than
 * patched towards it.
 *
 * Five bands, in the board's order:
 *   1. hero          — badge, "Press it. Watch it go.", two doors, three stats, Splat
 *   2. scroll-world  — the five-scene flight (components/scroll-world.tsx)
 *   3. three doors   — a guide / a ready-made toy / I make things
 *   4. costs         — "No price tags", and the filament-credit block beside it
 *   5. recent        — guides and toys, real rows from the API
 *
 * Numbers are live where the board shows numbers: the stat tiles and the two
 * door counts read from /api/public/impact and /api/public/tutorials, so the
 * page never claims 142 guides when there are 7.
 *
 * Related files:
 * - components/scroll-world.tsx: band 2
 * - components/splat-mascot.tsx: the bear, lifted from the board
 * - globals.css: .hero-*, .sw-*, .door-* live there
 */
import Link from 'next/link'
import type { Route } from 'next'
import {
  ArrowRight,
  BookOpen,
  Gift,
  Users,
  MagnifyingGlass,
  Wrench,
  Receipt,
  SealCheck,
  Recycle,
} from '@phosphor-icons/react/dist/ssr'
import { TutorialCard } from '@/components/tutorial-card'
import { ToyLibraryCard } from '@/components/toy-library-card'
import { ScrollWorld } from '@/components/scroll-world'
import { SplatMascot } from '@/components/splat-mascot'
import { StatChips } from '@/components/stat-chips'
import type { Tutorial, ImpactSummary, ToyWithOwner } from '@splat-connect/types'

const EMPTY_TOTALS: ImpactSummary['totals'] = {
  tutorials: 0,
  toysShared: 0,
  toysDelivered: 0,
  contributors: 0,
  organisations: 0,
}

/** An unreachable API degrades to zeros and an empty row, never a 500. */
async function getJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${process.env.API_URL}${path}`, { cache: 'no-store' })
    return res.ok ? ((await res.json()) as T) : fallback
  } catch {
    return fallback
  }
}

export default async function HomePage() {
  const [tutorials, toys, impact] = await Promise.all([
    getJson<Tutorial[]>('/api/public/tutorials', []),
    getJson<ToyWithOwner[]>('/api/public/toys', []),
    getJson<ImpactSummary>('/api/public/impact', {
      totals: EMPTY_TOTALS,
      recent: [],
      contributors: [],
      organisations: [],
    }),
  ])
  const { totals } = impact

  const stats = [
    { icon: BookOpen, value: totals.tutorials, label: 'guides', tint: 'var(--color-brand-soft)' },
    { icon: Gift, value: totals.toysDelivered, label: 'toys delivered', tint: 'var(--color-mint-soft)' },
    { icon: Users, value: totals.contributors, label: 'contributors', tint: 'var(--color-apricot-soft)' },
  ]

  const doors = [
    {
      icon: MagnifyingGlass,
      title: 'I’m looking for a guide',
      body: 'Filter by what your child can do, not by what they can’t. Every guide is free to read; the parts list and its costs are inside.',
      cta: `Browse ${tutorials.length} guide${tutorials.length === 1 ? '' : 's'}`,
      href: '/library' as Route,
      tint: 'var(--color-brand-soft)',
    },
    {
      icon: Gift,
      title: 'I’d like a ready-made toy',
      body: 'Families and organisations give away toys they’ve already adapted. Request one near you.',
      cta: `See ${toys.length} toy${toys.length === 1 ? '' : 's'} available`,
      href: '/toy-library' as Route,
      tint: 'var(--color-apricot-soft)',
    },
    {
      icon: Wrench,
      title: 'I make things',
      body: 'Write a guide, print a part, or back a build as an organisation.',
      cta: 'Get involved',
      href: '/get-involved' as Route,
      tint: 'var(--color-violet-soft)',
      // The board ranks these three: two white cards at full width, then a
      // quieter sunken one, narrower and without the lift. "I make things" is
      // the smallest audience of the three and the board says so in the shape.
      quiet: true,
    },
  ]

  return (
    <>
      <section className="hero">
        <div className="hero__copy">
          <p className="hero__badge">
            <SealCheck weight="fill" className="h-4 w-4 text-success" aria-hidden="true" />
            Free to read, reviewed guides for switch-adapted play
          </p>
          <h1 className="hero__title">
            Press it.
            <br />
            Watch it <span className="hero__accent">go.</span>
          </h1>
          <p className="hero__lede">
            We help families turn ordinary toys into ones that answer to one big switch — so
            every child gets the part that matters: making something happen.
          </p>
          <div className="hero__actions">
            <Link href="/library" className="btn btn-primary btn-hero no-underline">
              <BookOpen weight="bold" className="h-5 w-5" aria-hidden="true" />
              Find a guide
            </Link>
            <Link href="/toy-library" className="btn btn-quiet btn-hero no-underline">
              <Gift weight="bold" className="h-5 w-5" aria-hidden="true" />
              Borrow a toy
            </Link>
          </div>
          <StatChips
            stats={stats.map(({ icon: Icon, value, label, tint }) => ({
              label,
              value: value.toLocaleString(),
              icon: <Icon weight="duotone" className="h-5 w-5" />,
              tint,
            }))}
          />
        </div>

        <div className="hero__mascot">
          <p className="hero__bubble">Hi! I’m Splat. Let’s find a toy that works for your child.</p>
          <SplatMascot />
        </div>
      </section>

      <ScrollWorld />

      <section className="band" aria-label="Where to start">
        <ul className="door-grid">
          {doors.map(({ icon: Icon, title, body, cta, href, tint, quiet }) => (
            <li key={title} className={quiet ? 'door-cell--quiet' : undefined}>
              <Link href={href} className={`door no-underline${quiet ? ' door--quiet' : ''}`}>
                <span aria-hidden="true" className="door__icon" style={{ backgroundColor: tint }}>
                  <Icon weight="duotone" className="h-6 w-6" />
                </span>
                <span className="door__title">{title}</span>
                <span className="door__body">{body}</span>
                <span className="door__cta">
                  {cta}
                  <ArrowRight weight="bold" className="h-4 w-4" aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="band band--split" aria-label="What things cost">
        <div className="cost-card">
          <span aria-hidden="true" className="door__icon" style={{ backgroundColor: 'var(--color-honey-soft)' }}>
            <Receipt weight="duotone" className="h-6 w-6" />
          </span>
          <h2 className="door__title">No price tags. Every cost written down.</h2>
          <p className="band__body">
            Nobody on SPLAT charges for their time, and SPLAT never touches your money. What
            people do spend — filament, a switch jack, a satchel, a parts kit — is itemised by
            the person who spent it, with a reason in their own words, and you see the figure
            before you agree to anything.
          </p>
          {/* Arrow leads on the board here — the button reads as "go this way"
              rather than as a label with a decoration after it. */}
          <Link href="/printing/basics" className="cost-cta cost-cta--light no-underline">
            <ArrowRight weight="bold" className="h-4 w-4" aria-hidden="true" />
            See how printing costs work
          </Link>
        </div>
        <div className="cost-card cost-card--mint">
          <span aria-hidden="true" className="door__icon" style={{ backgroundColor: 'var(--color-surface)' }}>
            <Recycle weight="duotone" className="h-6 w-6" />
          </span>
          <h3 className="door__title">Bring your failed prints. Leave with credit.</h3>
          <p className="band__body">
            Some organisations here run a shredder and an extruder. Two kilos of clean, sorted
            plastic becomes filament on their machines — and grams of print credit for you,
            weighed and issued at the door.
          </p>
          <Link href="/get-involved/recycling" className="cost-cta cost-cta--ink no-underline">
            <Recycle weight="bold" className="h-4 w-4" aria-hidden="true" />
            See who takes plastic
          </Link>
        </div>
      </section>

      {/* Side by side, two cards each — the board does not give either list the
          full width, and stacking them made the page end on two long rows of
          four. */}
      <section className="band band--split" aria-label="Recently added">
        <div className="recent">
          <div className="band__head">
            <h2 className="door__title">Recent guides</h2>
            <Link href="/library" className="door__cta no-underline">
              View all
              <ArrowRight weight="bold" className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <ul className="recent__row">
            {tutorials.slice(0, 2).map((t) => (
              <li key={t.id}>
                <TutorialCard tutorial={t} />
              </li>
            ))}
          </ul>
        </div>
        <div className="recent">
          <div className="band__head">
            <h2 className="door__title">Recent toys</h2>
            <Link href="/toy-library" className="door__cta no-underline">
              View all
              <ArrowRight weight="bold" className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <ul className="recent__row">
            {toys.slice(0, 2).map((toy) => (
              <li key={toy.id}>
                <ToyLibraryCard toy={toy} />
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  )
}
