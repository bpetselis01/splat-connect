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
import {
  Books,
  Camera,
  Hammer,
  Handshake,
  Lightbulb,
  BookOpen,
  Plus,
} from '@phosphor-icons/react/dist/ssr'
import { getCapabilities } from '@/lib/capabilities'
import { apiClient } from '@/lib/api-client'
import { MakersWantedBoard, type OpenBuild } from '@/components/makers-wanted-board'
import {
  FlowSteps,
  FreeForever,
  InvolvedIntro,
  SECONDARY_BTN,
  TintNote,
} from '@/components/involved-page'

export const metadata = {
  title: 'Makers wanted — SPLAT Connect',
  description:
    'A family picks a guide they cannot build. A maker nearby builds it; the family covers the parts.',
}

const HOW = [
  'A family picks a guide and asks',
  'You claim it',
  'Build, then post a working shot',
  'Meet and swap codes',
]

const ASIDE_LABEL = 'mb-3 text-xs font-extrabold uppercase tracking-[.08em]'

export default async function MakersWantedPage() {
  const caps = await getCapabilities()

  if (!caps) {
    return (
      <div className="max-w-[860px]">
        <InvolvedIntro
          title="Makers wanted"
          lead="A family picks a guide they cannot build. A maker nearby builds it; the family covers the parts."
        />
        <FlowSteps
          steps={[
            { t: 'A family picks a guide and asks', d: 'Published guides only, so the ask is specific.', icon: Books, tint: 'var(--b100)' },
            { t: 'A maker nearby claims it', d: 'Open requests within your range, claimed in one tap.', icon: Hammer, tint: 'var(--tamber)' },
            { t: 'Build, then post a working shot', d: 'The family approves the photo before anyone travels.', icon: Camera, tint: 'var(--tviolet)' },
            { t: 'Meet and swap codes', d: 'Both sides confirm and the build closes.', icon: Handshake, tint: 'var(--tmint)' },
          ]}
        />
        <TintNote title="Parts and money">
          The family covers the parts — most builds are under $35. The maker gives the time, never
          the money. Nothing else changes hands.
        </TintNote>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link
            href={`/login?next=${encodeURIComponent('/get-involved/makers-wanted')}`}
            className="btn btn-primary px-[26px]"
          >
            Sign in to see requests
          </Link>
          <Link href="/library" className={SECONDARY_BTN}>
            Browse the guides first
          </Link>
        </div>
        <FreeForever />
      </div>
    )
  }

  const builds = await apiClient
    .get<OpenBuild[]>('/api/toy-transactions/open-builds')
    .catch(() => [] as OpenBuild[])

  // "Most asked for": the open requests, grouped by the guide they name.
  const asked = new Map<string, { title: string; n: number }>()
  for (const b of builds) {
    if (!b.tutorial) continue
    const row = asked.get(b.tutorial.id) ?? { title: b.tutorial.title, n: 0 }
    row.n += 1
    asked.set(b.tutorial.id, row)
  }
  const top = [...asked.values()].sort((a, b) => b.n - a.n).slice(0, 3)
  const topTints = ['var(--b100)', 'var(--tviolet)', 'var(--tamber)']

  return (
    <div>
      <span className="text-[13px] font-extrabold uppercase tracking-[.1em] text-brand">
        My SPLAT · Build for a family
      </span>
      <div className="mt-2.5 flex flex-wrap items-end justify-between gap-5">
        <div className="min-w-0">
          <h1 className="font-display text-[clamp(32px,3.6vw,46px)] font-extrabold leading-[1.08] tracking-[-.02em] text-ink">
            Makers wanted
          </h1>
          <p className="mt-3.5 max-w-[52ch] text-lg leading-[1.6] text-muted [text-wrap:pretty]">
            Every request names a published guide, so you know exactly what to make.
          </p>
        </div>
        <Link href="/get-involved/makers-wanted/new" className="btn btn-primary shrink-0 px-6">
          <Plus weight="bold" aria-hidden="true" />
          Ask for a build
        </Link>
      </div>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <MakersWantedBoard builds={builds} />
        </div>

        <aside className="flex min-w-0 flex-col gap-3.5 lg:sticky lg:top-[94px]">
          <div className="card px-[22px] py-5">
            <p className={`${ASIDE_LABEL} text-muted`}>How a build works</p>
            <ol className="m-0 flex list-none flex-col gap-3 p-0">
              {HOW.map((t, i) => (
                <li key={t} className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-[14px] bg-[var(--b100)] font-display text-[13px] font-extrabold text-[var(--b700)]"
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 text-[15px] font-extrabold">{t}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-card border border-line bg-[var(--tamber)] px-[22px] py-5 text-[var(--tink)]">
            <p className={`${ASIDE_LABEL} mb-1.5`}>Parts and money</p>
            <p className="text-sm leading-[1.55]">
              The family covers the parts — usually under $35.{' '}
              <strong>They bring the parts or the money for them.</strong> The maker is never out of
              pocket.
            </p>
          </div>
          {top.length > 0 && (
            <div className="rounded-card border border-line bg-[var(--surface)] px-[22px] py-5">
              <p className={`${ASIDE_LABEL} mb-2.5 text-muted`}>Most asked for</p>
              <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                {top.map((g, i) => (
                  <li key={g.title} className="flex items-center gap-2.5 text-sm">
                    <span
                      aria-hidden="true"
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-[14px]"
                      style={{ background: topTints[i] }}
                    >
                      <BookOpen weight="duotone" className="text-lg text-[var(--tink)]" />
                    </span>
                    <span className="min-w-0 flex-1 truncate font-bold">{g.title}</span>
                    <span className="text-[13px] font-extrabold text-muted">{g.n} open</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex items-start gap-3 rounded-card bg-[var(--b100)] px-[22px] py-[18px] text-[var(--tink)]">
            <Lightbulb weight="duotone" aria-hidden="true" className="shrink-0 text-[26px] text-[var(--b600)]" />
            <p className="text-sm leading-[1.5]">
              No guide for it yet?{' '}
              <Link href="/get-involved/submit-an-idea" className="font-extrabold">
                Submit an idea →
              </Link>
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
