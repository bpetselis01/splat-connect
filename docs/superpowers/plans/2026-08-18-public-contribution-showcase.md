# Public Contribution Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a public "impact wall" plus per-entity public profile pages that showcase what contributors and organisations have made, given, and vouched for.

**Architecture:** Dedicated unauthenticated `/api/public/*` endpoints (anon Supabase client, RLS as backstop) compute contribution aggregates at read time. Next.js server components render the wall and profiles; a thin client component handles profile tabs. An opt-out flag on `profiles` (default on) governs individual visibility, enforced at both the query and RLS layers.

**Tech Stack:** Hono + Supabase (anon/admin clients) for the API; Next.js 16 App Router server components + Playwright for web; Vitest for API integration tests; SQL migration for schema/RLS.

**Spec:** `docs/superpowers/specs/2026-08-18-public-contribution-showcase-design.md`

## Global Constraints

- Public endpoints live in `packages/api/src/routes/public.ts`, mounted at `/api/public` **before** `authMiddleware`, and use `createAnonClient()` — never the admin/service client for data the wall returns. (Admin client is allowed only for a follow-up eligibility computation that never widens what a row exposes, matching the existing `unavailableToyIds()` pattern.)
- Public projections hand-write every `select`. Never `select('*')` on `profiles` (holds `email`) or return `org_leaders`.
- Toy statuses: shared = `toys.status = 'published'` and `archived_at is null`; delivered = `toy_transactions.status = 'completed'`.
- Tutorial public status = `'approved'`. Backing accepted = `tutorial_orgs.status = 'accepted'`. Org approval = `tutorials.reviewed_for_org_id`.
- Opt-out column: `profiles.public_showcase boolean not null default true`.
- API integration tests: `packages/api/tests/integration/public/*.test.ts`, vitest, `app.request(...)`, seed via `adminClient` and helpers in `tests/helpers/{auth,orgs}.ts`.
- Migrations are append-only and numbered; the next number is `034`.

---

## File Structure

- `supabase/migrations/034_public_showcase.sql` — **Create.** Column + public-read RLS.
- `packages/types/src/index.ts` — **Modify.** Add `public_showcase` to `Profile`; add `ImpactSummary`, `ImpactEntity`, `ContributorProfile`, `OrgPublicProfile` types.
- `packages/api/src/routes/public.ts` — **Modify.** Add `/impact`, `/contributors/:id`, `/organizations/:id`.
- `packages/api/src/routes/toys.ts` (PATCH profile) → actually profile PATCH lives in the profile route; **Modify** whichever route owns `PATCH /api/profile`/profile update to whitelist `public_showcase`.
- `packages/web/app/impact/page.tsx` — **Create.** The wall (layout C).
- `packages/web/app/contributors/[id]/page.tsx` — **Create.** Contributor profile (server fetch).
- `packages/web/app/organizations/[id]/public/page.tsx` OR a public-profile component reused — **Create** a dedicated public org profile page. (Do NOT touch `app/organizations/[id]/page.tsx`, the leader dashboard.)
- `packages/web/components/profile-tabs.tsx` — **Create.** Client tab switcher used by both profiles.
- `packages/web/components/impact-card.tsx` — **Create.** One entity card for the wall/strip.
- `packages/web/components/profile-form.tsx` — **Modify.** Add the "Show my contributions publicly" toggle.
- `packages/web/lib/nav-model.ts` and/or `packages/web/components/nav.tsx` — **Modify.** Public "Impact" link.
- `packages/api/tests/integration/public/impact.test.ts` — **Create.**
- `packages/api/tests/integration/public/contributor-profile.test.ts` — **Create.**
- `packages/api/tests/integration/public/org-profile.test.ts` — **Create.**
- `packages/web/tests/e2e/impact.spec.ts` — **Create.**

> Before Task 1, confirm the exact owner of the profile-update endpoint and the public nav location:
> `grep -rn "public_showcase\|PATCH\|profiles').update\|app.patch\|.put(" packages/api/src/routes/*.ts | grep -i profile`
> and `grep -rn "toy-library\|Library" packages/web/lib/nav-model.ts packages/web/components/nav.tsx`.
> Use what you find; the tasks below name the most likely files.

---

### Task 1: Schema + RLS migration

**Files:**
- Create: `supabase/migrations/034_public_showcase.sql`
- Test: `packages/api/tests/integration/public/impact.test.ts` (exercises the column indirectly; direct RLS assertion added in Task 3)

**Interfaces:**
- Produces: column `profiles.public_showcase` (bool, default true), selectable by anon/authenticated via a column grant. **No RLS policy** — opt-out is enforced in the endpoint queries (Ruling D), because `profiles.name` anon-read is shared by 023/026 (per-tutorial credit, reviewer-name display) which must stay ON for opted-out people.

- [ ] **Step 1: Write the migration**

```sql
-- 034_public_showcase.sql
-- WHY: individuals are shown on the public impact wall by default, but must be
--      able to remove themselves. Orgs are public entities and have no toggle.
-- HOW: an opt-out flag. Opt-out is enforced in routes/public.ts (the showcase
--      endpoints filter public_showcase and 404 opted-out profiles). It is NOT a
--      profiles RLS policy: profiles.name anon-read is already granted by 023
--      (contributor credit) and 026 (reviewer name), and the spec requires those
--      to keep showing for opted-out people, so an RLS gate here would be both
--      ineffective (policies OR together) and wrong (it would hide credits).
-- The column grant follows the 029 pattern so the API/tests may select the flag.
alter table public.profiles
  add column public_showcase boolean not null default true;

grant select (public_showcase) on public.profiles to anon, authenticated;
```

- [ ] **Step 2: Apply locally and verify the column + grant**
  Local Supabase is already running (shared). Run `supabase migration up --local`, then:
  `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "select public_showcase from public.profiles limit 1"` → succeeds.
  `psql ... -c "set role anon; select public_showcase from public.profiles limit 1"` → succeeds (grant works).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/034_public_showcase.sql
git commit -m "feat(db): opt-out flag and public read policy for the showcase"
```

---

### Task 2: Types

**Files:**
- Modify: `packages/types/src/index.ts`

**Interfaces:**
- Produces: `Profile.public_showcase: boolean`; `ImpactSummary`, `ImpactEntity`, `ContributorProfile`, `OrgPublicProfile`.

- [ ] **Step 1: Add `public_showcase` to the `Profile` type**
  Locate `interface Profile` (or type) and add `public_showcase: boolean`.

- [ ] **Step 2: Add the showcase payload types**

```ts
export interface ImpactEntity {
  id: string
  name: string
  tutorials: number
  toysShared: number
  toysDelivered: number
}
export interface ImpactOrgEntity extends ImpactEntity {
  projectsBacked: number
}
export interface ImpactRecent {
  kind: 'person' | 'org'
  id: string
  name: string
  at: string
}
export interface ImpactSummary {
  totals: {
    tutorials: number
    toysShared: number
    toysDelivered: number
    contributors: number
    organisations: number
  }
  recent: ImpactRecent[]
  contributors: ImpactEntity[]
  organisations: ImpactOrgEntity[]
}
export interface ContributorProfile {
  id: string
  name: string
  tutorials: Tutorial[]
  toysShared: Toy[]
  toysDelivered: Toy[]
}
export interface OrgPublicProfile {
  id: string
  name: string
  status: string
  tutorialsBacked: Tutorial[]
  tutorialsApproved: Tutorial[]
  toysShared: Toy[]
  toysDelivered: Toy[]
}
```

- [ ] **Step 3: Typecheck**
  Run: `pnpm --filter @splat-connect/types typecheck`
  Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/types/src/index.ts
git commit -m "feat(types): public contribution showcase payloads"
```

---

### Task 3: `GET /api/public/impact`

**Files:**
- Modify: `packages/api/src/routes/public.ts`
- Test: `packages/api/tests/integration/public/impact.test.ts`

**Interfaces:**
- Consumes: `createAnonClient`, `createAdminClient` (already imported in public.ts).
- Produces: `GET /api/public/impact` → `ImpactSummary`.

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

const BASE = 'http://localhost'

describe('GET /api/public/impact', () => {
  let maker: TestUser
  let hidden: TestUser

  beforeAll(async () => {
    maker = await createTestUser()
    hidden = await createTestUser()
    // maker: one approved tutorial they are credited on.
    // Ruling A: tutorials has no owner_id; difficulty is NOT NULL; authorship is
    // a tutorial_contributors row with role 'primary' (check is primary|collaborator).
    const { data: tut } = await adminClient
      .from('tutorials').insert({ title: 'Grip Aid', difficulty: 'easy', status: 'approved' })
      .select('id').single()
    await adminClient.from('tutorial_contributors')
      .insert({ tutorial_id: tut!.id, profile_id: maker.id, role: 'primary' })
    // maker: one published toy (shared)
    await adminClient.from('toys')
      .insert({ name: 'Bear', status: 'published', owner_id: maker.id, quantity: 1 })
    // hidden: opts out but has a published toy
    await adminClient.from('profiles').update({ public_showcase: false }).eq('id', hidden.id)
    await adminClient.from('toys')
      .insert({ name: 'Ghost', status: 'published', owner_id: hidden.id, quantity: 1 })
  })

  afterAll(async () => {
    // deleteTestUser cascades to the seeded profile rows; toys/tutorials seeded
    // above cascade on owner/profile delete. If any orphan remains, delete it by
    // the captured id here.
    await deleteTestUser(maker.id)
    await deleteTestUser(hidden.id)
  })

  it('counts approved tutorials and shared toys, and excludes opted-out people', async () => {
    const res = await app.request(`${BASE}/api/public/impact`)
    expect(res.status).toBe(200)
    const body = await res.json()
    const names = body.contributors.map((c: any) => c.name)
    const makerCard = body.contributors.find((c: any) => c.id === maker.id)
    expect(makerCard).toBeTruthy()
    expect(makerCard.tutorials).toBeGreaterThanOrEqual(1)
    expect(makerCard.toysShared).toBeGreaterThanOrEqual(1)
    expect(body.contributors.some((c: any) => c.id === hidden.id)).toBe(false)
    expect(body.recent.some((r: any) => r.id === hidden.id)).toBe(false)
    expect(body.totals.tutorials).toBeGreaterThanOrEqual(1)
  })
})
```

- [ ] **Step 2: Run test, verify it fails**
  Run: `pnpm --filter @splat-connect/api test:integration public/impact`
  Expected: FAIL (route 404 / undefined body).

- [ ] **Step 3: Implement the endpoint**
  Add to `public.ts`. Compute per-entity counts in the handler by fetching the raw rows via the anon client (RLS already limits `profiles` to showcased-eligible) and aggregating in JS — the same shape as `unavailableToyIds()`.

```ts
publicRoutes.get('/impact', async (c) => {
  const sb = createAnonClient()
  const admin = createAdminClient() // Ruling B: toy_transactions has no anon SELECT policy.
  const [tutorials, contribs, toys, delivered, orgs] = await Promise.all([
    sb.from('tutorials').select('id, created_at, reviewed_for_org_id').eq('status', 'approved'),
    sb.from('tutorial_contributors').select('tutorial_id, profile_id, tutorials!inner(status)').eq('tutorials.status', 'approved'),
    sb.from('toys').select('id, owner_id, owner_org_id, created_at').eq('status', 'published').is('archived_at', null),
    // delivered: admin client, restricted columns only — counts, never counterparty/pickup PII.
    admin.from('toy_transactions').select('toy_id, owner_id, owner_org_id, updated_at').eq('status', 'completed'),
    sb.from('organizations').select('id, name, status'),
  ])
  // Build maps: personId -> {tutorials, toysShared, toysDelivered}, orgId -> {...}
  // Ruling D: resolve names AND opt-out via the admin client, then filter:
  //   const { data: people } = await admin.from('profiles')
  //     .select('id, name, public_showcase').in('id', [...personIds])
  //   keep only people.filter(p => p.public_showcase)  // opt-out enforced here
  // Org names come from the `orgs` read above.
  // Assemble ImpactSummary. recent = distinct entities behind the newest
  //   tutorial/toy/handoff events, cap 8, recency-ordered, opted-out excluded.
  // ... (implement per spec counting rules)
  return c.json(summary)
})
```
  Requirements the implementer must satisfy (copied from spec):
  - person counts for any tutorial where they are a `tutorial_contributor` (any role) and the tutorial is `approved`;
  - `toysShared` grouped by `owner_id`/`owner_org_id`; `toysDelivered` from completed transactions grouped by giver;
  - an entity appears only with ≥1 contribution; a person also only if `public_showcase = true` (filtered in app, Ruling D);
  - `recent`: ≤8 distinct entities, recency-ordered, no ranking.

- [ ] **Step 4: Run test, verify it passes**
  Run: `pnpm --filter @splat-connect/api test:integration public/impact`
  Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/public.ts packages/api/tests/integration/public/impact.test.ts
git commit -m "feat(api): public impact aggregate endpoint"
```

---

### Task 4: `GET /api/public/contributors/:id`

**Files:**
- Modify: `packages/api/src/routes/public.ts`
- Test: `packages/api/tests/integration/public/contributor-profile.test.ts`

**Interfaces:**
- Produces: `GET /api/public/contributors/:id` → `ContributorProfile` | 404.

- [ ] **Step 1: Write failing test** — assert:
  - 200 with `tutorials`/`toysShared`/`toysDelivered` arrays for an eligible person;
  - **404** for an unknown uuid;
  - **404** for an opted-out person who otherwise has contributions;
  - **404** for a person with zero public contributions.

```ts
it('404s for opted-out and zero-contribution people, 200 for eligible', async () => {
  const ok = await app.request(`${BASE}/api/public/contributors/${maker.id}`)
  expect(ok.status).toBe(200)
  expect((await ok.json()).tutorials.length).toBeGreaterThanOrEqual(1)

  const gone = await app.request(`${BASE}/api/public/contributors/${hidden.id}`)
  expect(gone.status).toBe(404)

  const missing = await app.request(`${BASE}/api/public/contributors/00000000-0000-0000-0000-000000000000`)
  expect(missing.status).toBe(404)
})
```

- [ ] **Step 2: Run test, verify it fails**
  Run: `pnpm --filter @splat-connect/api test:integration public/contributor-profile`
  Expected: FAIL.

- [ ] **Step 3: Implement**
  Read the profile via the admin client (`select('id, name, public_showcase')`); 404 if not found **or** `public_showcase` is false (Ruling D — opt-out enforced here). Then fetch approved tutorials the person is credited on (anon), their published toys (anon), and toys behind their completed handoffs (admin, per Ruling B). If all three collections are empty, return 404.

```ts
publicRoutes.get('/contributors/:id', async (c) => {
  const sb = createAnonClient()
  const admin = createAdminClient()
  const id = c.req.param('id')
  const { data: profile } = await admin.from('profiles')
    .select('id, name, public_showcase').eq('id', id).maybeSingle()
  if (!profile || !profile.public_showcase) return c.json({ error: 'Not found' }, 404)
  // fetch tutorials (approved, credited) via sb; toysShared (published) via sb;
  // toysDelivered via admin (completed handoffs). if all empty -> 404
  return c.json({ id: profile.id, name: profile.name, tutorials, toysShared, toysDelivered })
})
```

- [ ] **Step 4: Run test, verify it passes** — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/public.ts packages/api/tests/integration/public/contributor-profile.test.ts
git commit -m "feat(api): public contributor profile endpoint"
```

---

### Task 5: `GET /api/public/organizations/:id`

**Files:**
- Modify: `packages/api/src/routes/public.ts`
- Test: `packages/api/tests/integration/public/org-profile.test.ts`

**Interfaces:**
- Produces: `GET /api/public/organizations/:id` → `OrgPublicProfile` | 404.

- [ ] **Step 1: Write failing test** — assert:
  - 200 with only public fields; the response body **must not** contain `org_leaders`, `email`, or any pickup field (assert `JSON.stringify(body)` excludes them);
  - 404 for unknown or zero-contribution org.
  Seed with `createOrg`, `addLeader`, `createOrgToy`, `setOrgPickup` from `tests/helpers/orgs.js`.

- [ ] **Step 2: Run test, verify it fails** — Expected: FAIL.

- [ ] **Step 3: Implement** — anon client, hand-written projection: org `id, name, status`; tutorials it `accepted`-backed (`tutorial_orgs.status='accepted'` + tutorial approved); tutorials where `reviewed_for_org_id = :id` and approved; published org toys; completed org handoffs. 404 if none.

- [ ] **Step 4: Run test, verify it passes** — Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/public.ts packages/api/tests/integration/public/org-profile.test.ts
git commit -m "feat(api): public organisation profile endpoint"
```

---

### Task 6: Opt-out toggle (API whitelist + dashboard control)

**Files:**
- Modify: the profile-update route (confirm owner via the grep in File Structure).
- Modify: `packages/web/components/profile-form.tsx`
- Test: add a case to the profile route's existing unit/integration test.

**Interfaces:**
- Consumes: `Profile.public_showcase` (Task 2).
- Produces: `PATCH` accepts `{ public_showcase: boolean }`; the toggle persists it.

- [ ] **Step 1: Write failing test** — PATCH the profile with `{ public_showcase: false }`, re-read, assert it persisted; assert other frozen fields (email) still cannot be changed.

- [ ] **Step 2: Run test, verify it fails** — Expected: FAIL (field ignored / not whitelisted).

- [ ] **Step 3: Implement** — add `public_showcase` to the profile update whitelist (mirror how `name` is accepted; reject non-boolean).

- [ ] **Step 4: Add the toggle to `profile-form.tsx`** — a labelled switch "Show my contributions publicly", bound to `profile.public_showcase`, submitting through the existing form action. Helper text: "Your name still appears on tutorials you're credited on."

- [ ] **Step 5: Run tests** — Run: `pnpm --filter @splat-connect/api test:integration` and `pnpm --filter @splat-connect/web test:unit`. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/routes packages/web/components/profile-form.tsx packages/api/tests
git commit -m "feat: opt-out toggle for public showcase"
```

---

### Task 7: `/impact` wall page (layout C)

**Files:**
- Create: `packages/web/app/impact/page.tsx`
- Create: `packages/web/components/impact-card.tsx`

**Interfaces:**
- Consumes: `GET /api/public/impact` (`ImpactSummary`).
- Produces: the wall route at `/impact`.

- [ ] **Step 1: Implement `impact-card.tsx`** — presentational card: name, person/org badge, the three counts; wraps a `Link` to `/contributors/[id]` or the public org profile.

- [ ] **Step 2: Implement `page.tsx`** — server component. Fetch `${process.env.API_URL}/api/public/impact` with `cache: 'no-store'`; on failure render an empty state (mirror `app/toy-library/page.tsx`'s try/catch-to-`[]`). Render: (1) stats band of the five totals; (2) "Recently active" horizontal strip from `recent`; (3) unified grid of `contributors` + `organisations` cards. No ranking — order as returned.

- [ ] **Step 3: Manual check** — `pnpm dev:web` + `pnpm dev:api`, open `/impact`, confirm totals, strip, and grid render and cards link out.

- [ ] **Step 4: Commit**

```bash
git add packages/web/app/impact/page.tsx packages/web/components/impact-card.tsx
git commit -m "feat(web): public impact wall"
```

---

### Task 8: Profile pages (tabbed) + shared tab switcher

**Files:**
- Create: `packages/web/components/profile-tabs.tsx` (client)
- Create: `packages/web/app/contributors/[id]/page.tsx`
- Create: `packages/web/app/organizations/[id]/public/page.tsx` (public org profile — leave the leader dashboard page untouched)

**Interfaces:**
- Consumes: `GET /api/public/contributors/:id`, `GET /api/public/organizations/:id`.
- Produces: `/contributors/[id]` and a public org profile route.

- [ ] **Step 1: Implement `profile-tabs.tsx`** — `'use client'`. Props: `tabs: { key: string; label: string; content: ReactNode }[]`. Renders the pill row and shows the active tab's content; state is local `useState`. No data fetching in this component.

- [ ] **Step 2: Implement `contributors/[id]/page.tsx`** — server component. Fetch the contributor profile; on non-200 call `notFound()`. Render identity header (avatar, name, headline counts), then `<ProfileTabs>` with **Tutorials** (reuse `tutorial-card`) and **Toys given** (reuse the toy card) tabs.

- [ ] **Step 3: Implement the public org profile page** — same shape, square avatar, tabs **Tutorials**, **Toys given**, **Projects** (backed/approved). `notFound()` on non-200.

- [ ] **Step 4: Manual check** — from `/impact`, click a contributor and an org card, switch tabs; confirm 404 page for an opted-out/unknown id.

- [ ] **Step 5: Commit**

```bash
git add packages/web/components/profile-tabs.tsx packages/web/app/contributors packages/web/app/organizations/[id]/public
git commit -m "feat(web): tabbed public contributor and organisation profiles"
```

---

### Task 9: Public "Impact" nav link

**Files:**
- Modify: `packages/web/lib/nav-model.ts` and/or `packages/web/components/nav.tsx` (confirm via grep).

- [ ] **Step 1: Add the link** — an "Impact" entry pointing to `/impact` in the public/top nav, beside the existing Library/Toy Library links.

- [ ] **Step 2: Manual check** — link appears logged out and navigates to `/impact`.

- [ ] **Step 3: Commit**

```bash
git add packages/web/lib/nav-model.ts packages/web/components/nav.tsx
git commit -m "feat(web): impact link in public nav"
```

---

### Task 10: Web e2e — wall → profile → tabs

**Files:**
- Create: `packages/web/tests/e2e/impact.spec.ts`

- [ ] **Step 1: Write the e2e** — using the `toy-exchange.spec.ts` fixture pattern, seed an approved tutorial with a credited contributor and a published toy, then: visit `/impact`, assert a total is visible and the contributor card shows, click it, assert the profile header, click the "Toys given" tab, assert content switches.

- [ ] **Step 2: Run it**
  Run: `pnpm --filter @splat-connect/web test:e2e impact`
  Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/web/tests/e2e/impact.spec.ts
git commit -m "test(web): e2e for the impact wall and profiles"
```

---

## Self-Review

**Spec coverage:**
- Wall (`/impact`, layout C) → Task 7. Profiles (tabbed) → Task 8. Opt-out → Tasks 1 (column+grant) + 6 (toggle) + app-layer filter in Tasks 3–5. Dedicated public endpoints → Tasks 3–5. Counting rules → Task 3. Nav → Task 9. Testing → Tasks 3–5, 10. ✅ All spec sections mapped.
- Opt-out enforcement is application-layer (Ruling D): there is no `profiles` RLS backstop, because `profiles.name` anon-read is shared with per-tutorial credit and reviewer display (023/026) which must stay ON. Tasks 3 and 4 assert opted-out people are absent from `/impact` (totals + list + recent) and 404 on `/contributors/:id` — these ARE the opt-out tests. Per-tutorial credit is verified unchanged by the existing tutorial-detail behaviour (untouched).

**Placeholder scan:** Task 3's handler body is a deliberate sketch with the exact counting requirements copied from the spec beneath it, not a "TODO" — the aggregation is mechanical JS over the fetched rows. All other tasks carry concrete code or exact assertions.

**Type consistency:** `ImpactSummary`/`ImpactEntity`/`ContributorProfile`/`OrgPublicProfile` (Task 2) are the exact shapes returned in Tasks 3–5 and consumed in Tasks 7–8. `public_showcase` name is identical across migration (Task 1), types (Task 2), API whitelist and toggle (Task 6).

**Known uncertainties to resolve at execution time (named, not hidden):**
- The exact route file owning profile update (Task 6) — resolve via the grep in File Structure.
- The public nav location (Task 9) — `nav-model.ts` vs `nav.tsx`.
- Whether `tutorials` has an `owner_id` vs an authoring row only — the Task 3 seed assumes an `owner_id`; if tutorials are authored purely through `tutorial_contributors`, drop `owner_id` from the seed insert and rely on the contributor row.
