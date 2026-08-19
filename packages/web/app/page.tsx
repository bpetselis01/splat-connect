import Link from 'next/link'
import { TutorialCard } from '@/components/tutorial-card'
import { LauncherGrid, type LauncherTile } from '@/components/launcher-grid'
import { EditorialImage } from '@/components/editorial-image'
import { HubGrid } from '@/components/hub-grid'
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

  const tiles: LauncherTile[] = [
    { href: '/library', label: 'Guides', blurb: 'Adaptation guides', count: totals.tutorials },
    { href: '/toy-library', label: 'Toy Library', blurb: 'Toys being given away', count: totals.toysShared },
    { href: '/learn', label: 'Learn', blurb: 'Switches, tools, safety', count: liveArticles.length },
    { href: '/get-involved', label: 'Get Involved', blurb: 'Make, give, or back' },
    { href: '/impact', label: 'Impact', blurb: 'Toys delivered', count: totals.toysDelivered },
    { href: '/about', label: 'About', blurb: 'Who runs SPLAT' },
  ]

  const tracks = getInvolved.children.filter((c) => TRACKS.includes(c.href))

  return (
    <div>
      {/* Hero — the one surface on the site that carries brand colour as fill.
          Stats sit inside it so the proof arrives with the promise rather than in
          a band underneath. */}
      <div className="card-tint px-6 py-12 sm:px-12 sm:py-14">
        <div className="mx-auto grid max-w-4xl items-center gap-8 sm:grid-cols-2">
          <div>
            <h1 className="text-3xl font-bold text-ink sm:text-4xl">
              Every child deserves to play.
            </h1>
            <p className="mt-4 max-w-prose text-base leading-relaxed text-brand-deep sm:text-lg">
              A thirty-dollar switch turns a toy a child can&apos;t use into one they can.
              We publish the guides, and connect the people who build them.
            </p>
            <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
              {[
                { label: 'Guides', value: totals.tutorials },
                { label: 'Toys delivered', value: totals.toysDelivered },
                { label: 'Contributors', value: totals.contributors },
              ].map((stat) => (
                <div key={stat.label}>
                  <dd className="text-2xl font-bold leading-none text-brand-deep">{stat.value}</dd>
                  <dt className="mt-1 text-xs font-semibold uppercase tracking-wide text-muted">
                    {stat.label}
                  </dt>
                </div>
              ))}
            </dl>
            <Link href="/library" className="btn btn-primary mt-7 px-8">
              Browse the Guides →
            </Link>
          </div>
          <EditorialImage illustration="adapted-toy" ratio="3/2" />
        </div>
      </div>

      {/* Launcher — the whole site, above the fold. */}
      <div className="mt-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Jump straight in
        </h2>
        <LauncherGrid tiles={tiles} />
      </div>

      {/* An ordered flow, so the steps are numbered and connected rather than
          dropped into three interchangeable cards. */}
      <div className="mt-16">
        <h2 className="text-xl font-bold text-ink">SPLAT in 30 seconds</h2>
        <ol className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {HOW_IT_WORKS.map((step, i) => (
            <li key={step.title} className="relative flex gap-4 sm:block">
              {i < HOW_IT_WORKS.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute left-6 top-14 hidden h-[calc(100%-2rem)] w-px bg-line sm:left-14 sm:top-6 sm:block sm:h-px sm:w-[calc(100%-2.5rem)]"
                />
              )}
              <span className="relative z-10 grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-tint text-lg font-bold text-brand-deep sm:mb-4">
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

      <div className="mt-16">
        <h2 className="text-xl font-bold text-ink">Where you fit</h2>
        <p className="mb-4 mt-1 max-w-prose text-sm text-muted">
          Each of these walks the whole path, start to finish.
        </p>
        <HubGrid items={tracks} />
      </div>

      <div className="mt-16 grid grid-cols-1 gap-10 lg:grid-cols-2">
        <div>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-ink">Recent guides</h2>
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
            <h2 className="text-xl font-bold text-ink">Learn the basics</h2>
            <Link
              href="/learn"
              className="shrink-0 text-sm font-semibold text-brand-dark hover:underline"
            >
              View all →
            </Link>
          </div>
          <HubGrid items={liveArticles.slice(0, 3)} />
        </div>
      </div>
    </div>
  )
}
