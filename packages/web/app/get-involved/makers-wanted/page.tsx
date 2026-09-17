/**
 * Makers wanted.
 *
 * Two pages in one, and the split is deliberate. Signed out, this is an
 * explainer with four steps and a sign-in — a board of children's first names,
 * ages and suburbs is not something to put behind no account at all, which is
 * also why 064's read policy is granted to `authenticated` and never to `anon`.
 * Signed in, it is the board.
 *
 * Related files:
 * - components/makers-wanted-board.tsx: the board itself
 * - supabase/migrations/064_open_build_requests.sql: the ownerless shape, and
 *   the policy that admits it
 */
import Link from 'next/link'
import { Hammer, Users, Camera, Handshake } from '@phosphor-icons/react/dist/ssr'
import { getCapabilities } from '@/lib/capabilities'
import { apiClient } from '@/lib/api-client'
import { MakersWantedBoard, type OpenBuild } from '@/components/makers-wanted-board'

export const metadata = {
  title: 'Makers wanted — SPLAT Connect',
  description:
    'A family picks a guide they cannot build. A maker nearby builds it; the family covers the parts.',
}

const STEPS = [
  {
    icon: Hammer,
    title: 'A family picks a guide and asks',
    body: 'Published guides only, so the ask is specific.',
  },
  {
    icon: Users,
    title: 'A maker nearby claims it',
    body: 'Open requests within your range, claimed in one tap.',
  },
  {
    icon: Camera,
    title: 'Build, then post a working shot',
    body: 'The family approves the photo before anyone travels.',
  },
  {
    icon: Handshake,
    title: 'Meet and swap codes',
    body: 'Both sides confirm and the build closes.',
  },
]

export default async function MakersWantedPage() {
  const caps = await getCapabilities()

  if (!caps) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="eyebrow text-muted">Get Involved</p>
        <h1 className="mt-1.5 title-hub">Makers wanted</h1>
        <p className="mt-2 max-w-prose text-base leading-relaxed text-muted">
          A family picks a guide they cannot build. A maker nearby builds it; the family covers
          the parts.
        </p>

        <ol className="mt-8 flex flex-col gap-3">
          {STEPS.map((step) => (
            <li key={step.title} className="card flex items-start gap-4 p-4">
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-card bg-brand-tint text-brand-deep"
              >
                <step.icon className="h-5 w-5" />
              </span>
              <span>
                <span className="card-title block">{step.title}</span>
                <span className="block text-sm leading-relaxed text-muted">{step.body}</span>
              </span>
            </li>
          ))}
        </ol>

        <section className="mt-10">
          <h2 className="title-detail">Parts and money</h2>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
            The family covers the parts — most builds are under $35. The maker gives the time,
            never the money. Nothing else changes hands.
          </p>
        </section>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={`/login?next=${encodeURIComponent('/get-involved/makers-wanted')}`}
            className="btn btn-primary"
          >
            Sign in to see requests
          </Link>
          <Link href="/library" className="btn btn-quiet">
            Browse the guides first
          </Link>
        </div>
        <p className="mt-2 text-sm text-muted">Free forever. No card, no newsletter.</p>
      </div>
    )
  }

  const builds = await apiClient
    .get<OpenBuild[]>('/api/toy-transactions/open-builds')
    .catch(() => [] as OpenBuild[])

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="title-hub">Makers wanted</h1>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
            Every request names a published guide, so you know exactly what to make.
          </p>
        </div>
        <Link href="/get-involved/makers-wanted/new" className="btn btn-quiet btn-sm">
          <Hammer className="h-4 w-4" aria-hidden="true" />
          Ask for a build
        </Link>
      </div>

      <div className="mt-6">
        <MakersWantedBoard builds={builds} />
      </div>
    </div>
  )
}
