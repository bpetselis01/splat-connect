# My SPLAT Signpost Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn each My SPLAT hub card from a one-sentence link into a signpost that lists what is behind it, with an unread badge, and put the real buttons on the destination pages.

**Architecture:** The card stays a single `BoundaryLink` — the lines inside it are text, never links, so `HubGrid` needs one branch rather than a restructure. `NavItem.blurb` widens to `string | string[]`; an array renders as flat tinted tags. Unread counts are bucketed by `NotificationType` in `@splat-connect/types` so the API and both clients cannot disagree, exposed as one new endpoint, and cleared by a small client component mounted on each destination page.

**Tech Stack:** Next.js 16 (App Router, React 19, server components), Hono API on Supabase, Tailwind v4 with utilities in `packages/web/app/globals.css`, Vitest + Testing Library for unit tests, Playwright for e2e.

**Spec:** `docs/superpowers/specs/2026-08-27-my-splat-signposts-design.md`

## Global Constraints

- **Copy is British/Australian English** and matches the spec's table verbatim. "My exchanges", not "My Exchanges".
- **No new design tokens.** Every value used here already exists in `globals.css` or the board's vocabulary table. Tags use `rounded-full` + `bg-surface/75`; the badge uses the existing `.badge` utility.
- **A tag is never an anchor.** It is text inside the card's single link. This is decision 1 of the spec and Task 4 pins it with a test.
- **`caps.exchangeActions` is not shown on the hub.** It stays the rail's signal only.
- **Blocked on the unspecced `saves` subsystem:** the three "Saved …" *buttons* on destination pages. The card *tags* naming them are text and ship now. Do not add a Saved button in this plan.
- Run commands from the repo root unless stated. Web unit tests: `pnpm --filter @splat-connect/web test:unit`. API unit tests: `pnpm --filter @splat-connect/api test:unit`. Types: `pnpm typecheck`.
- Commit after every task.

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `packages/types/src/index.ts` | `NotificationBucket`, the type→bucket map, `notificationBucket`, `typesInBucket`, `NOTIFICATION_TYPES` | 1 |
| `packages/web/tests/unit/lib/notification-bucket.test.ts` | every type buckets; buckets round-trip | 1 |
| `packages/api/src/routes/notifications.ts` | `GET /me/unread-counts`, `POST /me/read` | 2 |
| `packages/api/tests/unit/routes/notifications.test.ts` | both new endpoints (new file) | 2 |
| `packages/web/lib/capabilities.ts` | `unread: UnreadCounts` on `Capabilities` | 3 |
| `packages/web/lib/public-nav.ts` | `NavItem.blurb` widens; `NavItem.count` added | 4 |
| `packages/web/components/hub-grid.tsx` | tag list branch + count badge | 4 |
| `packages/web/lib/nav-model.ts` | `Exchanges` → `My exchanges` | 5 |
| `packages/web/app/dashboard/page.tsx` | seven cards, the tag copy, the badges | 6 |
| `packages/web/components/mark-notifications-read.tsx` | fire-once clear on destination mount (new file) | 7 |
| `packages/web/app/dashboard/exchanges/page.tsx` | active/history split, header buttons | 8 |
| `packages/web/app/dashboard/tutorials/page.tsx`, `.../toys/page.tsx`, `.../challenges/page.tsx` | Browse buttons; the persistent Submit an idea button | 9 |

**Page tests live in `packages/web/tests/unit/pages/`, one file per page, and every
page this plan touches already has one** — `dashboard-hub.test.tsx`,
`dashboard-exchanges.test.tsx`, `dashboard-tutorials.test.tsx`,
`dashboard-toys-list.test.tsx`, `dashboard-challenges.test.tsx`. Extend those
files. Do not create new test files under `tests/unit/app/` for page behaviour;
that directory holds cross-cutting concerns (chrome, tokens, scaffolds), not
per-page tests.

---

### Task 1: Bucket every notification type

**Files:**
- Modify: `packages/types/src/index.ts` (after the `NotificationType` union, currently `:392-410`)
- Test: `packages/web/tests/unit/lib/notification-bucket.test.ts` (create)

**Interfaces:**
- Consumes: the existing `NotificationType` union.
- Produces: `NotificationBucket = 'tutorials' | 'exchanges' | 'challenges'`; `notificationBucket(type: NotificationType): NotificationBucket`; `typesInBucket(bucket: NotificationBucket): NotificationType[]`; `NOTIFICATION_TYPES: NotificationType[]`. Tasks 2, 3, 6, 7, 8 all import from here.

There is no test runner in `packages/types`, so its tests live in web's suite. That is already the pattern — `packages/web/tests/unit/lib/` holds `public-nav.test.ts`.

- [ ] **Step 1: Write the failing test**

Create `packages/web/tests/unit/lib/notification-bucket.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  NOTIFICATION_TYPES,
  notificationBucket,
  typesInBucket,
} from '@splat-connect/types'

describe('notificationBucket', () => {
  /*
   * The badge on a My SPLAT card is only as good as this map: a type that
   * buckets nowhere is a notification the user is never told about on the hub.
   * The `satisfies Record<NotificationType, …>` in index.ts makes a new type a
   * compile error; this makes a *wrong* value a test failure.
   */
  it('gives every notification type a bucket', () => {
    expect(NOTIFICATION_TYPES.length).toBe(18)
    for (const type of NOTIFICATION_TYPES) {
      expect(['tutorials', 'exchanges', 'challenges']).toContain(notificationBucket(type))
    }
  })

  it('buckets authoring and collaboration to tutorials', () => {
    expect(notificationBucket('tutorial_approved')).toBe('tutorials')
    expect(notificationBucket('collaborator_invited')).toBe('tutorials')
    expect(notificationBucket('collaborator_left')).toBe('tutorials')
  })

  /* Every toy_* type is a transaction event, so My toys gets no badge and
     My exchanges gets all five. See the spec — do not invent a toy
     notification to fill that card. */
  it('buckets all five toy events to exchanges, none to toys', () => {
    expect(typesInBucket('exchanges').sort()).toEqual([
      'toy_accepted',
      'toy_message',
      'toy_rejected',
      'toy_request',
      'toy_withdrawn',
    ])
  })

  it('buckets ideas and challenges together', () => {
    expect(notificationBucket('idea_graduated')).toBe('challenges')
    expect(notificationBucket('challenge_joined')).toBe('challenges')
  })

  it('round-trips every type through its own bucket', () => {
    for (const type of NOTIFICATION_TYPES) {
      expect(typesInBucket(notificationBucket(type))).toContain(type)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @splat-connect/web test:unit -- notification-bucket`
Expected: FAIL — `NOTIFICATION_TYPES` / `notificationBucket` / `typesInBucket` are not exported from `@splat-connect/types`.

- [ ] **Step 3: Write minimal implementation**

In `packages/types/src/index.ts`, immediately after the `NotificationType` union (before `export interface Notification`), add:

```ts
/** Which My SPLAT card a notification's badge belongs to. */
export type NotificationBucket = 'tutorials' | 'exchanges' | 'challenges'

/**
 * Notification type → the hub card that counts it.
 *
 * Declared here rather than in the web app because the API groups by it and
 * the hub renders by it; two copies would drift the first time a type is added.
 *
 * `satisfies Record<NotificationType, NotificationBucket>` is load-bearing: a
 * nineteenth NotificationType becomes a compile error on this object rather
 * than a badge that silently never counts it.
 *
 * Note there is no 'toys' bucket. Every toy_* type is an event on a
 * transaction, not on a toy, so they all belong to My exchanges — a toy
 * sitting on a shelf generates nothing.
 */
const NOTIFICATION_BUCKET = {
  collaborator_invited: 'tutorials',
  collaborator_accepted: 'tutorials',
  collaborator_declined: 'tutorials',
  collaborator_removed: 'tutorials',
  collaborator_left: 'tutorials',
  tutorial_approved: 'tutorials',
  tutorial_rejected: 'tutorials',
  toy_request: 'exchanges',
  toy_accepted: 'exchanges',
  toy_rejected: 'exchanges',
  toy_withdrawn: 'exchanges',
  toy_message: 'exchanges',
  idea_approved: 'challenges',
  idea_rejected: 'challenges',
  idea_graduated: 'challenges',
  challenge_joined: 'challenges',
  challenge_left: 'challenges',
  challenge_removed: 'challenges',
} satisfies Record<NotificationType, NotificationBucket>

/** Every notification type, for iteration at runtime — the union alone is compile-time only. */
export const NOTIFICATION_TYPES = Object.keys(NOTIFICATION_BUCKET) as NotificationType[]

export function notificationBucket(type: NotificationType): NotificationBucket {
  return NOTIFICATION_BUCKET[type]
}

/** The types in one bucket, for a grouped update. */
export function typesInBucket(bucket: NotificationBucket): NotificationType[] {
  return NOTIFICATION_TYPES.filter((t) => NOTIFICATION_BUCKET[t] === bucket)
}

/** The shape GET /api/notifications/me/unread-counts returns. */
export interface UnreadCounts {
  tutorials: number
  exchanges: number
  challenges: number
  total: number
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @splat-connect/web test:unit -- notification-bucket`
Expected: PASS (5 tests)

Then: `pnpm typecheck`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add packages/types/src/index.ts packages/web/tests/unit/lib/notification-bucket.test.ts
git commit -m "feat(types): bucket every notification type to a My SPLAT card"
```

---

### Task 2: The two notification endpoints

**Files:**
- Modify: `packages/api/src/routes/notifications.ts`
- Test: `packages/api/tests/unit/routes/notifications.test.ts` (create — the route has no test file today)

**Interfaces:**
- Consumes: `notificationBucket`, `typesInBucket`, `UnreadCounts` from Task 1.
- Produces: `GET /api/notifications/me/unread-counts` → `UnreadCounts`; `POST /api/notifications/me/read` with `{ bucket: NotificationBucket }` → `204`, `400` on a bad bucket. Tasks 3 and 7 consume them.

The existing `GET /me/unread-count` (singular) stays — the rail still uses it via `capabilities`, and removing it is not this plan's job.

- [ ] **Step 1: Write the failing test**

Create `packages/api/tests/unit/routes/notifications.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import type { AuthVariables } from '../../../src/middleware/auth.js'

const mockFrom = vi.fn()

// --- Mock strategy ---
// notifications.ts builds a per-request client from the caller's JWT via
// createUserClient, so RLS does the ownership check. Replacing that with one
// controlled fake lets each test drive the query chain's return value directly.
vi.mock('../../../src/supabase/user-client.js', () => ({
  createUserClient: () => ({ from: mockFrom }),
}))

const { default: notifications } = await import('../../../src/routes/notifications.js')

function makeApp() {
  const app = new Hono<{ Variables: AuthVariables }>()
  app.use('*', async (c, next) => {
    c.set('userId', 'user-1')
    c.set('role', 'contributor')
    c.set('token', 'test-token')
    await next()
  })
  app.route('/', notifications)
  return app
}

describe('GET /me/unread-counts', () => {
  beforeEach(() => vi.clearAllMocks())

  // Tests: unread rows are tallied into the three hub buckets plus a total
  // How:   the select/eq/is chain returns five unread rows across all three buckets
  // Chain: My SPLAT reads this to badge its cards → a user sees which card has news
  it('tallies unread rows into buckets', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          is: () => ({
            data: [
              { type: 'tutorial_approved' },
              { type: 'collaborator_invited' },
              { type: 'toy_message' },
              { type: 'toy_request' },
              { type: 'idea_graduated' },
            ],
            error: null,
          }),
        }),
      }),
    })

    const res = await makeApp().request('/me/unread-counts')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      tutorials: 2,
      exchanges: 2,
      challenges: 1,
      total: 5,
    })
  })

  it('returns all zeroes when nothing is unread', async () => {
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ is: () => ({ data: [], error: null }) }) }),
    })

    const res = await makeApp().request('/me/unread-counts')
    expect(await res.json()).toEqual({ tutorials: 0, exchanges: 0, challenges: 0, total: 0 })
  })

  it('500s rather than reporting a falsely empty inbox', async () => {
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ is: () => ({ data: null, error: { message: 'boom' } }) }) }),
    })

    const res = await makeApp().request('/me/unread-counts')
    expect(res.status).toBe(500)
  })
})

describe('POST /me/read', () => {
  beforeEach(() => vi.clearAllMocks())

  // Tests: marking one bucket read only touches that bucket's types
  // How:   captures the .in() argument from the update chain
  // Chain: opening /dashboard/tutorials clears the tutorials badge → and only it
  it('marks only the named bucket read', async () => {
    const inSpy = vi.fn().mockReturnValue({ error: null })
    mockFrom.mockReturnValue({
      update: () => ({ eq: () => ({ is: () => ({ in: inSpy }) }) }),
    })

    const res = await makeApp().request('/me/read', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bucket: 'tutorials' }),
    })

    expect(res.status).toBe(204)
    const [column, types] = inSpy.mock.calls[0]
    expect(column).toBe('type')
    expect(types).toContain('tutorial_approved')
    expect(types).toContain('collaborator_left')
    expect(types).not.toContain('toy_message')
  })

  it('rejects an unknown bucket rather than marking everything read', async () => {
    const res = await makeApp().request('/me/read', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ bucket: 'everything' }),
    })

    expect(res.status).toBe(400)
    expect(mockFrom).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @splat-connect/api test:unit -- notifications`
Expected: FAIL — both routes 404, so the first assertion gets `404` instead of `200`.

- [ ] **Step 3: Write minimal implementation**

In `packages/api/src/routes/notifications.ts`, extend the import line and add both routes after the existing `/me/unread-count` handler:

```ts
import {
  notificationBucket,
  typesInBucket,
  type NotificationType,
  type NotificationBucket,
  type UnreadCounts,
} from '@splat-connect/types'
```

```ts
/**
 * Unread, split by which My SPLAT card owns it. The rail still reads the
 * singular /me/unread-count above; this is the hub's version.
 *
 * Counted in JS over the unread rows rather than as three grouped queries:
 * one round trip, and the set is a single user's *unread* notifications.
 * ponytail: linear scan, push the grouping into SQL if someone ever carries
 * thousands unread.
 */
notifications.get('/me/unread-counts', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const { data, error } = await supabase
    .from('notifications')
    .select('type')
    .eq('recipient_id', c.get('userId'))
    .is('read_at', null)
  if (error) return c.json({ error: error.message }, 500)

  const counts: UnreadCounts = { tutorials: 0, exchanges: 0, challenges: 0, total: 0 }
  for (const row of (data ?? []) as { type: NotificationType }[]) {
    counts[notificationBucket(row.type)] += 1
    counts.total += 1
  }
  return c.json(counts)
})

/**
 * Clear one card's badge. Called when its destination page opens, which is why
 * this is a bucket rather than a list of ids — the page does not know them.
 *
 * The bucket is allowlisted, not cast: an unrecognised value must 400 rather
 * than fall through to an update with an empty `in`, which is silent and wrong.
 */
notifications.post('/me/read', async (c) => {
  const body = await c.req.json<{ bucket?: string }>().catch(() => ({ bucket: undefined }))
  const allowed: NotificationBucket[] = ['tutorials', 'exchanges', 'challenges']
  const bucket = allowed.find((b) => b === body.bucket)
  if (!bucket) {
    return c.json({ error: 'bucket must be tutorials, exchanges or challenges' }, 400)
  }

  const supabase = createUserClient(c.get('token'))
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', c.get('userId'))
    .is('read_at', null)
    .in('type', typesInBucket(bucket))
  if (error) return c.json({ error: error.message }, 500)
  return c.body(null, 204)
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @splat-connect/api test:unit -- notifications`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/notifications.ts packages/api/tests/unit/routes/notifications.test.ts
git commit -m "feat(api): unread counts per hub card, and a way to clear one"
```

---

### Task 3: Capabilities carries the bucketed counts

**Files:**
- Modify: `packages/web/lib/capabilities.ts:37-88`

**Interfaces:**
- Consumes: `UnreadCounts` (Task 1), `GET /api/notifications/me/unread-counts` (Task 2).
- Produces: `Capabilities.unread: UnreadCounts`. `Capabilities.unreadNotifications` keeps its meaning (the total) so `nav-model.ts` and the rail are untouched. Task 6 reads `caps.unread`.

Swapping the endpoint rather than adding one keeps the root layout at three parallel fetches — the file's own comment explains why that number matters.

- [ ] **Step 1: Write the failing test**

There is no existing `capabilities` unit test and this task adds no branch worth one — the guard is the type checker plus Task 6's page test, which reads `caps.unread`. Skip to Step 2.

- [ ] **Step 2: Make the change**

Add the import:

```ts
import type { Profile, Organization, UnreadCounts } from '@splat-connect/types'
```

Add to the `Capabilities` type, below `unreadNotifications`:

```ts
  /** The same unread total, split by which My SPLAT card owns it. */
  unread: UnreadCounts
```

Replace the second entry of the `Promise.all` and the return:

```ts
  const [ledOrgs, unread, exchangeActions] = await Promise.all([
    apiClient.get<Organization[]>('/api/organizations/mine').catch(() => [] as Organization[]),
    apiClient
      .get<UnreadCounts>('/api/notifications/me/unread-counts')
      .catch(() => ({ tutorials: 0, exchanges: 0, challenges: 0, total: 0 }) as UnreadCounts),
    apiClient
      .get<{ count: number }>('/api/toy-transactions/action-count')
      .then((r) => r.count)
      .catch(() => 0),
  ])

  return {
    profile,
    isAdmin: profile.role === 'admin',
    ledOrgs,
    canAuthor: true,
    unreadNotifications: unread.total,
    unread,
    exchangeActions,
  }
```

- [ ] **Step 3: Verify nothing regressed**

Run: `pnpm typecheck && pnpm --filter @splat-connect/web test:unit`
Expected: clean, all existing tests pass. `unreadNotifications` still feeds `buildNav`, so the rail badge is unchanged.

- [ ] **Step 4: Commit**

```bash
git add packages/web/lib/capabilities.ts
git commit -m "feat(web): capabilities carries unread split by hub card"
```

---

### Task 4: HubGrid renders a tag list and a count badge

**Files:**
- Modify: `packages/web/lib/public-nav.ts:34` (the `blurb` field), and the `NavItem` interface
- Modify: `packages/web/components/hub-grid.tsx:75-92`
- Test: `packages/web/tests/unit/components/hub-grid.test.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `NavItem.blurb: string | string[]` and `NavItem.count?: number`. Task 6 passes both.

`NavItem` is referenced by exactly three files — `public-nav.ts`, `hub-grid.tsx` and `app/dashboard/page.tsx` — so widening it touches one component and one page. `NavSection.blurb` is a different field and stays `string`; the footer, `launcher-grid` and `app/page.tsx` read that one.

- [ ] **Step 1: Write the failing test**

Append to `packages/web/tests/unit/components/hub-grid.test.tsx`, inside the existing `describe('HubGrid', …)`:

```ts
  /*
   * My SPLAT's cards list what is behind them instead of describing themselves.
   * The lines are TEXT, deliberately: the whole card is one link, so a line
   * that looked and behaved like a control would navigate somewhere other than
   * what it names. See decision 1 in the spec.
   */
  const signpost: NavItem[] = [
    {
      href: '/dashboard/tutorials',
      label: 'My tutorials',
      state: 'live',
      count: 2,
      blurb: [
        'Add a tutorial to SPLAT Connect',
        'View saved tutorials',
        'Browse tutorial library',
      ],
    },
  ]

  it('renders an array blurb as a list of lines', () => {
    render(<HubGrid items={signpost} tone="brand" />)
    expect(screen.getByText('Add a tutorial to SPLAT Connect')).toBeInTheDocument()
    expect(screen.getByText('View saved tutorials')).toBeInTheDocument()
    expect(screen.getByText('Browse tutorial library')).toBeInTheDocument()
  })

  it('makes no line a link of its own', () => {
    render(<HubGrid items={signpost} tone="brand" />)
    // One link for the card, and nothing else. Three tags that each looked
    // pressable but went to the card's href would teach that tags lie.
    expect(screen.getAllByRole('link')).toHaveLength(1)
    expect(screen.getByText('Browse tutorial library').closest('a')).toHaveAttribute(
      'href',
      '/dashboard/tutorials'
    )
  })

  it('badges a non-zero count', () => {
    render(<HubGrid items={signpost} tone="brand" />)
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('renders no badge at zero rather than a zero badge', () => {
    render(<HubGrid items={[{ ...signpost[0], count: 0 }]} tone="brand" />)
    expect(screen.queryByText('0')).not.toBeInTheDocument()
  })

  it('renders no badge when the item has no count at all', () => {
    const { count: _count, ...noCount } = signpost[0]
    const { container } = render(<HubGrid items={[noCount]} tone="brand" />)
    expect(container.querySelector('.badge')).toBeNull()
  })

  it('still renders a string blurb as a paragraph', () => {
    const { container } = render(<HubGrid items={items} tone="honey" />)
    expect(container.querySelector('ul')).toBeNull()
    expect(screen.getByText('Which switch suits which child.')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @splat-connect/web test:unit -- hub-grid`
Expected: FAIL — `count` is not a property of `NavItem`, and an array blurb renders as `"Add a tutorial to SPLAT ConnectView saved tutorials…"` in one paragraph, so `getByText` misses.

- [ ] **Step 3: Write minimal implementation**

In `packages/web/lib/public-nav.ts`, replace the `blurb` field on `NavItem` and add `count`:

```ts
  /**
   * One line, or a short list of what is behind the card.
   *
   * Used on hub cards, in the footer's title attribute, and as the scaffold
   * page's promise — all of which pass a string. The array form is My SPLAT's
   * alone (app/dashboard/page.tsx): its cards list what they lead to rather
   * than describing themselves. They stay text, never links — the card is one
   * link and a nested one would be invalid as well as a lie.
   */
  blurb: string | string[]
  /** Unread items behind this card. Omit or 0 for no badge. */
  count?: number
```

In `packages/web/components/hub-grid.tsx`, add the badge to the title row and branch the blurb:

```tsx
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={`font-extrabold ${wide ? 'text-[15px]' : 'text-[14px]'}`}>
              {item.label}
            </h3>
            {item.state === 'soon' && (
              // The board's four-character SOON, at the size it was drawn:
              // .badge defaults to 11px for the multi-word labels every other
              // caller carries, but this is the one label 9px fits.
              <span className="badge bg-honey-soft text-honey-deep text-[9px]">SOON</span>
            )}
            {/* Apricot, the board's one warm accent, so the number reads before
                the title on the only cards that carry one. Nothing at zero: a
                grey 0 is noise that trains you to ignore the badge. */}
            {item.count ? (
              <span className="badge bg-apricot text-ink">{item.count}</span>
            ) : null}
          </div>

          {Array.isArray(item.blurb) ? (
            /* Tinted tags rather than outlined chips. Button-shaped, but
               deliberately without the board's two button signals (3px ink
               border, hard shadow) — these are labels inside a link, and the
               outlined form is pixel-identical to the real, pressable filter
               chips on /library. */
            <ul className={`flex flex-wrap gap-1.5 ${wide ? 'text-[12px]' : 'text-[11px]'}`}>
              {item.blurb.map((line) => (
                <li
                  key={line}
                  className="rounded-full bg-surface/75 px-2.5 py-1 font-bold leading-snug"
                >
                  {line}
                </li>
              ))}
            </ul>
          ) : (
            /* Always muted, never the tone's own ink: the board keeps the blurb
               at #4d6a7d on every section so the title is the only coloured
               thing in the card and reads first. */
            <p
              className={`leading-relaxed text-muted ${
                wide ? 'text-[13px]' : 'text-[12px]'
              }`}
            >
              {item.blurb}
            </p>
          )}
```

The tags inherit the card's `spec.ink` (`text-brand-deep` on My SPLAT), which is why they carry no colour class of their own.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @splat-connect/web test:unit -- hub-grid`
Expected: PASS — the six new tests plus all eight existing ones. The existing suite passing unchanged is the point: every public hub still renders exactly as it did.

- [ ] **Step 5: Commit**

```bash
git add packages/web/lib/public-nav.ts packages/web/components/hub-grid.tsx packages/web/tests/unit/components/hub-grid.test.tsx
git commit -m "feat(web): a hub card can list what is behind it, and carry a count"
```

---

### Task 5: Exchanges becomes My exchanges

**Files:**
- Modify: `packages/web/lib/nav-model.ts` (the `/dashboard/exchanges` row)
- Test: `packages/web/tests/unit/components/rail.test.tsx`, `packages/web/tests/unit/components/nav.test.tsx`

**Interfaces:** none — one string.

The rail reads the same model, so it renames there too. That is intended: the label sits beside "My tutorials" and "My toys" in the same group.

- [ ] **Step 1: Find every assertion on the old label**

Run: `grep -rn "'Exchanges'\|\"Exchanges\"\|/Exchanges/" packages/web/tests packages/web/app packages/web/components`
Expected: the `nav-model.ts` row plus any test asserting on it. Note each one — you will update them in Step 3.

- [ ] **Step 2: Make the change**

In `packages/web/lib/nav-model.ts`, in the `'Exchange a toy'` group:

```ts
        {
          href: '/dashboard/exchanges',
          label: 'My exchanges',
          icon: 'handshake',
          // Requests to answer and handoffs to confirm — the same rows the list
          // marks "waiting on you". See needsAction in @splat-connect/types.
          count: caps.exchangeActions || undefined,
        },
```

- [ ] **Step 3: Update the assertions Step 1 found**

Change each `Exchanges` expectation to `My exchanges`. Use a case-insensitive regex where the test already uses one (`/my exchanges/i`).

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @splat-connect/web test:unit -- rail nav`
Expected: PASS.

Then check the e2e specs, which the unit run does not cover:
Run: `grep -rn "Exchanges" packages/web/tests/e2e`
Update `dashboard/navigation.spec.ts` and `dashboard/shell.spec.ts` if either names the label.

- [ ] **Step 5: Commit**

```bash
git add packages/web/lib/nav-model.ts packages/web/tests
git commit -m "feat(web): Exchanges becomes My exchanges, beside its two siblings"
```

---

### Task 6: The hub page

**Files:**
- Modify: `packages/web/app/dashboard/page.tsx` (replaces the `counts` and `blurbs` literals at `:31-52` and the `items` build at `:57-64`)
- Test: `packages/web/tests/unit/pages/dashboard-hub.test.tsx` (**extend the existing file — do not create a new one**)

**Interfaces:**
- Consumes: `NavItem.blurb: string | string[]` and `NavItem.count` (Task 4), `caps.unread` (Task 3), the renamed label (Task 5).
- Produces: nothing downstream.

Two changes of substance. First, the count stops replacing the description — today three pending actions overwrite the Exchanges blurb entirely, so the card loses its meaning exactly when it matters. Counts move to the badge. Second, `Submit an idea` stops being its own card and becomes the first tag on Design challenges: it was the one row in the account hub pointing at a public route, and Design challenges already leads to the same section.

**Read `packages/web/tests/unit/pages/dashboard-hub.test.tsx` before you write anything.** It has six existing tests and its own mock setup (a `caps` ref, a `pathname` ref, a `mockLink` spy, and a `redirect` mock that *throws* `NEXT_REDIRECT`). Reuse that setup — do not add a second one. Three of its tests are affected:

| Existing test | What happens to it |
|---|---|
| `renders a tile per account destination` | keep; Task 5 already changed `'Exchanges'` to `'My exchanges'` in its label array |
| `links to the idea form` | **delete.** The hub no longer links there — Task 9 moves that guarantee to `/dashboard/challenges`, which is where the tag now points you |
| `renders the idea-form tile as a plain anchor from the account section` | **delete**, same reason. The boundary-crossing guard it provided still exists: `/dashboard/challenges` reaches the public form through `BoundaryLink` |
| `renders an account-internal tile as a plain anchor…` | keep unchanged — still the guard for hub tiles crossing into the rail |
| `summarises what is waiting on you` | **rewrite.** It asserts `/2 waiting on you/`, which this task deletes. Replace with the badge assertions below |
| `redirects a signed-out visitor` | keep unchanged |

Deleting the two idea-form tests is only safe because Task 9 adds a persistent
`Submit an idea` button to `/dashboard/challenges` and a test for it. **If Task 9
has not landed, do not delete them** — say so in your report instead.

- [ ] **Step 1: Write the failing tests**

Add to the existing `describe('DashboardHub', …)` in `packages/web/tests/unit/pages/dashboard-hub.test.tsx`, using the file's existing `caps` / `baseCaps` helpers:

```tsx
  // Submit an idea was the one row here pointing at a public route, and
  // Design challenges already leads to the same section. Reachability moved
  // with it — see the persistent button on /dashboard/challenges.
  it('folds Submit an idea into Design challenges rather than giving it a card', async () => {
    render(await DashboardHub())
    expect(screen.queryByRole('link', { name: /^Submit an idea$/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Design challenges/ })).toHaveTextContent(
      'Submit an idea'
    )
  })

  it('lists what is behind My tutorials', async () => {
    render(await DashboardHub())
    const card = screen.getByRole('link', { name: /My tutorials/ })
    expect(card).toHaveTextContent('Add a tutorial to SPLAT Connect')
    expect(card).toHaveTextContent('View saved tutorials')
    expect(card).toHaveTextContent('Browse tutorial library')
  })

  it('lists what is behind My toys', async () => {
    render(await DashboardHub())
    const card = screen.getByRole('link', { name: /My toys/ })
    expect(card).toHaveTextContent('Add a toy you want to donate or exchange')
    expect(card).toHaveTextContent('View saved toys')
    expect(card).toHaveTextContent('Browse toy library')
  })

  it('lists what is behind My exchanges', async () => {
    render(await DashboardHub())
    const card = screen.getByRole('link', { name: /My exchanges/ })
    expect(card).toHaveTextContent('View active exchanges or donations')
    expect(card).toHaveTextContent('Exchange history')
  })

  /*
   * Replaces "summarises what is waiting on you". The bug that test encoded:
   * `counts` used to overwrite the blurb, so a card with pending actions read
   * only "3 waiting on you" and lost its description exactly when it mattered
   * most. The count moved to a badge so both survive.
   */
  it('badges the unread count without eating the description', async () => {
    caps.current = {
      ...baseCaps,
      unread: { tutorials: 2, exchanges: 3, challenges: 0, total: 5 },
    }
    render(await DashboardHub())
    const card = screen.getByRole('link', { name: /My exchanges/ })
    expect(card).toHaveTextContent('3')
    expect(card).toHaveTextContent('Exchange history')
  })

  // exchangeActions is the rail's signal — a different number that clears on a
  // different event. Four actions must not surface here as a badge.
  it('badges unread, not the needs-action count', async () => {
    caps.current = { ...baseCaps, exchangeActions: 4 }
    render(await DashboardHub())
    expect(screen.getByRole('link', { name: /My exchanges/ })).not.toHaveTextContent('4')
  })

  // Every toy_* type is a transaction event, so My toys has no bucket at all.
  it('gives My toys no badge', async () => {
    caps.current = {
      ...baseCaps,
      unread: { tutorials: 2, exchanges: 3, challenges: 0, total: 5 },
    }
    render(await DashboardHub())
    expect(
      screen.getByRole('link', { name: /My toys/ }).querySelector('.badge')
    ).toBeNull()
  })

  // Eight before: Submit an idea folded into Design challenges.
  it('renders seven cards for a plain account', async () => {
    const { container } = render(await DashboardHub())
    expect(container.querySelectorAll('a.card-pixel')).toHaveLength(7)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @splat-connect/web test:unit -- dashboard-hub`
Expected: FAIL — `Submit an idea` still has its own card, the blurbs are still single sentences, and there are eight cards.

- [ ] **Step 3: Write minimal implementation**

Replace the body of `packages/web/app/dashboard/page.tsx` between `if (!caps) redirect('/login')` and the `return`:

```tsx
  /*
   * What is behind each card, rather than a sentence about the card.
   *
   * An array renders as tags (components/hub-grid.tsx); a string renders as
   * today's paragraph. The three cards with nothing to do keep prose, because a
   * one-item list is a sentence wearing a costume.
   *
   * These are text, not links. The card is one link — see the spec's decision 1.
   */
  const blurbs: Record<string, string | string[]> = {
    '/dashboard/tutorials': [
      'Add a tutorial to SPLAT Connect',
      'View saved tutorials',
      'Browse tutorial library',
    ],
    '/dashboard/toys': [
      'Add a toy you want to donate or exchange',
      'View saved toys',
      'Browse toy library',
    ],
    '/dashboard/exchanges': ['View active exchanges or donations', 'Exchange history'],
    '/dashboard/challenges': ['Submit an idea', 'View saved challenges'],
    '/dashboard/print-requests': 'Parts you have asked someone to print.',
    '/dashboard/organisation': 'Projects waiting for your organisation to review.',
    '/dashboard/organisation/toys': 'What your organisation has on its shelves.',
    '/dashboard/organisation/orders': 'Print jobs your organisation has taken on.',
    '/dashboard/profile': 'Your name, email, and the children and terms you have on file.',
    '/notifications': 'Everything SPLAT has told you.',
    '/admin': 'The review queues and the report inbox.',
  }

  /*
   * Unread, per card. Deliberately NOT caps.exchangeActions: that is a
   * needs-action count, it clears when you act rather than when you read, and
   * it already has a home in the rail. Two numbers meaning different things on
   * one card is worse than one.
   */
  const counts: Record<string, number> = {
    '/dashboard/tutorials': caps.unread.tutorials,
    '/dashboard/exchanges': caps.unread.exchanges,
    '/dashboard/challenges': caps.unread.challenges,
    '/notifications': caps.unread.total,
  }

  // Built from the same model the rail reads, so a destination cannot exist in
  // one and not the other — with one subtraction. "Submit an idea" is the only
  // row here that points at a public route, and Design challenges already leads
  // to the same section, so it is a line on that card instead of a card.
  const items: NavItem[] = buildNav(caps, caps.unreadNotifications)
    .flatMap((g) => g.rows)
    .filter((row) => row.href !== '/get-involved/submit-an-idea')
    .map((row) => ({
      href: row.href,
      label: row.label,
      state: row.soon ? 'soon' : 'live',
      blurb: blurbs[row.href] ?? '',
      count: counts[row.href],
    }))
```

Update the header comment's second paragraph, which no longer describes the file:

```
 * It is not a duplicate of the rail. The rail says where you can go; this says
 * what you can do when you get there, which is why most blurbs are a list
 * rather than a sentence. The lists are text: the card is a single link, and a
 * line that behaved like a control would navigate somewhere other than what it
 * names.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @splat-connect/web test:unit -- dashboard-hub`
Expected: PASS (8 tests)

Then the whole suite: `pnpm --filter @splat-connect/web test:unit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/app/dashboard/page.tsx packages/web/tests/unit/pages/dashboard-hub.test.tsx
git commit -m "feat(web): My SPLAT cards say what is behind them"
```

---

### Task 7: Clearing a card's badge

**Files:**
- Create: `packages/web/components/mark-notifications-read.tsx`
- Test: `packages/web/tests/unit/components/mark-notifications-read.test.tsx` (create)

**Interfaces:**
- Consumes: `POST /api/notifications/me/read` (Task 2), `NotificationBucket` (Task 1).
- Produces: `<MarkNotificationsRead bucket={...} />`, rendering nothing. Tasks 8 and 9 mount it.

A server component cannot POST during render without a side effect on every re-render, so this is a client component that fires once on mount. It renders `null`: the badge it clears lives on a different page, so there is nothing to show here.

- [ ] **Step 1: Write the failing test**

Create `packages/web/tests/unit/components/mark-notifications-read.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'

const post = vi.hoisted(() => vi.fn())
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { post } }))

const { MarkNotificationsRead } = await import('@/components/mark-notifications-read')

describe('MarkNotificationsRead', () => {
  beforeEach(() => {
    post.mockReset()
    post.mockResolvedValue(undefined)
  })

  it('clears its bucket on mount', async () => {
    render(<MarkNotificationsRead bucket="tutorials" />)
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/api/notifications/me/read', { bucket: 'tutorials' })
    )
  })

  it('renders nothing', () => {
    const { container } = render(<MarkNotificationsRead bucket="exchanges" />)
    expect(container).toBeEmptyDOMElement()
  })

  /* React 18+ mounts twice in StrictMode and effects re-run on any remount.
     Marking read is idempotent server-side, but a doubled request on every
     page view is noise worth not making. */
  it('fires once even if the effect runs twice', async () => {
    const { rerender } = render(<MarkNotificationsRead bucket="tutorials" />)
    rerender(<MarkNotificationsRead bucket="tutorials" />)
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
  })

  /* A failed clear must not surface: the page behind it loaded fine, and an
     unread badge that lingers one more visit is not worth an error. */
  it('swallows a failed clear', async () => {
    post.mockRejectedValue(new Error('offline'))
    expect(() => render(<MarkNotificationsRead bucket="challenges" />)).not.toThrow()
    await waitFor(() => expect(post).toHaveBeenCalled())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @splat-connect/web test:unit -- mark-notifications-read`
Expected: FAIL — cannot resolve `@/components/mark-notifications-read`.

- [ ] **Step 3: Write minimal implementation**

Create `packages/web/components/mark-notifications-read.tsx`:

```tsx
/**
 * Clears one My SPLAT card's unread badge when its destination page opens.
 *
 * A bucket rather than a list of ids because the page does not know its
 * notifications — it knows which card sent the visitor here. See
 * lib/notification-bucket via @splat-connect/types for the mapping.
 *
 * Renders nothing. The badge this clears is on /dashboard, not here.
 *
 * The accepted consequence: opening /dashboard/tutorials also marks those rows
 * read in /notifications. That is the decision recorded in the spec — the badge
 * counts what you have not seen, and you have now seen it.
 */
'use client'

import { useEffect, useRef } from 'react'
import { browserApiClient } from '@/lib/browser-api-client'
import type { NotificationBucket } from '@splat-connect/types'

export function MarkNotificationsRead({ bucket }: { bucket: NotificationBucket }) {
  // StrictMode mounts twice in development and any remount re-runs the effect.
  // The endpoint is idempotent, so this is about not making the request twice
  // rather than about correctness.
  const sent = useRef(false)

  useEffect(() => {
    if (sent.current) return
    sent.current = true
    // Swallowed: the page loaded fine, and a badge that lingers one more visit
    // is not worth an error state.
    browserApiClient.post('/api/notifications/me/read', { bucket }).catch(() => {})
  }, [bucket])

  return null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @splat-connect/web test:unit -- mark-notifications-read`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/components/mark-notifications-read.tsx packages/web/tests/unit/components/mark-notifications-read.test.tsx
git commit -m "feat(web): clear a card's badge when its destination opens"
```

---

### Task 8: Exchanges splits into active and history

**Files:**
- Modify: `packages/web/app/dashboard/exchanges/page.tsx`
- Test: `packages/web/tests/unit/pages/dashboard-exchanges.test.tsx` (**extend the existing file — do not create a new one**; reuse its mock setup rather than adding a second)

**Interfaces:**
- Consumes: `<MarkNotificationsRead />` (Task 7).
- Produces: nothing downstream.

"Exchange history" is the one tag in Task 6 that names something that does not exist: the page renders one flat list at every status. No API change — `ToyTransactionSummary.status` already carries what is needed. `requested` and `accepted` are active; `completed`, `rejected` and `withdrawn` are history.

- [ ] **Step 1: Write the failing test**

Read `packages/web/tests/unit/pages/dashboard-exchanges.test.tsx` first and reuse its existing mocks and fixtures. Add these cases to it — the helpers below are a reference for what to assert, not a new file to create:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ToyTransactionSummary } from '@splat-connect/types'

const caps = vi.hoisted(() => ({ current: null as unknown }))
const get = vi.hoisted(() => vi.fn())

vi.mock('@/lib/capabilities', () => ({ getCapabilities: async () => caps.current }))
vi.mock('@/lib/api-client', () => ({ apiClient: { get } }))
vi.mock('next/navigation', () => ({ redirect: vi.fn(), usePathname: () => '/dashboard/exchanges' }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...p}>{children}</a>
  ),
}))
// The empty state's "Browse the toy library" button crosses the account
// boundary, so this page pulls in BoundaryLink as well as next/link.
vi.mock('@/components/boundary-link', () => ({
  BoundaryLink: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...p}>{children}</a>
  ),
}))
vi.mock('@/components/mark-notifications-read', () => ({
  MarkNotificationsRead: () => null,
}))

const { default: ExchangesPage } = await import('@/app/dashboard/exchanges/page')

function tx(over: Partial<ToyTransactionSummary>): ToyTransactionSummary {
  return {
    id: 'tx-1',
    toy_name: 'Bubble machine',
    type: 'exchange',
    status: 'requested',
    other_party_name: 'Sam',
    requester_id: 'them',
    owner_id: 'u1',
    owner_org_id: null,
    acting_for_org_name: null,
    blocked_by_rival_accept: false,
    last_message: null,
    ...over,
  } as ToyTransactionSummary
}

beforeEach(() => {
  vi.clearAllMocks()
  caps.current = { profile: { id: 'u1' }, ledOrgs: [] }
})

describe('exchanges active/history split', () => {
  it('puts requested and accepted under active', async () => {
    get.mockResolvedValue([
      tx({ id: 'a', toy_name: 'Requested toy', status: 'requested' }),
      tx({ id: 'b', toy_name: 'Accepted toy', status: 'accepted' }),
    ])
    render(await ExchangesPage())

    expect(screen.getByRole('heading', { name: /active/i })).toBeInTheDocument()
    expect(screen.getByText('Requested toy')).toBeInTheDocument()
    expect(screen.getByText('Accepted toy')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /history/i })).not.toBeInTheDocument()
  })

  it('puts completed, rejected and withdrawn under history', async () => {
    get.mockResolvedValue([
      tx({ id: 'c', toy_name: 'Done toy', status: 'completed' }),
      tx({ id: 'd', toy_name: 'Refused toy', status: 'rejected' }),
      tx({ id: 'e', toy_name: 'Pulled toy', status: 'withdrawn' }),
    ])
    render(await ExchangesPage())

    expect(screen.getByRole('heading', { name: /history/i })).toBeInTheDocument()
    expect(screen.getByText('Done toy')).toBeInTheDocument()
    expect(screen.getByText('Refused toy')).toBeInTheDocument()
    expect(screen.getByText('Pulled toy')).toBeInTheDocument()
  })

  /* A section heading over nothing reads as "you have none of these", which is
     wrong when the other section is full. Show a heading only when it has rows. */
  it('shows neither heading when there is nothing at all', async () => {
    get.mockResolvedValue([])
    render(await ExchangesPage())
    expect(screen.queryByRole('heading', { name: /active/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /history/i })).not.toBeInTheDocument()
    expect(screen.getByText(/no donation or exchange requests yet/i)).toBeInTheDocument()
  })

  it('shows both when both have rows', async () => {
    get.mockResolvedValue([
      tx({ id: 'a', toy_name: 'Live toy', status: 'accepted' }),
      tx({ id: 'c', toy_name: 'Done toy', status: 'completed' }),
    ])
    render(await ExchangesPage())
    expect(screen.getByRole('heading', { name: /active/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /history/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @splat-connect/web test:unit -- dashboard-exchanges
Expected: FAIL — no `Active` or `History` heading exists; one flat `<ul>` renders every row.

- [ ] **Step 3: Write minimal implementation**

In `packages/web/app/dashboard/exchanges/page.tsx`:

Add the imports:

```tsx
import { MarkNotificationsRead } from '@/components/mark-notifications-read'
import type { ToyTransactionSummary, ToyTransactionStatus } from '@splat-connect/types'
```

After `const transactions = await apiClient.get<ToyTransactionSummary[]>('/api/toy-transactions')`:

```tsx
  /*
   * Two lists, one fetch. "Exchange history" is named on the My SPLAT card, and
   * until now this page rendered every status in one pile — a handoff you
   * confirmed last March sat between two requests waiting on you today.
   *
   * Active is the pair that can still change: a request you have not answered,
   * and an acceptance nobody has confirmed. Everything else is settled.
   */
  const ACTIVE: ToyTransactionStatus[] = ['requested', 'accepted']
  const active = transactions.filter((tx) => ACTIVE.includes(tx.status))
  const history = transactions.filter((tx) => !ACTIVE.includes(tx.status))
```

Extract the existing row — **lines 47–100 inclusive**, the `<li key={tx.id}>` through its closing `</li>` — into a local component above the default export, so the two lists share one row rather than duplicating fifty lines of JSX. Move those lines verbatim; the only edits are the wrapper and dropping `key` (the caller sets it now):

```tsx
function TransactionRow({
  tx,
  viewerId,
  ledOrgIds,
}: {
  tx: ToyTransactionSummary
  viewerId: string
  ledOrgIds: string[]
}) {
  return (
    <li>
      {/* Lines 47–100 of the current file, from <Link href={`/dashboard/exchanges/${tx.id}`}>
          through its closing </Link>. Nothing inside changes: it already reads
          only tx, viewerId and ledOrgIds, which are now props. */}
    </li>
  )
}
```

`viewerId` and `ledOrgIds` were closure variables in the page body and become props — that is the whole reason this extraction is safe to do mechanically.

Then replace the single `<ul>` with the two sections, keeping the existing empty state for the case where both are empty:

```tsx
      <MarkNotificationsRead bucket="exchanges" />

      {transactions.length === 0 ? (
        /* Lines 32–44 of the current file, unchanged — the dashed empty state
           with the Handshake icon and the "Browse the toy library" button. It
           still covers both lists being empty, which is the only case it ever
           meant. */
      ) : (
        <>
          {active.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-bold text-ink">Active</h2>
              <ul className="flex flex-col gap-3">
                {active.map((tx) => (
                  <TransactionRow key={tx.id} tx={tx} viewerId={viewerId} ledOrgIds={ledOrgIds} />
                ))}
              </ul>
            </section>
          )}

          {history.length > 0 && (
            <section className={active.length > 0 ? 'mt-10' : undefined}>
              <h2 className="mb-3 text-lg font-bold text-ink">History</h2>
              <ul className="flex flex-col gap-3">
                {history.map((tx) => (
                  <TransactionRow key={tx.id} tx={tx} viewerId={viewerId} ledOrgIds={ledOrgIds} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
```

Update the page's `<h1>` to `My exchanges` to match the nav label from Task 5.

**Also `packages/web/app/dashboard/exchanges/[id]/page.tsx:74`** — the transaction detail page's back-link reads `← Exchanges`. Task 5 deliberately left it, because it belongs to this file's family rather than the nav model, and no other task names it. Change it to `← My exchanges`. It is the label a reader sees immediately after clicking through from a card that said "My exchanges", so leaving it is the one drift a user would actually notice.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @splat-connect/web test:unit -- dashboard-exchanges
Expected: PASS (4 tests)

Then: `pnpm --filter @splat-connect/web test:unit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/app/dashboard/exchanges/page.tsx packages/web/tests/unit/pages/dashboard-exchanges.test.tsx
git commit -m "feat(web): exchanges splits active from history, as the card promises"
```

---

### Task 9: The two library buttons

**Files:**
- Modify: `packages/web/app/dashboard/tutorials/page.tsx:31-40` (the header block)
- Modify: `packages/web/app/dashboard/toys/page.tsx:24-34` (the header block)
- Modify: `packages/web/app/dashboard/challenges/page.tsx` (the header block)
- Test: `packages/web/tests/unit/pages/dashboard-tutorials.test.tsx`, `.../dashboard-toys-list.test.tsx`, `.../dashboard-challenges.test.tsx` (**extend all three existing files — create none**)

**Interfaces:**
- Consumes: `<MarkNotificationsRead />` (Task 7).
- Produces: nothing downstream.

**Scope limit — read this before starting.** The spec's destination-page work is three buttons per page. Only *Browse* ships here. `Saved tutorials`, `Saved toys` and `Saved challenges` are blocked on the `saves` subsystem, which has no spec and no table. Do not add a button that leads nowhere; do not scaffold a `soon` page to hold it. The card tags naming them are text and are already correct.

Both pages use `BoundaryLink` for hrefs that cross out of the account section — `/library` and `/toy-library` are public, so they cross.

- [ ] **Step 1: Write the failing test**

Read each of the three existing page tests first and reuse their mocks. Add the cases below to the matching file — this block is a reference for what to assert, not a new file to create:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const get = vi.hoisted(() => vi.fn())
vi.mock('@/lib/api-client', () => ({ apiClient: { get } }))
vi.mock('@/lib/capabilities', () => ({
  getCapabilities: async () => ({ profile: { id: 'u1' }, ledOrgs: [] }),
}))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('next/link', () => ({
  default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...p}>{children}</a>
  ),
}))
vi.mock('@/components/boundary-link', () => ({
  BoundaryLink: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...p}>{children}</a>
  ),
}))
vi.mock('@/components/mark-notifications-read', () => ({
  MarkNotificationsRead: () => null,
}))

const { default: TutorialsPage } = await import('@/app/dashboard/tutorials/page')
const { default: ToysPage } = await import('@/app/dashboard/toys/page')

beforeEach(() => vi.clearAllMocks())

describe('destination page buttons', () => {
  it('gives My tutorials a way into the public library', async () => {
    get.mockResolvedValue([])
    render(await TutorialsPage())
    expect(screen.getByRole('link', { name: /browse the library/i })).toHaveAttribute(
      'href',
      '/library'
    )
  })

  it('keeps the primary action on My tutorials', async () => {
    get.mockResolvedValue([])
    render(await TutorialsPage())
    expect(screen.getByRole('link', { name: /new tutorial/i })).toHaveAttribute('href', '/upload')
  })

  it('gives My toys a way into the toy library', async () => {
    get.mockResolvedValue([])
    render(await ToysPage())
    expect(screen.getByRole('link', { name: /browse toy library/i })).toHaveAttribute(
      'href',
      '/toy-library'
    )
  })

  /* Blocked on the saves subsystem, which has no spec. A button that leads
     nowhere is worse than an absent one, and the card tag naming it is text. */
  it('ships no Saved button yet', async () => {
    get.mockResolvedValue([])
    render(await TutorialsPage())
    expect(screen.queryByRole('link', { name: /saved/i })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @splat-connect/web test:unit -- dashboard-tutorials dashboard-toys-list dashboard-challenges`
Expected: FAIL — neither Browse link exists.

- [ ] **Step 3: Write minimal implementation**

In `packages/web/app/dashboard/tutorials/page.tsx`, add the import and replace the single-button header:

```tsx
import { MarkNotificationsRead } from '@/components/mark-notifications-read'
```

```tsx
      <MarkNotificationsRead bucket="tutorials" />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">My tutorials</h1>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
            Your adaptation guides. Each one is reviewed — by an organisation you ask, or by
            SPLAT — before it reaches the library.
          </p>
        </div>
        {/* The My SPLAT card promises three things here. Two of them exist;
            "Saved tutorials" waits on the saves subsystem, and an absent button
            beats one that leads nowhere. */}
        <div className="flex flex-wrap gap-3">
          <BoundaryLink href="/upload" className="btn btn-accent">
            + New tutorial
          </BoundaryLink>
          <BoundaryLink href="/library" className="btn btn-quiet">
            Browse the library
          </BoundaryLink>
        </div>
      </div>
```

In `packages/web/app/dashboard/toys/page.tsx`, add the `BoundaryLink` import if it is not already there and make the same change:

```tsx
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/toys/new" className="btn btn-accent">
            + Add a toy
          </Link>
          <BoundaryLink href="/toy-library" className="btn btn-quiet">
            Browse toy library
          </BoundaryLink>
        </div>
```

`btn-quiet` is the existing secondary treatment — white, `--color-line` border, brand-deep text — so nothing new enters `globals.css`.

No `MarkNotificationsRead` on the toys page: there is no `toys` bucket, because every `toy_*` notification belongs to My exchanges.

**`packages/web/app/dashboard/challenges/page.tsx` — the load-bearing one.**

Today this page links to the idea form **only from its empty state** (`:124`, inside the `mine.items.length === 0` branch). Submit one idea and the link vanishes. That was survivable while the hub carried its own `Submit an idea` card; Task 6 removes that card, so without this change the idea form becomes unreachable from inside the account area for anyone who has already submitted one — re-opening the exact bug the hub card was added to fix.

Give the page a header with a persistent button, matching the two pages above:

```tsx
      <MarkNotificationsRead bucket="challenges" />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">Design challenges</h1>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted">
            Ideas you have put forward, and challenges you have joined as a maker.
          </p>
        </div>
        {/* Persistent, not empty-state-only. The My SPLAT card names this as
            what is behind the Design challenges tile, and the tile itself is
            text — this button is the only way through. */}
        <BoundaryLink href="/get-involved/submit-an-idea" className="btn btn-accent">
          + Submit an idea
        </BoundaryLink>
      </div>
```

Keep the existing empty-state button. It sits inside a different branch, speaks to a different moment, and removing it would leave the empty state without a call to action.

Match the existing heading markup on that page rather than pasting the block above verbatim if it already has an `<h1>` — the requirement is a persistent header button, not a specific wrapper.

Add to `packages/web/tests/unit/pages/dashboard-challenges.test.tsx`, reusing its existing mocks:

```tsx
  /*
   * The hub's Design challenges card names "Submit an idea" as one of the
   * things behind it, and that tag is text, not a link. This button is the
   * only route to the idea form from inside the account area — and it has to
   * survive having ideas already, which the empty-state button does not.
   */
  it('offers the idea form even when ideas already exist', async () => {
    // …mock GET /api/ideas/mine to return one idea, per this file's existing style…
    render(await ChallengesPage())
    expect(screen.getByRole('link', { name: /Submit an idea/ })).toHaveAttribute(
      'href',
      '/get-involved/submit-an-idea'
    )
  })
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @splat-connect/web test:unit -- dashboard-tutorials dashboard-toys-list dashboard-challenges`
Expected: PASS (4 tests)

Then the full suite and a typecheck: `pnpm --filter @splat-connect/web test:unit && pnpm typecheck`
Expected: PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add packages/web/app/dashboard/tutorials/page.tsx packages/web/app/dashboard/toys/page.tsx packages/web/app/dashboard/challenges/page.tsx packages/web/tests/unit/pages/dashboard-tutorials.test.tsx packages/web/tests/unit/pages/dashboard-toys-list.test.tsx packages/web/tests/unit/pages/dashboard-challenges.test.tsx
git commit -m "feat(web): destination pages get the browse links their card names"
```

---

## After the plan

Run `graphify update .` to keep the knowledge graph current, per `CLAUDE.md`.

Check the built page before shortening any copy: "Add a toy you want to donate or exchange" is 38 characters in a ~300px card and will wrap to two lines, which sets the height of the whole row.

Two things the spec flags as judgement calls to make on the built page, not in review:

1. **The tint wall.** Seven brand-tint cards in one grid is a knowing exception to the 27 Aug page-template spec's "no grid renders more than four cards". If it reads as monotony, the remedy is two `HubGrid` calls with headings — the pattern five other hub pages already use.
2. **Tags that look pressable.** They carry no border and no shadow for exactly this reason. If they still read as controls in a browser, the fallback is chevron-led plain text, which is a change to one `className` in `hub-grid.tsx`.

Still unspecced and gating the three "Saved" buttons: the `saves` subsystem — table, RLS, `/api/saves`, a save control on `/library` and `/toy-library`, and a list page per type, across all five savable entity types. It needs its own brainstorm before it gets a plan.
