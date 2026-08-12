/**
 * Home/Landing Page
 *
 * Entry point for the web app. Shows:
 * - Hero section with call-to-action
 * - Featured tutorials
 * - How it works
 *
 * Process:
 * 1. Server-side: Fetches approved tutorials from /api/public/tutorials
 * 2. Displays featured tutorials (first 3)
 * 3. No authentication required
 *
 * The hero is the one surface on the site carrying brand colour as fill rather
 * than tint, and the only one that leaves <main>'s max-w-6xl (via .bleed, which
 * is a no-op inside the signed-in rail — see globals.css).
 *
 * The three step headings must keep accessible names ending "Browse", "Buy the
 * parts" and "Adapt & play": tests/e2e/public/home.spec.ts matches them with
 * $-anchored regexes.
 *
 * Related files:
 * - components/home-steps.tsx: the steps, plus the route's one GSAP moment
 * - components/tutorial-card.tsx: Tutorial preview cards
 * - routes/public.ts: API endpoint fetching approved tutorials
 */
import Link from 'next/link'
import { TutorialCard } from '@/components/tutorial-card'
import { HomeSteps } from '@/components/home-steps'
import { Reveal } from '@/components/reveal'
import { fadeIn } from '@/lib/motion'
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
      {/* Hero — brand as fill, not tint, and the site's one full-bleed surface */}
      <div className="bleed bg-brand-deep">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center sm:py-24">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-5xl">
            Every child deserves to play.
          </h1>
          <p className="mx-auto mt-5 max-w-xl leading-relaxed text-brand-soft sm:text-lg">
            Free, step-by-step guides for switch-adapting commercial toys so
            children with disabilities can join in.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Link href="/library" className="btn btn-accent px-8">
              Browse the library →
            </Link>
            <Link
              href="/challenges"
              className="btn px-8 text-white ring-1 ring-inset ring-white/35 hover:bg-white/10"
            >
              See what families need
            </Link>
          </div>
        </div>
      </div>

      {/* Featured tutorials */}
      {featured.length > 0 && (
        <div className="mt-14">
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
      <Reveal variants={fadeIn} className="mt-16">
        <h2 className="mb-6 text-xl font-bold text-ink">How it works</h2>
        <HomeSteps />
      </Reveal>
    </div>
  )
}
