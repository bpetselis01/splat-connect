import Link from 'next/link'
import { TutorialCard } from '@/components/tutorial-card'
import { LauncherGrid, type LauncherTile } from '@/components/launcher-grid'
import { Slot } from '@/components/slot'
import { HubGrid } from '@/components/hub-grid'
import { SwitchAdaptedBear } from '@/components/switch-adapted-bear'
import { PUBLIC_NAV } from '@/lib/public-nav'
import type { Tutorial, ImpactSummary } from '@splat-connect/types'

const EMPTY_TOTALS: ImpactSummary['totals'] = {
  tutorials: 0,
  toysShared: 0,
  toysDelivered: 0,
  contributors: 0,
  organisations: 0,
}

/** Same connection-failure guard as before: an unreachable API degrades to zeros
    and an empty row, never a 500. */
async function getJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${process.env.API_URL}${path}`, { cache: 'no-store' })
    return res.ok ? ((await res.json()) as T) : fallback
  } catch {
    return fallback
  }
}

const HOW_IT_WORKS = [
  {
    title: 'A guide gets written',
    body: 'A contributor adapts a toy and documents every step, with a parts list anyone can buy from.',
  },
  {
    title: 'An organisation stands behind it',
    body: 'A therapy service or school reviews the work and puts their name on it, so a parent knows someone competent read it.',
  },
  {
    title: 'A family builds it — or receives one',
    body: 'Follow the guide with about thirty dollars of parts, or claim a toy someone has already adapted.',
  },
]

// Same three tracks packages/web/app/get-involved/page.tsx selects, matched by
// href rather than position — a nav reorder should not silently swap which
// three tiles the homepage promotes.
const TRACKS = [
  '/get-involved/families',
  '/get-involved/contributors',
  '/get-involved/organisations',
]

export default async function HomePage() {
  const [tutorials, impact] = await Promise.all([
    getJson<Tutorial[]>('/api/public/tutorials', []),
    getJson<ImpactSummary>('/api/public/impact', {
      totals: EMPTY_TOTALS,
      recent: [],
      contributors: [],
      organisations: [],
    }),
  ])

  const featured = tutorials.slice(0, 3)
  const { totals } = impact

  const learn = PUBLIC_NAV.find((s) => s.href === '/learn')!
  const getInvolved = PUBLIC_NAV.find((s) => s.href === '/get-involved')!
  const liveArticles = learn.children.filter((c) => c.state === 'live')

  // Derived from the nav model rather than hand-listed beside it: a section added
  // there used to need remembering here too, and the launcher silently fell behind.
  // Only the short blurbs and the counts are local, because neither belongs in a
  // route registry.
  const BLURB: Record<string, string> = {
    '/library': 'Adaptation guides',
    '/toy-library': 'Toys being given away',
    '/printing': 'Printed parts and mounts',
    '/learn': 'Switches, tools, safety',
    '/get-involved': 'Make, give, or back',
    '/impact': 'Toys delivered',
    '/about': 'Who runs SPLAT',
  }
  const COUNT: Record<string, number | undefined> = {
    '/library': totals.tutorials,
    '/toy-library': totals.toysShared,
    '/learn': liveArticles.length,
    '/impact': totals.toysDelivered,
  }

  const tiles: LauncherTile[] = PUBLIC_NAV.map((s) => ({
    ...s,
    blurb: BLURB[s.href] ?? s.blurb,
    count: COUNT[s.href],
  }))

  const tracks = getInvolved.children.filter((c) => TRACKS.includes(c.href))

  return (
    <div>
      {/*
        The hero, and the whole direction in one screen: no panel, no band, no
        box. The content sits directly on the canvas with the section's soft
        shapes behind it — the same ground the rest of the site stands on, which
        is what stops the homepage reading as a separate landing page bolted onto
        a product.

        Two words of the headline lean. One pixel-art mascot you can press. One
        apricot control with a diagonal ink shadow and a 2px border. That is the
        entire budget, and holding to it is why the same language survives on
        a privacy policy.
      */}
      {/* pt-[60px]/pb-[68px] are the board's. The negative top margin stays and
          now earns its keep: with the band tinted it is what runs the fill up
          flush under the header, instead of leaving a canvas-coloured stripe
          between the two. */}
      <section className="pixel-hero relative isolate -mt-8 pb-[68px] pt-[60px] sm:-mt-10">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_0.85fr] lg:gap-14">
          <div className="rise" style={{ '--rise-delay': '0ms' } as React.CSSProperties}>
            {/* brand-deep, not brand-dark — the board sets the hero eyebrow at
                #0a4f70, and on the newly tinted band the lighter #0f6f9c no
                longer clears 4.5:1. */}
            <p className="eyebrow text-brand-deep">Supporting Play by Adapting Toys</p>

            <h1 className="title-hero mt-3">
              Press it.
              <br />
              <span className="lean">Watch it go.</span>
            </h1>

            <p className="mt-5 max-w-[42ch] text-base leading-relaxed text-muted">
              We turn ordinary toys into ones that answer to a single big switch — so every
              child gets the bit that matters: making something happen.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/library" className="btn btn-accent px-8 text-base">
                Browse the guides
              </Link>
              <Link href="/toy-library" className="btn btn-quiet px-6">
                Or borrow a toy
              </Link>
            </div>

            {/* Stats as chips rather than a dl: bordered boxes that wrap
                without collapsing into a column on a phone.

                White, with the colour carried by a dot rather than by the fill.
                Three tinted chips in a row put three more washes of colour
                directly beneath a hero that already has a tinted photo slot and
                an apricot button in it, and the numbers — the only content here
                — were the palest thing on the row. On white they read first,
                and the dot still says which pillar each belongs to. */}
            <ul className="mt-9 flex flex-wrap gap-3">
              {[
                { label: 'guides', value: totals.tutorials, dot: 'bg-brand' },
                { label: 'toys delivered', value: totals.toysDelivered, dot: 'bg-mint' },
                { label: 'contributors', value: totals.contributors, dot: 'bg-apricot' },
              ].map((stat) => (
                <li
                  key={stat.label}
                  className="stat-pixel flex items-center gap-2.5 bg-surface px-4 py-2.5 text-ink"
                >
                  <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ${stat.dot}`} />
                  <span className="flex flex-col gap-0.5">
                    <span className="numeral text-[22px]">{stat.value}</span>
                    <span className="meta opacity-70">{stat.label}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/*
            The mascot, which is the whole hero's argument made playable: hold
            the switch, the bear waves and its badge lights up.

            This replaces three placeholders at once — the round photo slot, the
            animation slot briefed as "switch press → toy lights up", and the
            spark sticker whose only job was breaking the photo disc's edge. All
            three were reserving space for this, and a placeholder next to the
            finished thing it was holding space for is just clutter.
          */}
          <div
            className="rise mx-auto w-full max-w-sm"
            style={{ '--rise-delay': '120ms' } as React.CSSProperties}
          >
            <SwitchAdaptedBear />
          </div>
        </div>
      </section>

      {/* Launcher — the whole site, above the fold. */}
      <div className="mt-12">
        <h2 className="eyebrow mb-4 text-muted">Jump straight in</h2>
        <LauncherGrid tiles={tiles} />
      </div>

      {/* An ordered flow, so the steps are numbered and connected rather than
          dropped into three interchangeable cards. */}
      <div className="rise relative mt-16" style={{ '--rise-delay': '0ms' } as React.CSSProperties}>
        <h2 className="title-article">SPLAT in 30 seconds</h2>

        {/* The three steps are joined by a dashed rule, which is the most
            literal possible drawing of "and then" — and dashed rather than
            solid because a solid line between three boxes reads as a table
            border. A hand-drawn path over the top is the version of this that
            belongs on a site about play, and it has to sit above the row rather
            than inside any one step — so it is marked here, over the whole
            band. */}
        <Slot
          kind="overlay"
          note="Hand-drawn dotted path arcing between the three steps, with a small arrow at each join"
          className="mt-4 w-full sm:absolute sm:right-0 sm:top-0 sm:mt-0 sm:w-56"
        />

        <ol className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {HOW_IT_WORKS.map((step, i) => (
            <li key={step.title} className="relative flex gap-4 sm:block">
              {i < HOW_IT_WORKS.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute left-5 top-14 hidden h-[calc(100%-2rem)] border-l-2 border-dashed border-brand-soft sm:left-14 sm:top-5 sm:block sm:h-0 sm:w-[calc(100%-2.5rem)] sm:border-l-0 sm:border-t-2"
                />
              )}
              <span className="step-pixel relative z-10 grid h-11 w-11 shrink-0 place-items-center text-xl leading-none sm:mb-4">
                {i + 1}
              </span>
              <div>
                <h3 className="font-bold text-ink">{step.title}</h3>
                <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="rise mt-16" style={{ '--rise-delay': '60ms' } as React.CSSProperties}>
        <h2 className="title-article">Where you fit</h2>
        <p className="mb-4 mt-1 max-w-prose text-sm text-muted">
          Each of these walks the whole path, start to finish.
        </p>
        <HubGrid items={tracks} tone={getInvolved.tone} />
      </div>

      <div className="rise mt-16 grid grid-cols-1 gap-10 lg:grid-cols-2" style={{ '--rise-delay': '120ms' } as React.CSSProperties}>
        <div>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="title-article">Recent guides</h2>
            <Link
              href="/library"
              className="shrink-0 text-sm font-semibold text-brand-dark hover:underline"
            >
              View all →
            </Link>
          </div>
          {featured.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {featured.map((t) => (
                <TutorialCard key={t.id} tutorial={t} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">No guides published yet.</p>
          )}
        </div>

        <div>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="title-article">Learn the basics</h2>
            <Link
              href="/learn"
              className="shrink-0 text-sm font-semibold text-brand-dark hover:underline"
            >
              View all →
            </Link>
          </div>
          <HubGrid items={liveArticles.slice(0, 3)} tone={learn.tone} />
        </div>
      </div>
    </div>
  )
}
