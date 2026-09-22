/**
 * The account section's hub — the same shape as app/get-involved/page.tsx and
 * app/learn/page.tsx, for the same reason: a section's landing page lists what
 * is inside it, with a sentence per destination that a menu never had room for.
 *
 * It is not a duplicate of the rail. The rail says where you can go; this says
 * what you can do when you get there, which is why the busiest blurbs are a
 * comma list rather than a description. They are prose: the card is a single
 * link, and anything inside it that looked like a control would navigate
 * somewhere other than what it names.
 *
 * Related files:
 * - lib/nav-model.ts: the destination list, shared with the rail
 * - components/hub-grid.tsx: the grid, shared with every public hub
 */
import { requireCapabilities } from '@/lib/require-capabilities'
import { buildNav } from '@/lib/nav-model'
import { HubGrid } from '@/components/hub-grid'
import { ACCOUNT_NAV } from '@/lib/public-nav'
import type { NavItem } from '@/lib/public-nav'
import type { IconName } from '@/lib/nav-model'
import Link from 'next/link'
import type { Route } from 'next'
import { Handshake, Tray } from '@phosphor-icons/react/dist/ssr'
import { apiClient } from '@/lib/api-client'
import { MoneyPanel, type OutstandingLine } from '@/components/money-panel'
import { SplatMascot } from '@/components/splat-mascot'
import { isPast } from '@/lib/dates'
import type { OpenBuild } from '@/components/makers-wanted-board'
import type {
  PrinterWithOwner,
  Tutorial,
  TutorialOrg,
  ToyTransactionSummary,
} from '@splat-connect/types'

export const metadata = {
  title: 'My SPLAT — SPLAT Connect',
}

const BUILD_HREF = '/get-involved/makers-wanted'

/* The board's card order, where it differs from the nav model's: the maker's
   card beside My exchanges, and My events ahead of Print for others. */
const ORDER = [
  '/dashboard/tutorials',
  '/dashboard/toys',
  '/dashboard/exchanges',
  BUILD_HREF,
  '/dashboard/challenges',
  '/dashboard/print-requests',
  '/dashboard/events',
  '/dashboard/printers',
  '/get-involved/recycling',
]

/* The board gives every card its own icon-square colour rather than the
   section's one tint, so a grid of twelve does not read as one flat block. */
const TINTS: Record<string, string> = {
  '/dashboard/tutorials': 'var(--b100)',
  '/dashboard/toys': 'var(--tmint)',
  '/dashboard/exchanges': 'var(--tcoral)',
  [BUILD_HREF]: 'var(--tamber)',
  '/dashboard/challenges': 'var(--tviolet)',
  '/dashboard/print-requests': 'var(--tviolet)',
  '/dashboard/events': 'var(--tamber)',
  '/dashboard/printers': 'var(--tmint)',
  '/get-involved/recycling': 'var(--tmint)',
  '/dashboard/organisation/requests': 'var(--tcoral)',
  '/dashboard/organisation': 'var(--tamber)',
  '/dashboard/organisation/toys': 'var(--tok)',
  '/dashboard/organisation/orders': 'var(--tamber)',
  '/dashboard/organisation/publish': 'var(--tviolet)',
  '/dashboard/organisation/recycling': 'var(--tviolet)',
  '/dashboard/saved': 'var(--b100)',
  '/notifications': 'var(--tcoral)',
  '/dashboard/profile': 'var(--tmint)',
  '/admin': 'var(--tviolet)',
}

// Where the board draws a different glyph than the rail's.
const ICONS: Record<string, IconName> = {
  '/dashboard/print-requests': 'printer',
  '/dashboard/organisation/requests': 'inbox',
}

const LABELS: Record<string, string> = {
  '/dashboard/organisation/requests': 'Requests to your organisation',
}

const NUMBER_WORDS = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten']

function waitingSentence(n: number): string {
  return `${NUMBER_WORDS[n] ?? n} thing${n === 1 ? ' is' : 's are'} waiting.`
}

export default async function DashboardHub() {
  const caps = await requireCapabilities()

  /*
   * What is behind each card, rather than a sentence about the card.
   *
   * The four busy cards name their destinations as a comma list; the rest
   * describe themselves, because a one-item list is a sentence wearing a
   * costume. Both are one paragraph — see the spec's decision 2.
   */
  const blurbs: Record<string, string> = {
    '/dashboard/tutorials': 'Add a tutorial, saved tutorials, browse library.',
    '/dashboard/toys': 'Add a toy to donate, saved toys, browse toy library.',
    '/dashboard/exchanges': 'Active exchanges, exchange history.',
    '/dashboard/challenges': 'Submit an idea, saved challenges.',
    '/dashboard/print-requests':
      'Parts you have asked someone to print, and where each one is up to.',
    '/dashboard/printers': 'Your printers, requests waiting on you, jobs on the bed.',
    [BUILD_HREF]:
      'Families nearby asking for a guide to be built. Claim one, post a working shot, hand it over.',
    '/dashboard/events': 'Build days you are going to, and whether the host is printing your parts.',
    '/get-involved/recycling':
      'Drop clean waste plastic at an organisation that can extrude it, and earn print credit on their machines.',
    '/dashboard/organisation': 'Projects waiting for your organisation to review.',
    '/dashboard/organisation/requests':
      'Families asking you to host a build day, print parts, or build a guide nearby. Accept or decline.',
    '/dashboard/organisation/toys': 'What your organisation has on its shelves.',
    '/dashboard/organisation/orders': 'Print jobs your organisation has taken on.',
    '/dashboard/organisation/publish':
      'Publish a build day or a story. Live on the public pages the moment you press publish.',
    '/dashboard/organisation/recycling':
      'Weigh the plastic that turns up, issue the credit, and publish what your machines can take.',
    '/dashboard/organisation/profile': 'Everything a family reads about you.',
    '/dashboard/profile': 'Your name, email, children and terms.',
    '/dashboard/saved': 'Tutorials, toys, challenges and organisations you have kept.',
    '/notifications': 'Everything SPLAT has told you.',
    '/admin': 'The review queues and the report inbox.',
  }

  /*
   * The board badges every card that has something behind it. Each number here
   * comes from the same endpoint the card's own page reads, filtered the same
   * way, and each fetch degrades to "no badge" rather than failing the hub.
   * Leaders also pay for the tutorial list, which is what their review queue is
   * counted from (app/dashboard/organisation/page.tsx has the same rule).
   */
  const viewerId = caps.profile.id
  const isLeader = caps.ledOrgs.length > 0
  const [builds, events, transactions, printers, tutorials] = await Promise.all([
    apiClient.get<OpenBuild[]>('/api/toy-transactions/open-builds').catch(() => [] as OpenBuild[]),
    apiClient
      .get<Array<{ event: { starts_at: string; ends_at: string | null } }>>('/api/events/mine')
      .catch(() => []),
    apiClient
      .get<ToyTransactionSummary[]>('/api/toy-transactions')
      .catch(() => [] as ToyTransactionSummary[]),
    apiClient.get<PrinterWithOwner[]>('/api/printers/mine').catch(() => [] as PrinterWithOwner[]),
    isLeader
      ? apiClient
          .get<Array<Tutorial & { tutorial_orgs?: TutorialOrg[] }>>('/api/tutorials')
          .catch(() => [])
      : Promise.resolve([]),
  ])
  const myPrinterIds = new Set(printers.filter((p) => p.owner_id === viewerId).map((p) => p.id))
  const ledOrgIds = new Set(caps.ledOrgs.map((o) => o.id))
  const toReview = tutorials.reduce(
    (n, t) =>
      n +
      (t.tutorial_orgs ?? []).filter(
        (row) =>
          ledOrgIds.has(row.org_id) &&
          (row.status === 'pending' || (row.status === 'accepted' && t.status === 'pending'))
      ).length,
    0
  )

  /*
   * Unread for the three cards that have an unread count. Deliberately NOT
   * caps.exchangeActions on My exchanges: that is a needs-action count, it
   * clears when you act rather than when you read, and it already has its own
   * button in the header. Two numbers meaning different things on one card is
   * worse than one.
   */
  const counts: Record<string, number> = {
    '/dashboard/tutorials': caps.unread.tutorials,
    '/dashboard/exchanges': caps.unread.exchanges,
    [BUILD_HREF]: builds.length,
    '/dashboard/challenges': caps.unread.challenges,
    '/dashboard/print-requests': transactions.filter(
      (tx) =>
        tx.type === 'print' &&
        tx.requester_id === viewerId &&
        (tx.status === 'requested' || tx.status === 'accepted')
    ).length,
    '/dashboard/events': events.filter((r) => !isPast(r.event.starts_at, r.event.ends_at)).length,
    '/dashboard/printers': transactions.filter(
      (tx) =>
        tx.type === 'print' &&
        tx.status === 'requested' &&
        tx.printer_id !== null &&
        myPrinterIds.has(tx.printer_id)
    ).length,
    '/dashboard/organisation': toReview,
    '/notifications': caps.unread.total,
  }

  // Built from the same model the rail reads, so a destination cannot exist in
  // one and not the other — with one subtraction and one addition. "Submit an
  // idea" is a public route Design challenges already leads to, so it is a line
  // on that card instead. "Build for a family" is the maker's side of an
  // exchange, which the board puts beside My exchanges; its page is public, so
  // the nav model does not carry it.
  const rows = buildNav(caps)
    .flatMap((g) => g.rows)
    .filter((row) => row.href !== '/get-involved/submit-an-idea')
  const exchangesAt = rows.findIndex((row) => row.href === '/dashboard/exchanges')
  rows.splice(exchangesAt + 1, 0, { href: BUILD_HREF, label: 'Build for a family', icon: 'wrench' })

  const items: NavItem[] = rows
    .map((row) => ({
      href: row.href,
      label: LABELS[row.href] ?? row.label,
      state: row.soon ? ('soon' as const) : ('live' as const),
      blurb: blurbs[row.href] ?? '',
      count: counts[row.href],
      icon: ICONS[row.href] ?? row.icon,
      tint: TINTS[row.href],
    }))
    .sort((a, b) => (ORDER.indexOf(a.href) + 1 || 99) - (ORDER.indexOf(b.href) + 1 || 99))

  /*
   * Three groups, decided here rather than in the shared nav model.
   *
   * buildNav's own groupings are the rail's — task-shaped, "Add a tutorial",
   * "Exchange a toy" — and they are right there. The hub wants a different cut,
   * and the last redesign already learned that adding a `groups` field to the
   * shared model is the wrong move: the hub pages do their own grouping, and a
   * model change would have forced the rail to carry a shape only this page
   * reads.
   */
  const ORG_PREFIX = '/dashboard/organisation'
  const ACCOUNT_HREFS = new Set(['/dashboard/saved', '/dashboard/profile', '/notifications', '/admin'])

  const yours = items.filter((i) => !i.href.startsWith(ORG_PREFIX) && !ACCOUNT_HREFS.has(i.href))
  const organisation = items.filter((i) => i.href.startsWith(ORG_PREFIX))
  const account = items.filter((i) => ACCOUNT_HREFS.has(i.href))

  /*
   * The money panel's data. Degrades to absent rather than taking the page down
   * with it: an outstanding-costs fetch failing should not stop somebody
   * reaching their guides, and the panel renders nothing when there is nothing
   * outstanding anyway.
   */
  let money: { lines: OutstandingLine[]; total_cents: number; exchange_count: number } | null = null
  try {
    money = await apiClient.get('/api/exchange-costs/outstanding')
  } catch {
    money = null
  }

  const firstName = caps.profile.name.trim().split(/\s+/)[0]

  /*
   * What is waiting, as buttons rather than as a sentence.
   *
   * The board puts these in the header because they are the reason somebody
   * opened the page: an exchange that needs an answer and a queue with guides
   * in it are both actions, and a hub full of nine equal cards buries them.
   * Only rendered when the number is real — "0 exchanges need you" is worse
   * than nothing, and a button that leads to an empty list is a dead control.
   */
  const waiting: Array<{ href: Route; icon: typeof Handshake; label: string; primary?: boolean }> = []
  if (caps.exchangeActions > 0) {
    waiting.push({
      href: '/dashboard/exchanges' as Route,
      icon: Handshake,
      label: `${caps.exchangeActions} exchange${caps.exchangeActions === 1 ? '' : 's'} need you`,
      primary: true,
    })
  }
  if (toReview > 0) {
    waiting.push({
      href: '/dashboard/organisation' as Route,
      icon: Tray,
      label: `${toReview} guide${toReview === 1 ? '' : 's'} to review`,
    })
  }
  const waitingTotal = caps.exchangeActions + toReview

  return (
    <div>
      <section className="dash-hero">
        <div aria-hidden="true" className="dash-hero__blob" />
        <div className="relative flex flex-wrap items-center gap-7">
          <div className="flex-none">
            <SplatMascot width={140} />
          </div>
          <div className="min-w-[280px] flex-1">
            <p className="eyebrow text-muted">{ACCOUNT_NAV.label}</p>
            <h1 className="dash-hero__title">Welcome back, {firstName}.</h1>
            <p className="mt-3 max-w-[52ch] text-[17px] leading-[1.6] text-muted">
              Everything that belongs to you — what you have written, what you have lent, and what
              you have asked for.{waitingTotal > 0 && ` ${waitingSentence(waitingTotal)}`}
            </p>
            {waiting.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2.5">
                {waiting.map((w) => (
                  <Link
                    key={w.href}
                    href={w.href}
                    className={`btn no-underline ${w.primary ? 'btn-primary' : 'btn-quiet'}`}
                  >
                    <w.icon size={18} weight="bold" aria-hidden="true" />
                    {w.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="mt-[34px]">
        <HubGrid items={yours} tone={ACCOUNT_NAV.tone} columns={4} variant="tile" />
      </div>

      {organisation.length > 0 && (
        <section className="mt-[34px]">
          <h2 className="font-display text-xl font-extrabold text-ink">Your organisation</h2>
          <div className="mt-4">
            <HubGrid items={organisation} tone={ACCOUNT_NAV.tone} columns={4} variant="tile" />
          </div>
        </section>
      )}

      {account.length > 0 && (
        <section className="mt-[34px]">
          <h2 className="font-display text-xl font-extrabold text-ink">Account</h2>
          <div className="mt-4">
            <HubGrid items={account} tone={ACCOUNT_NAV.tone} columns={4} variant="tile" />
          </div>
        </section>
      )}

      {money && (
        <MoneyPanel
          lines={money.lines}
          totalCents={money.total_cents}
          exchangeCount={money.exchange_count}
        />
      )}
    </div>
  )
}
