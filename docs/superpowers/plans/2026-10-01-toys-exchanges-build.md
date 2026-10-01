# Toys + Exchanges Build (Sub-project 4, Batch 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the 11 toys-and-exchanges items in `packages/types/src/pending.ts` (condition words, holder location, exchange toy photo, handover code actions, my-toy summary, pause, inline requests, retired, holder picks, money panel detail, build-thread cost panel) and ship each one out of the registry.

**Architecture:** One task per registry item, except `toy-holder-picks`, which is two (data + API, then apps), shipping in the second. Three slices add a migration (100 paused, 101 retired, 102 picks). The API checks every limit with a hand-written validator that answers 400 with a plain sentence (the API has no zod), and the database repeats the limit as a CHECK. Shared pure logic goes in `packages/types` (`gradeOf`, `autoPicks`); mobile-only logic in `packages/mobile/lib/my-toy.ts`. One mobile `CostPanel` serves the exchange thread (read-only) and the build thread (maker edits, family settles).

**Tech Stack:** Hono + supabase-js + vitest (api), Next.js App Router + vitest (web), Expo SDK 57 / Expo Router / React Native + jest + RNTL (mobile), Postgres migrations via the Supabase CLI.

**Spec:** `docs/superpowers/specs/2026-10-01-toys-exchanges-build-design.md` (inherits "Rules every slice keeps" from `docs/superpowers/specs/2026-10-01-guides-build-design.md`).

**Order note:** the spec's slice 2 order is pause → summary → inline. This plan builds the summary first (Task 5), with "Mark unavailable" as a `PendingRow`, so the pause task (Task 6) puts its real control straight onto the summary instead of building it in the editor and moving it a task later.

## Global Constraints

- **One migration per slice, numbered from 100** (batch 1 owns 085–093, batch 2 owns 094–099): `100_toy_paused.sql`, `101_toy_retired.sql`, `102_toy_picks.sql`. Each has a `-- DOWN:` block like 068/074. Each migration's test selects its new objects through the admin client, so a repaired-not-run migration fails loudly; 102's RLS also gets a row in `scripts/check-schema-guards.sh`. No notification type is added by this batch, so 093's notifications check is not touched.
- **Limits are checked twice:** the API returns 400 with a plain sentence; a CHECK in the database backs it (`retired_note` ≤ 80, `picks_mode` in ('auto','picked'), `toy_picks.position` 1–3, `entity_type` in ('toy','tutorial')).
- **No counter columns.** "{n} families have asked for it" counts rows from `GET /api/toy-transactions`; nothing is stored. A transaction's extra stages stay timestamps (memory: toy_transactions is polymorphic). The API is the only writer of `toy_transactions` (026 has no client INSERT/UPDATE).
- **Handover codes stay 6 random digits from `generateCode()`.** The board's 4-character code is not adopted. Each side only ever receives its own code (`sanitizeCodes`).
- **Never the street or postcode.** `holder_suburb`/`holder_state` are an org's public `suburb`/`state` (059) or a person's `pickup_suburb`/`pickup_state` read with the admin client. No `pickup_line1`/`pickup_postcode` leaves the API on a public read.
- **Names come from the admin client** in any new read (memory: PostgREST embeds fail silently under 033/045 grants). The existing `profiles(name)` / `organizations(name)` embeds in `GET /api/toy-transactions` and `/api/public/toys` stay as they are.
- **Shipping an item:** delete every `PENDING(<id>)` / `pending="<id>"` reference, set `shipped: true` on the entry (never delete it — `pending-registry.test.ts` counts the entries), run `node scripts/pending.mjs`, delete any `explained` rule in `scripts/parity/app-screen-map.json` / `screen-map.json` whose `pending` is the id (drop the `explained` key if it empties), and run the drift test. The commit that flips `shipped` contains that item only. The drift test also fails if an **open** item loses its last reference, so never delete another item's marker early.
- **Mobile is a second consumer of every column.** On each column change run `grep -rn "<column>" packages/mobile`. `paused_at`, `retired_at`, `retired_note`, `picks_mode` all reach mobile in this batch.
- **Copy is quoted from the boards** (`Splat Connect frontend overhaul/SPLAT Connect - Mobile.dc.html` = MB, `SPLAT Connect - Web.dc.html` = WB, `CostPanel.dc.html` = CP). Where no board draws the thing, the spec's or registry's own words are used and nothing else. Every string a task introduces is listed in that task with its source. Strings with no board source, flagged for Byron: "Take requests again", "Retire", "Why it is retired", "Automatic", "Hand-picked", "Save picks".
- **Mobile dates** use `toLocaleDateString('en-AU', …)` like `job-screen.tsx`, not `shortDate` (Hermes; memory: mobile Hermes runtime parity).
- **`expo-clipboard` is a native module.** After installing it, the gitignored `packages/mobile/ios` dir must be regenerated (`npx expo prebuild -p ios`) before an iOS dev build, or the app crashes on launch (memory: stale iOS prebuild dir). Android rebuilds on its own.
- **Web e2e specs import only from `tests/e2e/helpers.ts` / `lib/`,** never a component. Never run web and mobile e2e at the same time.
- **Batches 1 and 2 are being built at the same time.** Before editing any file, re-read it; anchor every edit on the code quoted in the step, never on a line number. Files more than one batch touches: `packages/types/src/index.ts`, `packages/types/src/pending.ts`, `docs/PENDING.md`, `packages/api/src/routes/toy-transactions.ts` (batch 1 widens the `tutorial:tutorials(...)` embeds; batch 2 adds print routes), `packages/api/src/routes/public.ts` (batch 2 adds distance to `/toys`), `packages/mobile/components/toys/toy-library-screen.tsx` (batch 2 replaces the "Nearest first" chip), `scripts/check-schema-guards.sh`, `scripts/parity/app-screen-map.json`. In `pending.ts` flip only this batch's entries.
- **Stage only this task's files.** The tree holds unrelated changes (`CLAUDE.md` modified; `packages/web/zz3_57656.mjs` and `selfIdentity.plist` untracked) plus other batches' work in progress: list files by name in every `git add`, run `git status --short` first, and `git restore --staged` anything that is not the task's.
- Commit messages end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV
  ```

## Review Focus

1. **A toy changes hands carrying the old holder's settings.** An exchange moves the offered toy, and a person's toy moves to its receiver, through `transferToy` in the confirm handler. A paused offered toy must arrive un-paused, and a toy with hand-picked "Also worth a look" must arrive in auto mode with no picks pointing at the previous holder's shelf. Pinned by Task 6's and Task 9's confirm tests.
2. **A handover code regenerated at the wrong moment.** New code after the other side has already typed yours in, on a request not yet accepted, by an outsider, or one that touches the other side's code. Expected: 409 / 409 / 404, and the counterparty's code is never changed and never returned. Pinned by Task 4's integration test.
3. **Money rows that mislead.** A thread whose lines are all "Covering it" (no row — it is $0 to everyone), a thread with lines in both directions (no netting), a settled thread ("Settled", and "All settled — nothing outstanding." when nothing is left), and an outsider (nothing). Pinned by Task 11's integration and unit tests.
4. **Location that leaks or reads broken.** A holder with no suburb set must render nothing — not "Held by Jamie · " — and no public read may carry a street or postcode. Pinned by Task 2's integration test (the JSON never contains the street or postcode) and mobile test.
5. **A pick that stops being public, or was never the holder's to make.** A picked toy later unpublished or retired, a guide sent back to review, and a crafted PUT naming another holder's toy or the toy itself. Expected: dropped from the public read; 400 on the PUT. Pinned by Task 9's integration test.

## Files

New:
- `packages/types/src/toy-grade.ts` — `GradeKey`, `Grade`, `GRADES`, `gradeOf`.
- `packages/types/src/toy-picks.ts` — `PicksMode`, `ToyPickInput`, `ToyPick`, `PICK_KIND_LABEL`, `autoPicks`.
- `packages/web/tests/unit/lib/toy-grade.test.ts`, `packages/web/tests/unit/lib/toy-picks.test.ts`.
- `supabase/migrations/100_toy_paused.sql`, `101_toy_retired.sql`, `102_toy_picks.sql`.
- `packages/api/tests/integration/toys/{holder-location,paused,retired,picks}.test.ts`, `packages/api/tests/integration/toy-transactions/{toy-photo,new-code}.test.ts`, `packages/api/tests/integration/exchange-costs/mine.test.ts`.
- `packages/mobile/lib/my-toy.ts` (+ `tests/unit/lib/my-toy.test.ts`) — `loadOwnedToy`, `toySummaryLead`.
- `packages/mobile/components/my-toys/summary-screen.tsx` (+ test), `packages/mobile/components/my-toys/picks-editor.tsx` (+ test), `packages/mobile/components/exchanges/cost-panel.tsx` (+ test), `packages/mobile/tests/unit/components/builds/build-thread-screen.test.tsx`.
- `packages/mobile/app/(my)/toys/[id]/index.tsx`, `packages/mobile/app/(my)/toys/[id]/edit.tsx`.
- `packages/web/components/toy-picks.tsx`, `packages/web/components/toy-picks-editor.tsx` (+ tests).

Deleted: `packages/mobile/app/(my)/toys/[id].tsx` (becomes `[id]/edit.tsx`).

## Commands used throughout

- Apply new migrations locally (needs `supabase start`): `supabase migration up`
- API integration: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts <file>`
- API unit: `pnpm --filter @splat-connect/api exec vitest run <file>`
- Drift test: `pnpm --filter @splat-connect/api exec vitest run tests/unit/pending-features.test.ts tests/unit/pending-registry.test.ts` → `Tests  11 passed (11)`
- Regenerate the registry doc: `node scripts/pending.mjs` → `wrote docs/PENDING.md (N items)`
- Web unit: `pnpm --filter @splat-connect/web exec vitest run <file>`
- Mobile unit: `pnpm --filter @splat-connect/mobile exec jest <file>`
- Typecheck: `pnpm typecheck`

---

### Task 1: Condition in words (`toy-condition-words`)

**Files:**
- Create: `packages/types/src/toy-grade.ts`
- Modify: `packages/types/src/index.ts` (named re-export)
- Modify: `packages/web/lib/toy-grade.ts` (keeps only the tints; the grade comes from types)
- Modify: `packages/mobile/components/toys/toy-detail-screen.tsx` (pill), `packages/mobile/components/organisation/inventory-screen.tsx` (row meta), `packages/mobile/components/toys/toy-library-screen.tsx` (card grade + filter chips)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/web/tests/unit/lib/toy-grade.test.ts` (new); `packages/mobile/tests/unit/components/toys/toy-detail-screen.test.tsx`, `.../organisation/inventory-screen.test.tsx`, `.../toys/toy-library-screen.test.tsx`, `packages/mobile/tests/e2e/toy-library.spec.ts` (updated)

**Interfaces:**
- Consumes: nothing.
- Produces: from `@splat-connect/types`: `type GradeKey = 'like-new' | 'good' | 'well-loved' | 'needs-fix'`, `interface Grade { key: GradeKey; label: string; min: number }`, `GRADES: readonly Grade[]` (best first), `gradeOf(condition: number): Grade`. Web's `@/lib/toy-grade` keeps exporting `gradeOf` (now `Grade & { tint: string }`) and `GradeKey`, so its seven callers do not change. Tasks 5, 8 and 9 use `gradeOf` from types.

Copy: "{grade} condition" (MB: "Good condition"); grade labels "Like new", "Good", "Well-loved", "Needs a fix" (MB `GRADE()`).

- [ ] **Step 1: Write the failing tests**

`packages/web/tests/unit/lib/toy-grade.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { gradeOf, GRADES } from '@splat-connect/types'
import { gradeOf as webGrade } from '@/lib/toy-grade'

describe('gradeOf', () => {
  it('cuts the 1–10 scale where the board does', () => {
    expect([10, 9, 8, 7, 6, 5, 4, 1].map((c) => gradeOf(c).label)).toEqual([
      'Like new', 'Like new', 'Good', 'Good', 'Well-loved', 'Well-loved', 'Needs a fix', 'Needs a fix',
    ])
  })
  it('lists the four grades best first, for filter chips', () => {
    expect(GRADES.map((g) => g.key)).toEqual(['like-new', 'good', 'well-loved', 'needs-fix'])
  })
  it('gives web the same word with its tint', () => {
    expect(webGrade(8)).toEqual({ key: 'good', label: 'Good', min: 7, tint: 'var(--tmint)' })
  })
})
```

In `packages/mobile/tests/unit/components/toys/toy-detail-screen.test.tsx`, replace the assertion `expect(screen.getByText('Condition 7 / 10')).toBeTruthy()` in "shows the offer, condition and switch-adapted pills" with:

```tsx
    expect(screen.getByText('Good condition')).toBeTruthy()
    expect(screen.queryByText('Condition 7 / 10')).toBeNull()
```

In `packages/mobile/tests/unit/components/organisation/inventory-screen.test.tsx`, "lists the stock with quantity and status": replace `expect(screen.getByText(/^5 in stock · Condition/)).toBeTruthy()` with (the `stock()` fixture's condition is 8):

```tsx
    expect(screen.getByText('5 in stock · Good')).toBeTruthy()
```

In `packages/mobile/tests/unit/components/toys/toy-library-screen.test.tsx`:
- In the test that says `// Words, never a score: 8 is "Good", 5 is "Well-loved".`, the four grade words are now also filter chips, so each word appears twice (chip + card). Replace its two `getByText` lines with:

```tsx
    expect(screen.getAllByText('Good', { includeHiddenElements: true })).toHaveLength(2)
    expect(screen.getAllByText('Well-loved', { includeHiddenElements: true })).toHaveLength(2)
```

- Replace the whole `it('filters by condition bucket', …)` with:

```tsx
  it('filters by the four condition grades', async () => {
    mockGet.mockResolvedValue([
      toy({ id: 't1', name: 'Good toy', condition: 8 }),
      toy({ id: 't2', name: 'Worn toy', condition: 2 }),
    ])
    render(<ToyLibraryScreen />)
    await screen.findByText('Good toy')
    fireEvent.press(screen.getByRole('button', { name: 'Needs a fix' }))
    expect(screen.queryByText('Good toy')).toBeNull()
    expect(screen.getByText('Worn toy')).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Good' }))
    expect(screen.getByText('Good toy')).toBeTruthy()
    expect(screen.queryByText('Worn toy')).toBeNull()
  })
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/lib/toy-grade.test.ts`
Expected: FAIL — `gradeOf` is not exported from `@splat-connect/types`.
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/toys tests/unit/components/organisation/inventory-screen.test.tsx`
Expected: FAIL — `Unable to find an element with text: Good condition`, `5 in stock · Good`, and no button named `Needs a fix`.

- [ ] **Step 3: Implement**

`packages/types/src/toy-grade.ts`:

```ts
/**
 * A toy's condition as the word a parent wants, never a number to interpret.
 * The board's GRADE() over 021's 1–10 `condition` column. One list for web and
 * mobile, so a card's pill and the filter that found it never say different
 * words.
 */
export type GradeKey = 'like-new' | 'good' | 'well-loved' | 'needs-fix'

export interface Grade {
  key: GradeKey
  label: string
  /** The lowest condition that earns this grade. */
  min: number
}

const NEEDS_FIX: Grade = { key: 'needs-fix', label: 'Needs a fix', min: 0 }

/** Best first, so the first match is the grade. */
export const GRADES: readonly Grade[] = [
  { key: 'like-new', label: 'Like new', min: 9 },
  { key: 'good', label: 'Good', min: 7 },
  { key: 'well-loved', label: 'Well-loved', min: 5 },
  NEEDS_FIX,
]

export function gradeOf(condition: number): Grade {
  return GRADES.find((g) => condition >= g.min) ?? NEEDS_FIX
}
```

`packages/types/src/index.ts` — beside the other named re-exports near the top (named, not `export *`: the api loads this package as CommonJS, see the comment above `contributorBadges`):

```ts
export { gradeOf, GRADES } from './toy-grade'
export type { Grade, GradeKey } from './toy-grade'
```

`packages/web/lib/toy-grade.ts` — replace the whole file:

```ts
/**
 * The grade (packages/types/src/toy-grade.ts) with web's tint for its pill.
 * The words and cut points live in types so mobile says the same thing.
 */
import { gradeOf as baseGrade, type Grade as BaseGrade, type GradeKey } from '@splat-connect/types'

export type { GradeKey }

export interface Grade extends BaseGrade {
  tint: string
}

const TINT: Record<GradeKey, string> = {
  'like-new': 'var(--tok)',
  good: 'var(--tmint)',
  'well-loved': 'var(--tamber)',
  'needs-fix': 'var(--tcoral)',
}

export function gradeOf(condition: number): Grade {
  const g = baseGrade(condition)
  return { ...g, tint: TINT[g.key] }
}
```

`toy-detail-screen.tsx`:
- Import: `import { gradeOf, toyFacts, type OfferType, type Toy, type ToyDetail } from '@splat-connect/types'`.
- Replace

```tsx
        {/* PENDING(toy-condition-words): "Good condition", not "Condition 7 / 10". */}
        <Pill variant="large" icon="checkmark-circle-outline" label={`Condition ${toy.condition} / 10`} bg={theme.colors.tone.mint.bg} fg={theme.colors.tone.mint.fg} />
```

with

```tsx
        <Pill variant="large" icon="checkmark-circle-outline" label={`${gradeOf(toy.condition).label} condition`} bg={theme.colors.tone.mint.bg} fg={theme.colors.tone.mint.fg} />
```

`inventory-screen.tsx`:
- Import: `import { gradeOf, type ToyWithOwner } from '@splat-connect/types'` (replacing the type-only import).
- In `StockRow`, replace the `meta` prop with

```tsx
        meta={`${toy.quantity} in stock · ${gradeOf(toy.condition).label}${toy.switch_adapted ? ' · Switch-adapted' : ''}`}
```

`toy-library-screen.tsx`:
- Import: add `gradeOf, GRADES, type GradeKey` to the `@splat-connect/types` value import (`import { gradeOf, GRADES, toyHolderName, type GradeKey } from '@splat-connect/types'`).
- Delete `type ConditionBucket`, `CONDITIONS`, `matchesCondition` and the old `conditionGrade` (with its doc comment and the "same buckets as web" comment), and add:

```tsx
/** The board's grade look: one icon and tint per word. The words are types'. */
const GRADE_LOOK: Record<GradeKey, { icon: IconName; bg: string }> = {
  'like-new': { icon: 'sparkles-outline', bg: theme.colors.successSoft },
  good: { icon: 'checkmark-circle-outline', bg: theme.colors.mintSoft },
  'well-loved': { icon: 'heart-outline', bg: theme.colors.honeySoft },
  'needs-fix': { icon: 'build-outline', bg: theme.colors.apricotSoft },
}

function conditionGrade(c: number): { label: string; icon: IconName; bg: string } {
  const g = gradeOf(c)
  return { label: g.label, ...GRADE_LOOK[g.key] }
}
```

- State: `const [condition, setCondition] = useState<GradeKey | null>(null)`.
- In `visible`'s filter replace `matchesCondition(t.condition, condition) &&` with `(!condition || gradeOf(t.condition).key === condition) &&`.
- Replace the `CONDITIONS.map((c) => (…))` chip block with

```tsx
              {GRADES.map((g) => (
                <Chip
                  key={g.key}
                  variant="filter"
                  label={g.label}
                  active={condition === g.key}
                  onPress={() => setCondition((cur) => (cur === g.key ? null : g.key))}
                />
              ))}
```

`packages/mobile/tests/e2e/toy-library.spec.ts` — the condition-filter test seeds conditions 9 (`good`, now "Like new") and 2 (`wellLoved`, now "Needs a fix"). Replace its three `pickFilter` blocks (from `await pickFilter(page, 'Good (7–10)')` to the `Fair (4–6)` block's last `expect`) with:

```ts
  await pickFilter(page, 'Like new')
  await expect(page.getByText(good)).toBeVisible()
  await expect(page.getByText(wellLoved)).toHaveCount(0)

  await pickFilter(page, 'Needs a fix')
  await expect(page.getByText(wellLoved)).toBeVisible()
  await expect(page.getByText(good)).toHaveCount(0)

  // Good sits between the two, so it proves the cut points exclude as well as include.
  await pickFilter(page, 'Good')
  await expect(page.getByText(good)).toHaveCount(0)
  await expect(page.getByText(wellLoved)).toHaveCount(0)
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/lib/toy-grade.test.ts tests/unit/components/toy-library-card.test.tsx`
Expected: PASS.
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/toys tests/unit/components/organisation/inventory-screen.test.tsx`
Expected: PASS.
Run: `pnpm typecheck` → exit 0.

- [ ] **Step 5: Ship the item** — `shipped: true,` on `'toy-condition-words'`; `node scripts/pending.mjs`; no parity rule names this id; run the drift test → `Tests  11 passed (11)`.

- [ ] **Step 6: Commit**

```bash
git add packages/types/src/toy-grade.ts packages/types/src/index.ts packages/web/lib/toy-grade.ts packages/web/tests/unit/lib/toy-grade.test.ts packages/mobile/components/toys/toy-detail-screen.tsx packages/mobile/components/organisation/inventory-screen.tsx packages/mobile/components/toys/toy-library-screen.tsx packages/mobile/tests/unit/components/toys/toy-detail-screen.test.tsx packages/mobile/tests/unit/components/organisation/inventory-screen.test.tsx packages/mobile/tests/unit/components/toys/toy-library-screen.test.tsx packages/mobile/tests/e2e/toy-library.spec.ts packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(toys): condition in words on every surface, one grade list in types

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 2: Where the toy is (`toy-holder-location`)

**Files:**
- Modify: `packages/api/src/routes/public.ts` (`GET /toys/:id`)
- Modify: `packages/types/src/index.ts` (`ToyDetail.holder_suburb`, `holder_state`)
- Modify: `packages/mobile/components/toys/toy-detail-screen.tsx`
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/api/tests/integration/toys/holder-location.test.ts` (new), `packages/mobile/tests/unit/components/toys/toy-detail-screen.test.tsx`

**Interfaces:**
- Consumes: `createOrg`, `createOrgToy`, `cleanupOrg` from `tests/helpers/orgs.ts`.
- Produces: `GET /api/public/toys/:id` adds `holder_suburb: string | null`, `holder_state: string | null`. `ToyDetail` gains both fields.

Copy: "{holder} · {suburb}, {state}" (MB: "Northside Therapy Collective · Newcastle, NSW").

- [ ] **Step 1: Write the failing tests**

`packages/api/tests/integration/toys/holder-location.test.ts`:

```ts
/**
 * The holder's suburb on a public toy, and never more. A person's comes from
 * their pickup columns through the admin client; an organisation's from its
 * public suburb (059). The street and postcode never leave the API.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, createOrgToy, cleanupOrg } from '../../helpers/orgs.js'

let person: TestUser
let quiet: TestUser
let orgId: string
let personToy: string
let quietToy: string
let orgToy: string

const publishedToy = async (ownerId: string) =>
  (
    await adminClient()
      .from('toys')
      .insert({ owner_id: ownerId, name: 'Drum', condition: 8, photo_urls: ['https://example.com/d.jpg'], offer_type: 'donation', status: 'published' })
      .select('id')
      .single()
  ).data!.id as string

beforeAll(async () => {
  person = await createTestUser('contributor')
  quiet = await createTestUser('contributor')
  const admin = adminClient()
  await admin
    .from('profiles')
    .update({ pickup_line1: '12 Secret St', pickup_suburb: 'Newtown', pickup_state: 'NSW', pickup_postcode: '2042' })
    .eq('id', person.id)
  personToy = await publishedToy(person.id)
  quietToy = await publishedToy(quiet.id)
  orgId = await createOrg({ createdBy: person.id })
  await admin
    .from('organizations')
    .update({ suburb: 'Newcastle', state: 'NSW', pickup_line1: '5 Private Rd', pickup_postcode: '2300' })
    .eq('id', orgId)
  orgToy = await createOrgToy({ orgId })
})

afterAll(async () => {
  await adminClient().from('toys').delete().in('id', [personToy, quietToy])
  await cleanupOrg(orgId)
  await deleteTestUser(person.id)
  await deleteTestUser(quiet.id)
})

const read = async (id: string) => {
  const res = await app.request(`/api/public/toys/${id}`)
  expect(res.status).toBe(200)
  return (await res.json()) as { holder_suburb: string | null; holder_state: string | null }
}

describe('holder location on a public toy', () => {
  it("gives a person's suburb and state, never their street or postcode", async () => {
    const res = await app.request(`/api/public/toys/${personToy}`)
    const text = await res.text()
    const body = JSON.parse(text) as { holder_suburb: string; holder_state: string }
    expect(body.holder_suburb).toBe('Newtown')
    expect(body.holder_state).toBe('NSW')
    expect(text).not.toContain('12 Secret St')
    expect(text).not.toContain('2042')
  })

  it("gives an organisation's public suburb, never its pickup address", async () => {
    const res = await app.request(`/api/public/toys/${orgToy}`)
    const text = await res.text()
    expect(JSON.parse(text)).toMatchObject({ holder_suburb: 'Newcastle', holder_state: 'NSW' })
    expect(text).not.toContain('5 Private Rd')
    expect(text).not.toContain('2300')
  })

  it('says nothing when the holder has not given a suburb', async () => {
    const body = await read(quietToy)
    expect(body.holder_suburb).toBeNull()
    expect(body.holder_state).toBeNull()
  })
})
```

Append to `toy-detail-screen.test.tsx` (inside `describe('ToyDetailScreen')`; `toy()` there is a person's toy held by "Jamie"):

```tsx
  it("puts the holder's suburb beside their name", async () => {
    mockEndpoints({ detail: Promise.resolve(toy({ holder_suburb: 'Newcastle', holder_state: 'NSW' })) })
    render(<ToyDetailScreen id="toy1" />)
    expect(await screen.findByText('Held by Jamie · Newcastle, NSW')).toBeTruthy()
  })

  it('says only the name when there is no suburb', async () => {
    mockEndpoints({ detail: Promise.resolve(toy({ holder_suburb: null, holder_state: null })) })
    render(<ToyDetailScreen id="toy1" />)
    expect(await screen.findByText('Held by Jamie')).toBeTruthy()
  })

  it("puts an organisation's suburb after the stock", async () => {
    mockEndpoints({
      detail: Promise.resolve(
        toy({ owner_id: null, owner_org_id: 'org1', quantity: 4, profiles: null, organizations: { name: 'TAD Australia' }, holder_suburb: 'Newcastle', holder_state: 'NSW' })
      ),
    })
    render(<ToyDetailScreen id="toy1" />)
    expect(await screen.findByText('· Newcastle, NSW')).toBeTruthy()
  })
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/toys/holder-location.test.ts`
Expected: FAIL — `expected undefined to be 'Newtown'`.
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/toys/toy-detail-screen.test.tsx`
Expected: FAIL — `Unable to find an element with text: Held by Jamie · Newcastle, NSW`.

- [ ] **Step 3: Implement**

`public.ts`, in `publicRoutes.get('/toys/:id', …)` — replace the `const [guide, given] = await Promise.all([` block and the return with:

```ts
  const giver = data.owner_org_id ? 'owner_org_id' : 'owner_id'
  const admin = createAdminClient()
  const [guide, given, place] = await Promise.all([
    data.tutorial_id
      ? supabase
          .from('tutorials')
          .select('id, title')
          .eq('id', data.tutorial_id)
          .eq('status', 'approved')
          .maybeSingle()
      : Promise.resolve({ data: null }),
    admin
      .from('toy_transactions')
      .select('id', { count: 'exact', head: true })
      .eq(giver, data.owner_org_id ?? data.owner_id)
      .eq('status', 'completed')
      .not('toy_id', 'is', null),
    // Where the toy is, to the suburb and never closer. An organisation's
    // public suburb is anon-readable (059's grant); a person's lives on their
    // pickup columns, which no anon grant reaches, so the admin client reads
    // exactly those two and nothing beside them.
    data.owner_org_id
      ? supabase.from('organizations').select('suburb, state').eq('id', data.owner_org_id).maybeSingle()
      : admin.from('profiles').select('suburb:pickup_suburb, state:pickup_state').eq('id', data.owner_id).maybeSingle(),
  ])
  const where = place.data as { suburb: string | null; state: string | null } | null
  return c.json({
    ...data,
    guide: guide.data ?? null,
    holder_given: given.count ?? 0,
    holder_suburb: where?.suburb ?? null,
    holder_state: where?.state ?? null,
  })
```

(The existing `createAdminClient()` call inside the old `Promise.all` is replaced by `admin`; keep the comments above the block.)

`packages/types/src/index.ts` — `ToyDetail`:

```ts
export type ToyDetail = ToyWithOwner & {
  guide: { id: string; title: string } | null
  holder_given: number
  /** The holder's suburb and state, never closer: an organisation's public
   *  suburb (059) or a person's pickup suburb. Null when they gave none. */
  holder_suburb: string | null
  holder_state: string | null
}
```

`toy-detail-screen.tsx`:
- After `const personName = …`:

```tsx
  // "Newcastle, NSW" — the board's subtitle. Nothing at all without a suburb.
  const place = toy.holder_suburb ? [toy.holder_suburb, toy.holder_state].filter(Boolean).join(', ') : null
```

- In the org branch, after `<Text style={styles.holderQty}>{`· ${toy.quantity} available`}</Text>` add

```tsx
          {place ? <Text style={styles.holderQty}>{`· ${place}`}</Text> : null}
```

- Replace the person branch `<Text style={styles.holder}>{`Held by ${personName}`}</Text>` with

```tsx
        <Text style={styles.holder}>{`Held by ${personName}${place ? ` · ${place}` : ''}`}</Text>
```

- Delete `{/* PENDING(toy-holder-location): the holder's suburb and state under the title. */}`.

- [ ] **Step 4: Run the tests to see them pass**

Run both commands from Step 2. Expected: PASS.

- [ ] **Step 5: Ship the item** — `shipped: true,` on `'toy-holder-location'`; `node scripts/pending.mjs`; no parity rule names this id; drift test → `Tests  11 passed (11)`.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/routes/public.ts packages/api/tests/integration/toys/holder-location.test.ts packages/types/src/index.ts packages/mobile/components/toys/toy-detail-screen.tsx packages/mobile/tests/unit/components/toys/toy-detail-screen.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(toys): the holder's suburb on a toy, never their street

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 3: Toy photo in the exchange header (`exchange-toy-photo`)

**Files:**
- Modify: `packages/api/src/routes/toy-transactions.ts` (`GET /:id`)
- Modify: `packages/types/src/index.ts` (`ToyTransactionDetail.toy_cover_photo_url`)
- Modify: `packages/mobile/components/exchanges/thread-screen.tsx`
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/api/tests/integration/toy-transactions/toy-photo.test.ts` (new), `packages/mobile/tests/unit/components/exchanges/thread-screen.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `GET /api/toy-transactions/:id` returns `toy_cover_photo_url: string | null`.

- [ ] **Step 1: Write the failing tests**

`packages/api/tests/integration/toy-transactions/toy-photo.test.ts`:

```ts
/** The toy's cover on one exchange, for the thread's header tile. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let owner: TestUser
let requester: TestUser
let toyId: string
let txId: string

beforeAll(async () => {
  owner = await createTestUser('contributor')
  requester = await createTestUser('contributor')
  const admin = adminClient()
  toyId = (
    await admin
      .from('toys')
      .insert({ owner_id: owner.id, name: 'Drum', condition: 8, photo_urls: ['https://example.com/cover.jpg'], offer_type: 'donation', status: 'published' })
      .select('id')
      .single()
  ).data!.id
  txId = (
    await admin
      .from('toy_transactions')
      .insert({ toy_id: toyId, type: 'donation', status: 'requested', requester_id: requester.id, owner_id: owner.id })
      .select('id')
      .single()
  ).data!.id
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('toy_transactions').delete().eq('id', txId)
  await admin.from('toys').delete().eq('id', toyId)
  await deleteTestUser(owner.id)
  await deleteTestUser(requester.id)
})

describe('GET /api/toy-transactions/:id', () => {
  it("carries the toy's cover photo to both parties", async () => {
    for (const u of [owner, requester]) {
      const res = await app.request(`/api/toy-transactions/${txId}`, { headers: { Authorization: `Bearer ${u.token}` } })
      expect(res.status).toBe(200)
      expect(((await res.json()) as { toy_cover_photo_url: string }).toy_cover_photo_url).toBe('https://example.com/cover.jpg')
    }
  })
})
```

Append to `thread-screen.test.tsx` (top level; it uses the file's `detail`, `caps`, `mockGet`, `mockUseCapabilities`):

```tsx
describe('header photo', () => {
  beforeEach(() => mockUseCapabilities.mockReturnValue(caps({})))

  it("shows the toy's photo in the Toy slot", async () => {
    mockGet.mockImplementation((p: string) =>
      p === '/api/toy-transactions/tx1'
        ? Promise.resolve(detail({ toy_cover_photo_url: 'https://example.com/cover.jpg' }))
        : Promise.resolve({ lines: [], settlement: null })
    )
    render(<ExchangeThreadScreen id="tx1" />)
    expect((await screen.findByTestId('exchange-toy-photo')).props.source).toEqual({ uri: 'https://example.com/cover.jpg' })
  })

  it('falls back to the cube tile without one', async () => {
    mockGet.mockImplementation((p: string) =>
      p === '/api/toy-transactions/tx1' ? Promise.resolve(detail({ toy_cover_photo_url: null })) : Promise.resolve({ lines: [], settlement: null })
    )
    render(<ExchangeThreadScreen id="tx1" />)
    await screen.findByText('Bubble machine → Jamie collects')
    expect(screen.queryByTestId('exchange-toy-photo')).toBeNull()
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/toy-transactions/toy-photo.test.ts` → FAIL (`expected undefined to be 'https://example.com/cover.jpg'`).
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/exchanges/thread-screen.test.tsx -t "header photo"` → FAIL (`Unable to find an element with testID: exchange-toy-photo`).

- [ ] **Step 3: Implement**

`toy-transactions.ts`, `toyTransactions.get('/:id', …)`:
- In the select string, `toy:toys!toy_transactions_toy_id_fkey(name, status)` → `toy:toys!toy_transactions_toy_id_fkey(name, status, cover_photo_url)`.
- In the `row` type: `toy: { name: string; status: 'draft' | 'published'; cover_photo_url: string | null } | null`.
- In the returned object, after `toy_name: row.toy?.name ?? '',`:

```ts
    // 025's "parties can view each other's toy" policy outlives the handoff,
    // so the giver still sees what they gave.
    toy_cover_photo_url: row.toy?.cover_photo_url ?? null,
```

`packages/types/src/index.ts` — in `ToyTransactionDetail`, after `toy_name: string`:

```ts
  /** The toy's cover (053), for the thread's header. Null on a build or a toy with none. */
  toy_cover_photo_url: string | null
```

`thread-screen.tsx`:
- Add `Image` to the `react-native` import.
- Replace

```tsx
            {/* PENDING(exchange-toy-photo): the toy's photo here — the detail has no photo field. */}
            <View style={styles.toyTile}>
              <Ionicons name="cube-outline" size={22} color={theme.colors.muted} />
            </View>
```

with

```tsx
            {tx.toy_cover_photo_url ? (
              <Image
                testID="exchange-toy-photo"
                source={{ uri: tx.toy_cover_photo_url }}
                style={styles.toyTile}
                accessibilityIgnoresInvertColors
              />
            ) : (
              <View style={styles.toyTile}>
                <Ionicons name="cube-outline" size={22} color={theme.colors.muted} />
              </View>
            )}
```

- [ ] **Step 4: Run the tests to see them pass**

Run both commands from Step 2 (the mobile one without `-t`). Expected: PASS.

- [ ] **Step 5: Ship the item** — `shipped: true,` on `'exchange-toy-photo'`; `node scripts/pending.mjs`; no parity rule names this id; drift test → `Tests  11 passed (11)`.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/routes/toy-transactions.ts packages/api/tests/integration/toy-transactions/toy-photo.test.ts packages/types/src/index.ts packages/mobile/components/exchanges/thread-screen.tsx packages/mobile/tests/unit/components/exchanges/thread-screen.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(exchanges): the toy's photo in the exchange header

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 4: Copy and New code (`handover-code-actions`)

**Files:**
- Modify: `packages/mobile/package.json`, `pnpm-lock.yaml` (expo-clipboard)
- Modify: `packages/api/src/routes/toy-transactions.ts` (`POST /:id/new-code`)
- Modify: `packages/mobile/components/exchanges/thread-screen.tsx`
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/api/tests/integration/toy-transactions/new-code.test.ts` (new), `packages/mobile/tests/unit/components/exchanges/thread-screen.test.tsx`

**Interfaces:**
- Consumes: `loadForParty`, `generateCode`, `sanitizeCodes`, `ledOrgIds`, `isOwnerSide` in `toy-transactions.ts`.
- Produces: `POST /api/toy-transactions/:id/new-code` (no body) → 200 the sanitized row with the caller's fresh code; 404 not a party; 409 not accepted, or the caller's code already used.

Copy (MB): "Copy", "New code", toast "Code {code} copied", toast "New code — the old one no longer works".

- [ ] **Step 1: Add the dependency**

The app is on Expo SDK 57 (`"expo": "~57.0.18"`). From `packages/mobile`:

Run: `npx expo install expo-clipboard`
Expected: `packages/mobile/package.json` gains `"expo-clipboard": "~57.0.<n>"` (the SDK-57 line `expo install` resolves) and `pnpm-lock.yaml` changes. Nothing else in `package.json` moves; if `expo install` offers to "fix" other versions, decline.

Then, for iOS dev builds only: `npx expo prebuild -p ios` (the gitignored `ios/` dir does not pick up new native modules by itself — memory: stale iOS prebuild dir). Jest needs nothing: the test mocks the module.

- [ ] **Step 2: Write the failing tests**

`packages/api/tests/integration/toy-transactions/new-code.test.ts`:

```ts
/**
 * A fresh handover code: only your own, only while the handover is open, and
 * never once the other side has typed yours in. Each side recites its code for
 * the OTHER to type (confirm handler), so the counterparty's code must never
 * change here and never come back in the response.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let owner: TestUser
let requester: TestUser
let outsider: TestUser
let toyId: string

const newCode = (u: TestUser, id: string) =>
  app.request(`/api/toy-transactions/${id}/new-code`, { method: 'POST', headers: { Authorization: `Bearer ${u.token}` } })
const codes = async (id: string) =>
  (await adminClient().from('toy_transactions').select('owner_code, requester_code').eq('id', id).single()).data!
const tx = async (over: Record<string, unknown> = {}) =>
  (
    await adminClient()
      .from('toy_transactions')
      .insert({
        toy_id: toyId, type: 'exchange', status: 'accepted', requester_id: requester.id, owner_id: owner.id,
        owner_code: '111111', requester_code: '222222', ...over,
      })
      .select('id')
      .single()
  ).data!.id as string

beforeAll(async () => {
  owner = await createTestUser('contributor')
  requester = await createTestUser('contributor')
  outsider = await createTestUser('contributor')
  toyId = (
    await adminClient()
      .from('toys')
      .insert({ owner_id: owner.id, name: 'Drum', condition: 8, photo_urls: ['https://example.com/d.jpg'], offer_type: 'both', status: 'published' })
      .select('id')
      .single()
  ).data!.id
})

afterAll(async () => {
  await adminClient().from('toy_transactions').delete().eq('toy_id', toyId)
  await adminClient().from('toys').delete().eq('id', toyId)
  for (const u of [owner, requester, outsider]) await deleteTestUser(u.id)
})

describe('POST /api/toy-transactions/:id/new-code', () => {
  it("replaces the requester's code and leaves the owner's alone", async () => {
    const id = await tx()
    const res = await newCode(requester, id)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { requester_code: string; owner_code: string | null }
    expect(body.requester_code).toMatch(/^\d{6}$/)
    expect(body.owner_code).toBeNull()
    const after = await codes(id)
    expect(after.owner_code).toBe('111111')
    expect(after.requester_code).toBe(body.requester_code)
  })

  it("replaces the owner's code and never returns the requester's", async () => {
    const id = await tx()
    const res = await newCode(owner, id)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { owner_code: string; requester_code: string | null }
    expect(body.requester_code).toBeNull()
    expect((await codes(id)).requester_code).toBe('222222')
  })

  it('is refused to anyone outside the exchange', async () => {
    expect((await newCode(outsider, await tx())).status).toBe(404)
  })

  it('is refused before the request is accepted', async () => {
    expect((await newCode(requester, await tx({ status: 'requested', owner_code: null, requester_code: null }))).status).toBe(409)
  })

  it('is refused once the other side has already typed your code in', async () => {
    // The owner confirms with the requester's code, so the requester's code is spent.
    const id = await tx({ owner_confirmed_at: new Date().toISOString() })
    expect((await newCode(requester, id)).status).toBe(409)
    expect((await codes(id)).requester_code).toBe('222222')
  })
})
```

Append to `thread-screen.test.tsx`. Add next to the other `jest.mock` calls at the top of the file:

```tsx
const mockCopy = jest.fn()
jest.mock('expo-clipboard', () => ({ setStringAsync: (...a: unknown[]) => mockCopy(...a) }))
```

and at the bottom:

```tsx
describe('handover code actions', () => {
  // The requester on an accepted donation holds the code.
  const accepted = (over: object = {}) =>
    detail({ status: 'accepted', owner_id: 'owner1', requester_id: 'viewer1', requester_code: '123456', owner_name: 'Ash', ...over })

  beforeEach(() => {
    mockUseCapabilities.mockReturnValue(caps({}))
    mockGet.mockImplementation((p: string) =>
      p === '/api/toy-transactions/tx1' ? Promise.resolve(accepted()) : Promise.resolve({ lines: [], settlement: null })
    )
  })

  it('copies the code and says so', async () => {
    mockCopy.mockResolvedValue(true)
    render(<ExchangeThreadScreen id="tx1" />)
    fireEvent.press(await screen.findByText('Copy'))
    await waitFor(() => expect(mockCopy).toHaveBeenCalledWith('123456'))
    expect(await screen.findByText('Code 123456 copied')).toBeTruthy()
  })

  it('swaps in a new code from the API and says the old one is dead', async () => {
    mockPost.mockResolvedValue(accepted({ requester_code: '654321' }))
    render(<ExchangeThreadScreen id="tx1" />)
    fireEvent.press(await screen.findByText('New code'))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/tx1/new-code', {}))
    expect(await screen.findByText('New code — the old one no longer works')).toBeTruthy()
    expect(screen.getByLabelText('6 5 4 3 2 1')).toBeTruthy()
  })
})
```

- [ ] **Step 3: Run them to see them fail**

Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/toy-transactions/new-code.test.ts` → FAIL (404 from an unknown route).
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/exchanges/thread-screen.test.tsx -t "handover code actions"` → FAIL (`Unable to find an element with text: Copy`).

- [ ] **Step 4: Implement**

`toy-transactions.ts` — add after the `toyTransactions.post('/:id/confirm', …)` handler:

```ts
/**
 * POST /api/toy-transactions/:id/new-code
 *
 * A fresh code for the CALLER only, for when theirs was overheard or sent to
 * the wrong person. Your code is the one the other side types in, so once they
 * have confirmed it is spent and cannot be replaced. The counterparty's code is
 * never touched, and sanitizeCodes keeps it out of the answer as everywhere else.
 */
toyTransactions.post('/:id/new-code', async (c) => {
  const loaded = await loadForParty(c)
  if ('status' in loaded) return c.json({ error: 'message' in loaded ? loaded.message : 'Not found' }, loaded.status)
  const tx = loaded.data
  const userId = c.get('userId')
  const admin = createAdminClient()
  const ledOrgs = await ledOrgIds(admin, userId)
  const isOwner = isOwnerSide(tx as any, userId, ledOrgs)
  if (!isOwner && userId !== tx.requester_id) return c.json({ error: 'Not found' }, 404)
  if (tx.status !== 'accepted') return c.json({ error: 'A code is only given once the request is accepted.' }, 409)
  const spent = isOwner ? tx.requester_confirmed_at : tx.owner_confirmed_at
  if (spent) return c.json({ error: 'Your code has already been used, so it cannot be changed.' }, 409)

  const field = isOwner ? 'owner_code' : 'requester_code'
  const { data: updated, error } = await admin
    .from('toy_transactions')
    .update({ [field]: generateCode(), updated_at: new Date().toISOString() })
    .eq('id', tx.id)
    .eq('status', 'accepted')
    .select()
    .maybeSingle()
  if (error) return c.json({ error: error.message }, 500)
  if (!updated) return c.json({ error: 'This handover is no longer open.' }, 409)
  return c.json(sanitizeCodes(updated, userId, ledOrgs))
})
```

`thread-screen.tsx`:
- Imports: `import * as Clipboard from 'expo-clipboard'` and `import { FlashLine, useFlash } from '../ui/Flash'`.
- In `ExchangeThreadScreen`, beside the other `useState`s: `const [flash, setFlash] = useFlash()`.
- Replace `<PendingButton pending="handover-code-actions" label="New code" variant="ghost" />` with:

```tsx
                  <View style={styles.buttonRow}>
                    <Button
                      label="Copy"
                      variant="ghost"
                      style={styles.rowButton}
                      onPress={async () => {
                        await Clipboard.setStringAsync(myCode)
                        setFlash(`Code ${myCode} copied`)
                      }}
                    />
                    <Button
                      label="New code"
                      variant="ghost"
                      disabled={busy}
                      style={styles.rowButton}
                      onPress={async () => {
                        const sent = await run(() =>
                          apiClient.post<ToyTransaction>(`/api/toy-transactions/${id}/new-code`, {})
                        )
                        if (sent) setFlash('New code — the old one no longer works')
                      }}
                    />
                  </View>
                  <FlashLine message={flash} />
```

(`PendingButton` stays imported: "Say thanks" and "Report a problem" still use it. `styles.buttonRow` and `styles.rowButton` already exist for Accept / Decline.)

- [ ] **Step 5: Run the tests to see them pass**

Run both commands from Step 3 (the mobile one without `-t`). Expected: PASS.

- [ ] **Step 6: Ship the item** — `shipped: true,` on `'handover-code-actions'`; `node scripts/pending.mjs`; no parity rule names this id; drift test → `Tests  11 passed (11)`.

- [ ] **Step 7: Commit**

```bash
git add packages/mobile/package.json pnpm-lock.yaml packages/api/src/routes/toy-transactions.ts packages/api/tests/integration/toy-transactions/new-code.test.ts packages/mobile/components/exchanges/thread-screen.tsx packages/mobile/tests/unit/components/exchanges/thread-screen.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(exchanges): copy your handover code, or get a new one while it is unused

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---
### Task 5: Your toy — the summary in front of the editor (`my-toy-summary`)

**Files:**
- Create: `packages/mobile/lib/my-toy.ts`, `packages/mobile/components/my-toys/summary-screen.tsx`
- Create: `packages/mobile/app/(my)/toys/[id]/index.tsx`, `packages/mobile/app/(my)/toys/[id]/edit.tsx`
- Delete: `packages/mobile/app/(my)/toys/[id].tsx`
- Modify: `packages/mobile/app/(my)/_layout.tsx`, `packages/mobile/app/(my)/toys/new.tsx`, `packages/mobile/components/my-toys/editor.tsx`, `packages/mobile/components/exchanges/thread-screen.tsx` (received toy → editor)
- Modify: `scripts/parity/app-screen-map.json` (the `toy_detail` rule naming `my-toy-summary`)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/mobile/tests/unit/lib/my-toy.test.ts` (new), `packages/mobile/tests/unit/components/my-toys/summary-screen.test.tsx` (new); updated `tests/unit/app/toys-new.test.tsx`, `tests/unit/components/my-toys/editor.test.tsx`, `tests/unit/components/exchanges/thread-screen.test.tsx`

**Interfaces:**
- Consumes: `gradeOf` (Task 1).
- Produces:
  - `loadOwnedToy(id: string): Promise<{ toy: Toy; shelf: Toy[] } | null>` — the toy from `GET /api/toys`, else from `GET /api/toys/inventory`; `shelf` is the rest of that holder's toys (Task 10 uses it for the picker).
  - `toySummaryLead(toy: Pick<Toy, 'name' | 'condition' | 'switch_adapted' | 'status' | 'created_at'>, asks: number): string`.
  - `ToySummaryScreen({ id }: { id: string })` with state `toy`, `requests: ToyTransactionSummary[]`, and the derived `open` (owner-side `requested` rows on this toy). Tasks 6, 7, 8 add rows to it.
  - Routes: `/toys/[id]` is the summary, `/toys/[id]/edit` the editor.

Copy (MB `toy_detail`): lead "Light-up drum — listed 4 June, good condition, switch-adapted. Two families have asked for it." (numbers as digits, per the spec's "{n}"); rows "Edit listing" · "Photos, condition, notes", "Mark unavailable". Stack titles: "Your toy" (registry title), "Edit listing".

Why `loadOwnedToy`: `GET /api/toys` returns only `owner_id = caller`. The inventory opens org toys at `/toys/[id]`, and the editor read only `/api/toys`, so a leader's org toy loaded as "Couldn't load this toy." Both screens use the fallback.

- [ ] **Step 1: Write the failing tests**

`packages/mobile/tests/unit/lib/my-toy.test.ts`:

```ts
import { loadOwnedToy, toySummaryLead } from '../../../lib/my-toy'

const mockGet = jest.fn()
jest.mock('../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))

const toy = (over: object) => ({ id: 't1', owner_id: 'me', owner_org_id: null, name: 'Light-up drum', condition: 8, switch_adapted: true, status: 'published', created_at: '2026-06-04T12:00:00Z', ...over })

describe('toySummaryLead', () => {
  it("says the board's sentence", () => {
    expect(toySummaryLead(toy({}) as never, 2)).toBe(
      'Light-up drum — listed 4 June, good condition, switch-adapted. 2 families have asked for it.'
    )
  })
  it('says one family, and nothing about asking when nobody has', () => {
    expect(toySummaryLead(toy({}) as never, 1)).toMatch(/ 1 family has asked for it\.$/)
    expect(toySummaryLead(toy({ switch_adapted: false }) as never, 0)).toBe('Light-up drum — listed 4 June, good condition.')
  })
  it('does not say listed for a draft', () => {
    expect(toySummaryLead(toy({ status: 'draft', condition: 9, switch_adapted: false }) as never, 0)).toBe('Light-up drum, like new condition.')
  })
})

describe('loadOwnedToy', () => {
  beforeEach(() => mockGet.mockReset())

  it('finds a personal toy without asking for the shelf', async () => {
    mockGet.mockResolvedValueOnce([toy({})])
    expect((await loadOwnedToy('t1'))?.toy.id).toBe('t1')
    expect(mockGet).toHaveBeenCalledTimes(1)
  })

  it("falls back to the organisation's inventory, and returns that org's shelf", async () => {
    mockGet
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([toy({ id: 'o1', owner_id: null, owner_org_id: 'org1' }), toy({ id: 'o2', owner_id: null, owner_org_id: 'org2' })])
    const owned = await loadOwnedToy('o1')
    expect(owned?.toy.id).toBe('o1')
    expect(owned?.shelf.map((t) => t.id)).toEqual(['o1'])
    expect(mockGet).toHaveBeenLastCalledWith('/api/toys/inventory')
  })

  it('is null for a toy the caller does not hold', async () => {
    mockGet.mockResolvedValue([])
    expect(await loadOwnedToy('nope')).toBeNull()
  })
})
```

`packages/mobile/tests/unit/components/my-toys/summary-screen.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react-native'
import { ToySummaryScreen } from '../../../../components/my-toys/summary-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))

const mockGet = jest.fn()
const mockPost = jest.fn()
const mockPatch = jest.fn()
const mockDelete = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: {
    get: (...a: unknown[]) => mockGet(...a),
    post: (...a: unknown[]) => mockPost(...a),
    patch: (...a: unknown[]) => mockPatch(...a),
    delete: (...a: unknown[]) => mockDelete(...a),
  },
}))

const mockPush = jest.fn()
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useFocusEffect: (effect: () => void) => useEffect(effect, []), useRouter: () => ({ push: mockPush }) }
})

const mockUseCapabilities = jest.fn()
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => mockUseCapabilities() }))

const caps = (ledOrgs: { id: string; name: string }[] = []) => ({
  caps: {
    profile: { id: 'me', name: 'Sam', role: 'contributor' },
    isAdmin: false,
    ledOrgs,
    unread: { tutorials: 0, exchanges: 0, challenges: 0, organisations: 0, total: 0 },
    exchangeActions: 0,
  },
  loading: false,
  refresh: jest.fn(),
})

const toy = (over: object = {}) => ({
  id: 't1', owner_id: 'me', owner_org_id: null, quantity: 1, name: 'Light-up drum', description: null, condition: 8,
  switch_adapted: true, photo_urls: [], cover_photo_url: null, switch_photo_url: null, status: 'published',
  offer_type: 'donation', created_at: '2026-06-04T12:00:00Z', updated_at: '', ...over,
})

const request = (over: object = {}) => ({
  id: 'tx1', toy_id: 't1', type: 'donation', status: 'requested', requester_id: 'fam1', owner_id: 'me', owner_org_id: null,
  requester_name: 'Eastwood Special School', other_party_name: 'Eastwood Special School', blocked_by_rival_accept: false,
  last_message: { body: 'For a class of four who share one switch', sender_id: 'fam1', kind: 'user', created_at: '' },
  ...over,
})

/** Routes each GET; `inventory` is only read when `mine` lacks the toy. */
function serve({ mine = [toy()], inventory = [], txs = [] }: { mine?: object[]; inventory?: object[]; txs?: object[] } = {}) {
  mockGet.mockImplementation((p: string) =>
    p === '/api/toys' ? Promise.resolve(mine)
    : p === '/api/toys/inventory' ? Promise.resolve(inventory)
    : p === '/api/toy-transactions' ? Promise.resolve(txs)
    : Promise.reject(new Error(`unexpected GET ${p}`))
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  mockUseCapabilities.mockReturnValue(caps())
})

describe('ToySummaryScreen', () => {
  it('leads with the listing and how many families have asked, and opens the editor', async () => {
    serve({ txs: [request(), request({ id: 'tx2', requester_name: 'Priya Nadarajah' }), request({ id: 'tx3', toy_id: 'other' })] })
    render(<ToySummaryScreen id="t1" />)
    expect(
      await screen.findByText('Light-up drum — listed 4 June, good condition, switch-adapted. 2 families have asked for it.')
    ).toBeTruthy()
    expect(screen.getByText('Photos, condition, notes')).toBeTruthy()
    fireEvent.press(screen.getByText('Edit listing'))
    expect(mockPush).toHaveBeenCalledWith('/toys/t1/edit')
  })

  it("opens an organisation's toy from the inventory", async () => {
    mockUseCapabilities.mockReturnValue(caps([{ id: 'org1', name: 'Northside' }]))
    serve({ mine: [], inventory: [toy({ owner_id: null, owner_org_id: 'org1', switch_adapted: false })] })
    render(<ToySummaryScreen id="t1" />)
    expect(await screen.findByText('Light-up drum — listed 4 June, good condition.')).toBeTruthy()
  })

  it('says so when the toy is not yours', async () => {
    serve({ mine: [] })
    render(<ToySummaryScreen id="t1" />)
    expect(await screen.findByText("Couldn't load this toy.")).toBeTruthy()
  })
})
```

Updates to existing tests:
- `tests/unit/app/toys-new.test.tsx`: `expect(mockReplace).toHaveBeenCalledWith('/toys/toy1')` → `'/toys/toy1/edit'`.
- `tests/unit/components/exchanges/thread-screen.test.tsx`: `expect(mockPush).toHaveBeenCalledWith('/toys/received1')` → `'/toys/received1/edit'`.
- `tests/unit/components/my-toys/editor.test.tsx`:
  - Add `const mockDismissTo = jest.fn()` beside `mockBack`, and make the router mock `useRouter: () => ({ back: mockBack, push: mockPush, dismissTo: mockDismissTo })`.
  - In `mockGetRouting`, add `if (path === '/api/toys/inventory') return Promise.resolve([])` before the reject.
  - In "deletes the toy after the confirm alert, and goes back": `expect(mockBack).toHaveBeenCalled()` → `expect(mockDismissTo).toHaveBeenCalledWith('/toys')`. In the two tests after it: `expect(mockBack).not.toHaveBeenCalled()` → `expect(mockDismissTo).not.toHaveBeenCalled()`.

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/lib/my-toy.test.ts tests/unit/components/my-toys tests/unit/app/toys-new.test.tsx tests/unit/components/exchanges/thread-screen.test.tsx`
Expected: FAIL — `Cannot find module '../../../lib/my-toy'`, `.../summary-screen`, and the three route assertions.

- [ ] **Step 3: Implement**

`packages/mobile/lib/my-toy.ts`:

```ts
// packages/mobile/lib/my-toy.ts
import type { Toy } from '@splat-connect/types'
import { gradeOf } from '@splat-connect/types'
import { apiClient } from './api-client'

/**
 * One toy the caller holds — personally, or for an organisation they lead —
 * and the rest of that holder's shelf. toys.ts has no single-row GET, and
 * GET /api/toys is the caller's own toys only: an org toy is on
 * /api/toys/inventory, so it is read only when the first list lacks it.
 */
export async function loadOwnedToy(id: string): Promise<{ toy: Toy; shelf: Toy[] } | null> {
  const mine = await apiClient.get<Toy[]>('/api/toys')
  const own = mine.find((t) => t.id === id)
  if (own) return { toy: own, shelf: mine }
  const inventory = await apiClient.get<Toy[]>('/api/toys/inventory')
  const held = inventory.find((t) => t.id === id)
  return held ? { toy: held, shelf: inventory.filter((t) => t.owner_org_id === held.owner_org_id) } : null
}

/**
 * The board's lead for one of your toys: "Light-up drum — listed 4 June, good
 * condition, switch-adapted. Two families have asked for it." A draft is not
 * listed, so it says only the name.
 */
export function toySummaryLead(
  toy: Pick<Toy, 'name' | 'condition' | 'switch_adapted' | 'status' | 'created_at'>,
  asks: number
): string {
  const head =
    toy.status === 'published'
      ? `${toy.name} — listed ${new Date(toy.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long' })}`
      : toy.name
  const facts = [head, `${gradeOf(toy.condition).label.toLowerCase()} condition`, toy.switch_adapted ? 'switch-adapted' : null]
    .filter(Boolean)
    .join(', ')
  const asked = asks === 0 ? '' : ` ${asks} ${asks === 1 ? 'family has' : 'families have'} asked for it.`
  return `${facts}.${asked}`
}
```

`packages/mobile/components/my-toys/summary-screen.tsx`:

```tsx
// packages/mobile/components/my-toys/summary-screen.tsx
/**
 * The board's "Your toy" (MB toy_detail): a lead that says where the listing
 * stands, then rows — the requests waiting on you, Edit listing, Mark
 * unavailable. The editor is one row away at /toys/[id]/edit.
 *
 * Reloaded on focus: the editor one push away changes the name and condition
 * the lead reads.
 */
import { useCallback, useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import type { Toy, ToyTransactionSummary } from '@splat-connect/types'
import { isOwnerSide } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { useCapabilities } from '../../lib/capabilities'
import { loadOwnedToy, toySummaryLead } from '../../lib/my-toy'
import { theme } from '../../lib/theme'
import { Screen } from '../ui/Screen'
import { SkeletonRow } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { PendingRow } from '../ui/pending'
import { ListIntro, ListRow } from '../list/list-kit'

export function ToySummaryScreen({ id }: { id: string }) {
  const router = useRouter()
  const { caps } = useCapabilities()
  const [toy, setToy] = useState<Toy | null>(null)
  const [requests, setRequests] = useState<ToyTransactionSummary[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  useFocusEffect(
    useCallback(() => {
      let ignore = false
      Promise.all([loadOwnedToy(id), apiClient.get<ToyTransactionSummary[]>('/api/toy-transactions')])
        .then(([owned, txs]) => {
          if (ignore) return
          if (!owned) {
            setState('error')
            return
          }
          setToy(owned.toy)
          setRequests(txs)
          setState('ready')
        })
        .catch((err) => {
          console.error('[ToySummaryScreen] load failed:', err)
          if (!ignore) setState('error')
        })
      return () => {
        ignore = true
      }
    }, [id])
  )

  if (state === 'loading') {
    return (
      <Screen>
        <SkeletonRow />
        <SkeletonRow />
      </Screen>
    )
  }
  if (state === 'error' || !toy) {
    return (
      <Screen>
        <EmptyState icon="cloud-offline-outline" title="Couldn't load this toy." hint="Check your connection and try again." />
      </Screen>
    )
  }

  const ledOrgIds = caps?.ledOrgs.map((o) => o.id) ?? []
  // Requests still waiting on this holder — the same isOwnerSide check the
  // editor's count uses, so a leader's org toy counts too.
  const open = requests.filter(
    (t) => t.toy_id === toy.id && t.status === 'requested' && !!caps && isOwnerSide(t, caps.profile.id, ledOrgIds)
  )

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <ListIntro lead={toySummaryLead(toy, open.length)} />
        <View style={styles.rows}>
          <ListRow title="Edit listing" meta="Photos, condition, notes" onPress={() => router.push(`/toys/${toy.id}/edit`)} />
          <PendingRow pending="toy-pause-unavailable" label="Mark unavailable" icon="pause-circle-outline" />
        </View>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: theme.spacing(6) },
  rows: { gap: theme.spacing(3) },
})
```

Routes:
- `git mv "packages/mobile/app/(my)/toys/[id].tsx" "packages/mobile/app/(my)/toys/[id]/edit.tsx"`, then make that file:

```tsx
import { useLocalSearchParams } from 'expo-router'
import { Editor } from '../../../../components/my-toys/editor'

export default function EditToyRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <Editor id={id} />
}
```

- `packages/mobile/app/(my)/toys/[id]/index.tsx`:

```tsx
import { useLocalSearchParams } from 'expo-router'
import { ToySummaryScreen } from '../../../../components/my-toys/summary-screen'

export default function ToySummaryRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <ToySummaryScreen id={id} />
}
```

- `_layout.tsx`: replace `<Stack.Screen name="toys/[id]" options={{ title: 'Toy' }} />` with

```tsx
      <Stack.Screen name="toys/[id]/index" options={{ title: 'Your toy' }} />
      <Stack.Screen name="toys/[id]/edit" options={{ title: 'Edit listing' }} />
```

- `toys/new.tsx`: `router.replace(`/toys/${data.id}`)` → `router.replace(`/toys/${data.id}/edit`)` (a new toy is a draft: straight on to photos).
- `thread-screen.tsx`: the received-toy button `router.push(`/toys/${receivedToy.id}`)` → `router.push(`/toys/${receivedToy.id}/edit`)` (a received toy is a draft waiting to be listed).

`editor.tsx`:
- Import `import { loadOwnedToy } from '../../lib/my-toy'`.
- In the load effect, replace `apiClient.get<Toy[]>('/api/toys'),` with `loadOwnedToy(id),`, and in `.then(([toys, tx]) => {` replace the first lines with

```tsx
      .then(([owned, tx]) => {
        if (ignore) return
        const found = owned?.toy ?? null
```

  (the rest of the `.then` body is unchanged).
- Beside `const currentPhotoUrls = toy.photo_urls`, add

```tsx
  // Where Delete lands: the list this toy came from. The summary behind the
  // editor would only say the toy is gone.
  const shelfHref = toy.owner_org_id ? '/organisation/toys' : '/toys'
```

- In `handleDelete`, `router.back()` → `router.dismissTo(shelfHref)`.

`scripts/parity/app-screen-map.json`: in the `toy_detail` entry delete the rule `{ "type": "picture", "match": "editor", "why": "pending", "pending": "my-toy-summary" }` (keep the two `my-toy-inline-requests` rules).

Remove the `// PENDING(my-toy-summary): …` comment (it was in the deleted `[id].tsx`; check `git grep -n "my-toy-summary" -- packages scripts` shows only `pending.ts` and the generated `app-parity-report.json`).

- [ ] **Step 4: Run the tests to see them pass**

Run the command from Step 2. Expected: PASS.
Run: `pnpm --filter @splat-connect/mobile typecheck` → exit 0.

- [ ] **Step 5: Ship the item** — `shipped: true,` on `'my-toy-summary'`; `node scripts/pending.mjs`; drift test → `Tests  11 passed (11)`.

- [ ] **Step 6: Commit**

```bash
git add packages/mobile/lib/my-toy.ts packages/mobile/components/my-toys/summary-screen.tsx "packages/mobile/app/(my)/toys/[id].tsx" "packages/mobile/app/(my)/toys/[id]/index.tsx" "packages/mobile/app/(my)/toys/[id]/edit.tsx" "packages/mobile/app/(my)/_layout.tsx" "packages/mobile/app/(my)/toys/new.tsx" packages/mobile/components/my-toys/editor.tsx packages/mobile/components/exchanges/thread-screen.tsx packages/mobile/tests/unit/lib/my-toy.test.ts packages/mobile/tests/unit/components/my-toys/summary-screen.test.tsx packages/mobile/tests/unit/app/toys-new.test.tsx packages/mobile/tests/unit/components/my-toys/editor.test.tsx packages/mobile/tests/unit/components/exchanges/thread-screen.test.tsx scripts/parity/app-screen-map.json packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(mobile): a toy opens on its summary, the editor one row away; org toys load

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 6: Mark unavailable (`toy-pause-unavailable`, migration 100)

**Files:**
- Create: `supabase/migrations/100_toy_paused.sql`
- Modify: `packages/api/src/routes/toys.ts` (`EDITABLE`, `badTimestamp`), `packages/api/src/routes/toy-transactions.ts` (POST refuses; `transferToy` clears)
- Modify: `packages/types/src/index.ts` (`Toy.paused_at`)
- Modify: `packages/mobile/components/toys/request-block.tsx`, `packages/mobile/components/my-toys/summary-screen.tsx`, `packages/mobile/components/my-toys/editor.tsx` (drop the footer `PendingButton`)
- Modify: `packages/web/components/toy-transaction-request.tsx`, `packages/web/components/toy-editor.tsx`
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/api/tests/integration/toys/paused.test.ts` (new); `packages/mobile/tests/unit/components/toys/toy-detail-screen.test.tsx`, `.../my-toys/summary-screen.test.tsx`; `packages/web/tests/unit/components/toy-transaction-request.test.tsx`, `toy-editor.test.tsx`

**Interfaces:**
- Consumes: `ToySummaryScreen` (Task 5).
- Produces: column `toys.paused_at timestamptz`; `PATCH /api/toys/:id` accepts `paused_at` (ISO string or null; 400 otherwise) for person and org toys; `POST /api/toy-transactions` → 409 `This toy is not taking requests right now` while paused; `badTimestamp(body, key): boolean` in `toys.ts` (Task 8 reuses it). `Toy.paused_at?: string | null`.

Copy: "Mark unavailable" · "Keeps it listed but hides the request button" (MB), "Not taking requests right now" (WB), "Take requests again" (spec; no board).

- [ ] **Step 1: Write the failing tests**

`packages/api/tests/integration/toys/paused.test.ts`:

```ts
/**
 * Mark unavailable: still listed and readable, but no new requests. Pausing is
 * the holder's own column, and it does not travel with the toy.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let owner: TestUser
let asker: TestUser
const toyIds: string[] = []

const call = (u: TestUser, path: string, method: string, body?: unknown) =>
  app.request(path, {
    method,
    headers: { Authorization: `Bearer ${u.token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
const publishedToy = async (ownerId: string, offer = 'donation') => {
  const id = (
    await adminClient()
      .from('toys')
      .insert({ owner_id: ownerId, name: 'Drum', condition: 8, photo_urls: ['https://example.com/d.jpg'], offer_type: offer, status: 'published' })
      .select('id')
      .single()
  ).data!.id as string
  toyIds.push(id)
  return id
}

beforeAll(async () => {
  owner = await createTestUser('contributor')
  asker = await createTestUser('contributor')
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('toy_transactions').delete().in('toy_id', toyIds)
  await admin.from('toys').delete().in('id', toyIds)
  await deleteTestUser(owner.id)
  await deleteTestUser(asker.id)
})

describe('100 toy paused', () => {
  it('has the column', async () => {
    const { error } = await adminClient().from('toys').select('paused_at').limit(1)
    expect(error).toBeNull()
  })

  it('refuses requests while paused, stays readable, and takes them again once resumed', async () => {
    const id = await publishedToy(owner.id)
    const paused = await call(owner, `/api/toys/${id}`, 'PATCH', { paused_at: new Date().toISOString() })
    expect(paused.status).toBe(200)
    expect(((await paused.json()) as { paused_at: string | null }).paused_at).not.toBeNull()

    const ask = await call(asker, '/api/toy-transactions', 'POST', { toy_id: id, type: 'donation' })
    expect(ask.status).toBe(409)
    expect(((await ask.json()) as { error: string }).error).toBe('This toy is not taking requests right now')

    const pub = await app.request(`/api/public/toys/${id}`)
    expect(pub.status).toBe(200)
    expect(((await pub.json()) as { paused_at: string | null }).paused_at).not.toBeNull()

    expect((await call(owner, `/api/toys/${id}`, 'PATCH', { paused_at: null })).status).toBe(200)
    expect((await call(asker, '/api/toy-transactions', 'POST', { toy_id: id, type: 'donation' })).status).toBe(201)
  })

  it('refuses a pause that is not a date', async () => {
    const id = await publishedToy(owner.id)
    expect((await call(owner, `/api/toys/${id}`, 'PATCH', { paused_at: 'soon' })).status).toBe(400)
  })

  it('arrives un-paused when it changes hands in an exchange', async () => {
    const wanted = await publishedToy(owner.id, 'exchange')
    const offered = await publishedToy(asker.id)
    await adminClient().from('toys').update({ paused_at: new Date().toISOString() }).eq('id', offered)
    const { data: tx } = await adminClient()
      .from('toy_transactions')
      .insert({
        toy_id: wanted, offered_toy_id: offered, type: 'exchange', status: 'accepted', requester_id: asker.id,
        owner_id: owner.id, owner_code: '111111', requester_code: '222222',
      })
      .select('id')
      .single()
    expect((await call(owner, `/api/toy-transactions/${tx!.id}/confirm`, 'POST', { code: '222222' })).status).toBe(200)
    expect((await call(asker, `/api/toy-transactions/${tx!.id}/confirm`, 'POST', { code: '111111' })).status).toBe(200)
    const { data: moved } = await adminClient().from('toys').select('owner_id, paused_at').eq('id', offered).single()
    expect(moved).toEqual({ owner_id: owner.id, paused_at: null })
  })
})
```

Append to `toy-detail-screen.test.tsx` (inside `describe('ToyDetailScreen')`):

```tsx
  it('hides the request button on a paused toy and says why', async () => {
    mockEndpoints({ detail: Promise.resolve(toy({ paused_at: '2026-09-30T00:00:00Z' })) })
    render(<ToyDetailScreen id="toy1" />)
    expect(await screen.findByText('Not taking requests right now')).toBeTruthy()
    expect(screen.queryByText('Ask to collect it')).toBeNull()
  })
```

Append to `summary-screen.test.tsx` (inside the `describe`):

```tsx
  it('pauses and resumes requests from the summary', async () => {
    serve()
    mockPatch.mockResolvedValueOnce(toy({ paused_at: '2026-09-30T00:00:00Z' })).mockResolvedValueOnce(toy({ paused_at: null }))
    render(<ToySummaryScreen id="t1" />)
    expect(await screen.findByText('Keeps it listed but hides the request button')).toBeTruthy()
    fireEvent.press(screen.getByText('Mark unavailable'))
    expect(await screen.findByText('Take requests again')).toBeTruthy()
    expect(mockPatch).toHaveBeenCalledWith('/api/toys/t1', { paused_at: expect.any(String) })
    fireEvent.press(screen.getByText('Take requests again'))
    expect(await screen.findByText('Mark unavailable')).toBeTruthy()
    expect(mockPatch).toHaveBeenLastCalledWith('/api/toys/t1', { paused_at: null })
  })
```

Append to `packages/web/tests/unit/components/toy-transaction-request.test.tsx` (it has `toy()` and `myToy()` fixtures):

```tsx
describe('a paused toy', () => {
  it('says it is not taking requests and offers no way to ask', () => {
    render(<ToyTransactionRequest toy={toy({ paused_at: '2026-09-30T00:00:00Z' })} viewerId="viewer-1" myToys={[]} />)
    expect(screen.getByText('Not taking requests right now')).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
  })
})
```

Append to `packages/web/tests/unit/components/toy-editor.test.tsx` (inside `describe('ToyEditor')`):

```tsx
  it('pauses a live toy and offers to take requests again', async () => {
    vi.mocked(browserApiClient.patch).mockResolvedValue(toy({ status: 'published', paused_at: '2026-09-30T00:00:00Z' }))
    render(<ToyEditor toy={toy({ status: 'published' })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Mark unavailable' }))
    expect(await screen.findByRole('button', { name: 'Take requests again' })).toBeInTheDocument()
    expect(browserApiClient.patch).toHaveBeenCalledWith('/api/toys/t1', { paused_at: expect.any(String) })
  })
```

- [ ] **Step 2: Run them to see them fail**

Run: `supabase migration up` (nothing to apply yet), then `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/toys/paused.test.ts` → FAIL (column `paused_at` does not exist).
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/toys/toy-detail-screen.test.tsx tests/unit/components/my-toys/summary-screen.test.tsx` → FAIL.
Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/components/toy-transaction-request.test.tsx tests/unit/components/toy-editor.test.tsx` → FAIL.

- [ ] **Step 3: Implement**

`supabase/migrations/100_toy_paused.sql`:

```sql
-- 100 — Mark unavailable: a toy stops taking requests without leaving the library.
--
-- Decided 2026-09-30 (registry: toy-pause-unavailable). The toy stays listed
-- and readable, the request button hides, and POST /api/toy-transactions
-- refuses with 409; one tap resumes. A timestamp rather than a `status`
-- member: status is the draft/published axis the whole publish flow reads.
--
--   toys.paused_at  when the holder paused it. Null = taking requests.
--
-- Owner-editable through PATCH /api/toys/:id (both whitelists). The confirm
-- handler clears it when the toy changes hands: a pause is the holder's
-- choice, not the toy's.
--
-- DOWN:
--   alter table public.toys drop column if exists paused_at;

alter table public.toys add column paused_at timestamptz;
```

`toys.ts`:
- Add `'paused_at',` to `EDITABLE` (after `'tutorial_id',`). `ORG_EDITABLE` spreads `EDITABLE`, so org toys get it too.
- Above `checkFacts`, add:

```ts
/**
 * A timestamp the holder sets (100's paused_at, 101's retired_at): an ISO
 * date, or null to clear it. Anything else would reach Postgres as a cast
 * error and come back a 500.
 */
function badTimestamp(body: Record<string, unknown>, key: string): boolean {
  if (!(key in body) || body[key] === null) return false
  return typeof body[key] !== 'string' || Number.isNaN(Date.parse(body[key] as string))
}
```

- In `toys.patch('/:id', …)`, right after `const body = await c.req.json()`:

```ts
  if (badTimestamp(body, 'paused_at')) {
    return c.json({ error: 'Pausing needs a date, or nothing to take requests again.' }, 400)
  }
```

`toy-transactions.ts`, `toyTransactions.post('/', …)`:
- Select: `'id, owner_id, owner_org_id, quantity, offer_type, status'` → `'id, owner_id, owner_org_id, quantity, offer_type, status, paused_at'`.
- After the "your own organisation's toy" check (before `const atCapacity = …`):

```ts
  // Marked unavailable (100): still listed and readable, but no new asks.
  // A 409 rather than the capacity check's 404 — the toy is plainly there,
  // the holder has said not now.
  if (toy.paused_at) return c.json({ error: 'This toy is not taking requests right now' }, 409)
```

- In the confirm handler's `transferToy`, change the update to

```ts
      .update({ ...to, status: 'draft', paused_at: null, updated_at: now })
```

  and add `paused_at` to the doc comment above it: "and un-paused: a pause is the old holder's choice".

`packages/types/src/index.ts`, `Toy` — after `tutorial_id?: string | null`:

```ts
  /** Marked unavailable (100): listed and readable, but no new requests. */
  paused_at?: string | null
```

`request-block.tsx` — at the top of `RequestBlock`'s body, before `if (!toy.offer_type) {`:

```tsx
  if (toy.paused_at) return <Text style={styles.muted}>Not taking requests right now</Text>
```

`summary-screen.tsx`:
- Imports: `import { apiMessage, isOwnerSide } from '@splat-connect/types'`, `import { ErrorRow } from '../ui/ErrorRow'`; drop the `PendingRow` import.
- State: `const [error, setError] = useState<string | null>(null)`.
- After `const open = …`, add:

```tsx
  async function togglePaused() {
    setError(null)
    try {
      const updated = await apiClient.patch<Toy>(`/api/toys/${id}`, { paused_at: toy?.paused_at ? null : new Date().toISOString() })
      setToy((cur) => (cur ? { ...cur, ...updated } : updated))
    } catch (err) {
      setError(apiMessage(err, 'Could not save that. Please try again.'))
    }
  }
```

- Replace `<PendingRow pending="toy-pause-unavailable" label="Mark unavailable" icon="pause-circle-outline" />` with

```tsx
          {toy.status === 'published' ? (
            <ListRow
              title={toy.paused_at ? 'Take requests again' : 'Mark unavailable'}
              meta={toy.paused_at ? null : 'Keeps it listed but hides the request button'}
              onPress={togglePaused}
            />
          ) : null}
          <ErrorRow message={error} />
```

`editor.tsx` — the footer: delete `<PendingButton pending="toy-pause-unavailable" label="Mark unavailable" variant="ghost" />` (the control lives on the summary now) and drop the `PendingButton` import if nothing else in the file uses it (`grep -n PendingButton packages/mobile/components/my-toys/editor.tsx`).

`packages/web/components/toy-transaction-request.tsx` — after `if (viewerId && viewerId === toy.owner_id) return null`:

```tsx
  // Marked unavailable (100). The words are the board's printer card's.
  if (toy.paused_at) return <p className="m-0 text-sm font-bold text-muted">Not taking requests right now</p>
```

`packages/web/components/toy-editor.tsx`:
- After `publish()`:

```tsx
  // Throws on failure, like publish(): SubmitButton shows the error.
  async function togglePaused() {
    setToy(
      await browserApiClient.patch<Toy>(`/api/toys/${toy.id}`, {
        paused_at: toy.paused_at ? null : new Date().toISOString(),
      })
    )
  }
```

- In the status section's action row (`<div className="flex flex-wrap gap-2.5 border-t border-line pt-[18px]">`), after `{primary}`:

```tsx
        {live && (
          <SubmitButton
            label={toy.paused_at ? 'Take requests again' : 'Mark unavailable'}
            busyLabel="Saving…"
            errorMessage="Could not save that. Please try again."
            onSubmit={togglePaused}
          />
        )}
```

Mobile second-consumer check: `grep -rn "paused_at" packages/mobile` → request-block, summary-screen only.

- [ ] **Step 4: Run the tests to see them pass**

Run: `supabase migration up` → applies `100_toy_paused.sql`. Then the three commands from Step 2. Expected: PASS.

- [ ] **Step 5: Ship the item** — `shipped: true,` on `'toy-pause-unavailable'`; `node scripts/pending.mjs`; no parity rule names this id; drift test → `Tests  11 passed (11)`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/100_toy_paused.sql packages/api/src/routes/toys.ts packages/api/src/routes/toy-transactions.ts packages/api/tests/integration/toys/paused.test.ts packages/types/src/index.ts packages/mobile/components/toys/request-block.tsx packages/mobile/components/my-toys/summary-screen.tsx packages/mobile/components/my-toys/editor.tsx packages/mobile/tests/unit/components/toys/toy-detail-screen.test.tsx packages/mobile/tests/unit/components/my-toys/summary-screen.test.tsx packages/web/components/toy-transaction-request.tsx packages/web/components/toy-editor.tsx packages/web/tests/unit/components/toy-transaction-request.test.tsx packages/web/tests/unit/components/toy-editor.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(toys): mark a toy unavailable — still listed, no new requests (100)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 7: Requests on this toy (`my-toy-inline-requests`)

**Files:**
- Modify: `packages/mobile/components/my-toys/summary-screen.tsx`
- Modify: `packages/mobile/components/exchanges/thread-screen.tsx` (`startAccept`, `pickupFrom`), `packages/mobile/app/(my)/exchanges/[id].tsx`
- Modify: `packages/mobile/components/my-toys/editor.tsx` (delete the marker comment)
- Modify: `scripts/parity/app-screen-map.json` (the two `toy_detail` rules naming `my-toy-inline-requests`)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/mobile/tests/unit/components/my-toys/summary-screen.test.tsx`, `.../exchanges/thread-screen.test.tsx`

**Interfaces:**
- Consumes: `ToySummaryScreen`'s `open` (Task 5); `GET /api/toy-transactions` rows carry `requester_name`, `last_message`, `owner_org_id`, `blocked_by_rival_accept` already.
- Produces: `ExchangeThreadScreen({ id, startAccept }: { id: string; startAccept?: boolean })` — with `startAccept`, an owner opening a personal `requested` exchange lands on the pickup form already seeded from their profile. Route `/exchanges/[id]?accept=1` sets it.

Copy (MB): "{requester} · {their message}" as row title/meta, "Accept".

Why a route param and not a sheet: there is no accept sheet component — the pickup form is inline state in `thread-screen.tsx`. `?accept=1` opens that same form rather than copying it. `last_message` is the thread's newest message; it is shown only while it is the requester's own words, which on an untouched request is the note they sent with it.

- [ ] **Step 1: Write the failing tests**

Append to `summary-screen.test.tsx` (inside the `describe`):

```tsx
  it("lists each open request with the family's note, and Accept", async () => {
    serve({ txs: [request()] })
    render(<ToySummaryScreen id="t1" />)
    expect(await screen.findByText('Eastwood Special School')).toBeTruthy()
    expect(screen.getByText('For a class of four who share one switch')).toBeTruthy()
    // A personal toy needs a pickup address: the exchange's own form, seeded.
    fireEvent.press(screen.getByText('Accept'))
    expect(mockPush).toHaveBeenCalledWith('/exchanges/tx1?accept=1')
  })

  it("accepts an organisation's request on the spot", async () => {
    mockUseCapabilities.mockReturnValue(caps([{ id: 'org1', name: 'Northside' }]))
    serve({
      mine: [],
      inventory: [toy({ owner_id: null, owner_org_id: 'org1' })],
      txs: [request({ owner_id: null, owner_org_id: 'org1' })],
    })
    mockPost.mockResolvedValue({})
    render(<ToySummaryScreen id="t1" />)
    fireEvent.press(await screen.findByText('Accept'))
    expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/tx1/accept', {})
    await screen.findByText('Light-up drum — listed 4 June, good condition, switch-adapted.')
    expect(screen.queryByText('Eastwood Special School')).toBeNull()
  })

  it('shows no note when the newest message is not the family’s', async () => {
    serve({ txs: [request({ last_message: { body: 'Requested this toy for donation.', sender_id: 'fam1', kind: 'system', created_at: '' } })] })
    render(<ToySummaryScreen id="t1" />)
    await screen.findByText('Eastwood Special School')
    expect(screen.queryByText('Requested this toy for donation.')).toBeNull()
  })
```

Append to `thread-screen.test.tsx`:

```tsx
describe('opened to accept', () => {
  it("lands an owner on the pickup form, seeded from their profile", async () => {
    mockUseCapabilities.mockReturnValue(
      caps({}, { pickup_line1: '1 Home St', pickup_suburb: 'Newtown', pickup_state: 'NSW', pickup_postcode: '2042' })
    )
    mockGet.mockImplementation((p: string) =>
      p === '/api/toy-transactions/tx1' ? Promise.resolve(detail({})) : Promise.resolve({ lines: [], settlement: null })
    )
    render(<ExchangeThreadScreen id="tx1" startAccept />)
    expect(await screen.findByText('Where should they collect it?')).toBeTruthy()
    expect(screen.getByLabelText('Suburb').props.value).toBe('Newtown')
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/my-toys/summary-screen.test.tsx tests/unit/components/exchanges/thread-screen.test.tsx`
Expected: FAIL — `Unable to find an element with text: Eastwood Special School` and `Where should they collect it?`.

- [ ] **Step 3: Implement**

`thread-screen.tsx`:
- Below `type PickupDraft = …`:

```tsx
/** The owner's saved pickup address as the form's starting point. Every field stays editable. */
function pickupFrom(p?: Partial<Record<keyof PickupDraft, string | null>>): PickupDraft {
  return {
    pickup_line1: p?.pickup_line1 ?? '',
    pickup_suburb: p?.pickup_suburb ?? '',
    pickup_state: p?.pickup_state ?? '',
    pickup_postcode: p?.pickup_postcode ?? '',
  }
}
```

- Signature: `export function ExchangeThreadScreen({ id, startAccept = false }: { id: string; startAccept?: boolean }) {`.
- After the `useFocusEffect(…)` block and `viewerId` / `ledOrgIds`:

```tsx
  // Opened from a toy's summary to accept (?accept=1): go straight to the
  // pickup form, once, if this is still the owner's personal request to answer.
  const acceptOpened = useRef(false)
  useEffect(() => {
    if (!startAccept || acceptOpened.current || !tx || !caps) return
    if (tx.status !== 'requested' || tx.owner_org_id || !isOwnerSide(tx, viewerId, ledOrgIds)) return
    acceptOpened.current = true
    setPickup(pickupFrom(caps.profile))
  }, [startAccept, tx, caps, viewerId, ledOrgIds])
```

  (`ledOrgIds` is a new array each render; the ref keeps this to one run.)
- In the Accept button's `onPress`, replace the inline `setPickup({ pickup_line1: caps?.profile.pickup_line1 ?? '', … })` object with `setPickup(pickupFrom(caps?.profile))` (keep the comment above it).

`packages/mobile/app/(my)/exchanges/[id].tsx`:

```tsx
import { useLocalSearchParams } from 'expo-router'
import { ExchangeThreadScreen } from '../../../components/exchanges/thread-screen'

export default function ExchangeThreadRoute() {
  const { id, accept } = useLocalSearchParams<{ id: string; accept?: string }>()
  return <ExchangeThreadScreen id={id} startAccept={accept === '1'} />
}
```

`summary-screen.tsx`:
- Imports: add `Button` from `'../ui/Button'`; add `type ToyTransactionSummary` already there.
- State: `const [busy, setBusy] = useState(false)`.
- After `togglePaused`:

```tsx
  /** The family's own note, never a system line or a reply. */
  const noteOf = (t: ToyTransactionSummary) =>
    t.last_message?.kind === 'user' && t.last_message.sender_id === t.requester_id ? t.last_message.body : null

  async function accept(t: ToyTransactionSummary) {
    // A person picks where to meet as they accept: the exchange's own form.
    if (!t.owner_org_id) {
      router.push(`/exchanges/${t.id}?accept=1`)
      return
    }
    // An organisation's pickup point is fixed; accept reads it from the org.
    setBusy(true)
    setError(null)
    try {
      await apiClient.post(`/api/toy-transactions/${t.id}/accept`, {})
      setRequests((rs) => rs.map((r) => (r.id === t.id ? { ...r, status: 'accepted' } : r)))
    } catch (err) {
      setError(apiMessage(err, 'Could not accept that request. Please try again.'))
    } finally {
      setBusy(false)
    }
  }
```

- In the rows `View`, before the "Edit listing" row:

```tsx
          {open.map((t) => (
            <ListRow
              key={t.id}
              title={t.requester_name ?? t.other_party_name}
              meta={noteOf(t)}
              onPress={() => router.push(`/exchanges/${t.id}`)}
              trailing={
                <Button
                  label="Accept"
                  variant="secondary"
                  disabled={busy || t.blocked_by_rival_accept}
                  onPress={() => void accept(t)}
                  style={styles.accept}
                />
              }
            />
          ))}
```

- Style: `accept: { paddingHorizontal: theme.spacing(4), minHeight: 40 },`.

`editor.tsx`: delete the line `// PENDING(my-toy-inline-requests): list each request inline (who, their note, Accept) instead of a count.` (the count stays — it is the Review step's own row).

`scripts/parity/app-screen-map.json`: in the `toy_detail` entry delete both rules whose `pending` is `my-toy-inline-requests`; the `explained` array is now empty, so delete the `explained` key.

- [ ] **Step 4: Run the tests to see them pass**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Ship the item** — `shipped: true,` on `'my-toy-inline-requests'`; `node scripts/pending.mjs`; drift test → `Tests  11 passed (11)`.

- [ ] **Step 6: Commit**

```bash
git add packages/mobile/components/my-toys/summary-screen.tsx packages/mobile/components/exchanges/thread-screen.tsx "packages/mobile/app/(my)/exchanges/[id].tsx" packages/mobile/components/my-toys/editor.tsx packages/mobile/tests/unit/components/my-toys/summary-screen.test.tsx packages/mobile/tests/unit/components/exchanges/thread-screen.test.tsx scripts/parity/app-screen-map.json packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(mobile): each request on your toy, with the family's note and Accept

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 8: Retired toys (`inventory-states`, migration 101)

**Files:**
- Create: `supabase/migrations/101_toy_retired.sql`
- Modify: `packages/api/src/routes/toys.ts` (`ORG_EDITABLE`, note check), `packages/api/src/routes/toy-transactions.ts` (POST hides retired)
- Modify: `packages/types/src/index.ts` (`Toy.retired_at`, `retired_note`)
- Modify: `packages/mobile/components/organisation/inventory-screen.tsx`, `packages/mobile/components/my-toys/summary-screen.tsx`
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/api/tests/integration/toys/retired.test.ts` (new), `packages/mobile/tests/unit/components/organisation/inventory-screen.test.tsx`, `.../my-toys/summary-screen.test.tsx`

**Interfaces:**
- Consumes: `badTimestamp` (Task 6), `ToySummaryScreen` (Task 5), `FlashLine`/`useFlash`.
- Produces: columns `toys.retired_at timestamptz`, `toys.retired_note text` (≤ 80, org toys only); the toys select policy hides a retired toy from everyone but its holder, so every public read (library, detail, org profile, impact counts, auto picks in Task 9) drops it with no route change. `POST /api/toy-transactions` → 404 for a retired toy (as for a draft). `Toy.retired_at?`, `Toy.retired_note?`.

Copy: "Retired" pill, the note as the row's line (MB/WB: "Broken 12 Aug"), "Remove", toast "{name} removed from the shelf" (WB). Not on any board: "Retire", "Why it is retired" (flagged).

**Controller ruling (overrides the steps below where they differ):** Remove must never erase delivery history. 026's `toy_id … on delete cascade` would take the toy's past handoffs with it and shrink "Delivered all time". So `DELETE /api/toys/:id` refuses (409, "This toy has handovers on record, so it stays on the shelf as retired.") when any `toy_transactions` row references the toy; it deletes only a toy with no history. Inventory shows **Remove** only on retired toys with no handovers (the inventory row needs a `has_history` boolean — add it to the `/inventory` response from a count of the toy's transactions via the admin client), and a retired toy with history keeps its "Retired" pill and note with no Remove button. Add API tests for both the 409 and the plain delete, and a mobile test that a retired toy with history shows no Remove. The editor's Delete gets the same 409 path for free; show its message.

- [ ] **Step 1: Write the failing tests**

`packages/api/tests/integration/toys/retired.test.ts`:

```ts
/**
 * Retired org toys: off the public library and out of the request flow, still
 * on the leader's own shelf with the reason. A person's toy cannot be retired.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, addLeader, createOrgToy, cleanupOrg } from '../../helpers/orgs.js'

let leader: TestUser
let family: TestUser
let orgId: string
let toyId: string
let personToy: string

const call = (u: TestUser, path: string, method: string, body?: unknown) =>
  app.request(path, {
    method,
    headers: { Authorization: `Bearer ${u.token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

beforeAll(async () => {
  leader = await createTestUser('contributor')
  family = await createTestUser('contributor')
  orgId = await createOrg({ createdBy: leader.id })
  await addLeader(orgId, leader.id)
  toyId = await createOrgToy({ orgId, name: 'Spinning top' })
  personToy = (
    await adminClient()
      .from('toys')
      .insert({ owner_id: family.id, name: 'Drum', condition: 8, photo_urls: ['https://example.com/d.jpg'], offer_type: 'donation', status: 'published' })
      .select('id')
      .single()
  ).data!.id
})

afterAll(async () => {
  await adminClient().from('toys').delete().eq('id', personToy)
  await cleanupOrg(orgId)
  await deleteTestUser(leader.id)
  await deleteTestUser(family.id)
})

describe('101 toy retired', () => {
  it('has the columns', async () => {
    const { error } = await adminClient().from('toys').select('retired_at, retired_note').limit(1)
    expect(error).toBeNull()
  })

  it('refuses a reason longer than 80 characters', async () => {
    const res = await call(leader, `/api/toys/${toyId}`, 'PATCH', { retired_at: new Date().toISOString(), retired_note: 'x'.repeat(81) })
    expect(res.status).toBe(400)
  })

  it('takes a retired toy out of the library and the request flow, and keeps it on the shelf', async () => {
    const res = await call(leader, `/api/toys/${toyId}`, 'PATCH', { retired_at: new Date().toISOString(), retired_note: 'Broken 12 Aug' })
    expect(res.status).toBe(200)

    const list = (await (await app.request('/api/public/toys')).json()) as Array<{ id: string }>
    expect(list.map((t) => t.id)).not.toContain(toyId)
    expect((await app.request(`/api/public/toys/${toyId}`)).status).toBe(404)
    expect((await call(family, '/api/toy-transactions', 'POST', { toy_id: toyId, type: 'donation' })).status).toBe(404)

    const shelf = (await (await call(leader, '/api/toys/inventory', 'GET')).json()) as Array<{ id: string; retired_note: string | null }>
    expect(shelf.find((t) => t.id === toyId)?.retired_note).toBe('Broken 12 Aug')
  })

  it("does not let a person retire their own toy", async () => {
    const res = await call(family, `/api/toys/${personToy}`, 'PATCH', { retired_at: new Date().toISOString() })
    expect(res.status).toBe(200)
    expect(((await res.json()) as { retired_at: string | null }).retired_at).toBeNull()
  })
})
```

Append to `inventory-screen.test.tsx`. Change its api-client mock to

```tsx
const mockGet = jest.fn()
const mockDelete = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => mockGet(...a), delete: (...a: unknown[]) => mockDelete(...a) },
}))
```

add `import { Alert } from 'react-native'` and `waitFor` to the RNTL import, then inside `describe('InventoryScreen')`:

```tsx
  it('shows a retired toy with its reason, and removes it from the shelf', async () => {
    mockGet.mockResolvedValue([stock({ id: 'toy1', name: 'Spinning top', quantity: 1, retired_at: '2026-08-12T00:00:00Z', retired_note: 'Broken 12 Aug' })])
    mockDelete.mockResolvedValue({ id: 'toy1' })
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.text === 'Remove')?.onPress?.()
    })
    render(<InventoryScreen />)
    expect(await screen.findByText('Retired')).toBeTruthy()
    expect(screen.getByText('Broken 12 Aug')).toBeTruthy()
    fireEvent.press(screen.getByText('Remove'))
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/api/toys/toy1'))
    expect(await screen.findByText('Spinning top removed from the shelf')).toBeTruthy()
    expect(screen.queryByText('Broken 12 Aug')).toBeNull()
  })
```

Append to `summary-screen.test.tsx` (inside the `describe`):

```tsx
  it("retires an organisation's toy with a reason", async () => {
    mockUseCapabilities.mockReturnValue(caps([{ id: 'org1', name: 'Northside' }]))
    serve({ mine: [], inventory: [toy({ owner_id: null, owner_org_id: 'org1' })] })
    mockPatch.mockResolvedValue(toy({ owner_id: null, owner_org_id: 'org1', retired_at: '2026-08-12T00:00:00Z', retired_note: 'Broken 12 Aug' }))
    render(<ToySummaryScreen id="t1" />)
    fireEvent.changeText(await screen.findByLabelText('Why it is retired'), 'Broken 12 Aug')
    fireEvent.press(screen.getByText('Retire'))
    expect(await screen.findByText('Retired')).toBeTruthy()
    expect(mockPatch).toHaveBeenCalledWith('/api/toys/t1', { retired_at: expect.any(String), retired_note: 'Broken 12 Aug' })
  })

  it('offers no Retire on a personal toy', async () => {
    serve()
    render(<ToySummaryScreen id="t1" />)
    await screen.findByText('Edit listing')
    expect(screen.queryByText('Retire')).toBeNull()
  })
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/toys/retired.test.ts` → FAIL (column `retired_at` does not exist).
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/organisation/inventory-screen.test.tsx tests/unit/components/my-toys/summary-screen.test.tsx` → FAIL.

- [ ] **Step 3: Implement**

`supabase/migrations/101_toy_retired.sql`:

```sql
-- 101 — Retired: an organisation's toy that is broken or worn out.
--
-- Decided 2026-09-30 (registry: inventory-states): no lending — toys are given,
-- exchanged, built or printed — so there is no Out or Needs clean. Retired is
-- the one state left: the toy leaves the public library and the request flow,
-- and stays on the leader's shelf with the reason until they remove it.
--
--   toys.retired_at    when it was retired. Org toys only.
--   toys.retired_note  why, in the leader's words: "Broken 12 Aug". ≤ 80.
--
-- The public read is the select policy, so every public surface (library,
-- detail, org profile, impact counts, auto picks) drops a retired toy at once.
-- The holder's own arms (owner_id, is_org_leader) still see it.
--
-- DOWN:
--   drop policy "Anyone can read published toys, or their own draft" on public.toys;
--   create policy "Anyone can read published toys, or their own draft"
--     on public.toys for select
--     using (status = 'published' or owner_id = auth.uid() or public.is_org_leader(owner_org_id));
--   alter table public.toys drop constraint if exists toys_retired_org_only;
--   alter table public.toys drop column if exists retired_note;
--   alter table public.toys drop column if exists retired_at;

alter table public.toys
  add column retired_at timestamptz,
  add column retired_note text
    check (retired_note is null or length(btrim(retired_note)) between 1 and 80),
  add constraint toys_retired_org_only check (retired_at is null or owner_org_id is not null);

drop policy "Anyone can read published toys, or their own draft" on public.toys;
create policy "Anyone can read published toys, or their own draft"
  on public.toys for select
  using (
    (status = 'published' and retired_at is null)
    or owner_id = auth.uid()
    or public.is_org_leader(owner_org_id)
  );
```

`toys.ts`:
- `const ORG_EDITABLE = [...EDITABLE, 'quantity'] as const` → `const ORG_EDITABLE = [...EDITABLE, 'quantity', 'retired_at', 'retired_note'] as const` (and extend the comment above it: "retired_at/retired_note likewise: 101 allows them on org toys only").
- In `toys.patch('/:id', …)`, after the `isOrgToy` quantity check:

```ts
  if (isOrgToy) {
    if (badTimestamp(body, 'retired_at')) return c.json({ error: 'Retiring needs a date, or nothing to bring it back.' }, 400)
    if ('retired_note' in body && body.retired_note !== null) {
      if (typeof body.retired_note !== 'string' || body.retired_note.trim().length > 80) {
        return c.json({ error: 'Keep the reason to 80 characters.' }, 400)
      }
      body.retired_note = body.retired_note.trim() || null
    }
  }
```

`toy-transactions.ts`, `toyTransactions.post('/', …)`:
- Select: add `retired_at` (`'id, owner_id, owner_org_id, quantity, offer_type, status, paused_at, retired_at'`).
- `if (!toy || toy.status !== 'published') return c.json({ error: 'Not found' }, 404)` → `if (!toy || toy.status !== 'published' || toy.retired_at) return c.json({ error: 'Not found' }, 404)` (this read is the admin client, so RLS does not hide it here).

`packages/types/src/index.ts`, `Toy` — after `paused_at`:

```ts
  /** Retired (101): an org toy off the library, still on the leader's shelf. */
  retired_at?: string | null
  /** Why, in the leader's words: "Broken 12 Aug". ≤ 80. */
  retired_note?: string | null
```

`inventory-screen.tsx`:
- Imports: `Text` is not needed; add `import { confirmDestructive, notify } from '../../lib/confirm'`, `import { FlashLine, useFlash } from '../ui/Flash'`.
- `StockRow` gets `onRemove: () => void` in its props, and:
  - the pill: a retired toy first —

```tsx
  const pill = toy.retired_at ? (
    <Pill label="Retired" bg={theme.colors.surfaceSunken} fg={theme.colors.muted} icon="archive-outline" />
  ) : toy.quantity === 0 ? (
```

    (the rest of the existing chain unchanged);
  - `meta` — the reason stands in for the stock line on a retired toy:

```tsx
        meta={
          toy.retired_at
            ? toy.retired_note ?? gradeOf(toy.condition).label
            : `${toy.quantity} in stock · ${gradeOf(toy.condition).label}${toy.switch_adapted ? ' · Switch-adapted' : ''}`
        }
```

  - `trailing={toy.retired_at ? <Button label="Remove" variant="danger" onPress={onRemove} /> : undefined}` on the `ListRow`.
- Replace the `// PENDING(inventory-states): …` comment above `InventoryScreen` with nothing.
- In `InventoryScreen`: `const [flash, setFlash] = useFlash()`, and

```tsx
  const remove = (toy: ToyWithOwner) =>
    confirmDestructive(`Remove ${toy.name}?`, 'This cannot be undone.', 'Remove', async () => {
      try {
        await apiClient.delete(`/api/toys/${toy.id}`)
        setToys((ts) => ts.filter((t) => t.id !== toy.id))
        setFlash(`${toy.name} removed from the shelf`)
      } catch {
        notify(`Could not remove ${toy.name}`, 'Please try again.')
      }
    })
```

- The lead counts only what is on offer: `const units = toys.filter((t) => !t.retired_at).reduce((n, t) => n + t.quantity, 0)`.
- Pass `onRemove={() => remove(toy)}` to each `StockRow`, and render `<FlashLine message={flash} />` right after `<ListIntro … />`.

`summary-screen.tsx`:
- Imports: `import { Text } from 'react-native'` (add to the existing import), `TextField` from `'../ui/TextField'`, `Pill` from `'../list/list-kit'`.
- State: `const [retireNote, setRetireNote] = useState('')`.
- After `accept`:

```tsx
  async function retire() {
    setBusy(true)
    setError(null)
    try {
      const updated = await apiClient.patch<Toy>(`/api/toys/${id}`, {
        retired_at: new Date().toISOString(),
        retired_note: retireNote.trim() || null,
      })
      setToy((cur) => (cur ? { ...cur, ...updated } : updated))
    } catch (err) {
      setError(apiMessage(err, 'Could not retire this toy. Please try again.'))
    } finally {
      setBusy(false)
    }
  }
```

- After the rows `View` (inside the `ScrollView`):

```tsx
        {toy.owner_org_id ? (
          toy.retired_at ? (
            <View style={styles.retired}>
              <Pill label="Retired" bg={theme.colors.surfaceSunken} fg={theme.colors.muted} icon="archive-outline" />
              {toy.retired_note ? <Text style={styles.note}>{toy.retired_note}</Text> : null}
            </View>
          ) : (
            <View style={styles.retired}>
              <TextField
                label="Why it is retired"
                accessibilityLabel="Why it is retired"
                placeholder="Broken 12 Aug"
                maxLength={80}
                value={retireNote}
                onChangeText={setRetireNote}
              />
              <Button label="Retire" variant="secondary" disabled={busy} onPress={() => void retire()} />
            </View>
          )
        ) : null}
```

- Styles: `retired: { marginTop: theme.spacing(5), gap: theme.spacing(2) },` and `note: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted },`.

Mobile second-consumer check: `grep -rn "retired_" packages/mobile` → inventory-screen, summary-screen only.

- [ ] **Step 4: Run the tests to see them pass**

Run: `supabase migration up` → applies `101_toy_retired.sql`; then both commands from Step 2. Expected: PASS.
Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/toys tests/integration/public/org-profile.test.ts` → PASS (the policy change leaves every other toy read as it was).

- [ ] **Step 5: Ship the item** — `shipped: true,` on `'inventory-states'`; `node scripts/pending.mjs`; no parity rule names this id; drift test → `Tests  11 passed (11)`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/101_toy_retired.sql packages/api/src/routes/toys.ts packages/api/src/routes/toy-transactions.ts packages/api/tests/integration/toys/retired.test.ts packages/types/src/index.ts packages/mobile/components/organisation/inventory-screen.tsx packages/mobile/components/my-toys/summary-screen.tsx packages/mobile/tests/unit/components/organisation/inventory-screen.test.tsx packages/mobile/tests/unit/components/my-toys/summary-screen.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(toys): retire a broken org toy — off the library, on the shelf with why (101)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---
### Task 9: Also worth a look — data and API (`toy-holder-picks`, part 1 of 2, migration 102)

No ship in this task: the registry entry flips in Task 10, with the screens.

**Files:**
- Create: `supabase/migrations/102_toy_picks.sql`, `packages/types/src/toy-picks.ts`
- Modify: `packages/types/src/index.ts` (re-exports; `Toy.picks_mode`, `Toy.toy_picks`, `ToyDetail.picks`)
- Modify: `packages/api/src/routes/toys.ts` (`picks_mode` in `EDITABLE`; embeds; `PUT /:id/picks`), `packages/api/src/routes/public.ts` (`holderPicks`), `packages/api/src/routes/toy-transactions.ts` (`transferToy` resets picks)
- Modify: `scripts/check-schema-guards.sh`
- Test: `packages/api/tests/integration/toys/picks.test.ts` (new), `packages/web/tests/unit/lib/toy-picks.test.ts` (new)

**Interfaces:**
- Consumes: `gradeOf` (Task 1); the 101 select policy (retired toys are invisible to anon).
- Produces:
  - `toys.picks_mode text not null default 'auto'` ('auto' | 'picked'); table `toy_picks(toy_id, position 1–3, entity_type 'toy'|'tutorial', entity_id)`, PK `(toy_id, position)`.
  - From `@splat-connect/types`: `type PicksMode = 'auto' | 'picked'`; `type ToyPickInput = { entity_type: 'toy' | 'tutorial'; entity_id: string }`; `interface ToyPick { kind: 'toy' | 'toy_adaptation' | 'assistive_tech'; id: string; title: string; photo_url: string | null; meta: string | null }`; `PICK_KIND_LABEL: Record<ToyPick['kind'], string>`; `autoPicks<T extends { id: string; created_at: string; owner_id: string | null; owner_org_id: string | null }>(toy: Pick<T, 'id' | 'owner_id' | 'owner_org_id'>, listed: readonly T[]): T[]`.
  - `Toy.picks_mode?: PicksMode`, `Toy.toy_picks?: { position: number; entity_type: 'toy' | 'tutorial'; entity_id: string }[]` (on `GET /api/toys` and `/inventory`), `ToyDetail.picks?: ToyPick[]` (always present from `GET /api/public/toys/:id`).
  - `PUT /api/toys/:id/picks` `{ picks: ToyPickInput[] }` → 200 `{ picks }`; 400 more than three, a malformed pick, a duplicate, the toy itself, another holder's or an unlisted toy, a guide that is not approved; 404 not the caller's toy. `PATCH /api/toys/:id` accepts `picks_mode`.

Copy: `PICK_KIND_LABEL` is MB's `mToyRecs` kinds — "Toy in the library", "Toy adaptation guide", "Assistive tech guide".

- [ ] **Step 1: Write the failing tests**

`packages/web/tests/unit/lib/toy-picks.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { autoPicks, PICK_KIND_LABEL } from '@splat-connect/types'

const row = (id: string, created_at: string, owner_id: string | null = 'p1', owner_org_id: string | null = null) => ({ id, created_at, owner_id, owner_org_id })

describe('autoPicks', () => {
  it("is up to three of the holder's other toys, newest first", () => {
    const listed = [row('a', '2026-01-01'), row('b', '2026-02-01'), row('c', '2026-03-01'), row('d', '2026-04-01'), row('e', '2026-05-01'), row('x', '2026-06-01', 'p2')]
    expect(autoPicks(row('a', ''), listed).map((t) => t.id)).toEqual(['e', 'd', 'c'])
  })
  it("matches an organisation's toys by the organisation, not a person", () => {
    const listed = [row('o1', '2026-01-01', null, 'org1'), row('o2', '2026-02-01', null, 'org1'), row('p', '2026-03-01', null, 'org2')]
    expect(autoPicks(row('o1', '', null, 'org1'), listed).map((t) => t.id)).toEqual(['o2'])
  })
  it('is empty for a holder with nothing else listed', () => {
    expect(autoPicks(row('a', ''), [row('a', '2026-01-01')])).toEqual([])
  })
  it("names each kind in the board's words", () => {
    expect(PICK_KIND_LABEL).toEqual({ toy: 'Toy in the library', toy_adaptation: 'Toy adaptation guide', assistive_tech: 'Assistive tech guide' })
  })
})
```

`packages/api/tests/integration/toys/picks.test.ts`:

```ts
/**
 * "Also worth a look": automatic (the holder's other listed toys, newest first)
 * or hand-picked (up to three of their own toys and published guides). A pick
 * that stops being public drops out of the public read, and the picks reset
 * when the toy changes hands.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let holder: TestUser
let other: TestUser
let family: TestUser
const t: Record<string, string> = {}
let guide: string
let pendingGuide: string

const call = (u: TestUser, path: string, method: string, body?: unknown) =>
  app.request(path, {
    method,
    headers: { Authorization: `Bearer ${u.token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
const insertToy = async (ownerId: string, name: string, created_at: string, status = 'published') =>
  (
    await adminClient()
      .from('toys')
      .insert({ owner_id: ownerId, name, condition: 8, photo_urls: ['https://example.com/t.jpg'], offer_type: 'donation', status, created_at })
      .select('id')
      .single()
  ).data!.id as string
const insertGuide = async (title: string, status: string) =>
  (
    await adminClient()
      .from('tutorials')
      .insert({ title, description: 'x', difficulty: 'easy', status, kind: 'assistive_tech' })
      .select('id')
      .single()
  ).data!.id as string
const publicPicks = async (id: string) =>
  ((await (await app.request(`/api/public/toys/${id}`)).json()) as { picks: Array<{ kind: string; id: string; title: string; meta: string | null }> }).picks

beforeAll(async () => {
  holder = await createTestUser('contributor')
  other = await createTestUser('contributor')
  family = await createTestUser('contributor')
  t.a = await insertToy(holder.id, 'Drum', '2026-01-01T00:00:00Z')
  t.b = await insertToy(holder.id, 'Bubbles', '2026-02-01T00:00:00Z')
  t.c = await insertToy(holder.id, 'Fan', '2026-03-01T00:00:00Z')
  t.d = await insertToy(holder.id, 'Lights', '2026-04-01T00:00:00Z')
  t.draft = await insertToy(holder.id, 'Unfinished', '2026-05-01T00:00:00Z', 'draft')
  t.x = await insertToy(other.id, 'Not theirs', '2026-06-01T00:00:00Z')
  guide = await insertGuide('Switch mount', 'approved')
  pendingGuide = await insertGuide('Still in review', 'pending')
})

afterAll(async () => {
  const admin = adminClient()
  const ids = Object.values(t)
  await admin.from('toy_transactions').delete().in('toy_id', ids)
  await admin.from('toys').delete().in('id', ids)
  await admin.from('tutorials').delete().in('id', [guide, pendingGuide])
  for (const u of [holder, other, family]) await deleteTestUser(u.id)
})

describe('102 toy picks', () => {
  it('has the column and the table', async () => {
    const admin = adminClient()
    expect((await admin.from('toys').select('picks_mode').limit(1)).error).toBeNull()
    expect((await admin.from('toy_picks').select('toy_id, position, entity_type, entity_id').limit(1)).error).toBeNull()
  })

  it("shows the holder's other listed toys, newest first, by default", async () => {
    const picks = await publicPicks(t.a)
    expect(picks.map((p) => p.id)).toEqual([t.d, t.c, t.b])
    expect(picks[0]).toMatchObject({ kind: 'toy', title: 'Lights', meta: 'Good' })
  })

  it('refuses a mode that is not auto or picked', async () => {
    expect((await call(holder, `/api/toys/${t.a}`, 'PATCH', { picks_mode: 'sideways' })).status).toBe(400)
  })

  it('refuses picks that are not the holder’s to make', async () => {
    const put = (picks: unknown) => call(holder, `/api/toys/${t.a}/picks`, 'PUT', { picks })
    expect((await put([{ entity_type: 'toy', entity_id: t.x }])).status).toBe(400)
    expect((await put([{ entity_type: 'toy', entity_id: t.a }])).status).toBe(400)
    expect((await put([{ entity_type: 'toy', entity_id: t.draft }])).status).toBe(400)
    expect((await put([{ entity_type: 'tutorial', entity_id: pendingGuide }])).status).toBe(400)
    expect((await put([t.b, t.c, t.d, t.b].map((id) => ({ entity_type: 'toy', entity_id: id })))).status).toBe(400)
    expect((await put([{ entity_type: 'toy', entity_id: t.b }, { entity_type: 'toy', entity_id: t.b }])).status).toBe(400)
    expect((await call(other, `/api/toys/${t.a}/picks`, 'PUT', { picks: [] })).status).toBe(404)
  })

  it('shows the hand-picked ones in order, and drops one that stops being public', async () => {
    const res = await call(holder, `/api/toys/${t.a}/picks`, 'PUT', {
      picks: [{ entity_type: 'tutorial', entity_id: guide }, { entity_type: 'toy', entity_id: t.b }],
    })
    expect(res.status).toBe(200)
    expect((await call(holder, `/api/toys/${t.a}`, 'PATCH', { picks_mode: 'picked' })).status).toBe(200)
    expect(await publicPicks(t.a)).toEqual([
      { kind: 'assistive_tech', id: guide, title: 'Switch mount', photo_url: null, meta: null },
      { kind: 'toy', id: t.b, title: 'Bubbles', photo_url: 'https://example.com/t.jpg', meta: 'Good' },
    ])

    const mine = (await (await call(holder, '/api/toys', 'GET')).json()) as Array<{ id: string; toy_picks: unknown[] }>
    expect(mine.find((x) => x.id === t.a)?.toy_picks).toHaveLength(2)

    await adminClient().from('toys').update({ status: 'draft' }).eq('id', t.b)
    expect((await publicPicks(t.a)).map((p) => p.id)).toEqual([guide])
  })

  it('goes back to automatic, with no picks, when the toy changes hands', async () => {
    const { data: tx } = await adminClient()
      .from('toy_transactions')
      .insert({ toy_id: t.a, type: 'donation', status: 'accepted', requester_id: family.id, owner_id: holder.id, owner_code: '111111', requester_code: '222222' })
      .select('id')
      .single()
    expect((await call(holder, `/api/toy-transactions/${tx!.id}/confirm`, 'POST', { code: '222222' })).status).toBe(200)
    const admin = adminClient()
    const { data: moved } = await admin.from('toys').select('owner_id, picks_mode').eq('id', t.a).single()
    expect(moved).toEqual({ owner_id: family.id, picks_mode: 'auto' })
    const { count } = await admin.from('toy_picks').select('toy_id', { count: 'exact', head: true }).eq('toy_id', t.a)
    expect(count).toBe(0)
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/lib/toy-picks.test.ts` → FAIL (`autoPicks` not exported).
Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/toys/picks.test.ts` → FAIL (column `picks_mode` does not exist).

- [ ] **Step 3: Implement**

`supabase/migrations/102_toy_picks.sql`:

```sql
-- 102 — "Also worth a look" on a toy: the holder chooses how.
--
-- Decided 2026-09-30 (registry: toy-holder-picks): the holder picks the mode
-- and can change it — automatic (their other listed toys, newest first, which
-- is what the web page did) or hand-picked, up to three, like 048's guide
-- recommendations. A pick is one of the holder's own toys or a published guide.
--
--   toys.picks_mode  'auto' | 'picked'.
--   toy_picks        (toy_id, position 1–3, entity_type, entity_id). Position
--                    1..3 plus the (toy_id, position) key IS the three-cap,
--                    as in 048. entity_id has no foreign key because it points
--                    at one of two tables; the public read drops any pick that
--                    is not public, so a dangling one shows nothing.
--
-- RLS in 048's shape: read while the toy is publicly listed, or by its holder;
-- the holder (owner, or a leader of the owning org) writes; admins do anything.
-- The API checks that every pick is the holder's own toy or an approved guide.
-- The confirm handler resets both when the toy changes hands.
--
-- DOWN:
--   drop table if exists public.toy_picks;
--   alter table public.toys drop column if exists picks_mode;

alter table public.toys
  add column picks_mode text not null default 'auto' check (picks_mode in ('auto', 'picked'));

create table public.toy_picks (
  toy_id      uuid not null references public.toys on delete cascade,
  position    smallint not null check (position between 1 and 3),
  entity_type text not null check (entity_type in ('toy', 'tutorial')),
  entity_id   uuid not null,
  primary key (toy_id, position),
  unique (toy_id, entity_type, entity_id),
  check (not (entity_type = 'toy' and entity_id = toy_id))
);

alter table public.toy_picks enable row level security;

create policy "Anyone can read picks of a listed toy, holders their own"
  on public.toy_picks for select using (
    exists (
      select 1 from public.toys t
      where t.id = toy_id
        and ((t.status = 'published' and t.retired_at is null)
             or t.owner_id = auth.uid()
             or public.is_org_leader(t.owner_org_id))
    )
  );

create policy "Holders write their toy's picks"
  on public.toy_picks for all
  using (
    exists (
      select 1 from public.toys t
      where t.id = toy_id and (t.owner_id = auth.uid() or public.is_org_leader(t.owner_org_id))
    )
  )
  with check (
    exists (
      select 1 from public.toys t
      where t.id = toy_id and (t.owner_id = auth.uid() or public.is_org_leader(t.owner_org_id))
    )
  );

create policy "Admin full access to toy_picks"
  on public.toy_picks for all using (public.is_admin());
```

`packages/types/src/toy-picks.ts`:

```ts
/**
 * "Also worth a look" on a toy (102): automatic, or up to three the holder
 * picked from their own toys and published guides.
 */
export type PicksMode = 'auto' | 'picked'

export type ToyPickInput = { entity_type: 'toy' | 'tutorial'; entity_id: string }

/** One card, as the public read sends it. A guide's kind is its tutorials.kind (048). */
export interface ToyPick {
  kind: 'toy' | 'toy_adaptation' | 'assistive_tech'
  id: string
  title: string
  photo_url: string | null
  /** A toy's grade word; nothing for a guide. */
  meta: string | null
}

/** The board's eyebrow over each card (MB mToyRecs). */
export const PICK_KIND_LABEL: Record<ToyPick['kind'], string> = {
  toy: 'Toy in the library',
  toy_adaptation: 'Toy adaptation guide',
  assistive_tech: 'Assistive tech guide',
}

/** Automatic picks: up to three of the same holder's other listed toys, newest first. */
export function autoPicks<T extends { id: string; created_at: string; owner_id: string | null; owner_org_id: string | null }>(
  toy: Pick<T, 'id' | 'owner_id' | 'owner_org_id'>,
  listed: readonly T[]
): T[] {
  return listed
    .filter((t) => t.id !== toy.id && (toy.owner_org_id ? t.owner_org_id === toy.owner_org_id : t.owner_id === toy.owner_id))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 3)
}
```

`packages/types/src/index.ts`:
- Re-exports beside Task 1's:

```ts
export { autoPicks, PICK_KIND_LABEL } from './toy-picks'
export type { PicksMode, ToyPick, ToyPickInput } from './toy-picks'
import type { PicksMode, ToyPick } from './toy-picks'
```

- `Toy`, after `retired_note`:

```ts
  /** "Also worth a look" (102): automatic, or the holder's own picks. */
  picks_mode?: PicksMode
  /** The holder's picks, in order. Only on the holder's own reads (GET /api/toys, /inventory). */
  toy_picks?: { position: number; entity_type: 'toy' | 'tutorial'; entity_id: string }[]
```

- `ToyDetail`, after `holder_state`:

```ts
  /** "Also worth a look", resolved: automatic or hand-picked, public ones only. */
  picks?: ToyPick[]
```

`toys.ts`:
- Imports: `import type { OfferType, ToyPickInput } from '@splat-connect/types'`.
- Add `'picks_mode',` to `EDITABLE`.
- In `toys.patch('/:id', …)`, after the `paused_at` check:

```ts
  if ('picks_mode' in body && body.picks_mode !== 'auto' && body.picks_mode !== 'picked') {
    return c.json({ error: 'Show picks automatically or hand-picked.' }, 400)
  }
```

- `GET /` select `'*, save_count, request_count'` → `'*, save_count, request_count, toy_picks(position, entity_type, entity_id)'`; `GET /inventory` select `'*, organizations(name)'` → `'*, organizations(name), toy_picks(position, entity_type, entity_id)'`.
- After the `toys.patch('/:id/publish', …)` handler:

```ts
/**
 * PUT /api/toys/:id/picks — the holder's hand-picked "Also worth a look",
 * replaced whole, in the order sent. Up to three, each one of the holder's own
 * listed toys or a published guide; 102's position and type checks back this.
 */
toys.put('/:id/picks', async (c) => {
  const body = await c.req.json().catch(() => null)
  const picks = (body as { picks?: unknown } | null)?.picks
  if (!Array.isArray(picks) || picks.length > 3) return c.json({ error: 'Pick up to three.' }, 400)
  const valid = picks.every(
    (p): p is ToyPickInput =>
      !!p && typeof p === 'object' && (p.entity_type === 'toy' || p.entity_type === 'tutorial') && typeof p.entity_id === 'string'
  )
  if (!valid) return c.json({ error: 'Each pick is one of your toys or a guide.' }, 400)
  const list = picks as ToyPickInput[]
  if (new Set(list.map((p) => `${p.entity_type}:${p.entity_id}`)).size !== list.length) {
    return c.json({ error: 'Pick each one once.' }, 400)
  }

  const supabase = createUserClient(c.get('token'))
  const orgIds = await ledOrgIds(supabase, c.get('userId'))
  const { data: toy, error } = await supabase
    .from('toys')
    .select('id, owner_id, owner_org_id')
    .eq('id', c.req.param('id'))
    .or(ownedByCaller(c.get('userId'), orgIds))
    .maybeSingle()
  if (error) {
    if (error.code === INVALID_TEXT_REPRESENTATION) return c.json({ error: 'Not found' }, 404)
    return c.json({ error: error.message }, 500)
  }
  if (!toy) return c.json({ error: 'Not found' }, 404)

  const toyIds = list.filter((p) => p.entity_type === 'toy').map((p) => p.entity_id)
  if (toyIds.includes(toy.id)) return c.json({ error: 'A toy cannot point at itself.' }, 400)
  if (toyIds.length) {
    // A malformed id errors here and returns no rows: the same 400.
    const { data: own } = await supabase
      .from('toys')
      .select('id')
      .in('id', toyIds)
      .eq(toy.owner_org_id ? 'owner_org_id' : 'owner_id', toy.owner_org_id ?? toy.owner_id)
      .eq('status', 'published')
    if ((own ?? []).length !== toyIds.length) return c.json({ error: 'Pick from your own listed toys.' }, 400)
  }
  const guideIds = list.filter((p) => p.entity_type === 'tutorial').map((p) => p.entity_id)
  if (guideIds.length) {
    const { data: approved } = await supabase.from('tutorials').select('id').in('id', guideIds).eq('status', 'approved')
    if ((approved ?? []).length !== guideIds.length) {
      return c.json({ error: 'Pick guides that are published in the library.' }, 400)
    }
  }

  const { error: clearError } = await supabase.from('toy_picks').delete().eq('toy_id', toy.id)
  if (clearError) return c.json({ error: clearError.message }, 500)
  const rows = list.map((p, i) => ({ toy_id: toy.id, position: i + 1, entity_type: p.entity_type, entity_id: p.entity_id }))
  if (rows.length) {
    const { error: insertError } = await supabase.from('toy_picks').insert(rows)
    if (insertError) return c.json({ error: insertError.message }, 500)
  }
  return c.json({ picks: list.map((p, i) => ({ position: i + 1, ...p })) })
})
```

  Add `PUT /api/toys/:id/picks` to the endpoint list in the file's header comment.

`public.ts`:
- Imports: add `autoPicks, gradeOf` to the `@splat-connect/types` value import, and `ToyPick` to the type import.
- Above `publicRoutes.get('/toys', …)`:

```ts
type ListedToy = {
  id: string
  name: string
  cover_photo_url: string | null
  condition: number
  created_at: string
  owner_id: string | null
  owner_org_id: string | null
}
const LISTED_TOY = 'id, name, cover_photo_url, condition, created_at, owner_id, owner_org_id'

/**
 * "Also worth a look" (102). Automatic: up to three of the holder's other
 * listed toys, newest first. Hand-picked: the holder's choices in their order.
 * Through the anon client, so RLS drops anything not public — a draft or
 * retired toy, a guide not approved — and a pick that went private shows nothing.
 */
async function holderPicks(
  sb: ReturnType<typeof createAnonClient>,
  toy: { id: string; owner_id: string | null; owner_org_id: string | null; picks_mode?: string | null }
): Promise<ToyPick[]> {
  const toyPick = (t: ListedToy): ToyPick => ({
    kind: 'toy',
    id: t.id,
    title: t.name,
    photo_url: t.cover_photo_url,
    meta: gradeOf(t.condition).label,
  })
  if (toy.picks_mode !== 'picked') {
    // ponytail: no at-capacity filter, so a toy mid-handoff can be suggested; add atCapacityToyIds if families hit it
    const { data } = await sb
      .from('toys')
      .select(LISTED_TOY)
      .eq('status', 'published')
      .eq(toy.owner_org_id ? 'owner_org_id' : 'owner_id', (toy.owner_org_id ?? toy.owner_id) as string)
    return autoPicks(toy, (data ?? []) as ListedToy[]).map(toyPick)
  }
  const { data: rows } = await sb.from('toy_picks').select('entity_type, entity_id').eq('toy_id', toy.id).order('position')
  const picks = (rows ?? []) as { entity_type: 'toy' | 'tutorial'; entity_id: string }[]
  const ids = (type: 'toy' | 'tutorial') => picks.filter((p) => p.entity_type === type).map((p) => p.entity_id)
  const [toys, guides] = await Promise.all([
    ids('toy').length ? sb.from('toys').select(LISTED_TOY).in('id', ids('toy')).eq('status', 'published') : null,
    ids('tutorial').length
      ? sb.from('tutorials').select('id, title, kind, toy_photo_url').in('id', ids('tutorial')).eq('status', 'approved')
      : null,
  ])
  const found = new Map<string, ToyPick>()
  for (const t of (toys?.data ?? []) as ListedToy[]) found.set(`toy:${t.id}`, toyPick(t))
  for (const g of (guides?.data ?? []) as { id: string; title: string; kind: 'toy_adaptation' | 'assistive_tech'; toy_photo_url: string | null }[]) {
    found.set(`tutorial:${g.id}`, { kind: g.kind, id: g.id, title: g.title, photo_url: g.toy_photo_url, meta: null })
  }
  return picks.map((p) => found.get(`${p.entity_type}:${p.entity_id}`)).filter((p): p is ToyPick => !!p)
}
```

- In `publicRoutes.get('/toys/:id', …)`: add `holderPicks(supabase, data)` as a fourth member of Task 2's `Promise.all` (`const [guide, given, place, picks] = …`) and `picks,` to the returned object.

`toy-transactions.ts` — the confirm handler's `transferToy` becomes:

```ts
  async function transferToy(toyId: string, to: { owner_id: string | null; owner_org_id: string | null }) {
    const moved = await admin
      .from('toys')
      .update({ ...to, status: 'draft', paused_at: null, picks_mode: 'auto', updated_at: now })
      .eq('id', toyId)
    if (moved.error) return moved
    // The old holder's hand-picked "Also worth a look" points at their shelf,
    // not the new one's (102).
    return admin.from('toy_picks').delete().eq('toy_id', toyId)
  }
```

`scripts/check-schema-guards.sh` — after the last row (add a comma to the row before it):

```sql
  -- 102. A toy's "Also worth a look" is its holder's to write. With RLS off,
  -- anyone could point a stranger's toy page at anything.
  ('102 toy_picks has RLS enabled and a holder-gated write policy',
   (select coalesce(bool_and(relrowsecurity), false) from pg_class
      where relname = 'toy_picks' and relnamespace = 'public'::regnamespace)
   and (select count(*) > 0 from pg_policies
      where tablename = 'toy_picks'
        and cmd = 'ALL'
        and coalesce(qual, with_check) like '%is_org_leader%'))
```

Mobile second-consumer check: `grep -rn "picks_mode\|toy_picks" packages/mobile` → nothing yet (Task 10 adds the editor).

- [ ] **Step 4: Run the tests to see them pass**

Run: `supabase migration up` → applies `102_toy_picks.sql`; then both commands from Step 2. Expected: PASS.
Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/toys tests/integration/toy-transactions` → PASS.

- [ ] **Step 5: Commit** (no `pending.ts` change — the item ships in Task 10)

```bash
git add supabase/migrations/102_toy_picks.sql packages/types/src/toy-picks.ts packages/types/src/index.ts packages/api/src/routes/toys.ts packages/api/src/routes/public.ts packages/api/src/routes/toy-transactions.ts packages/api/tests/integration/toys/picks.test.ts packages/web/tests/unit/lib/toy-picks.test.ts scripts/check-schema-guards.sh
git commit -m "feat(toys): holder picks for Also worth a look — automatic or hand-picked (102)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 10: Also worth a look — the screens and editors (`toy-holder-picks`, part 2 of 2)

**Files:**
- Create: `packages/web/components/toy-picks.tsx`, `packages/web/components/toy-picks-editor.tsx`, `packages/mobile/components/my-toys/picks-editor.tsx`
- Modify: `packages/web/app/toy-library/[id]/page.tsx`, `packages/web/components/toy-editor.tsx`, `packages/web/app/dashboard/toys/[id]/page.tsx`
- Modify: `packages/mobile/components/toys/toy-detail-screen.tsx`, `packages/mobile/components/my-toys/editor.tsx`
- Modify: `scripts/parity/app-screen-map.json` (the `lib_toy` rule naming `toy-holder-picks`)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/web/tests/unit/components/toy-picks.test.tsx`, `toy-picks-editor.test.tsx` (new); `packages/mobile/tests/unit/components/my-toys/picks-editor.test.tsx` (new); `packages/mobile/tests/unit/components/toys/toy-detail-screen.test.tsx`

**Interfaces:**
- Consumes: `ToyPick`, `ToyPickInput`, `PicksMode`, `PICK_KIND_LABEL`, `ToyDetail.picks`, `Toy.picks_mode`, `Toy.toy_picks`, `PUT /api/toys/:id/picks` (Task 9); `loadOwnedToy(...).shelf` (Task 5).
- Produces: `ToyPicks({ picks, holder }: { picks: ToyPick[]; holder: string | null })` (web, server-renderable); `ToyPicksEditor({ toy, ownToys, guides, onSaved })` (web) and `PicksEditor({ toy, ownToys, guides, onSaved })` (mobile), both `onSaved: (toy: Toy) => void`.

Copy: "Also worth a look", "Picked by {holder} — what else they have listed, and the guides behind it." (WB: "Picked by Family 3 — …"; MB writes "the holder", used here as the fallback when there is no name). Not on any board: "Automatic", "Hand-picked" (the registry decision's words), "Save picks" (flagged).

- [ ] **Step 1: Write the failing tests**

`packages/web/tests/unit/components/toy-picks.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ToyPicks } from '@/components/toy-picks'

vi.mock('next/navigation', () => ({ usePathname: () => '/toy-library/t1' }))

describe('ToyPicks', () => {
  it("names the holder and links each card to its page", () => {
    render(
      <ToyPicks
        holder="Family 3"
        picks={[
          { kind: 'toy', id: 't9', title: 'Light-up drum', photo_url: null, meta: 'Good' },
          { kind: 'assistive_tech', id: 'g1', title: 'Switch mount', photo_url: null, meta: null },
        ]}
      />
    )
    expect(screen.getByRole('heading', { name: 'Also worth a look' })).toBeInTheDocument()
    expect(screen.getByText('Picked by Family 3 — what else they have listed, and the guides behind it.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Light-up drum/ })).toHaveAttribute('href', '/toy-library/t9')
    expect(screen.getByRole('link', { name: /Switch mount/ })).toHaveAttribute('href', '/tutorials/g1')
    expect(screen.getByText('Assistive tech guide')).toBeInTheDocument()
  })

  it('draws nothing without picks', () => {
    const { container } = render(<ToyPicks holder="Family 3" picks={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
```

`packages/web/tests/unit/components/toy-picks-editor.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ToyPicksEditor } from '@/components/toy-picks-editor'
import type { Toy } from '@splat-connect/types'

vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { patch: vi.fn(), put: vi.fn() } }))
import { browserApiClient } from '@/lib/browser-api-client'

const toy = (over: Partial<Toy> = {}): Toy => ({
  id: 't1', owner_id: 'u1', owner_org_id: null, quantity: 1, name: 'Fire truck', description: null, condition: 8,
  switch_adapted: false, photo_urls: [], cover_photo_url: null, switch_photo_url: null, status: 'published',
  offer_type: 'donation', created_at: '', updated_at: '', ...over,
})

describe('ToyPicksEditor', () => {
  beforeEach(() => vi.mocked(browserApiClient.put).mockReset())

  it('saves the hand-picked toys and guides in the order chosen', async () => {
    vi.mocked(browserApiClient.put).mockResolvedValue({ picks: [] })
    render(
      <ToyPicksEditor
        toy={toy({ picks_mode: 'picked', toy_picks: [] })}
        ownToys={[toy({ id: 't2', name: 'Robot' }), toy({ id: 't3', name: 'Draft one', status: 'draft' })]}
        guides={[{ id: 'g1', title: 'Switch mount' }]}
        onSaved={vi.fn()}
      />
    )
    expect(screen.queryByLabelText('Draft one')).toBeNull()
    fireEvent.click(screen.getByLabelText('Switch mount'))
    fireEvent.click(screen.getByLabelText('Robot'))
    fireEvent.click(screen.getByRole('button', { name: 'Save picks' }))
    await vi.waitFor(() =>
      expect(browserApiClient.put).toHaveBeenCalledWith('/api/toys/t1/picks', {
        picks: [{ entity_type: 'tutorial', entity_id: 'g1' }, { entity_type: 'toy', entity_id: 't2' }],
      })
    )
  })

  it('switches back to automatic', async () => {
    const onSaved = vi.fn()
    vi.mocked(browserApiClient.patch).mockResolvedValue(toy({ picks_mode: 'auto' }))
    render(<ToyPicksEditor toy={toy({ picks_mode: 'picked' })} ownToys={[]} guides={[]} onSaved={onSaved} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Automatic' }))
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ picks_mode: 'auto' })))
    expect(browserApiClient.patch).toHaveBeenCalledWith('/api/toys/t1', { picks_mode: 'auto' })
  })
})
```

`packages/mobile/tests/unit/components/my-toys/picks-editor.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { PicksEditor } from '../../../../components/my-toys/picks-editor'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))
const mockPatch = jest.fn()
const mockPut = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { patch: (...a: unknown[]) => mockPatch(...a), put: (...a: unknown[]) => mockPut(...a) },
}))

const toy = (over: object = {}) => ({
  id: 't1', owner_id: 'me', owner_org_id: null, quantity: 1, name: 'Drum', description: null, condition: 8,
  switch_adapted: false, photo_urls: [], cover_photo_url: null, switch_photo_url: null, status: 'published',
  offer_type: 'donation', created_at: '', updated_at: '', ...over,
}) as never

beforeEach(() => jest.clearAllMocks())

it('picks up to three and saves them in order', async () => {
  mockPut.mockResolvedValue({ picks: [] })
  const onSaved = jest.fn()
  render(
    <PicksEditor
      toy={toy({ picks_mode: 'picked', toy_picks: [] })}
      ownToys={[toy({ id: 't1' }), toy({ id: 't2', name: 'Robot' })]}
      guides={[{ id: 'g1', title: 'Switch mount' }, { id: 'g2', title: 'Big button' }, { id: 'g3', title: 'Bubble blower' }]}
      onSaved={onSaved}
    />
  )
  // The toy itself is never offered.
  expect(screen.queryByText('Drum')).toBeNull()
  for (const label of ['Robot', 'Switch mount', 'Big button', 'Bubble blower']) fireEvent.press(screen.getByText(label))
  fireEvent.press(screen.getByText('Save picks'))
  await waitFor(() =>
    expect(mockPut).toHaveBeenCalledWith('/api/toys/t1/picks', {
      picks: [
        { entity_type: 'toy', entity_id: 't2' },
        { entity_type: 'tutorial', entity_id: 'g1' },
        { entity_type: 'tutorial', entity_id: 'g2' },
      ],
    })
  )
  expect(onSaved).toHaveBeenCalled()
})

it('switches the mode', async () => {
  mockPatch.mockResolvedValue(toy({ picks_mode: 'picked' }))
  const onSaved = jest.fn()
  render(<PicksEditor toy={toy({ picks_mode: 'auto' })} ownToys={[]} guides={[]} onSaved={onSaved} />)
  expect(screen.queryByText('Save picks')).toBeNull()
  fireEvent.press(screen.getByText('Hand-picked'))
  await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/api/toys/t1', { picks_mode: 'picked' }))
  expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ picks_mode: 'picked' }))
})
```

Append to `toy-detail-screen.test.tsx` (inside the `describe`):

```tsx
  it("shows the holder's picks and opens each one", async () => {
    mockEndpoints({
      detail: Promise.resolve(
        toy({
          picks: [
            { kind: 'toy', id: 't9', title: 'Light-up drum', photo_url: null, meta: 'Good' },
            { kind: 'toy_adaptation', id: 'g1', title: 'Bubble machine, four-second burst', photo_url: null, meta: null },
          ],
        })
      ),
    })
    render(<ToyDetailScreen id="toy1" />)
    expect(await screen.findByText('Picked by Jamie — what else they have listed, and the guides behind it.')).toBeTruthy()
    expect(screen.getByText('Toy adaptation guide')).toBeTruthy()
    fireEvent.press(screen.getByText('Light-up drum'))
    expect(mockPush).toHaveBeenCalledWith('/toy-library/t9')
    fireEvent.press(screen.getByText('Bubble machine, four-second burst'))
    expect(mockPush).toHaveBeenCalledWith('/guides/g1')
  })
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/components/toy-picks.test.tsx tests/unit/components/toy-picks-editor.test.tsx` → FAIL (modules missing).
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/my-toys/picks-editor.test.tsx tests/unit/components/toys/toy-detail-screen.test.tsx` → FAIL.

- [ ] **Step 3: Implement**

`packages/web/components/toy-picks.tsx`:

```tsx
/**
 * "Also worth a look" on a toy's page (102): what the API resolved — the
 * holder's other listed toys, or their hand-picked toys and guides.
 */
import type { Route } from 'next'
import { BookOpen, Gift } from '@phosphor-icons/react/dist/ssr'
import { PICK_KIND_LABEL, type ToyPick } from '@splat-connect/types'
import { BoundaryLink } from '@/components/boundary-link'
import { tintFor } from '@/components/card-photo'

export function ToyPicks({ picks, holder }: { picks: ToyPick[]; holder: string | null }) {
  if (picks.length === 0) return null
  return (
    <section aria-labelledby="toy-rec-h" className="flex flex-col gap-4 border-t border-line pt-[26px]">
      <div>
        <h2 id="toy-rec-h" className="m-0 font-display text-[26px] font-extrabold text-ink">
          Also worth a look
        </h2>
        <p className="m-0 mt-1.5 max-w-[58ch] text-[15px] leading-[1.5] text-muted">
          {`Picked by ${holder ?? 'the holder'} — what else they have listed, and the guides behind it.`}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {picks.map((p) => {
          const Icon = p.kind === 'toy' ? Gift : BookOpen
          const href = (p.kind === 'toy' ? `/toy-library/${p.id}` : `/tutorials/${p.id}`) as Route
          return (
            <BoundaryLink key={`${p.kind}:${p.id}`} href={href} className="rec-card">
              <span aria-hidden="true" className="rec-card__band" style={{ background: tintFor(p.id) }}>
                <Icon size={46} weight="duotone" />
              </span>
              <span className="rec-card__body">
                <span className="eyebrow text-muted">{PICK_KIND_LABEL[p.kind]}</span>
                <span className="text-[17px] font-extrabold leading-[1.3] text-ink">{p.title}</span>
                {p.meta && <span className="mt-auto pt-2 text-[13px] font-extrabold text-brand-deep">{p.meta}</span>}
              </span>
            </BoundaryLink>
          )
        })}
      </div>
    </section>
  )
}
```

`packages/web/app/toy-library/[id]/page.tsx`:
- Import `import { ToyPicks } from '@/components/toy-picks'`.
- Delete `holderOthers`, `others`, `othersNote` and their comment block (keep `sameHolder`: the holder card still counts their listings), and replace the whole `{others.length > 0 && ( <section aria-labelledby="toy-rec-h" …> … </section> )}` block with

```tsx
        <ToyPicks picks={toy.picks ?? []} holder={holder} />
```

- Remove imports that are now unused (`Gift` if nothing else uses it — `OFFER` does, so it stays; `BoundaryLink` and `tintFor` go if unused): check with `pnpm --filter @splat-connect/web exec tsc --noEmit` and `pnpm --filter @splat-connect/web lint`.

`packages/web/components/toy-picks-editor.tsx`:

```tsx
'use client'
/**
 * "Also worth a look" for one of your toys (102): automatic — your other
 * listed toys, newest first — or up to three you pick from your own listed
 * toys and published guides.
 */
import { useState } from 'react'
import type { PicksMode, Toy, ToyPickInput } from '@splat-connect/types'
import { browserApiClient } from '@/lib/browser-api-client'

const MAX_PICKS = 3
const same = (a: ToyPickInput, b: ToyPickInput) => a.entity_type === b.entity_type && a.entity_id === b.entity_id

export function ToyPicksEditor({
  toy,
  ownToys,
  guides,
  onSaved,
}: {
  toy: Toy
  ownToys: Toy[]
  guides: { id: string; title: string }[]
  onSaved: (toy: Toy) => void
}) {
  const [picks, setPicks] = useState<ToyPickInput[]>(
    [...(toy.toy_picks ?? [])]
      .sort((a, b) => a.position - b.position)
      .map(({ entity_type, entity_id }) => ({ entity_type, entity_id }))
  )
  const [error, setError] = useState<string | null>(null)
  const mode: PicksMode = toy.picks_mode ?? 'auto'

  async function setMode(next: PicksMode) {
    setError(null)
    try {
      onSaved(await browserApiClient.patch<Toy>(`/api/toys/${toy.id}`, { picks_mode: next }))
    } catch {
      setError('Could not save that. Please try again.')
    }
  }

  async function save() {
    setError(null)
    try {
      await browserApiClient.put(`/api/toys/${toy.id}/picks`, { picks })
    } catch {
      setError('Could not save your picks. Please try again.')
    }
  }

  const options: { pick: ToyPickInput; label: string }[] = [
    ...ownToys
      .filter((t) => t.id !== toy.id && t.status === 'published')
      .map((t) => ({ pick: { entity_type: 'toy' as const, entity_id: t.id }, label: t.name })),
    ...guides.map((g) => ({ pick: { entity_type: 'tutorial' as const, entity_id: g.id }, label: g.title })),
  ]

  return (
    <div>
      <h3 className="editor-h3">Also worth a look</h3>
      <div role="radiogroup" aria-label="Also worth a look" className="flex flex-wrap gap-2.5">
        {(['auto', 'picked'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className="kind-card px-4 py-2.5 font-bold"
          >
            {m === 'auto' ? 'Automatic' : 'Hand-picked'}
          </button>
        ))}
      </div>
      {mode === 'picked' && (
        <div className="mt-3 flex flex-col gap-2">
          {options.map((o) => {
            const on = picks.some((p) => same(p, o.pick))
            return (
              <label key={`${o.pick.entity_type}:${o.pick.entity_id}`} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={on}
                  disabled={!on && picks.length >= MAX_PICKS}
                  onChange={() => setPicks((cur) => (on ? cur.filter((p) => !same(p, o.pick)) : [...cur, o.pick]))}
                />
                {o.label}
              </label>
            )
          })}
          <button type="button" onClick={save} className="btn btn-primary self-start">
            Save picks
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm font-bold text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
```

`packages/web/components/toy-editor.tsx`:
- Import `import { ToyPicksEditor } from '@/components/toy-picks-editor'`.
- Props: add `ownToys = []` to the destructure and `ownToys?: Toy[]` (doc: "The holder's other toys, for Also worth a look.") to the type.
- In `status`, after the `{live && ( <div> <h3 className="editor-h3">How it is doing</h3> … )}` block:

```tsx
      {live && <ToyPicksEditor toy={toy} ownToys={ownToys} guides={guides} onSaved={setToy} />}
```

`packages/web/app/dashboard/toys/[id]/page.tsx` — pass the rest of the shelf:

```tsx
    <ToyEditor
      toy={toy}
      guides={guides.map((g) => ({ id: g.id, title: g.title }))}
      ownToys={toys.filter((t) => t.id !== id)}
    />
```

`packages/mobile/components/my-toys/picks-editor.tsx`:

```tsx
// packages/mobile/components/my-toys/picks-editor.tsx
/**
 * "Also worth a look" for one of your toys (102): automatic — your other
 * listed toys, newest first — or up to three you pick from your own listed
 * toys and published guides.
 */
import { useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import type { PicksMode, Toy, ToyPickInput } from '@splat-connect/types'
import { apiMessage } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { Chip } from '../ui/Chip'
import { Button } from '../ui/Button'
import { ErrorRow } from '../ui/ErrorRow'

const MAX_PICKS = 3
const same = (a: ToyPickInput, b: ToyPickInput) => a.entity_type === b.entity_type && a.entity_id === b.entity_id

export function PicksEditor({
  toy,
  ownToys,
  guides,
  onSaved,
}: {
  toy: Toy
  /** The holder's shelf; only their other listed toys can be picked. */
  ownToys: Toy[]
  guides: { id: string; title: string }[]
  onSaved: (toy: Toy) => void
}) {
  const [picks, setPicks] = useState<ToyPickInput[]>(
    [...(toy.toy_picks ?? [])]
      .sort((a, b) => a.position - b.position)
      .map(({ entity_type, entity_id }) => ({ entity_type, entity_id }))
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mode: PicksMode = toy.picks_mode ?? 'auto'

  async function run(action: () => Promise<void>, fallback: string) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(apiMessage(err, fallback))
    } finally {
      setBusy(false)
    }
  }

  const setMode = (next: PicksMode) =>
    run(async () => onSaved(await apiClient.patch<Toy>(`/api/toys/${toy.id}`, { picks_mode: next })), 'Could not save that. Please try again.')

  const save = () =>
    run(async () => {
      await apiClient.put(`/api/toys/${toy.id}/picks`, { picks })
      onSaved({ ...toy, toy_picks: picks.map((p, i) => ({ position: i + 1, ...p })) })
    }, 'Could not save your picks. Please try again.')

  const toggle = (p: ToyPickInput) =>
    setPicks((cur) =>
      cur.some((q) => same(q, p)) ? cur.filter((q) => !same(q, p)) : cur.length >= MAX_PICKS ? cur : [...cur, p]
    )

  const options: { pick: ToyPickInput; label: string }[] = [
    ...ownToys
      .filter((t) => t.id !== toy.id && t.status === 'published')
      .map((t) => ({ pick: { entity_type: 'toy' as const, entity_id: t.id }, label: t.name })),
    ...guides.map((g) => ({ pick: { entity_type: 'tutorial' as const, entity_id: g.id }, label: g.title })),
  ]

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Also worth a look</Text>
      <View accessibilityRole="radiogroup" style={styles.row}>
        <Chip role="radio" label="Automatic" active={mode === 'auto'} onPress={() => void setMode('auto')} />
        <Chip role="radio" label="Hand-picked" active={mode === 'picked'} onPress={() => void setMode('picked')} />
      </View>
      {mode === 'picked' ? (
        <>
          <View style={styles.row}>
            {options.map((o) => (
              <Chip
                key={`${o.pick.entity_type}:${o.pick.entity_id}`}
                variant="filter"
                label={o.label}
                active={picks.some((p) => same(p, o.pick))}
                onPress={() => toggle(o.pick)}
              />
            ))}
          </View>
          <Button label="Save picks" disabled={busy} onPress={() => void save()} />
        </>
      ) : null}
      <ErrorRow message={error} />
    </View>
  )
}

const styles = StyleSheet.create({
  box: { gap: theme.spacing(3), marginTop: theme.spacing(5) },
  title: { fontFamily: theme.fonts.display, fontSize: theme.type.body, color: theme.colors.ink },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
})
```

`packages/mobile/components/my-toys/editor.tsx`:
- Import `import { PicksEditor } from './picks-editor'`.
- State: `const [shelf, setShelf] = useState<Toy[]>([])`; in the load `.then`, after `setToy(found)`: `setShelf(owned!.shelf)` (`owned` is non-null once `found` is).
- In the Review step, right after the `{toy.status === 'published' ? ( <View style={styles.publishedRow}> … ) : ( … )}` block:

```tsx
            {toy.status === 'published' ? (
              <PicksEditor
                toy={toy}
                ownToys={shelf}
                guides={guides}
                onSaved={(t) => setToy((prev) => (prev ? { ...prev, ...t } : t))}
              />
            ) : null}
```

`packages/mobile/components/toys/toy-detail-screen.tsx`:
- Import: add `PICK_KIND_LABEL` and `toyHolderName` to the `@splat-connect/types` import.
- Replace `{/* PENDING(toy-holder-picks): "Also worth a look" — the holder's other picks. */}` with:

```tsx
      {(toy.picks ?? []).length > 0 ? (
        <View style={styles.picks}>
          <Text style={styles.picksTitle} accessibilityRole="header">
            Also worth a look
          </Text>
          <Text style={styles.holder}>
            {`Picked by ${toyHolderName(toy) ?? 'the holder'} — what else they have listed, and the guides behind it.`}
          </Text>
          {(toy.picks ?? []).map((p) => (
            <Pressable
              key={`${p.kind}:${p.id}`}
              onPress={() => router.push(p.kind === 'toy' ? `/toy-library/${p.id}` : `/guides/${p.id}`)}
              accessibilityRole="link"
              accessibilityLabel={`${PICK_KIND_LABEL[p.kind]}: ${p.title}`}
              style={styles.pick}
            >
              <View style={styles.builtFromText}>
                <Text style={styles.factLabel}>{PICK_KIND_LABEL[p.kind]}</Text>
                <Text style={styles.builtFromTitle}>{p.title}</Text>
                {p.meta ? <Text style={styles.builtFromNote}>{p.meta}</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.ink} />
            </Pressable>
          ))}
        </View>
      ) : null}
```

- Styles:

```tsx
  picks: { gap: theme.spacing(3) },
  picksTitle: { fontFamily: theme.fonts.display, fontSize: 18, color: theme.colors.ink },
  pick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(3),
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.card,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing(3),
  },
```

`scripts/parity/app-screen-map.json`: in the `lib_toy` entry (`"route": "/toy-library/[id]"`) delete the rule `{ "type": "missing-section", "match": "also worth a look", "why": "pending", "pending": "toy-holder-picks" }` (the `font` rule stays).

Mobile second-consumer check: `grep -rn "picks_mode\|toy_picks\|\.picks\b" packages/mobile` → picks-editor, editor, toy-detail-screen.

- [ ] **Step 4: Run the tests to see them pass**

Run both commands from Step 2. Expected: PASS.
Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/components/toy-editor.test.tsx` and `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/my-toys` → PASS.
Run: `pnpm typecheck` → exit 0.

- [ ] **Step 5: Ship the item** — `shipped: true,` on `'toy-holder-picks'`; `node scripts/pending.mjs`; drift test → `Tests  11 passed (11)`.

- [ ] **Step 6: Commit**

```bash
git add packages/web/components/toy-picks.tsx packages/web/components/toy-picks-editor.tsx "packages/web/app/toy-library/[id]/page.tsx" packages/web/components/toy-editor.tsx "packages/web/app/dashboard/toys/[id]/page.tsx" packages/web/tests/unit/components/toy-picks.test.tsx packages/web/tests/unit/components/toy-picks-editor.test.tsx packages/mobile/components/my-toys/picks-editor.tsx packages/mobile/components/my-toys/editor.tsx packages/mobile/components/toys/toy-detail-screen.tsx packages/mobile/tests/unit/components/my-toys/picks-editor.test.tsx packages/mobile/tests/unit/components/toys/toy-detail-screen.test.tsx scripts/parity/app-screen-map.json packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(toys): Also worth a look on both toy pages, chosen in both editors

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---
### Task 11: Money details on Me (`money-panel-detail`)

**Files:**
- Modify: `packages/api/src/routes/exchange-costs.ts` (`GET /mine`)
- Modify: `packages/types/src/index.ts` (`MoneyThread`, `MoneyMine`)
- Modify: `packages/mobile/app/(tabs)/me.tsx`
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/api/tests/integration/exchange-costs/mine.test.ts` (new), `packages/mobile/tests/unit/app/me.test.tsx`

**Interfaces:**
- Consumes: `threadHref({ id, type })` from `packages/mobile/lib/builds.ts`.
- Produces: `GET /api/exchange-costs/mine` → `MoneyMine` = `{ threads: MoneyThread[]; owed_cents: number; unsettled_count: number }`, with `MoneyThread = { transaction_id: string; type: ToyTransactionType; other_name: string; what: string; amount_cents: number; you_pay: boolean; settled: boolean }`. Unsettled threads first. A thread whose claimed total is 0 (only covered lines) is left out.

`GET /api/exchange-costs/outstanding` is **not** turned into an alias: web's dashboard (`app/dashboard/page.tsx` → `components/money-panel.tsx`) reads its `lines` / `total_cents` / `exchange_count` shape, so it stays as it is, and `/mine` is the new read.

Copy (MB My SPLAT): "Money you have agreed to", "Still to settle across {n} exchange(s). SPLAT never handles the money — you pay each person directly.", "All settled — nothing outstanding.", "Settled" / "To settle", who: "{name}", "{name} — build thread", "{name} — print job".

- [ ] **Step 1: Write the failing tests**

`packages/api/tests/integration/exchange-costs/mine.test.ts`:

```ts
/**
 * The Me tab's money panel: every thread with money on it, whichever way it
 * runs, settled or not, named by the other person and the kind of thread.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let sam: TestUser
let tom: TestUser
let outsider: TestUser
let toyId: string
let guideId: string
const tx: Record<string, string> = {}

const mine = async (u: TestUser) => {
  const res = await app.request('/api/exchange-costs/mine', { headers: { Authorization: `Bearer ${u.token}` } })
  expect(res.status).toBe(200)
  return (await res.json()) as {
    threads: Array<{ transaction_id: string; type: string; other_name: string; what: string; amount_cents: number; you_pay: boolean; settled: boolean }>
    owed_cents: number
    unsettled_count: number
  }
}

beforeAll(async () => {
  sam = await createTestUser('contributor')
  tom = await createTestUser('contributor')
  outsider = await createTestUser('contributor')
  const admin = adminClient()
  toyId = (
    await admin
      .from('toys')
      .insert({ owner_id: tom.id, name: 'Bubble machine', condition: 8, photo_urls: ['https://example.com/b.jpg'], offer_type: 'donation', status: 'published' })
      .select('id')
      .single()
  ).data!.id
  guideId = (
    await admin.from('tutorials').insert({ title: 'Bubble machine build', description: 'x', difficulty: 'easy', status: 'approved' }).select('id').single()
  ).data!.id
  const insertTx = async (row: Record<string, unknown>) =>
    (await admin.from('toy_transactions').insert(row).select('id').single()).data!.id as string
  // Sam asked Tom for a toy; Tom paid the postage and covered the box.
  tx.donation = await insertTx({ toy_id: toyId, type: 'donation', status: 'accepted', requester_id: sam.id, owner_id: tom.id })
  // Tom asked Sam to build; Sam bought the parts and Tom has paid him back.
  tx.build = await insertTx({ type: 'build', status: 'accepted', requester_id: tom.id, owner_id: sam.id, tutorial_id: guideId, build_brief: 'A bubble machine' })
  // Only a covered line: $0 to everyone, so no row at all.
  tx.covered = await insertTx({ toy_id: toyId, type: 'donation', status: 'requested', requester_id: sam.id, owner_id: tom.id })
  const line = (transaction_id: string, payer: TestUser, payee: TestUser, description: string, amount_cents: number, extra: object = {}) => ({
    transaction_id, payer_id: payer.id, payee_id: payee.id, created_by: payee.id, description, amount_cents, ...extra,
  })
  const { error } = await admin.from('exchange_costs').insert([
    line(tx.donation, sam, tom, 'Postage on the handover', 1060),
    line(tx.donation, sam, tom, 'Box', 0, { claiming: false }),
    line(tx.build, tom, sam, 'Parts for the bubble machine', 890, { settled_at: new Date().toISOString(), settled_by: sam.id }),
    line(tx.covered, sam, tom, 'Bubble wrap', 0, { claiming: false }),
  ])
  expect(error).toBeNull()
})

afterAll(async () => {
  const admin = adminClient()
  const ids = Object.values(tx)
  await admin.from('exchange_costs').delete().in('transaction_id', ids)
  await admin.from('toy_transactions').delete().in('id', ids)
  await admin.from('toys').delete().eq('id', toyId)
  await admin.from('tutorials').delete().eq('id', guideId)
  for (const u of [sam, tom, outsider]) await deleteTestUser(u.id)
})

describe('GET /api/exchange-costs/mine', () => {
  it('lists money both ways, settled or not, unsettled first, and skips a thread with nothing claimed', async () => {
    const tomName = (await adminClient().from('profiles').select('name').eq('id', tom.id).single()).data!.name
    const body = await mine(sam)
    expect(body.threads.map((t) => t.transaction_id)).toEqual([tx.donation, tx.build])
    expect(body.threads[0]).toMatchObject({ type: 'donation', other_name: tomName, amount_cents: 1060, you_pay: true, settled: false })
    expect(body.threads[0].what).toContain('Postage on the handover')
    expect(body.threads[1]).toMatchObject({ type: 'build', other_name: tomName, amount_cents: 890, you_pay: false, settled: true })
    // Only what Sam still owes; what he is owed is never netted against it.
    expect(body.owed_cents).toBe(1060)
    expect(body.unsettled_count).toBe(1)
  })

  it('shows somebody outside every thread nothing', async () => {
    expect(await mine(outsider)).toEqual({ threads: [], owed_cents: 0, unsettled_count: 0 })
  })

  it('is not swallowed by the param route, and /outstanding keeps its shape for web', async () => {
    const res = await app.request('/api/exchange-costs/outstanding', { headers: { Authorization: `Bearer ${sam.token}` } })
    expect(((await res.json()) as { exchange_count: number }).exchange_count).toBe(1)
  })
})
```

`packages/mobile/tests/unit/app/me.test.tsx` — replace the `line` helper with

```tsx
const thread = (over: object = {}) => ({
  transaction_id: 'tx-a', type: 'exchange', other_name: 'Northside Therapy Collective', what: 'Postage on the handover',
  amount_cents: 1060, you_pay: true, settled: false, ...over,
})
```

change the `beforeEach` default to `mockGet.mockResolvedValue({ threads: [], owed_cents: 0, unsettled_count: 0 })`, and replace the whole `describe('Money you have agreed to', …)` with:

```tsx
describe('Money you have agreed to', () => {
  it('names what each thread is for and who it is with, and opens it', async () => {
    mockGet.mockResolvedValue({
      threads: [
        thread({ transaction_id: 'tx-p', type: 'print', other_name: 'Contributor 2', what: 'Filament for your switch mount', amount_cents: 500 }),
        thread({ transaction_id: 'tx-b', type: 'build', other_name: 'Tom Beattie', what: 'Parts for the bubble machine', amount_cents: 890, settled: true }),
        thread(),
        thread({ transaction_id: 'tx-d', what: 'A fourth thread' }),
      ],
      owed_cents: 1560,
      unsettled_count: 2,
    })
    render(<MeTab />)
    expect(await screen.findByText('$15.60')).toBeTruthy()
    expect(mockGet).toHaveBeenCalledWith('/api/exchange-costs/mine')
    expect(screen.getByText(/Still to settle across 2 exchanges\./)).toBeTruthy()
    expect(screen.getByText('Contributor 2 — print job')).toBeTruthy()
    expect(screen.getByText('Tom Beattie — build thread')).toBeTruthy()
    expect(screen.getByText('Northside Therapy Collective')).toBeTruthy()
    expect(screen.getByText('Settled')).toBeTruthy()
    expect(screen.getAllByText('To settle')).toHaveLength(2)
    expect(screen.queryByText('A fourth thread')).toBeNull()
    fireEvent.press(screen.getByText('Parts for the bubble machine'))
    expect(mockPush).toHaveBeenCalledWith('/exchanges/build/tx-b')
  })

  it('says "exchange" for one, not "exchanges"', async () => {
    mockGet.mockResolvedValue({ threads: [thread()], owed_cents: 1060, unsettled_count: 1 })
    render(<MeTab />)
    expect(await screen.findByText(/Still to settle across 1 exchange\./)).toBeTruthy()
  })

  it('says all settled once nothing is left', async () => {
    mockGet.mockResolvedValue({ threads: [thread({ settled: true })], owed_cents: 0, unsettled_count: 0 })
    render(<MeTab />)
    expect(await screen.findByText('All settled — nothing outstanding.')).toBeTruthy()
    expect(screen.getByText('$0.00')).toBeTruthy()
  })

  it('draws nothing when there is no money, or when the fetch fails', async () => {
    const { unmount } = render(<MeTab />)
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(screen.queryByText('Money you have agreed to')).toBeNull()
    unmount()

    mockGet.mockRejectedValue(new Error('down'))
    render(<MeTab />)
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(screen.queryByText('Money you have agreed to')).toBeNull()
    expect(screen.getByLabelText('My toys')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/exchange-costs/mine.test.ts` → FAIL (`/mine` is taken by `/:transactionId`: `threads` is undefined).
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/app/me.test.tsx` → FAIL.

- [ ] **Step 3: Implement**

`packages/types/src/index.ts` — after `ExchangeCost`:

```ts
/**
 * GET /api/exchange-costs/mine (the Me tab's money panel): one row per thread
 * with money on it, either direction, settled or not. A thread whose lines are
 * all covered is $0 to everyone and is not a row.
 */
export interface MoneyThread {
  transaction_id: string
  type: ToyTransactionType
  /** The person on the other side of the lines — never the caller. */
  other_name: string
  /** What the lines are for, in the words they were written in. */
  what: string
  /** Claimed lines only: what the caller pays back, or else what they are paid. */
  amount_cents: number
  you_pay: boolean
  /** Every claimed line marked settled. */
  settled: boolean
}

export interface MoneyMine {
  threads: MoneyThread[]
  /** Claimed, unsettled lines the caller pays: the panel's figure. */
  owed_cents: number
  /** Threads not settled yet: "Still to settle across {n} exchanges". */
  unsettled_count: number
}
```

`exchange-costs.ts`:
- Imports: `import { createUserClient, createAdminClient } from '../supabase/client.js'` and `import type { MoneyThread, ToyTransactionType } from '@splat-connect/types'`.
- After the `/outstanding` handler, before `/:transactionId`:

```ts
type MineRow = {
  transaction_id: string
  description: string
  amount_cents: number
  claiming: boolean
  payer_id: string
  payee_id: string
  settled_at: string | null
  toy_transactions: { type: ToyTransactionType } | null
}

/**
 * GET /api/exchange-costs/mine
 *
 * The Me tab's money panel: every thread with money on it — what the caller
 * pays and what they are paid, settled or not — one row per thread, named by
 * the other person and the kind of thread. Registered before /:transactionId
 * for the same reason as /outstanding.
 *
 * /outstanding stays as it is: web's dashboard panel reads its shape.
 * Directions are never netted: a row shows what the caller pays, or else what
 * they are paid, and the headline counts only what they owe.
 */
exchangeCosts.get('/mine', async (c) => {
  const supabase = createUserClient(c.get('token'))
  const userId = c.get('userId')
  const { data, error } = await supabase
    .from('exchange_costs')
    .select('transaction_id, description, amount_cents, claiming, payer_id, payee_id, settled_at, created_at, toy_transactions(type)')
    .or(`payer_id.eq.${userId},payee_id.eq.${userId}`)
    .order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  const rows = (data ?? []) as unknown as MineRow[]

  // Names through the admin client, never an embed (033/045 grants).
  const otherOf = (r: MineRow) => (r.payer_id === userId ? r.payee_id : r.payer_id)
  const otherIds = [...new Set(rows.map(otherOf))]
  const names = new Map<string, string>()
  if (otherIds.length) {
    const { data: people } = await createAdminClient().from('profiles').select('id, name').in('id', otherIds)
    for (const p of (people ?? []) as { id: string; name: string }[]) names.set(p.id, p.name)
  }

  const byThread = new Map<string, MineRow[]>()
  for (const r of rows) byThread.set(r.transaction_id, [...(byThread.get(r.transaction_id) ?? []), r])
  const sum = (ls: MineRow[]) => ls.reduce((n, l) => n + l.amount_cents, 0)
  const threads: MoneyThread[] = []
  for (const [transaction_id, lines] of byThread) {
    const claimed = lines.filter((l) => l.claiming)
    const pay = sum(claimed.filter((l) => l.payer_id === userId))
    const get = sum(claimed.filter((l) => l.payee_id === userId))
    if (pay + get === 0) continue
    threads.push({
      transaction_id,
      type: lines[0].toy_transactions?.type ?? 'exchange',
      other_name: names.get(otherOf(lines[0])) ?? '',
      what: lines.map((l) => l.description).join(', '),
      amount_cents: pay > 0 ? pay : get,
      you_pay: pay > 0,
      settled: claimed.every((l) => l.settled_at !== null),
    })
  }
  threads.sort((a, b) => Number(a.settled) - Number(b.settled))

  return c.json({
    threads,
    owed_cents: sum(rows.filter((r) => r.claiming && r.payer_id === userId && !r.settled_at)),
    unsettled_count: threads.filter((t) => !t.settled).length,
  })
})
```

`me.tsx`:
- Imports: `import { buildNav, formatCents, type IconName as NavIcon, type MoneyMine, type MoneyThread, type ToyTransactionType } from '@splat-connect/types'` and `import { threadHref } from '../../lib/builds'`.
- Delete the `Outstanding` type and its comment; add:

```tsx
/** The board's icon per kind of thread. */
const MONEY_ICON: Record<ToyTransactionType, Glyph> = {
  donation: 'cube-outline',
  exchange: 'cube-outline',
  build: 'hammer-outline',
  print: 'print-outline',
}

/** Who, in the board's words: "Tom Beattie — build thread", "Contributor 2 — print job". */
function moneyWho(t: MoneyThread): string {
  if (t.type === 'build') return `${t.other_name} — build thread`
  if (t.type === 'print') return `${t.other_name} — print job`
  return t.other_name
}
```

- Replace the `// PENDING(money-panel-detail): …` comment and the whole `MoneyPanel` function with:

```tsx
function MoneyPanel({ money, onOpen }: { money: MoneyMine; onOpen: (t: MoneyThread) => void }) {
  if (money.threads.length === 0) return null
  const n = money.unsettled_count
  return (
    <View style={styles.money}>
      <View>
        <Text style={styles.eyebrow}>Money you have agreed to</Text>
        <Text style={styles.moneyTotal}>{formatCents(money.owed_cents)}</Text>
        <Text style={styles.moneySub}>
          {n
            ? `Still to settle across ${n} ${n === 1 ? 'exchange' : 'exchanges'}. SPLAT never handles the money — you pay each person directly.`
            : 'All settled — nothing outstanding.'}
        </Text>
      </View>
      {money.threads.slice(0, 3).map((t) => (
        <Pressable
          key={t.transaction_id}
          onPress={() => onOpen(t)}
          accessibilityRole="button"
          accessibilityLabel={`${t.what}, ${moneyWho(t)}, ${formatCents(t.amount_cents)}, ${t.settled ? 'settled' : 'to settle'}`}
          style={({ pressed }) => [styles.moneyLine, pressed && styles.pressed]}
        >
          <View style={styles.moneyWhat}>
            <Ionicons name={MONEY_ICON[t.type]} size={22} color={theme.colors.primaryDark} />
            <View style={styles.flex}>
              <Text style={styles.moneyLineTitle} numberOfLines={1}>
                {t.what}
              </Text>
              <Text style={styles.moneyLineWho} numberOfLines={1}>
                {moneyWho(t)}
              </Text>
            </View>
          </View>
          <View style={styles.moneyAmountRow}>
            <Text style={[styles.settle, t.settled && styles.settled]}>{t.settled ? 'Settled' : 'To settle'}</Text>
            <Text style={styles.amount}>{formatCents(t.amount_cents)}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  )
}
```

- In `MeTab`: `useState<Outstanding | null>` → `useState<MoneyMine | null>`; `.get<Outstanding>('/api/exchange-costs/outstanding')` → `.get<MoneyMine>('/api/exchange-costs/mine')`; the panel's `onOpen` → `onOpen={(t) => router.push(threadHref({ id: t.transaction_id, type: t.type }) as never)}`.
- Styles: add `textTransform: 'uppercase',` to `settle` (the board's pill is set in capitals; the words stay "To settle" / "Settled"), and `settled: { backgroundColor: theme.colors.successSoft },`.

- [ ] **Step 4: Run the tests to see them pass**

Run both commands from Step 2, plus `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/exchange-costs` (the `/outstanding` suite still passes). Expected: PASS.

- [ ] **Step 5: Ship the item** — `shipped: true,` on `'money-panel-detail'`; `node scripts/pending.mjs`; no parity rule names this id; drift test → `Tests  11 passed (11)`.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/routes/exchange-costs.ts packages/api/tests/integration/exchange-costs/mine.test.ts packages/types/src/index.ts "packages/mobile/app/(tabs)/me.tsx" packages/mobile/tests/unit/app/me.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(mobile): the money panel names what and who, both ways, and says when it is all settled

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 12: The cost panel on a build (`build-thread-cost-panel`)

**Files:**
- Create: `packages/mobile/components/exchanges/cost-panel.tsx`
- Modify: `packages/mobile/components/exchanges/thread-screen.tsx` (its card becomes `<CostPanel mode="read">`), `packages/mobile/components/builds/build-thread-screen.tsx`
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/mobile/tests/unit/components/exchanges/cost-panel.test.tsx` (new), `packages/mobile/tests/unit/components/builds/build-thread-screen.test.tsx` (new), `packages/mobile/tests/unit/components/exchanges/thread-screen.test.tsx` (import moves)

**Interfaces:**
- Consumes: the existing routes `GET/POST /api/exchange-costs/:transactionId`, `PATCH /api/exchange-costs/:id/settle`, `DELETE /api/exchange-costs/:id`; `dollarsToCents`, `formatCents`, `apiMessage`.
- Produces: `CostPanel({ transactionId, viewerId, mode, title, hint }: { transactionId: string; viewerId: string; mode: 'edit' | 'settle' | 'read'; title: string; hint?: string })` and `costSummary(lines, viewerId): { youPay: number; youGet: number }` (moved from `thread-screen.tsx`).

Copy — CP/MB: maker "Parts you bought for this build" · "The family covers parts, never your time. Itemise what you bought and mark each line."; family "What this build costs you"; "You pay back" / "Nothing to pay"; "Asking back" / "Nothing asked back"; "Claiming back" / "Covering it"; "What the money went on" (placeholder "What did you pay for?"), "Amount in dollars" ("0.00"), "Add a line", "Remove this line", "Nothing listed — add a line for anything you paid for, even if you plan to cover it."; "Mark as settled" / "Marked as settled" with "Tap only once the money has actually changed hands." / "Both of you can see this. Tap to undo if it was early."; "SPLAT does not take payments or a cut. This is a written record both of you can see — you settle it between yourselves." The family hint is WB's neutral form, "{maker} gives the time and the tools free — these are the parts they bought." (MB's says "he"; the spec quotes MB). "Paid forward" has no column and is left out. One new sentence, the amount error "The amount is dollars, like 6.50." (the printing batch's "dollars per gram, like 0.12" pattern).

The maker is always the payee: `POST /api/exchange-costs/:transactionId` makes the caller the payee and the other party the payer. On a build an organisation claimed (`owner_org_id`), that route answers 400 with its own sentence; the panel shows it.

- [ ] **Step 1: Write the failing tests**

`packages/mobile/tests/unit/components/exchanges/cost-panel.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { CostPanel } from '../../../../components/exchanges/cost-panel'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))
const mockGet = jest.fn()
const mockPost = jest.fn()
const mockPatch = jest.fn()
const mockDelete = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: {
    get: (...a: unknown[]) => mockGet(...a),
    post: (...a: unknown[]) => mockPost(...a),
    patch: (...a: unknown[]) => mockPatch(...a),
    delete: (...a: unknown[]) => mockDelete(...a),
  },
}))

const line = (over: object = {}) => ({
  id: 'l1', description: 'Switch jack and cable', amount_cents: 650, claiming: true,
  payer_id: 'fam', payee_id: 'maker', settled_at: null, created_by: 'maker', ...over,
})
const serve = (lines: object[]) => mockGet.mockResolvedValue({ lines, settlement: null })
const maker = (title = 'Parts you bought for this build') => (
  <CostPanel transactionId="b1" viewerId="maker" mode="edit" title={title} />
)

beforeEach(() => jest.clearAllMocks())

describe('the maker', () => {
  it('adds a line the family is asked to pay back', async () => {
    serve([])
    mockPost.mockResolvedValue(line())
    render(maker())
    expect(await screen.findByText('Nothing listed — add a line for anything you paid for, even if you plan to cover it.')).toBeTruthy()
    fireEvent.changeText(screen.getByLabelText('What the money went on'), 'Switch jack and cable')
    fireEvent.changeText(screen.getByLabelText('Amount in dollars'), '6.50')
    fireEvent.press(screen.getByText('Add a line'))
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/exchange-costs/b1', { description: 'Switch jack and cable', amount_cents: 650, claiming: true })
    )
    expect(await screen.findByText('Asking back')).toBeTruthy()
    expect(screen.getAllByText('$6.50').length).toBeGreaterThan(0)
  })

  it('records a cost they cover', async () => {
    serve([])
    mockPost.mockResolvedValue(line({ claiming: false, amount_cents: 400 }))
    render(maker())
    fireEvent.changeText(await screen.findByLabelText('What the money went on'), 'Batteries')
    fireEvent.changeText(screen.getByLabelText('Amount in dollars'), '4')
    fireEvent.press(screen.getByRole('radio', { name: 'Covering it' }))
    fireEvent.press(screen.getByText('Add a line'))
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/exchange-costs/b1', { description: 'Batteries', amount_cents: 400, claiming: false })
    )
    expect(await screen.findByText('Nothing asked back')).toBeTruthy()
  })

  it('refuses an amount that is not dollars, and sends nothing', async () => {
    serve([])
    render(maker())
    fireEvent.changeText(await screen.findByLabelText('Amount in dollars'), '6.5.0')
    fireEvent.press(screen.getByText('Add a line'))
    expect(screen.getByText('The amount is dollars, like 6.50.')).toBeTruthy()
    expect(mockPost).not.toHaveBeenCalled()
  })

  it("removes their own line and never the family's", async () => {
    serve([line(), line({ id: 'l2', description: 'Their bus fare', created_by: 'fam', payer_id: 'maker', payee_id: 'fam' })])
    mockDelete.mockResolvedValue({ id: 'l1' })
    render(maker())
    await screen.findByText('Their bus fare')
    expect(screen.getAllByLabelText('Remove this line')).toHaveLength(1)
    fireEvent.press(screen.getByLabelText('Remove this line'))
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/api/exchange-costs/l1'))
    await waitFor(() => expect(screen.queryByText('Switch jack and cable')).toBeNull())
  })
})

describe('the family', () => {
  const family = () => (
    <CostPanel transactionId="b1" viewerId="fam" mode="settle" title="What this build costs you" hint="Tom gives the time and the tools free — these are the parts they bought." />
  )

  it('sees what they pay back and marks it settled', async () => {
    serve([line()])
    mockPatch.mockResolvedValue({ id: 'l1', settled_at: '2026-10-01T00:00:00Z', settled_by: 'fam' })
    render(family())
    expect(await screen.findByText('You pay back')).toBeTruthy()
    expect(screen.getByText('Tap only once the money has actually changed hands.')).toBeTruthy()
    fireEvent.press(screen.getByText('Mark as settled'))
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/api/exchange-costs/l1/settle', { settled: true }))
    expect(await screen.findByText('Marked as settled')).toBeTruthy()
  })

  it('has nothing to pay, and nothing to settle, when every line is covered', async () => {
    serve([line({ claiming: false, amount_cents: 400 })])
    render(family())
    expect(await screen.findByText('Nothing to pay')).toBeTruthy()
    expect(screen.queryByText('Mark as settled')).toBeNull()
  })
})

describe('read-only, on an exchange', () => {
  it('draws nothing when there are no lines', async () => {
    serve([])
    render(<CostPanel transactionId="tx1" viewerId="fam" mode="read" title="What the handover costs you" />)
    await waitFor(() => expect(mockGet).toHaveBeenCalled())
    expect(screen.queryByText('What the handover costs you')).toBeNull()
  })
})
```

`packages/mobile/tests/unit/components/builds/build-thread-screen.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native'
import { BuildThreadScreen } from '../../../../components/builds/build-thread-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))
jest.mock('expo-image-picker', () => ({}))
jest.mock('../../../../lib/upload', () => ({ uploadFile: jest.fn() }))
jest.mock('../../../../lib/supabase', () => ({
  supabase: { storage: { from: () => ({ createSignedUrl: () => Promise.resolve({ data: null }) }) } },
}))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a), post: jest.fn() } }))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useFocusEffect: (effect: () => void) => useEffect(effect, []), useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }
})
const mockUseCapabilities = jest.fn()
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => mockUseCapabilities() }))

const as = (id: string) => ({
  caps: { profile: { id, name: 'Viewer', role: 'contributor' }, isAdmin: false, ledOrgs: [], unread: { tutorials: 0, exchanges: 0, challenges: 0, organisations: 0, total: 0 }, exchangeActions: 0 },
  loading: false,
  refresh: jest.fn(),
})

const build = {
  id: 'b1', type: 'build', status: 'accepted', toy_id: null, offered_toy_id: null, requester_id: 'fam', owner_id: 'maker',
  owner_org_id: null, owner_code: null, requester_code: null, owner_confirmed_at: null, requester_confirmed_at: null,
  pickup_line1: null, pickup_suburb: null, pickup_state: null, pickup_postcode: null, pickup_instructions: null,
  tutorial_id: 'g1', tutorial_title: 'Bubble machine', build_brief: 'A bubble machine for Leo', travel_km: null, urgency: null,
  child_label: null, requester_suburb: 'Newtown', family_has_toy: false, working_photo_url: null, work_approved_at: null,
  owner_name: 'Tom Beattie', requester_name: 'Sam', toy_name: '', offered_toy_name: null, blocked_by_rival_accept: false,
  received_toy: null, messages: [], created_at: '', updated_at: '',
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockImplementation((p: string) =>
    p === '/api/toy-transactions/b1' ? Promise.resolve(build) : Promise.resolve({ lines: [], settlement: null })
  )
})

it('gives the maker the parts list to fill in', async () => {
  mockUseCapabilities.mockReturnValue(as('maker'))
  render(<BuildThreadScreen id="b1" />)
  expect(await screen.findByText('Parts you bought for this build')).toBeTruthy()
  expect(screen.getByText('The family covers parts, never your time. Itemise what you bought and mark each line.')).toBeTruthy()
})

it('shows the family what the build costs them, in the maker’s name', async () => {
  mockUseCapabilities.mockReturnValue(as('fam'))
  render(<BuildThreadScreen id="b1" />)
  expect(await screen.findByText('What this build costs you')).toBeTruthy()
  expect(screen.getByText('Tom Beattie gives the time and the tools free — these are the parts they bought.')).toBeTruthy()
  expect(screen.getByText('Nothing to pay')).toBeTruthy()
})
```

In `thread-screen.test.tsx`, move `costSummary` out of the `thread-screen` import and add `import { costSummary } from '../../../../components/exchanges/cost-panel'`.

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/exchanges tests/unit/components/builds/build-thread-screen.test.tsx`
Expected: FAIL — `Cannot find module '../../../../components/exchanges/cost-panel'`.

- [ ] **Step 3: Implement**

`packages/mobile/components/exchanges/cost-panel.tsx`:

```tsx
// packages/mobile/components/exchanges/cost-panel.tsx
/**
 * The cost panel the two threads share (055/056, on the exchange-costs routes
 * that already exist). SPLAT never handles the money: this is a written record
 * both people see.
 *
 * - 'edit': the maker on a build itemises what they bought and removes their
 *   own lines. POST makes the caller the payee, so every line they add is
 *   theirs to be paid back (or to cover).
 * - 'settle': the family on a build reads the lines and marks them settled.
 * - 'read': the exchange thread's card — the lines, who pays back, the method.
 *
 * Settling is per line (055); the board's one switch marks every claimed line.
 * The board's "Paid forward" has no column and is left out.
 */
import { useEffect, useState } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { ExchangeCost, ExchangeSettlement } from '@splat-connect/types'
import { apiMessage, dollarsToCents, formatCents } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { theme } from '../../lib/theme'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Chip } from '../ui/Chip'
import { TextField } from '../ui/TextField'
import { ErrorRow } from '../ui/ErrorRow'

type CostLine = Pick<
  ExchangeCost,
  'id' | 'description' | 'amount_cents' | 'claiming' | 'payer_id' | 'payee_id' | 'settled_at' | 'created_by'
>
type Costs = { lines: CostLine[]; settlement: Pick<ExchangeSettlement, 'method'> | null }
export type CostPanelMode = 'edit' | 'settle' | 'read'

/** What the viewer pays back, or is paid back. Only claimed lines count (055). */
export function costSummary(
  lines: Pick<CostLine, 'amount_cents' | 'claiming' | 'payer_id' | 'payee_id'>[],
  viewerId: string
): { youPay: number; youGet: number } {
  const claimed = lines.filter((l) => l.claiming)
  const sum = (ls: typeof claimed) => ls.reduce((n, l) => n + l.amount_cents, 0)
  return {
    youPay: sum(claimed.filter((l) => l.payer_id === viewerId)),
    youGet: sum(claimed.filter((l) => l.payee_id === viewerId)),
  }
}

function Total({ label, cents, owed }: { label: string; cents: number; owed: boolean }) {
  return (
    <View style={[styles.payBack, owed ? styles.payBackYou : styles.payBackThem]}>
      <Text style={styles.payBackLabel}>{label}</Text>
      <Text style={styles.payBackAmount}>{formatCents(cents)}</Text>
    </View>
  )
}

export function CostPanel({
  transactionId,
  viewerId,
  mode,
  title,
  hint,
}: {
  transactionId: string
  viewerId: string
  mode: CostPanelMode
  title: string
  hint?: string
}) {
  const [costs, setCosts] = useState<Costs | null>(null)
  const [what, setWhat] = useState('')
  const [amount, setAmount] = useState('')
  const [claiming, setClaiming] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Once per screen, not per poll. RLS returns empty arrays to a stranger.
  useEffect(() => {
    let ignore = false
    apiClient
      .get<Costs>(`/api/exchange-costs/${transactionId}`)
      .then((c) => {
        if (!ignore) setCosts(c)
      })
      .catch((err) => console.error('[CostPanel] cost fetch failed:', err))
    return () => {
      ignore = true
    }
  }, [transactionId])

  const lines = costs?.lines ?? []
  if (mode === 'read' && lines.length === 0) return null

  const setLines = (fn: (ls: CostLine[]) => CostLine[]) =>
    setCosts((c) => ({ lines: fn(c?.lines ?? []), settlement: c?.settlement ?? null }))

  async function run(action: () => Promise<void>, fallback: string) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(apiMessage(err, fallback))
    } finally {
      setBusy(false)
    }
  }

  async function addLine() {
    const cents = amount.trim() ? dollarsToCents(amount) : 0
    if (cents === null) {
      setError('The amount is dollars, like 6.50.')
      return
    }
    await run(async () => {
      const line = await apiClient.post<CostLine>(`/api/exchange-costs/${transactionId}`, {
        description: what.trim(),
        amount_cents: cents,
        claiming,
      })
      setLines((ls) => [...ls, line])
      setWhat('')
      setAmount('')
    }, 'Could not add that line. Please try again.')
  }

  const removeLine = (line: CostLine) =>
    run(async () => {
      await apiClient.delete(`/api/exchange-costs/${line.id}`)
      setLines((ls) => ls.filter((l) => l.id !== line.id))
    }, 'Could not remove that line. Please try again.')

  const claimed = lines.filter((l) => l.claiming)
  const settled = claimed.length > 0 && claimed.every((l) => l.settled_at)

  const toggleSettled = () =>
    run(async () => {
      const next = !settled
      const results = await Promise.all(
        claimed
          .filter((l) => !!l.settled_at !== next)
          .map((l) =>
            apiClient.patch<{ id: string; settled_at: string | null }>(`/api/exchange-costs/${l.id}/settle`, { settled: next })
          )
      )
      const at = new Map(results.map((r) => [r.id, r.settled_at]))
      setLines((ls) => ls.map((l) => (at.has(l.id) ? { ...l, settled_at: at.get(l.id) ?? null } : l)))
    }, 'Could not save that. Please try again.')

  const { youPay, youGet } = costSummary(lines, viewerId)
  const method = costs?.settlement?.method ?? null

  return (
    <Card style={styles.block}>
      <Text style={styles.eyebrow}>{title}</Text>
      {hint ? <Text style={styles.body}>{hint}</Text> : null}
      {mode === 'edit' && lines.length === 0 ? (
        <Text style={styles.body}>Nothing listed — add a line for anything you paid for, even if you plan to cover it.</Text>
      ) : null}

      {lines.map((l) => (
        <View key={l.id} style={styles.line}>
          <View style={styles.flex}>
            <Text style={styles.desc}>{l.description}</Text>
            {mode === 'read' ? null : <Text style={styles.mode}>{l.claiming ? 'Claiming back' : 'Covering it'}</Text>}
          </View>
          {/* A covered line costs the reader nothing on an exchange's card (055). */}
          <Text style={styles.amount}>{formatCents(mode === 'read' && !l.claiming ? 0 : l.amount_cents)}</Text>
          {mode === 'edit' && l.created_by === viewerId ? (
            <Pressable
              onPress={() => void removeLine(l)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Remove this line"
              hitSlop={8}
            >
              <Ionicons name="trash-outline" size={18} color={theme.colors.danger} />
            </Pressable>
          ) : null}
        </View>
      ))}

      {mode === 'edit' ? (
        <Total label={youGet > 0 ? 'Asking back' : 'Nothing asked back'} cents={youGet} owed={false} />
      ) : mode === 'settle' ? (
        <Total label={youPay > 0 ? 'You pay back' : 'Nothing to pay'} cents={youPay} owed={youPay > 0} />
      ) : youPay > 0 || youGet > 0 ? (
        <Total label={youPay > 0 ? 'You pay back' : 'They pay you back'} cents={youPay > 0 ? youPay : youGet} owed={youPay > 0} />
      ) : null}

      {method ? (
        <View style={styles.methodRow}>
          <Ionicons name="business-outline" size={15} color={theme.colors.muted} />
          <Text style={styles.body}>{method}</Text>
        </View>
      ) : null}

      {mode === 'edit' ? (
        <View style={styles.form}>
          <TextField
            label="What the money went on"
            accessibilityLabel="What the money went on"
            placeholder="What did you pay for?"
            value={what}
            onChangeText={setWhat}
          />
          <TextField
            label="Amount in dollars"
            accessibilityLabel="Amount in dollars"
            placeholder="0.00"
            inputMode="decimal"
            value={amount}
            onChangeText={setAmount}
          />
          <View accessibilityRole="radiogroup" style={styles.chips}>
            <Chip role="radio" label="Claiming back" active={claiming} onPress={() => setClaiming(true)} />
            <Chip role="radio" label="Covering it" active={!claiming} onPress={() => setClaiming(false)} />
          </View>
          <Button label="Add a line" variant="secondary" disabled={busy} onPress={() => void addLine()} />
        </View>
      ) : null}

      {/* Either side may settle (055): whoever was paid knows. */}
      {mode !== 'read' && claimed.length > 0 ? (
        <View style={styles.form}>
          <Button
            label={settled ? 'Marked as settled' : 'Mark as settled'}
            variant={settled ? 'secondary' : 'primary'}
            disabled={busy}
            onPress={() => void toggleSettled()}
          />
          <Text style={styles.body}>
            {settled ? 'Both of you can see this. Tap to undo if it was early.' : 'Tap only once the money has actually changed hands.'}
          </Text>
        </View>
      ) : null}

      {mode !== 'read' ? (
        <Text style={styles.body}>
          SPLAT does not take payments or a cut. This is a written record both of you can see — you settle it between yourselves.
        </Text>
      ) : null}
      <ErrorRow message={error} />
    </Card>
  )
}

const styles = StyleSheet.create({
  block: { gap: theme.spacing(2), padding: theme.spacing(4), borderRadius: theme.radii.panel },
  eyebrow: { fontFamily: theme.fonts.black, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: theme.colors.ink },
  body: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted, lineHeight: 21 },
  flex: { flex: 1 },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing(3) },
  desc: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.text },
  mode: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.muted },
  amount: { fontFamily: theme.fonts.numeral, fontSize: theme.type.label, color: theme.colors.text },
  payBack: { alignSelf: 'flex-start', borderRadius: theme.radii.panel, padding: theme.spacing(3), gap: 2 },
  payBackYou: { backgroundColor: theme.colors.honeySoft },
  payBackThem: { backgroundColor: theme.colors.mintSoft },
  payBackLabel: { fontFamily: theme.fonts.black, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: theme.colors.ink },
  payBackAmount: { fontFamily: theme.fonts.numeral, fontSize: theme.type.title, color: theme.colors.ink },
  methodRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) },
  form: { gap: theme.spacing(2), marginTop: theme.spacing(2) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
})
```

`thread-screen.tsx`:
- Delete `type CostLine`, `type CostPanel`, `costSummary` (with its doc comment), the `costs` state, the cost-fetch `useEffect` and its comment, `txType`, and the `costLines` / `youPay` / `youGet` / `method` constants.
- Replace the whole `{costLines.length > 0 ? ( <Card style={styles.block}> <Text style={styles.eyebrow}>What the handover costs you</Text> … </Card> ) : null}` block with:

```tsx
          <CostPanel transactionId={id} viewerId={viewerId} mode="read" title="What the handover costs you" />
```

- Import `import { CostPanel } from './cost-panel'`; drop `ExchangeCost`, `ExchangeSettlement` and (if now unused) `formatCents` from the imports; delete the now-unused styles `costLine`, `costDesc`, `costAmount`, `payBack`, `payBackYou`, `payBackThem`, `payBackLabel`, `payBackAmount`, `methodRow` (`pnpm --filter @splat-connect/mobile typecheck` and lint name any left over).

`build-thread-screen.tsx`:
- Import `import { CostPanel } from '../exchanges/cost-panel'`.
- In the header comment, delete the bullet "- The cost panel. Mobile has no exchange-costs screen yet on any thread; the parts conversation happens in the messages until it does."
- Replace `{/* PENDING(build-thread-cost-panel): the maker lists parts, the family sees them — exchange-costs exists. */}` with:

```tsx
          {/* Once a maker has the build: before that there is nobody to owe. */}
          {(tx.status === 'accepted' || tx.status === 'completed') && (c.isMaker || c.isFamily) ? (
            <CostPanel
              transactionId={id}
              viewerId={viewerId}
              mode={c.isMaker ? 'edit' : 'settle'}
              title={c.isMaker ? 'Parts you bought for this build' : 'What this build costs you'}
              hint={
                c.isMaker
                  ? 'The family covers parts, never your time. Itemise what you bought and mark each line.'
                  : `${tx.owner_name} gives the time and the tools free — these are the parts they bought.`
              }
            />
          ) : null}
```

- [ ] **Step 4: Run the tests to see them pass**

Run the command from Step 2. Expected: PASS (the existing exchange-thread cost-card tests pass unchanged against the read mode).
Run: `pnpm --filter @splat-connect/mobile typecheck` → exit 0.

- [ ] **Step 5: Ship the item** — `shipped: true,` on `'build-thread-cost-panel'`; `node scripts/pending.mjs`; no parity rule names this id; drift test → `Tests  11 passed (11)`.

- [ ] **Step 6: Commit**

```bash
git add packages/mobile/components/exchanges/cost-panel.tsx packages/mobile/components/exchanges/thread-screen.tsx packages/mobile/components/builds/build-thread-screen.tsx packages/mobile/tests/unit/components/exchanges/cost-panel.test.tsx packages/mobile/tests/unit/components/exchanges/thread-screen.test.tsx packages/mobile/tests/unit/components/builds/build-thread-screen.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(mobile): the build thread's cost panel — the maker itemises parts, the family settles

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 13: Full verification and graph update

No new code. Every check the spec names, in an order where a failure points at one thing.

**Files:**
- Modify (generated only): `graphify-out/*`, `scripts/parity/parity-report.json`, `scripts/parity/app-parity-report.json`, `scripts/parity/mobile-report.json`

- [ ] **Step 1: Registry and drift**

Run: `node scripts/pending.mjs --check`
Expected: `docs/PENDING.md is up to date`
Run: `git grep -nE 'PENDING\((toy-condition-words|toy-holder-location|exchange-toy-photo|handover-code-actions|toy-pause-unavailable|my-toy-summary|my-toy-inline-requests|inventory-states|toy-holder-picks|money-panel-detail|build-thread-cost-panel)\)|pending="(toy-condition-words|toy-holder-location|exchange-toy-photo|handover-code-actions|toy-pause-unavailable|my-toy-summary|my-toy-inline-requests|inventory-states|toy-holder-picks|money-panel-detail|build-thread-cost-panel)"' -- . ':!docs/**' ':!packages/types/src/pending.ts'`
Expected: no output.
Run the drift test. Expected: `Tests  11 passed (11)`.

- [ ] **Step 2: Types and unit suites**

Run: `pnpm typecheck` → exit 0.
Run: `pnpm --filter @splat-connect/api test:unit` → all pass.
Run: `pnpm --filter @splat-connect/web test:unit` → all pass.
Run: `pnpm --filter @splat-connect/mobile test:unit` → all pass.

- [ ] **Step 3: API integration against a clean local database**

Run: `supabase db reset` (applies every migration through 102 from scratch — proves 100–102 each run on their own, including 101's policy swap), then `pnpm --filter @splat-connect/api test:integration`.
Expected: all pass, including `tests/integration/toys/{holder-location,paused,retired,picks}.test.ts`, `tests/integration/toy-transactions/{toy-photo,new-code}.test.ts` and `tests/integration/exchange-costs/mine.test.ts`.

- [ ] **Step 4: Mobile e2e** (not at the same time as any web e2e)

Run: `pnpm --filter @splat-connect/mobile test:e2e tests/e2e/toy-library.spec.ts`
Expected: PASS (the condition chips are the four grades).

- [ ] **Step 5: Parity re-run**

Run: `./scripts/parity/stack.sh up`, then from `packages/web`: `node ../../scripts/parity/run.js` and `node ../../scripts/parity/app.js --id lib_toy,toy_detail,my_toys,exchange,build_thread,my_splat,org_toys,toy_library`.
Expected: web keeps its prior count with no new findings on `/toy-library/[id]` or `/dashboard/toys/[id]`; the app screens report no `pending` exemption errors. A new finding is a real divergence to fix or explain with `why: "intended"` and a reason — never `why: "pending"` naming a shipped id (the drift test refuses that). Then `node scripts/parity/mobile.js --id lib_toy,toy_detail,exchange,build_thread,my_splat,org_toys` for the 390px width check.

- [ ] **Step 6: Graph update**

Run: `graphify update .`
Expected: completes without error; `graphify-out/` updated.

- [ ] **Step 7: Commit the generated reports**

```bash
git add graphify-out scripts/parity/parity-report.json scripts/parity/app-parity-report.json scripts/parity/mobile-report.json
git commit -m "chore(toys): parity reports and graph after the toys and exchanges batch

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

Hosted database: migrations 100–102 are **not** pushed by this plan. Pushing to the live "development" project is a separate step Byron approves (`supabase db push`, then `pnpm db:guards`, which now checks the 102 row). The iOS dev client needs `npx expo prebuild -p ios` and a rebuild for `expo-clipboard` before anyone runs it on a phone.
