/**
 * Home/Landing Page
 * 
 * Entry point for the web app. Shows:
 * - Hero section with call-to-action
 * - Featured tutorials
 * - Link to the library
 *
 * Process:
 * 1. Server-side: Fetches approved tutorials from /api/public/tutorials
 * 2. Displays featured tutorials (first 3)
 * 3. No authentication required
 *
 * User flows from home:
 * - Logged-out users: Click "Browse Library" → /library
 * - Logged-out users: The account entry point lives in the nav → /login
 * - Logged-in users: Click featured tutorial → /tutorials/:id
 * 
 * Related files:
 * - components/tutorial-card.tsx: Tutorial preview cards
 * - app/library/page.tsx: Full library browse
 * - routes/public.ts: API endpoint fetching approved tutorials
 */
import Link from 'next/link'
import { TutorialCard } from '@/components/tutorial-card'
import { Search, Cart, Spark } from '@/components/icons'
import type { Tutorial } from '@splat-connect/types'

export default async function HomePage() {
  // WHY: `res.ok ? … : []` handles an HTTP error but not a connection failure —
  //      fetch rejects, nothing catches it, and the page returns a 500. Observed
  //      with the API stopped: "⨯ [TypeError: fetch failed] … GET / 500".
  // HOW: The catch falls back to the same empty list the `: []` branch already
  //      intended, so an unreachable API degrades to an empty featured row.
  let all: Tutorial[] = []
  try {
    const res = await fetch(`${process.env.API_URL}/api/public/tutorials`, { cache: 'no-store' })
    if (res.ok) all = await res.json()
  } catch {
    all = []
  }
  const featured = all.slice(0, 3)

  return (
    <div>
      {/* Hero — the one surface on the site that carries brand colour as fill */}
      <div className="card-tint px-6 py-14 text-center sm:px-12 sm:py-20">
        <h1 className="mx-auto max-w-2xl text-3xl font-bold text-ink sm:text-4xl">
          Every child deserves to play.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-brand-deep sm:text-lg">
          Free, step-by-step guides for switch-adapting commercial toys so
          children with disabilities can join in.
        </p>
        <Link href="/library" className="btn btn-primary mt-8 px-8">
          Browse the library →
        </Link>
      </div>

      {/* Featured tutorials */}
      {featured.length > 0 && (
        <div className="mt-12">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-ink">Recent tutorials</h2>
            <Link
              href="/library"
              className="shrink-0 text-sm font-semibold text-brand-dark hover:underline"
            >
              View all →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {featured.map((t) => (
              <TutorialCard key={t.id} tutorial={t} />
            ))}
          </div>
        </div>
      )}

      {/* How it works — an ordered flow, so the steps are numbered and connected
          rather than dropped into three interchangeable cards. */}
      <div className="mt-16">
        <h2 className="mb-6 text-xl font-bold text-ink">How it works</h2>
        <ol className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { Icon: Search, title: 'Browse', desc: 'Find a tutorial for the toy your child loves.' },
            { Icon: Cart, title: 'Buy the parts', desc: 'Each tutorial lists exactly what you need with links to buy.' },
            { Icon: Spark, title: 'Adapt & play', desc: 'Follow the step-by-step PDF guide to make it work with a switch.' },
          ].map((step, i) => (
            <li key={step.title} className="relative flex gap-4 sm:block">
              {/* Connector between steps — decorative, hidden from the reading order */}
              {i < 2 && (
                <span
                  aria-hidden="true"
                  className="absolute left-6 top-14 hidden h-[calc(100%-2rem)] w-px bg-line sm:left-14 sm:top-6 sm:block sm:h-px sm:w-[calc(100%-2.5rem)]"
                />
              )}
              <span className="relative z-10 grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-tint text-2xl text-brand-dark sm:mb-4">
                <step.Icon />
              </span>
              <div>
                <h3 className="font-bold text-ink">
                  <span className="text-muted">{i + 1}.</span> {step.title}
                </h3>
                <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted">
                  {step.desc}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
