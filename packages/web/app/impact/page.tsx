import Link from 'next/link'
import type { Route } from 'next'
import {
  ArrowRight,
  BookOpen,
  Buildings,
  Gift,
  Handshake,
  MapTrifold,
  Newspaper,
  UsersThree,
} from '@phosphor-icons/react/dist/ssr'
import { SplatMascot } from '@/components/splat-mascot'
import { ImpactCard } from '@/components/impact-card'
import { StoryKindPill, StoryPhoto } from '@/components/story-bits'
import { apiClient } from '@/lib/api-client'
import { shortDate } from '@/lib/dates'
import type { Difficulty, ImpactSummary, StoryListItem, Tutorial } from '@splat-connect/types'

// Same shape the empty grid/strip below already render for zero rows, so a
// fetch failure just looks like "nothing yet" rather than a separate error UI.
const EMPTY_IMPACT: ImpactSummary = {
  totals: { tutorials: 0, toysShared: 0, toysDelivered: 0, contributors: 0, organisations: 0 },
  recent: [],
  contributors: [],
  organisations: [],
  deliveriesByMonth: [],
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const DIFFICULTY: Array<{ key: Difficulty; label: string; colour: string }> = [
  { key: 'easy', label: 'Easy — interrupter only', colour: 'var(--ok)' },
  { key: 'medium', label: 'Medium — some soldering', colour: 'var(--amber)' },
  { key: 'hard', label: 'Hard — opening the case', colour: 'var(--coral)' },
]

const MORE: Array<{ label: string; blurb: string; icon: typeof Buildings; href: Route; soon?: boolean }> = [
  {
    label: 'Organisations',
    blurb: 'The therapy centres, schools and services standing behind the work.',
    icon: Buildings,
    href: '/organizations',
  },
  {
    label: 'Deliveries map',
    blurb: 'Where adapted toys have actually landed.',
    icon: MapTrifold,
    href: '/impact/map',
    soon: true,
  },
  {
    label: 'All stories',
    blurb: 'Family, maker and organisation stories, filterable by type.',
    icon: Newspaper,
    href: '/about/stories',
  },
]

export default async function ImpactPage() {
  let impact: ImpactSummary = EMPTY_IMPACT
  try {
    const res = await fetch(`${process.env.API_URL}/api/public/impact`, { cache: 'no-store' })
    if (res.ok) impact = await res.json()
  } catch {
    impact = EMPTY_IMPACT
  }
  // Two more reads for the two board panels the impact summary does not carry:
  // guides by difficulty, counted off the public list, and the featured story.
  const [guides, stories] = await Promise.all([
    apiClient.get<Tutorial[]>('/api/public/tutorials').catch(() => [] as Tutorial[]),
    apiClient.get<StoryListItem[]>('/api/public/stories').catch(() => [] as StoryListItem[]),
  ])
  const story = stories.find((s) => s.featured) ?? stories[0] ?? null
  const byDifficulty = DIFFICULTY.map((d) => ({
    ...d,
    n: guides.filter((g) => g.difficulty === d.key).length,
  }))
  const maxDifficulty = Math.max(1, ...byDifficulty.map((d) => d.n))

  const { totals, contributors, organisations, deliveriesByMonth } = impact
  const maxDelivered = Math.max(1, ...deliveriesByMonth.map((m) => m.n))
  /*
   * The board's four, big and tinted: the numbers are the whole point of the
   * screen. §5's "never a 4-tile stat grid" is about detail and record
   * screens, where a grid of counts pushes the record itself down the page;
   * here the counts ARE the record.
   */
  const stats = [
    { id: 'guides', label: 'guides published', count: totals.tutorials, icon: BookOpen, tint: 'var(--b100)' },
    { id: 'toys-delivered', label: 'toys delivered', count: totals.toysDelivered, icon: Gift, tint: 'var(--tcoral)' },
    { id: 'contributors', label: 'contributors', count: totals.contributors, icon: UsersThree, tint: 'var(--tmint)' },
    { id: 'organisations', label: 'organisations backing', count: totals.organisations, icon: Buildings, tint: 'var(--tviolet)' },
  ]

  return (
    <div>
      <div className="mb-7 grid grid-cols-1 items-center gap-6 sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="min-w-0">
          <span className="text-[13px] font-extrabold uppercase tracking-[0.1em] text-muted">Impact</span>
          <h1 className="mb-2 mt-1 font-display text-[clamp(32px,3.6vw,44px)] font-extrabold leading-[1.1] text-ink">
            What this community has made, given and delivered
          </h1>
          <p className="m-0 max-w-[60ch] text-[17px] text-muted">
            Every number here is a real toy, guide or person.
          </p>
        </div>
        <div className="hidden justify-self-end sm:block">
          <SplatMascot width={120} />
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.id}
            data-testid={`impact-stat-${s.id}`}
            className="flex flex-col gap-1.5 rounded-card p-[22px] text-[var(--tink)] shadow-[var(--shadow-e2),var(--shadow-hi)]"
            style={{ background: s.tint }}
          >
            <s.icon size={30} weight="duotone" aria-hidden="true" />
            <p className="mt-1.5 font-display text-[44px] font-extrabold leading-none tabular-nums">
              {s.count}
            </p>
            <p className="text-[15px] font-bold">{s.label}</p>
          </div>
        ))}
      </div>

      {deliveriesByMonth.length > 0 && (
        <>
          <h2 className="mb-1.5 mt-10 font-display text-[26px] font-extrabold text-ink">
            Toys delivered over time
          </h2>
          <p className="mb-[18px] text-sm text-muted">Completed handoffs per month, all sources.</p>
          <div className="card px-7 py-[26px]">
            <div
              role="img"
              aria-label={`Bar chart of toys delivered per month, ${deliveriesByMonth
                .map((m) => `${MONTHS[Number(m.month.slice(5)) - 1]} ${m.n}`)
                .join(', ')}`}
              className="flex h-[220px] items-end gap-3.5"
            >
              {deliveriesByMonth.map((m) => (
                <div
                  key={m.month}
                  className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                >
                  <span className="font-display text-sm font-extrabold tabular-nums">{m.n}</span>
                  <span
                    className="w-full rounded-[14px_12px_4px_4px] shadow-[var(--shadow-hi)]"
                    style={{
                      height: `${(m.n / maxDelivered) * 100}%`,
                      background: 'linear-gradient(180deg,var(--brand),var(--b600))',
                    }}
                  />
                  <span className="font-mono text-[11px] text-muted">
                    {MONTHS[Number(m.month.slice(5)) - 1]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* The board's per-state delivery chart has no data behind it yet — the
          impact summary carries no place for a completed handoff. */}
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="card px-7 py-[26px]">
          <h3 className="mb-4 font-display text-xl font-extrabold text-ink">Guides by difficulty</h3>
          {byDifficulty.map((d) => (
            <div key={d.key} className="mb-3.5">
              <div className="mb-1.5 flex justify-between text-sm font-bold text-ink">
                <span>{d.label}</span>
                <span className="tabular-nums text-muted">{d.n}</span>
              </div>
              <div className="h-3 overflow-hidden rounded-pill bg-sunken">
                <div
                  className="h-full rounded-pill"
                  style={{ width: `${(d.n / maxDifficulty) * 100}%`, background: d.colour }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <h2 className="mb-[18px] mt-11 font-display text-[26px] font-extrabold text-ink">
        Contributors and organisations
      </h2>
      {contributors.length === 0 && organisations.length === 0 ? (
        <div className="flex flex-col items-center px-6 py-12 text-center">
          <span aria-hidden="true" className="empty-badge text-brand-deep">
            <Handshake className="h-8 w-8" />
          </span>
          <p className="mt-4 font-bold text-ink">No contributors yet.</p>
          <p className="mt-1 max-w-xs text-sm leading-relaxed text-muted">
            Check back soon — this page tracks guides, toys, and deliveries across the
            community.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {contributors.map((c, i) => (
            <ImpactCard key={`person-${c.id}`} kind="person" entity={c} index={i} />
          ))}
          {organisations.map((o, i) => (
            <ImpactCard key={`org-${o.id}`} kind="org" entity={o} index={i + 1} />
          ))}
        </div>
      )}

      <h2 className="mb-1.5 mt-11 font-display text-[26px] font-extrabold text-ink">
        The story behind the numbers
      </h2>
      <p className="mb-[18px] text-sm text-muted">What families and makers actually did with SPLAT.</p>
      <div
        className={`grid items-start gap-5 ${story ? 'lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]' : ''}`}
      >
        {story && (
          <Link
            href={`/about/stories/${story.id}`}
            aria-label={`Open ${story.title}`}
            className="card card-link grid overflow-hidden sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]"
          >
            <span className="relative block min-h-[220px]">
              <StoryPhoto kind={story.kind} photos={story.photo_urls} />
            </span>
            <span className="flex flex-col justify-center gap-2.5 px-[26px] py-6 text-ink">
              <span className="flex items-center gap-2">
                <StoryKindPill kind={story.kind} />
                <span className="text-[13px] font-semibold text-muted">{story.read_minutes} min read</span>
              </span>
              <span className="font-display text-[22px] font-extrabold leading-[1.2] tracking-[-0.01em]">
                {story.title}
              </span>
              <span className="text-[15px] leading-[1.55] text-muted">{story.summary}</span>
              <span className="mt-1 text-[13px] text-muted">
                <strong className="text-ink">{story.byline}</strong>
                {story.published_at && ` · ${shortDate(story.published_at)}`}
              </span>
              <span className="mt-1.5 inline-flex items-center gap-1 text-sm font-extrabold text-[var(--b600)]">
                Read the story
                <ArrowRight size={14} weight="bold" aria-hidden="true" />
              </span>
            </span>
          </Link>
        )}
        <div className="grid gap-3">
          {MORE.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="card card-link grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3.5 rounded-[var(--radius-inset)] px-5 py-4 text-ink"
              style={{ boxShadow: 'var(--shadow-e1), var(--shadow-hi)' }}
            >
              <c.icon size={28} weight="duotone" className="text-[var(--violet)]" aria-hidden="true" />
              <span className="min-w-0">
                <span className="flex items-center gap-2 font-display text-[17px] font-extrabold">
                  {c.label}
                  {c.soon && (
                    <span className="rounded-pill border border-line bg-sunken px-2 py-0.5 font-sans text-[10px] font-extrabold tracking-[0.09em] text-muted">
                      SOON
                    </span>
                  )}
                </span>
                <span className="block text-[13px] leading-[1.45] text-muted">{c.blurb}</span>
              </span>
              <ArrowRight size={18} weight="bold" className="text-muted" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
