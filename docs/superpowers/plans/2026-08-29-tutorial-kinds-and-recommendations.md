# Tutorial Kinds and Recommendations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split tutorials into toy adaptations and assistive tech through one `kind` column, gate the STL step on it, and let a creator recommend up to three other tutorials.

**Architecture:** One `tutorials` table gains `kind`; a new `tutorial_recommendations` table enforces the 3-cap with `position`. The existing stepper filters its steps by kind. The public API strips unapproved recommendations the same way it strips unaccepted backing.

**Tech Stack:** Supabase/Postgres migrations, Hono API (`packages/api`), Next.js App Router (`packages/web`), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-29-tutorial-kinds-and-recommendations-design.md`

## Global Constraints

- **No commits.** Byron's instruction for this work. Every task ends at "tests pass", not at a commit.
- `kind` values are exactly `'toy_adaptation'` and `'assistive_tech'`; display names come only from `KIND_LABEL` in `packages/types`.
- `toy_photo_url` keeps its name. UI label is "Photo".
- Migration applies to the linked cloud project (`supabase db push`) **and** the local stack (`supabase migration up --local`).
- Unit tests: `pnpm --filter @splat-connect/api test:unit`, `pnpm --filter @splat-connect/web test:unit`. Typecheck: `pnpm typecheck`. Integration tests need the local Supabase stack running.

---

### Task 1: Migration, schema doc, seed

**Files:**
- Create: `supabase/migrations/048_tutorial_kind.sql`
- Modify: `supabase/SCHEMA.md` (migration index + tables), `supabase/seed.sql:84-85`

**Produces:** `tutorials.kind`, `public.tutorial_recommendations`.

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/048_tutorial_kind.sql
-- WHY: every tutorial walked the same steps, STL included, with nothing in the
--      data saying whether it was a switch-adapted toy (which never needs an
--      STL) or an assistive-tech build (whose whole point is the printed part).
--      Contributors filled the wrong step and print requests had no way to
--      find the printable ones. A second pipeline was proposed and rejected:
--      the two differ by exactly one step, so a discriminator says it.
-- HOW: kind on tutorials, defaulted to toy_adaptation because every existing
--      row is one (their STL rows were purged 2026-08-29). Recommendations are
--      a positioned join table: position 1..3 plus unique (tutorial, position)
--      is the 3-cap, so no trigger. RLS mirrors parts policy for policy.
alter table public.tutorials
  add column kind text not null default 'toy_adaptation'
    check (kind in ('toy_adaptation', 'assistive_tech'));

create table public.tutorial_recommendations (
  tutorial_id    uuid not null references public.tutorials on delete cascade,
  recommended_id uuid not null references public.tutorials on delete cascade,
  position       smallint not null check (position between 1 and 3),
  primary key (tutorial_id, recommended_id),
  unique (tutorial_id, position),
  check (tutorial_id <> recommended_id)
);

alter table public.tutorial_recommendations enable row level security;

create policy "Anyone can read recommendations of approved tutorials"
  on public.tutorial_recommendations for select using (
    exists (select 1 from public.tutorials t where t.id = tutorial_id and t.status = 'approved')
  );

create policy "Contributors can read own tutorial recommendations"
  on public.tutorial_recommendations for select using (
    exists (
      select 1 from public.tutorial_contributors tc
      where tc.tutorial_id = tutorial_recommendations.tutorial_id and tc.profile_id = auth.uid()
    )
  );

create policy "Contributors can write own tutorial recommendations"
  on public.tutorial_recommendations for all
  using (
    exists (
      select 1 from public.tutorial_contributors tc
      where tc.tutorial_id = tutorial_recommendations.tutorial_id and tc.profile_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.tutorial_contributors tc
      where tc.tutorial_id = tutorial_recommendations.tutorial_id and tc.profile_id = auth.uid()
    )
  );

create policy "Admin full access to tutorial_recommendations"
  on public.tutorial_recommendations for all using (public.is_admin());
```

- [ ] **Step 2: Seed** — the `aaaa…` tutorial carries an STL, so it becomes `kind = 'assistive_tech'` (add `kind` to its insert column list). Add one recommendation row `bbbb… → aaaa…` is not useful (bbbb is pending, invisible). Instead add `aaaa… → bbbb…` at position 1: it exercises the public filter (bbbb is pending, so the public page must show nothing) without needing a third tutorial.

- [ ] **Step 3: SCHEMA.md** — add row 048 to the migration index; add `kind` to the `tutorials` table; add a `tutorial_recommendations` section after `stl_files`.

- [ ] **Step 4: Apply locally and to the linked project**

Run: `supabase migration up --local` then `supabase db push`
Expected: both report 048 applied.

### Task 2: Types

**Files:**
- Modify: `packages/types/src/index.ts` (Tutorial, TutorialWithDetails, new exports)

**Produces:**
```ts
export type TutorialKind = 'toy_adaptation' | 'assistive_tech'
export const KIND_LABEL: Record<TutorialKind, string>
export interface Recommendation { position: number; tutorials: Pick<Tutorial, 'id'|'title'|'kind'|'difficulty'|'toy_photo_url'|'status'> }
// Tutorial.kind: TutorialKind
// TutorialWithDetails.tutorial_recommendations: Recommendation[]
```

- [ ] Add the above. Run `pnpm typecheck` — expect failures in every fixture that builds a `TutorialWithDetails` literal (edit-steps.test, validation.test, edit-tutorial.test, leader/admin page tests, tutorial-view consumers). Fix each fixture by adding `kind: 'toy_adaptation'` and `tutorial_recommendations: []`. Typecheck green.

### Task 3: API — POST/PATCH kind, embeds, recommendations route

**Files:**
- Modify: `packages/api/src/routes/tutorials.ts` (POST insert, EDITABLE, GET /:id select)
- Modify: `packages/api/src/routes/public.ts:81-110`
- Modify: `packages/api/src/routes/sub-resource.ts` (mapRow gains index)
- Create: `packages/api/src/routes/recommendations.ts`
- Modify: `packages/api/src/app.ts` (route registration)
- Test: `packages/api/tests/unit/routes/tutorials.test.ts`, `packages/api/tests/unit/routes/recommendations.test.ts`
- Test: `packages/api/tests/integration/parts-tools/recommendations.test.ts`

- [ ] **Step 1: Failing unit tests**

`tutorials.test.ts`, in `describe('POST /')`:
```ts
it('inserts kind, defaulting to toy_adaptation', async () => {
  const insert = vi.fn(() => ({ select: () => ({ single: () => ({ data: { id: 'x' }, error: null }) }) }))
  withTerms(true)
  mockAdminClient.from.mockReturnValue({ insert })
  await makeApp().request('/', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'x', title: 'T', difficulty: 'easy' }) })
  expect(insert.mock.calls[0][0]).toMatchObject({ kind: 'toy_adaptation' })
  await makeApp().request('/', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'y', title: 'T', difficulty: 'easy', kind: 'assistive_tech' }) })
  expect(insert.mock.calls[1][0]).toMatchObject({ kind: 'assistive_tech' })
})
```

`recommendations.test.ts` — copy of `stl-files.test.ts` with table `tutorial_recommendations`, body key `recommendations`, plus:
```ts
it('numbers rows by position from 1', async () => {
  await makeApp().request('/tutorial-1/recommendations', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recommendations: [{ recommended_id: 'a' }, { recommended_id: 'b' }] }) })
  expect(mockInsert.mock.calls[0][0]).toEqual([
    { tutorial_id: 'tutorial-1', recommended_id: 'a', position: 1 },
    { tutorial_id: 'tutorial-1', recommended_id: 'b', position: 2 },
  ])
})
```

- [ ] **Step 2: Implement**

`sub-resource.ts`: `mapRow: (item: Item, tutorialId: string, index: number)`; call `opts.mapRow(item, tutorialId, i)`.

`recommendations.ts`:
```ts
import { subResourceRoutes } from './sub-resource.js'
export default subResourceRoutes<{ recommended_id: string }>({
  path: 'recommendations', table: 'tutorial_recommendations', bodyKey: 'recommendations',
  mapRow: (r, tutorialId, index) => ({ tutorial_id: tutorialId, recommended_id: r.recommended_id, position: index + 1 }),
})
```

`tutorials.ts`: POST inserts `kind: body.kind ?? 'toy_adaptation'`; `EDITABLE` gains `'kind'`; GET /:id select gains `tutorial_recommendations(position, tutorials!recommended_id(id, title, kind, difficulty, toy_photo_url, status))`.

`public.ts` GET /tutorials/:id: same embed; response filters `tutorial_recommendations` to `r.tutorials?.status === 'approved'` and sorts by position.

`app.ts`: `app.route('/api/tutorials', recommendations)`.

- [ ] **Step 3: Integration test** (`recommendations.test.ts`, local stack): owner posts 3 → 201; posts 4 → 500 (constraint); posts self → 500; anon GET `/api/public/tutorials/:id` on an approved owner with one approved and one pending target returns only the approved one.

- [ ] **Step 4:** unit tests green, typecheck green.

### Task 4: Web — steps, validation, create page

**Files:**
- Modify: `packages/web/lib/edit-steps.ts`, `packages/web/lib/validation.ts`
- Modify: `packages/web/app/upload/page.tsx`, `packages/web/components/new-tutorial-form.tsx`
- Test: `packages/web/tests/unit/lib/edit-steps.test.ts`, `validation.test.ts`, create `tests/unit/pages/upload.test.tsx`

**Produces:** `stepsFor(kind: TutorialKind): EditStepId[]`; `EditStepId` gains `'recommended'`; `computeStepStatuses(...).recommended`.

- [ ] **Step 1: Failing tests**

edit-steps: `stepsFor('toy_adaptation')` equals `['details','files','parts','tools','review','recommended','team']`; `stepsFor('assistive_tech')` has `'stl'` between tools and review. `computeStepStatuses` on an assistive_tech tutorial with no STL → `stl: 'attention'`; with one → `'done'`. `recommended` neutral when empty, done with one row. Existing "stl is neutral when empty" test is replaced.

validation: assistive_tech with `stl_files: []` contains `'At least one STL file'`; toy with none does not; `'Photo'` replaces `'Toy photo'`.

upload page (server component, render directly with `searchParams`): no kind → two links to `/upload?kind=toy_adaptation` and `/upload?kind=assistive_tech`, no Title field; `kind=assistive_tech` → Title field and a tab `STL Files`; `kind=toy_adaptation` → no `STL Files` tab.

- [ ] **Step 2: Implement**

`edit-steps.ts`:
```ts
export function stepsFor(kind: TutorialKind): EditStepId[] {
  return kind === 'assistive_tech'
    ? ['details', 'files', 'parts', 'tools', 'stl', 'review', 'recommended', 'team']
    : ['details', 'files', 'parts', 'tools', 'review', 'recommended', 'team']
}
```
`REQUIRED` gains `{ step: 'stl', fields: { 'At least one STL file': 'A 3D-print file' } }`; files label `'Photo': 'A photo'`. `computeStepStatuses`: `stl: fieldStatus(missing, 'stl')`, `recommended: tutorial.tutorial_recommendations.length > 0 ? 'done' : 'neutral'`.

`validation.ts`: `'Toy photo'` → `'Photo'`; add the kind-gated STL check.

`upload/page.tsx`: `searchParams: Promise<{ kind?: string }>`; render `KindChoice` (two `<Link>` cards) when kind is not one of the two values; otherwise `NewTutorialForm kind={kind}` and `LOCKED` built from `stepsFor(kind).slice(1)` with labels from a `LABELS` map. `new-tutorial-form.tsx` posts `kind`.

- [ ] **Step 3:** tests green.

### Task 5: Web — edit page

**Files:**
- Modify: `packages/web/app/tutorials/[id]/edit/page.tsx`, `packages/web/components/edit-details-section.tsx`
- Create: `packages/web/components/edit-recommendations-section.tsx`
- Test: `tests/unit/pages/edit-tutorial.test.tsx`, create `tests/unit/components/edit-recommendations-section.test.tsx`

- [ ] **Step 1: Failing tests**

edit-tutorial page: toy tutorial renders no `[data-step="stl"]`; assistive_tech does; both render `[data-step="recommended"]`.

edit-recommendations-section (props `tutorialId`, `initial: Recommendation[]`, `candidates: Tutorial[]`, `onSave: (ids: string[]) => Promise<void>`): with three initial, no picker (no combobox/select); with one, picker excludes the current tutorial and already-chosen ids; an initial target whose status is `pending` shows text `Not yet approved`; remove then save calls `onSave` with the remaining ids.

- [ ] **Step 2: Implement**

Edit page: fetch `candidates` via `apiClient.get<Tutorial[]>('/api/public/tutorials').catch(() => [])`; `saveRecommendations(ids)` server action posts `{ recommendations: ids.map((recommended_id) => ({ recommended_id })) }`; build `steps` as before then filter with `stepsFor(tutorial.kind)`; STL step content unchanged; new `recommended` step, `trailing: true`, before Team. Details select for kind, `saveDetails` patch includes `kind`.

Section component: `useState<Recommendation[]>(initial)`; a native `<select>` (label "Add a recommendation") listing candidates minus self minus chosen, `onChange` appends and marks dirty; each slot is a row with title, `KIND_LABEL`, the "Not yet approved — hidden from the public page" tag when `status !== 'approved'`, and a Remove button; `PanelActions` Save button; `useSaveOnLeave` when dirty.

- [ ] **Step 3:** tests green.

### Task 6: Web — public rendering

**Files:**
- Modify: `packages/web/components/tutorial-view.tsx`, `packages/web/components/tutorial-card.tsx`
- Create: `packages/web/components/kind-badge.tsx`
- Test: `tests/unit/components/tutorial-view.test.tsx` (create), `tests/unit/components/tutorial-card.test.tsx`

- [ ] **Step 1: Failing tests**

tutorial-view: toy with STL rows → no "Files for 3D printing"; assistive_tech with rows → present; three recommendations → "Also worth a look" with three links in position order; a pending recommendation → "Not yet approved" tag; none → no heading. tutorial-card: renders `Toy adaptation` / `Assistive tech` badge.

- [ ] **Step 2: Implement** `KindBadge` (`<span className="badge …">{KIND_LABEL[kind]}</span>`), gate the STL block on kind, add the section rendering `TutorialCard` per recommendation (`TutorialCard` accepts a `Tutorial`; the embed's `tutorials` pick is widened to a `Tutorial` by spreading defaults — simpler: give `TutorialCard` a minimal `Listed` type of the picked fields, which is all it reads). Mobile `TutorialDetail` type gains `kind` via `Tutorial`.

- [ ] **Step 3:** tests, lint, typecheck green.

### Task 7: E2E and review panel

- Modify `packages/web/tests/e2e/contributor/upload-flow.spec.ts`: each `page.goto('/upload')` becomes `/upload?kind=toy_adaptation`; the locked-tabs test drops `'STL Files'` and gains a sibling asserting it appears for `?kind=assistive_tech`; add a test that the bare `/upload` shows both cards.
- Modify `packages/web/tests/e2e/contributor/edit-tutorial.spec.ts` if it visits the STL step: the tutorial it creates must be assistive_tech.
- `TutorialReviewPanel` keeps `stlCount`; pass `0` for toys? No — it renders the count only when `> 0` already, and toys have none. Unchanged.
- Run `pnpm typecheck && pnpm --filter @splat-connect/web lint`.

## Self-review

- Spec coverage: data (T1), types (T2), API (T3), create (T4), edit incl. kind select and Recommended pill (T5), public + card badge + mobile type (T6), tests/seed/e2e (T1, T7). Library filter, mobile recs, interstitial: out of scope per spec.
- Names used consistently: `stepsFor`, `KIND_LABEL`, `Recommendation`, `tutorial_recommendations`, `saveRecommendations`, `EditRecommendationsSection`, `KindBadge`.
