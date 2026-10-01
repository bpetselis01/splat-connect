# Challenges + Makers Build (Sub-project 4, Batch 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the 15 challenge and makers-wanted items in `packages/types/src/pending.ts` (`idea-required-fields`, `build-request-options`, `challenge-thread-tab`, `challenge-outcome-tab`, `challenge-maker-meta`, `challenge-saves-stat`, `idea-photo`, `challenge-brief-photo`, `challenge-author-states`, `idea-anonymous`, `challenge-writeup-stage`, `challenge-constraints`, `makers-row-meta`, `makers-live-done-tabs`, `makers-ask-first`) and ship each one out of the registry.

**Architecture:** One task per registry item. Nine of them add a migration, 103–111. Ideas and challenges stay one table (`toy_ideas`); the public read (`GET /api/public/challenges/:id`, admin client, explicit column list) grows the new public fields, and every new public column joins 040's anon column grant. Shared pure rules go in two new files in `packages/types` (`challenges.ts`, `builds.ts`) so web and mobile say the same thing. The guide-published notification is a database trigger on `tutorials`, because two routes approve a guide (admin and org leader) and a trigger is the one place both pass through. Ask-first questions are their own table (`build_request_questions`), readable by the family and that maker only, copied into the build thread when that maker claims.

**Tech Stack:** Hono + supabase-js + vitest (api), Next.js App Router + vitest (web), Expo SDK 57 / Expo Router / React Native + jest + RNTL (mobile), Postgres migrations via the Supabase CLI.

**Spec:** `docs/superpowers/specs/2026-10-01-challenges-makers-build-design.md` (inherits "Rules every slice keeps" from `docs/superpowers/specs/2026-10-01-guides-build-design.md`).

**Order note:** the spec's slice order is kept with one swap: `challenge-author-states` (Task 9) runs before `idea-anonymous` (Task 10). Anonymous makes the public read return `author_id: null`, and the author's own screens then recognise their idea through `GET /api/ideas/mine/:id`, which Task 9 adds. Inside slice 2 the Thread tab (Task 3) goes before Outcome (Task 4) because it rewrites the tab bar Outcome then joins.

**Where this plan follows the code, not the spec** (each is repeated in the task that meets it):

1. 057 is not the live `toy_transactions_subject`; 061 recreated it (with the print branch). Task 2 recreates 061's text with only the build arm relaxed.
2. 077's `notifications_one_subject` needs no widening: `toy_transaction_id` and `tutorial_id` are already among its seven subjects. Tasks 11 and 15 only extend `notifications_type_check`.
3. There is no ideas/photos bucket. Task 7 follows 093's note-photo route: the service role writes to the public `toy-photos` bucket under `ideas/<author>/`, and the idea stores the URL.
4. `profiles.role` is `admin | contributor` (access, not trade), never "OT". Task 5 maps it to the board's "Maker" for contributors and "Admin" for admins.
5. Graduation (`admin.ts`) makes the idea's **author** the draft's primary contributor, never a maker, so `writing_up` names the author and a maker row never reads "writing it up" today. Task 5/11 implement the spec literally and suppress the name when the author is anonymous.
6. The board's brief puts the summary first and the requirement box second; Task 8 maps "What a solution has to do" to `description`, not `summary` (the summary is the card line, as on the board and the list).
7. 037 grants authenticated `insert, update` only; withdraw needs `grant delete` as well as the policy (Task 9).
8. Anonymity: 040 grants anon `author_id`. Task 10 revokes it from anon. Controller ruling 2 closes this for signed-in users too.
9. Live/Done must not show builds addressed to a named maker (they are private to two parties). Task 14 lists only rows with `travel_km` set, which only the open-board form sends (064 requires it there).

## Controller rulings (override the tasks below where they differ)

1. **Idea photos are storage paths, never URLs** (the hole closed in guides Task 20, commits 159d6a63..e731e983). The column is `toy_ideas.photo_path` with `CHECK (photo_path is null or photo_path ~ ('^ideas/' || author_id::text || '/[0-9a-f-]{36}\.(jpg|png|webp|avif|heic|heif)$'))`; the upload route takes the extension from the whitelisted MIME type and returns `{ path, url }`; every read builds `photo_url` server-side from `SUPABASE_URL` + the toy-photos public prefix + the path. Tests: a direct user-client insert/update with an absolute URL or another member's folder fails the CHECK; the API rejects both. A pending idea's photo is reachable by its unguessable URL before review — accepted (same as note photos).
2. **Anonymity holds for signed-in readers too.** Revoke `author_id` from BOTH `anon` and `authenticated` on `toy_ideas` (column-level: revoke the table-wide select and re-grant every other column; keep RLS policies, which may still reference `author_id`). Any API path that needs the author id reads it with the admin client. Integration test: a signed-in non-author's direct PostgREST select of `author_id` on an anonymous challenge errors or returns nothing usable. The author's own thread messages still show their name to joined makers — accepted: anonymity is about the public challenge, and the author chose to post.
3. **"{maker} is writing this up" names the graduated guide's primary contributor**, whoever that is (today graduation makes the idea's author primary). No new write-up flow in this batch.

## Global Constraints

- **One migration per slice, numbered from 103** (batches 1–3 own 085–102): `103_idea_optional_fields.sql`, `104_build_note_optional.sql`, `105_challenge_save_count.sql`, `106_idea_photo.sql`, `107_idea_withdraw.sql`, `108_idea_anonymous.sql`, `109_challenge_guide_published.sql`, `110_idea_constraints.sql`, `111_build_request_questions.sql`. Each has a `-- DOWN:` block like 068/074. Each migration's integration test selects or exercises its new objects through the admin client, so a repaired-not-run migration fails loudly; RLS tables, grants and the trigger also get rows in `scripts/check-schema-guards.sh`.
- **Notification types:** Task 11 adds `challenge_guide_published`, Task 15 adds `build_question`. Before writing either migration, re-read the LATEST migration that redefines the check: `grep -ln "notifications_type_check" supabase/migrations/*.sql | sort | tail -1`. At the time of writing that is `093_tutorial_notes.sql`; if batches 1–3 landed a later one, copy ITS list. Use the 046/077/093 guard-and-recreate pattern on top of it: abort if the live constraint permits a value the new list would drop.
- **Anon reads a fixed column list** (040). Every new public `toy_ideas` column (`photo_url`, `anonymous`) is added with `grant select (<col>) on public.toy_ideas to anon`. `review_note` never is.
- **Limits are checked twice:** the API returns 400 with a plain sentence (the API has no zod — hand-written checks, as in every route here); a CHECK in the database backs it. Constraint `label` 1–80, `note` ≤ 300; question `body` 1–1000; `build_brief` ≤ 2000 when present; `photo_url` ≤ 1000.
- **No counter columns.** `save_count(toy_ideas)` is a SECURITY DEFINER computed field like 073's `save_count(toys)` (`stable`, `search_path = ''`, number only). Makers and posts stay computed in `challengeCounts` (public.ts).
- **Names come from the admin client** in any new read (memory: PostgREST embeds fail silently under 033/045 grants). The existing `profiles!toy_ideas_author_id_fkey(name)` and `profiles!toy_idea_participants_profile_id_fkey(name)` embeds in public.ts stay; Task 5 widens the second to `(name, role)`.
- **An anonymous author's identity never leaves the API on a public read:** no `author_name`, no `author_id`, no `writing_up` naming them. Admins (`GET /api/admin/ideas`) and the author (`/api/ideas/mine`) still see it.
- **Shipping an item:** delete every `PENDING(<id>)` / `pending="<id>"` reference, set `shipped: true` on the entry (never delete it), run `node scripts/pending.mjs`, delete any `explained` rule in `scripts/parity/app-screen-map.json` / `screen-map.json` whose `pending` is the id (only `makers-live-done-tabs` has one, on `makers_wanted`), and run the drift test. The commit that flips `shipped` contains that item only. Never delete another item's marker early — the drift test fails if an open item loses its last reference. `my-challenges-meta`, `locations-and-distance`, `build-thread-cost-panel`, `report-problem-mobile` markers in the files below belong to other batches: leave them.
- **Mobile is a second consumer of every column.** On each column change run `grep -rn "<column>" packages/mobile`.
- **Copy is quoted from the boards** (`Splat Connect frontend overhaul/SPLAT Connect - Mobile.dc.html` = MB, `SPLAT Connect - Web.dc.html` = WB). Where the two boards differ, each platform takes its own board's words. Every string a task introduces is listed in that task with its source. Strings with no board source, flagged for Byron: "Add a constraint" (spec), "Constraint", "Note (optional)", "Admin" (role label), "Show more builds", the two notification lines (Tasks 11, 15), "Could not withdraw this idea. Please try again.", "Could not add that constraint. Please try again.", "Could not send that. Please try again.", "A title and a summary are required.".
- **Mobile dates** use `toLocaleDateString('en-AU', …)` (the existing `shortDate` in `challenge-status.ts`), not types' `shortDate` (Hermes; memory: mobile Hermes runtime parity).
- **Web e2e specs import only from `tests/e2e/helpers.ts` / `lib/`,** never a component. Never run web and mobile e2e at the same time.
- **Another agent is finishing guides community notes** and batches 1–3 may still be landing. Before editing any file, re-read it; anchor every edit on the code quoted in the step, never on a line number. Files this batch shares: `packages/types/src/index.ts`, `packages/types/src/pending.ts`, `docs/PENDING.md`, `packages/api/src/routes/upload.ts`, `packages/api/src/routes/toy-transactions.ts`, `packages/api/src/routes/public.ts`, `packages/mobile/lib/notifications.ts`, `packages/mobile/lib/upload.ts`, `packages/web/components/notifications-list.tsx`, `packages/web/tests/unit/lib/notification-bucket.test.ts`, `scripts/check-schema-guards.sh`, `scripts/parity/app-screen-map.json`.
- **Stage only this task's files.** The tree holds unrelated changes (`CLAUDE.md`, `packages/web/zz3_57656.mjs`, `selfIdentity.plist`, the community-notes work): list files by name in every `git add`, run `git status --short` first, and `git restore --staged` anything that is not the task's.
- Commit messages end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV
  ```

## Review Focus

1. **An anonymous author leaks.** Anon or another member reading an anonymous challenge must get no `author_name`, no `author_id`, and no writing-up card naming the author — on the detail, the list, the saved list and the constraints. The author still recognises their own challenge ("This is your challenge.", can read the thread). Pinned by Task 10's integration test (JSON never contains the author's id or name) and its mobile test.
2. **Withdrawing the wrong thing.** A pending idea withdrawn by someone who is not its author, a published or rejected idea "withdrawn" by its author, or an idea that was approved between the screen loading and the tap. Expected: 404 / 409 / 409, and the row is still there. Pinned by Task 9's integration test.
3. **A question thread readable by the wrong maker.** Maker B reading maker A's questions, maker B posting into A's thread by naming `maker_id`, the family answering a maker who never asked, anyone asking after the build is claimed. Expected: empty / 403 / 404 / 409. Pinned by Task 15's integration test.
4. **The guide-published notification firing wrongly.** A guide approved twice (edit, back to review, approved again), a saver who is also a contributor, a guide approved by an org leader rather than an admin, and a guide with no challenge behind it. Expected: once per saver, never to a contributor, from both approval paths, nothing at all. Pinned by Task 11's integration test.
5. **A build row that misleads on Makers wanted.** A guide with an unpriced required part ("~$" must not show), a guide with no build time, a build addressed to a named maker (must not appear on Live or Done, nor its brief), a page past the end (an empty list, not an error). Pinned by Task 13's pure and integration tests and Task 14's integration test.

## Files

New:
- `packages/types/src/challenges.ts` — `OUTCOME_STEPS`, `OutcomeState`, `outcomeStates`, `PARTICIPANT_ROLE_LABEL`.
- `packages/types/src/builds.ts` — `BUILD_URGENCIES`, `buildRowMeta`.
- `supabase/migrations/103_idea_optional_fields.sql` … `111_build_request_questions.sql`.
- `packages/api/tests/integration/toy-ideas/{optional-fields,maker-meta,save-count,photo,withdraw,anonymous,writeup,constraints}.test.ts`, `packages/api/tests/integration/toy-transactions/{build-note,row-meta,builds-board,questions}.test.ts`.
- `packages/web/tests/unit/lib/{challenge-outcome,build-options}.test.ts`, `packages/web/tests/unit/pages/challenge-detail.test.tsx`, `packages/web/tests/unit/components/{follow-writeup,idea-author-actions,build-questions,makers-wanted-board}.test.tsx`.
- `packages/web/components/{follow-writeup,idea-author-actions,build-questions}.tsx`.
- `packages/web/app/dashboard/exchanges/build/[id]/ask/page.tsx`.
- `packages/mobile/components/builds/ask-first-screen.tsx`, `packages/mobile/app/(my)/exchanges/build/ask/[id].tsx`.
- `packages/mobile/tests/unit/components/builds/{makers-wanted-screen,ask-first-screen}.test.tsx`.

## Commands used throughout

- Apply new migrations locally (needs `supabase start`): `supabase migration up`
- API integration: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts <file>`
- API unit: `pnpm --filter @splat-connect/api exec vitest run <file>`
- Drift test: `pnpm --filter @splat-connect/api exec vitest run tests/unit/pending-features.test.ts tests/unit/pending-registry.test.ts` → `Tests  11 passed (11)`
- Regenerate the registry doc: `node scripts/pending.mjs` → `wrote docs/PENDING.md (N items)`
- Web unit: `pnpm --filter @splat-connect/web exec vitest run <file>`
- Mobile unit: `pnpm --filter @splat-connect/mobile exec jest <file>`
- Typecheck: `pnpm typecheck`

Every task's last code step is "Ship the item": the registry routine in Global Constraints, then the drift test.

---

### Task 1: Only Title and Summary are required (`idea-required-fields`, migration 103)

**Files:**
- Create: `supabase/migrations/103_idea_optional_fields.sql`
- Modify: `packages/api/src/routes/toy-ideas.ts` (`readIdeaBody`, POST `/` error)
- Modify: `packages/types/src/index.ts` (`ToyIdea`)
- Modify: `packages/mobile/components/challenges/submit-idea-screen.tsx`, `packages/mobile/components/challenges/detail-screen.tsx` (null-safe fields)
- Modify: `packages/web/components/idea-form.tsx`, `packages/web/app/get-involved/design-challenges/[id]/page.tsx`, `packages/web/app/admin/ideas/[id]/page.tsx` (null-safe fields)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/api/tests/integration/toy-ideas/optional-fields.test.ts` (new); `packages/api/tests/unit/routes/toy-ideas.test.ts`, `packages/mobile/tests/unit/components/challenges/submit-idea-screen.test.tsx`, `packages/web/tests/unit/components/idea-form.test.tsx` (updated)

**Interfaces:**
- Consumes: nothing.
- Produces: `toy_ideas.description`, `intended_use`, `primary_user` nullable. `POST /api/ideas` requires only `title` and `summary`; the other three are optional (absent, null or blank → stored null; a non-string → 400). `ToyIdea.description / intended_use / primary_user: string | null`. Tasks 7, 9 and 10 extend `readIdeaBody`.

Copy: "Why it matters" · placeholder "Who would use it, and what they cannot do today." (MB, WB). "A title and a summary are required." (no board — flagged).

- [ ] **Step 1: Write the failing tests**

`packages/api/tests/integration/toy-ideas/optional-fields.test.ts`:

```ts
/**
 * 103: an idea needs a title and a summary, nothing else. Old ideas keep their
 * intended use and primary user; new ones may leave every other field out.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let author: TestUser
const ids: string[] = []

beforeAll(async () => {
  author = await createTestUser('contributor')
})

afterAll(async () => {
  await adminClient().from('toy_ideas').delete().in('id', ids)
  await deleteTestUser(author.id)
})

const post = (body: unknown) =>
  app.request('/api/ideas', {
    method: 'POST',
    headers: { Authorization: `Bearer ${author.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

describe('103 idea optional fields', () => {
  it('lets the database hold an idea with only a title and a summary', async () => {
    const { data, error } = await adminClient()
      .from('toy_ideas')
      .insert({ author_id: author.id, title: 'T', summary: 'S', status: 'pending' })
      .select('id, description, intended_use, primary_user')
      .single()
    expect(error).toBeNull()
    ids.push(data!.id)
    expect(data).toMatchObject({ description: null, intended_use: null, primary_user: null })
  })

  it('takes an idea with only a title and a summary, and stores a blank why-it-matters as nothing', async () => {
    const res = await post({ title: '  Bubble machine  ', summary: 'One switch.', description: '   ' })
    expect(res.status).toBe(201)
    const row = (await res.json()) as { id: string; title: string; description: string | null }
    ids.push(row.id)
    expect(row).toMatchObject({ title: 'Bubble machine', description: null })
  })

  it('still refuses an idea with no summary, in a sentence', async () => {
    const res = await post({ title: 'T' })
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: string }).error).toBe('A title and a summary are required.')
  })
})
```

In `packages/api/tests/unit/routes/toy-ideas.test.ts`, replace the `it.each([...])('rejects a missing %s', …)` block inside `describe('POST /ideas')` with:

```ts
  it.each(['title', 'summary'])('rejects a missing %s', async (field) => {
    const body: Record<string, unknown> = { ...VALID }
    delete body[field]
    expect((await post(body)).status).toBe(400)
  })

  // Tests: the three narrative fields after the summary are optional (103)
  // How:   posts title + summary only; checks the insert carries nulls
  // Chain: a required "Why it matters" kept families from sending half an idea
  //        an admin could still judge
  it('stores the optional fields as null when they are left out', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 'idea-1' }, error: null })
    const insert = vi.fn().mockReturnValue({ select: () => ({ single }) })
    mockFrom.mockReturnValue({ insert })
    expect((await post({ title: 'T', summary: 'S' })).status).toBe(201)
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ description: null, intended_use: null, primary_user: null })
    )
  })

  it('rejects an optional field that is not text', async () => {
    expect((await post({ ...VALID, description: 42 })).status).toBe(400)
  })
```

In `packages/mobile/tests/unit/components/challenges/submit-idea-screen.test.tsx`:
- Replace `fillEverything` with:

```tsx
/** The board's form: a title and a summary are all it requires. */
function fillEverything() {
  fireEvent.changeText(screen.getByLabelText('Idea name'), 'A switch a toddler can hit')
  fireEvent.changeText(screen.getByLabelText('Summarise it in one sentence'), 'Too much force needed.')
  fireEvent.changeText(screen.getByLabelText('Why it matters'), 'She swipes rather than presses.')
}
```

- In 'posts exactly the fields the API reads, trimmed', replace the expected body with:

```tsx
      expect(mockPost).toHaveBeenCalledWith('/api/ideas', {
        title: 'A switch a toddler can hit',
        summary: 'Too much force needed.',
        description: 'She swipes rather than presses.',
        kind: 'challenge',
        contact_prefs: ['co_design'],
      })
```

- Append inside `describe('SubmitIdeaScreen')`:

```tsx
  it('sends an idea with only a title and a summary, and never asks for intended use or primary user', async () => {
    render(<SubmitIdeaScreen />)
    expect(screen.queryByLabelText('Intended use')).toBeNull()
    expect(screen.queryByLabelText('Primary user')).toBeNull()
    expect(screen.getByPlaceholderText('Who would use it, and what they cannot do today.')).toBeTruthy()
    fireEvent.changeText(screen.getByLabelText('Idea name'), 'Bubbles')
    fireEvent.changeText(screen.getByLabelText('Summarise it in one sentence'), 'One switch.')
    fireEvent.press(screen.getByRole('button', { name: 'Submit idea' }))
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/ideas', {
        title: 'Bubbles',
        summary: 'One switch.',
        description: null,
        kind: 'challenge',
        contact_prefs: [],
      })
    )
  })
```

- In 'refuses a whitespace-only field rather than spending the round trip', replace `fireEvent.changeText(screen.getByLabelText('Intended use'), '   ')` with `fireEvent.changeText(screen.getByLabelText('Summarise it in one sentence'), '   ')` and `'All fields are required'` with `'A title and a summary are required.'`.

In `packages/web/tests/unit/components/idea-form.test.tsx`:
- Replace 'asks for every field the reviewer needs' with:

```tsx
  it('asks for a title, a summary and why it matters — and nothing the board dropped', () => {
    render(<IdeaForm />)
    for (const label of [/^title$/i, /^summary$/i, /why it matters/i]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    }
    expect(screen.queryByLabelText(/intended use/i)).toBeNull()
    expect(screen.queryByLabelText(/primary user/i)).toBeNull()
  })
```

- In 'files a question when that tile is picked', replace the field list with `[[/your question/i, 'Glue?'], [/^summary$/i, 'S']]`.

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/toy-ideas/optional-fields.test.ts` → FAIL (`null value in column "description" … violates not-null constraint`).
Run: `pnpm --filter @splat-connect/api exec vitest run tests/unit/routes/toy-ideas.test.ts` → FAIL ('stores the optional fields as null…' gets 400).
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/challenges/submit-idea-screen.test.tsx` → FAIL (no 'Why it matters').
Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/components/idea-form.test.tsx` → FAIL.

- [ ] **Step 3: Write the migration**

`supabase/migrations/103_idea_optional_fields.sql`:

```sql
-- 103 — only Title and Summary are required on an idea (idea-required-fields).
--
-- The board's form asks for a title, a summary and an optional "Why it
-- matters" (description). intended_use and primary_user leave both forms and
-- stay as a nullable fallback on the ideas that already carry them. The API's
-- readIdeaBody stores a blank optional field as null, never ''.
--
-- DOWN:
--   update public.toy_ideas set description = coalesce(description, ''),
--     intended_use = coalesce(intended_use, ''), primary_user = coalesce(primary_user, '');
--   alter table public.toy_ideas alter column description set not null,
--     alter column intended_use set not null, alter column primary_user set not null;

alter table public.toy_ideas
  alter column description drop not null,
  alter column intended_use drop not null,
  alter column primary_user drop not null;
```

Run: `supabase migration up` → `Applying migration 103_idea_optional_fields.sql...`

- [ ] **Step 4: The API**

In `packages/api/src/routes/toy-ideas.ts`, replace `NARRATIVE_FIELDS` and `readIdeaBody`'s field loop:

```ts
const REQUIRED_FIELDS = ['title', 'summary'] as const
// 103: "Why it matters" is optional; intended use and primary user are only
// ever sent by an old client. Absent, null or blank all store as null.
const OPTIONAL_FIELDS = ['description', 'intended_use', 'primary_user'] as const

/**
 * A title and a summary are required and must survive trimming — the two
 * things an admin cannot judge an idea without. Everything else is optional.
 */
function readIdeaBody(body: unknown): Record<string, unknown> | null {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) return null
  const source = body as Record<string, unknown>
  const out: Record<string, unknown> = {}

  for (const field of REQUIRED_FIELDS) {
    const value = source[field]
    if (typeof value !== 'string' || !value.trim()) return null
    out[field] = value.trim()
  }
  for (const field of OPTIONAL_FIELDS) {
    const value = source[field]
    if (value === undefined || value === null) {
      out[field] = null
      continue
    }
    if (typeof value !== 'string') return null
    out[field] = value.trim() || null
  }
```

(the `contact_prefs` and `kind` blocks below it are unchanged). In `toyIdeas.post('/', …)` change the 400 to:

```ts
  if (!fields) return c.json({ error: 'A title and a summary are required.' }, 400)
```

In `packages/types/src/index.ts`, `interface ToyIdea`:

```ts
  /** "Why it matters" (103: optional). */
  description: string | null
  /** 103: no longer asked; kept on the ideas that have one. */
  intended_use: string | null
  primary_user: string | null
```

- [ ] **Step 5: The two forms**

`packages/mobile/components/challenges/submit-idea-screen.tsx`:
- Replace the header comment's "the same six fields, the same labels, the same required-ness" with "the board's fields: a title and a summary are required, why it matters is optional".
- Replace `FIELDS` and `EMPTY`:

```tsx
// label is the accessibility name the tests and a screen reader both use.
const FIELDS = [
  { key: 'title', label: 'Idea name', multiline: false, placeholder: undefined },
  { key: 'summary', label: 'Summarise it in one sentence', multiline: false, placeholder: undefined },
  // The board's label and placeholder (MB #challenge_new). Optional (103).
  { key: 'description', label: 'Why it matters', multiline: true, placeholder: 'Who would use it, and what they cannot do today.' },
] as const

type FieldKey = (typeof FIELDS)[number]['key']
type Draft = Record<FieldKey, string>

const EMPTY: Draft = { title: '', summary: '', description: '' }
```

- Replace the body of `submit()` up to `setBusy(true)`:

```tsx
  async function submit() {
    // Mirrors readIdeaBody: a title and a summary, trimmed, are required.
    const title = draft.title.trim()
    const summary = draft.summary.trim()
    if (!title || !summary) {
      setError('A title and a summary are required.')
      return
    }
```

  and the post:

```tsx
      await apiClient.post<ToyIdea>('/api/ideas', {
        title,
        summary,
        description: draft.description.trim() || null,
        kind,
        contact_prefs: prefs,
      })
```

- In the `FIELDS.map` TextField add `placeholder={field.placeholder}`.

`packages/web/components/idea-form.tsx`:
- `Fields` and `EMPTY_FIELDS` drop `intended_use` and `primary_user`.
- Replace the validation in `submit` with:

```tsx
    // Mirrors readIdeaBody: a title and a summary are required (103).
    const title = fields.title.trim()
    const summary = fields.summary.trim()
    if (!title || !summary) {
      setError('A title and a summary are required.')
      return
    }
```

  and the post body with `{ title, summary, description: fields.description.trim() || null, kind: fields.kind, contact_prefs: fields.contact_prefs }`.
- Replace the "Full description" block and delete the "Intended use" and "Primary user" blocks:

```tsx
      <div>
        <label htmlFor="idea-description" className="field-label">
          Why it matters
        </label>
        <textarea
          id="idea-description"
          rows={4}
          placeholder="Who would use it, and what they cannot do today."
          value={fields.description}
          onChange={(e) => set('description', e.target.value)}
          className="field"
        />
      </div>
```

- Update the header comment line "every narrative field is required" to "a title and a summary are required".

- [ ] **Step 6: Readers that assumed the fields**

`packages/mobile/components/challenges/detail-screen.tsx` — Brief and Constraints tabs:

```tsx
            {challenge.description ? <Field label="The problem" value={challenge.description} /> : null}
```

```tsx
            {challenge.intended_use ? <Field label="Intended use" value={challenge.intended_use} /> : null}
            {challenge.primary_user ? <Field label="Who it's for" value={challenge.primary_user} /> : null}
```

`packages/web/app/get-involved/design-challenges/[id]/page.tsx` — in the brief tab, filter the triples before mapping:

```tsx
              {(
                [
                  ['What it needs to do', challenge.description],
                  ['Intended use', challenge.intended_use],
                  ['Who it’s for', challenge.primary_user],
                ] as const
              )
                .filter(([, body]) => body)
                .map(([h, body]) => (
```

`packages/web/app/admin/ideas/[id]/page.tsx` — wrap the "Why it matters" heading+paragraph in `{idea.description && (<>…</>)}` and each of the Intended use / Who it's for `dt`+`dd` pairs in `{idea.intended_use && (<>…</>)}` / `{idea.primary_user && (<>…</>)}`.

Run: `grep -rn "intended_use\|primary_user\|\.description" packages/mobile/components/challenges` → only the guarded lines above and the provision script.

- [ ] **Step 7: Run the tests to see them pass**

Run the four commands from Step 2 → PASS. Then `pnpm typecheck` → exit 0.

- [ ] **Step 8: Ship the item**

Delete the `// PENDING(idea-required-fields): …` comment in `submit-idea-screen.tsx`. Set `shipped: true` on `'idea-required-fields'` in `pending.ts`. Run `node scripts/pending.mjs` and the drift test → `Tests  11 passed (11)`.

- [ ] **Step 9: Commit**

```bash
git status --short
git add supabase/migrations/103_idea_optional_fields.sql packages/api/src/routes/toy-ideas.ts packages/types/src/index.ts packages/mobile/components/challenges/submit-idea-screen.tsx packages/mobile/components/challenges/detail-screen.tsx packages/web/components/idea-form.tsx "packages/web/app/get-involved/design-challenges/[id]/page.tsx" "packages/web/app/admin/ideas/[id]/page.tsx" packages/types/src/pending.ts docs/PENDING.md packages/api/tests/integration/toy-ideas/optional-fields.test.ts packages/api/tests/unit/routes/toy-ideas.test.ts packages/mobile/tests/unit/components/challenges/submit-idea-screen.test.tsx packages/web/tests/unit/components/idea-form.test.tsx
git commit -m "feat(ideas): only a title and a summary are required on an idea (103)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 2: The note is optional and How soon? matches the board (`build-request-options`, migration 104)

**Files:**
- Create: `supabase/migrations/104_build_note_optional.sql`, `packages/types/src/builds.ts`
- Modify: `packages/types/src/index.ts` (re-export)
- Modify: `packages/api/src/routes/toy-transactions.ts` (POST `/build`)
- Modify: `packages/mobile/components/builds/ask-for-build-screen.tsx`, `packages/web/components/ask-openly-form.tsx`
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/api/tests/integration/toy-transactions/build-note.test.ts`, `packages/web/tests/unit/lib/build-options.test.ts` (new); `packages/mobile/tests/unit/components/builds/ask-for-build-screen.test.tsx` (updated)

**Interfaces:**
- Consumes: nothing.
- Produces: `BUILD_URGENCIES = ['No rush', 'This month', 'Before holidays'] as const` and `type BuildUrgency` from `@splat-connect/types` (Task 13 adds `buildRowMeta` to the same file). `POST /api/toy-transactions/build` accepts a missing or blank `build_brief` (stored null) and 400s one over 2000 characters with "Keep the note to the maker to 2000 characters or fewer.". `urgency` stays free text ≤ 60 on the API, so old values still display.

Copy: "A note to the maker (optional)" (MB, WB: label + muted "(optional)"), placeholder "Why this toy, the switch you have, what makes handover easy" (MB). "No rush" / "This month" / "Before holidays" (MB `mwnWhen`; WB writes "Before school holidays" — one list per the spec, flagged).

- [ ] **Step 1: Write the failing tests**

`packages/web/tests/unit/lib/build-options.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { BUILD_URGENCIES } from '@splat-connect/types'

describe('BUILD_URGENCIES', () => {
  it('is the board’s How soon? list, in its order', () => {
    expect(BUILD_URGENCIES).toEqual(['No rush', 'This month', 'Before holidays'])
  })
})
```

`packages/api/tests/integration/toy-transactions/build-note.test.ts`:

```ts
/**
 * 104: a build request's note to the maker is optional. 061's subject check
 * still holds every other arm, and still caps a note at 2000 characters.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let family: TestUser
let tutorialId: string

const post = (body: unknown) =>
  app.request('/api/toy-transactions/build', {
    method: 'POST',
    headers: { Authorization: `Bearer ${family.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

beforeAll(async () => {
  family = await createTestUser('contributor')
  const { data } = await adminClient()
    .from('tutorials')
    .insert({ title: `Note guide ${Date.now()}`, description: 'G', difficulty: 'easy', status: 'approved' })
    .select('id')
    .single()
  tutorialId = data!.id
})

afterAll(async () => {
  await adminClient().from('toy_transactions').delete().eq('tutorial_id', tutorialId)
  await adminClient().from('tutorials').delete().eq('id', tutorialId)
  await deleteTestUser(family.id)
})

describe('104 build note optional', () => {
  it('posts an open request with no note', async () => {
    const res = await post({ tutorial_id: tutorialId, requester_suburb: 'Newtown', travel_km: 10, urgency: 'This month' })
    expect(res.status).toBe(201)
    const tx = (await res.json()) as { build_brief: string | null; urgency: string }
    expect(tx).toMatchObject({ build_brief: null, urgency: 'This month' })
  })

  it('refuses a note over 2000 characters, in a sentence', async () => {
    const res = await post({ tutorial_id: tutorialId, build_brief: 'x'.repeat(2001), requester_suburb: 'Newtown', travel_km: 10 })
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: string }).error).toBe('Keep the note to the maker to 2000 characters or fewer.')
  })

  it('keeps the database cap on a note that is present', async () => {
    const { error } = await adminClient().from('toy_transactions').insert({
      type: 'build', status: 'requested', tutorial_id: tutorialId, requester_id: family.id,
      build_brief: '   ', travel_km: 10, requester_suburb: 'Newtown',
    })
    expect(error?.message).toMatch(/toy_transactions_subject/)
  })
})
```

In `packages/mobile/tests/unit/components/builds/ask-for-build-screen.test.tsx` add `import { apiClient } from '../../../../lib/api-client'` and append:

```tsx
it('offers the board’s How soon? choices and posts without a note', async () => {
  render(<AskForBuildScreen />)
  fireEvent.press(await screen.findByRole('radio', { name: 'Guide 0' }))
  for (const label of ['No rush', 'This month', 'Before holidays']) {
    expect(screen.getByRole('radio', { name: label })).toBeTruthy()
  }
  expect(screen.queryByRole('radio', { name: 'Within a month' })).toBeNull()
  expect(screen.getByText('A note to the maker (optional)')).toBeTruthy()
  fireEvent.changeText(screen.getByPlaceholderText('Newtown'), 'Glebe')
  fireEvent.press(screen.getByRole('radio', { name: 'This month' }))
  fireEvent.press(screen.getByRole('checkbox'))
  fireEvent.press(screen.getByRole('button', { name: 'Post to Makers wanted' }))
  await waitFor(() =>
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/toy-transactions/build',
      expect.objectContaining({ tutorial_id: 'g0', build_brief: null, urgency: 'This month', requester_suburb: 'Glebe' })
    )
  )
})
```

(add `waitFor` to the RNTL import).

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/lib/build-options.test.ts` → FAIL (`BUILD_URGENCIES` is not exported).
Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/toy-transactions/build-note.test.ts` → FAIL (400 "Say what you need built…").
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/builds/ask-for-build-screen.test.tsx` → FAIL.

- [ ] **Step 3: Write the migration**

First confirm which migration last defined the constraint: `grep -ln "toy_transactions_subject" supabase/migrations/*.sql` → `057_…`, `058_…`, `061_events.sql`. If any later file appears, copy ITS `add constraint toy_transactions_subject` body instead of 061's below and change only the build arm.

`supabase/migrations/104_build_note_optional.sql`:

```sql
-- 104 — the note to the maker is optional (build-request-options).
--
-- 057 required a non-empty build_brief on every build; 061 is the live text of
-- toy_transactions_subject (it added the print arm). This recreates 061's
-- constraint with one change: a build's brief may be null, and when present is
-- still 1–2000 characters after trimming. Every other arm is 061's, verbatim.
--
-- DOWN:
--   (recreate 061's toy_transactions_subject; it succeeds only once no build
--    row has a null build_brief)

alter table public.toy_transactions drop constraint toy_transactions_subject;
alter table public.toy_transactions
  add constraint toy_transactions_subject
  check (
    case
      when type = 'build' then
        toy_id is null
        and offered_toy_id is null
        and tutorial_id is not null
        and (build_brief is null or length(btrim(build_brief)) between 1 and 2000)
        and printer_id is null
        and event_id is null
        and part_sets is null
      when type = 'print' then
        toy_id is null
        and offered_toy_id is null
        and tutorial_id is not null
        and build_brief is null
        and num_nonnulls(printer_id, event_id) = 1
        and (event_id is null) = (part_sets is null)
        and working_photo_url is null
        and work_approved_at is null
      else
        toy_id is not null
        and tutorial_id is null
        and build_brief is null
        and printer_id is null
        and event_id is null
        and part_sets is null
        and working_photo_url is null
        and work_approved_at is null
        and print_note is null
        and printing_started_at is null
        and ready_at is null
        and ready_photo_url is null
    end
  );
```

Run: `supabase migration up` → applies 104.

- [ ] **Step 4: The list and the API**

`packages/types/src/builds.ts`:

```ts
/**
 * The pure rules behind build requests and the Makers wanted board, shared by
 * web, mobile and the API (docs/superpowers/specs/2026-10-01-challenges-makers-build-design.md).
 */

/** How soon? on Ask for a build (MB mwnWhen). Stored as the words; the API
 *  still takes any short text, so a request posted with an older list reads
 *  as it was written. */
export const BUILD_URGENCIES = ['No rush', 'This month', 'Before holidays'] as const
export type BuildUrgency = (typeof BUILD_URGENCIES)[number]
```

In `packages/types/src/index.ts`, beside the `./guides` re-exports:

```ts
export { BUILD_URGENCIES } from './builds'
export type { BuildUrgency } from './builds'
```

In `packages/api/src/routes/toy-transactions.ts`, POST `/build`, replace the brief check:

```ts
  // Optional since 104 — the board's note to the maker is "(optional)". When
  // present it is still capped, here and by toy_transactions_subject.
  const brief = typeof body.build_brief === 'string' ? body.build_brief.trim() : ''
  if (brief.length > 2000) {
    return c.json({ error: 'Keep the note to the maker to 2000 characters or fewer.' }, 400)
  }
```

and in the insert: `build_brief: brief || null,`. Update the doc comment above the route if it says the brief is required.

- [ ] **Step 5: The two forms**

`packages/mobile/components/builds/ask-for-build-screen.tsx`:
- Header comment: delete the bullet "The note is required, not "(optional)" …".
- Replace the `URGENCIES` lines (including the `// PENDING(build-request-options): …` comment) with:

```tsx
import { BUILD_URGENCIES } from '@splat-connect/types'
```

  (merge into the existing `@splat-connect/types` import) and `const [urgency, setUrgency] = useState<string>(BUILD_URGENCIES[0])`; map `BUILD_URGENCIES` in the How soon? radiogroup.
- In `submit()`, delete the `if (!brief.trim()) return setError(…)` line and post `build_brief: brief.trim() || null`.
- The note field:

```tsx
      <TextField
        label="A note to the maker (optional)"
        placeholder="Why this toy, the switch you have, what makes handover easy"
        maxLength={2000}
        multiline
        value={brief}
        onChangeText={setBrief}
        style={styles.note}
      />
```

`packages/web/components/ask-openly-form.tsx`:
- Replace `const URGENCIES = [...]` with an import of `BUILD_URGENCIES` from `@splat-connect/types` and use it in `useState` and the map.
- `const ready = tutorialId && suburb.trim() && covers` (no brief).
- Post `build_brief: brief.trim() || null`.
- The label: `<span className={LABEL}>A note to the maker <span className="font-semibold text-muted">(optional)</span></span>`.

- [ ] **Step 6: Run the tests to see them pass**

Run the three commands from Step 2 → PASS. Also `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/toy-transactions/open-builds.test.ts tests/integration/toy-transactions/builds.test.ts` → PASS (061's other arms unchanged).

- [ ] **Step 7: Ship the item**

The only marker was the `PENDING(build-request-options)` comment deleted in Step 5. Set `shipped: true`, `node scripts/pending.mjs`, drift test.

- [ ] **Step 8: Commit**

```bash
git status --short
git add supabase/migrations/104_build_note_optional.sql packages/types/src/builds.ts packages/types/src/index.ts packages/api/src/routes/toy-transactions.ts packages/mobile/components/builds/ask-for-build-screen.tsx packages/web/components/ask-openly-form.tsx packages/types/src/pending.ts docs/PENDING.md packages/api/tests/integration/toy-transactions/build-note.test.ts packages/web/tests/unit/lib/build-options.test.ts packages/mobile/tests/unit/components/builds/ask-for-build-screen.test.tsx
git commit -m "feat(builds): the note to the maker is optional and How soon? is the board's three (104)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---
### Task 3: The thread gets its own tab, and tabs carry counts (`challenge-thread-tab`)

**Files:**
- Modify: `packages/mobile/components/challenges/detail-screen.tsx`
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/mobile/tests/unit/components/challenges/detail-screen.test.tsx` (updated)

**Interfaces:**
- Consumes: nothing new — `ToyIdeaDetail.maker_count`, `answer_count` already come from `challengeCounts` (public.ts).
- Produces: the mobile detail's `type Tab = 'status' | 'brief' | 'constraints' | 'makers' | 'thread'`, a `TABS` list, a `listed` flag (`status` is `challenge` or `graduated`) that gates Makers and Thread, and a `badge: Partial<Record<Tab, number>>` map. Task 4 adds `'outcome'` to `Tab`/`TABS`; Task 12 adds `constraints` to `badge`. The thread and its composer render under `tab === 'thread'`.

Copy (MB `CDT`): Makers hint "Everyone working on this.", Thread "Where the work happens. Makers can post.".

- [ ] **Step 1: Write the failing tests**

In `packages/mobile/tests/unit/components/challenges/detail-screen.test.tsx`, replace the `openMakers` helper:

```tsx
/** The conversation has its own tab (MB #challenge_detail). */
async function openThread() {
  fireEvent.press(await screen.findByRole('tab', { name: 'Thread' }))
}
```

and replace every `await openMakers()` with `await openThread()` (every call site, all inside `describe('the thread')` and `describe('a question')`). Append inside `describe('ChallengeDetailScreen')`:

```tsx
  it('puts the thread in its own tab and counts makers and posts on the tabs', async () => {
    mockGet.mockResolvedValue(
      detail({ participants: [{ profile_id: 'p1', name: 'Sam', joined_at: '2026-08-14T03:00:00Z' }], maker_count: 1, answer_count: 4 })
    )
    render(<ChallengeDetailScreen id="c1" />)
    const thread = await screen.findByRole('tab', { name: 'Thread' })
    expect(thread.props.accessibilityValue).toEqual({ text: '4' })
    expect(screen.getByRole('tab', { name: 'Makers' }).props.accessibilityValue).toEqual({ text: '1' })
    fireEvent.press(thread)
    expect(screen.getByText('Where the work happens. Makers can post.')).toBeTruthy()
    fireEvent.press(screen.getByRole('tab', { name: 'Makers' }))
    expect(screen.getByText('Everyone working on this.')).toBeTruthy()
  })

  it('draws no Makers or Thread tab on an idea that is not public yet', async () => {
    mockGet.mockResolvedValue(detail({ status: 'pending' }))
    render(<ChallengeDetailScreen id="c1" />)
    expect(await screen.findByRole('tab', { name: 'Brief' })).toBeTruthy()
    expect(screen.queryByRole('tab', { name: 'Makers' })).toBeNull()
    expect(screen.queryByRole('tab', { name: 'Thread' })).toBeNull()
  })
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/challenges/detail-screen.test.tsx` → FAIL (the Thread tab is a pending link with no thread behind it).

- [ ] **Step 3: Implement**

In `detail-screen.tsx`:

Replace `type Tab` and `TABS` (and the comment "The conversation lives under Makers…"):

```tsx
type Tab = 'status' | 'brief' | 'constraints' | 'makers' | 'thread'
// title and hint: the board's heading and muted line over each tab (MB CDT).
const TABS: { id: Tab; label: string; icon: keyof typeof Ionicons.glyphMap; title: string; hint: string }[] = [
  { id: 'status', label: 'Status', icon: 'pulse-outline', title: 'Status', hint: 'Where this idea is, and what happens next.' },
  { id: 'brief', label: 'Brief', icon: 'document-text-outline', title: 'The brief', hint: 'What is being asked for, and why nothing off the shelf does it.' },
  { id: 'constraints', label: 'Constraints', icon: 'alert-circle-outline', title: 'Constraints', hint: 'What makes this harder than it looks.' },
  { id: 'makers', label: 'Makers', icon: 'people-outline', title: 'Makers', hint: 'Everyone working on this.' },
  { id: 'thread', label: 'Thread', icon: 'chatbubbles-outline', title: 'Thread', hint: 'Where the work happens. Makers can post.' },
]
```

After `const makers = challenge.maker_count ?? challenge.participants.length`, add:

```tsx
  // The board draws Makers and Thread only once the idea is public (MB cdOpen:
  // challenge or graduated). The count badges are the board's too.
  const listed = challenge.status === 'challenge' || challenge.status === 'graduated'
  const tabs = TABS.filter((t) => listed || (t.id !== 'makers' && t.id !== 'thread'))
  const badge: Partial<Record<Tab, number>> = { makers, thread: challenge.answer_count ?? 0 }
```

Replace the tab bar's children (the `TABS.map`, both PENDING comments and the two-entry pending map) with:

```tsx
          {tabs.map((t) => {
            const n = badge[t.id] ?? 0
            return (
              <Pressable
                key={t.id}
                accessibilityRole="tab"
                accessibilityLabel={t.label}
                accessibilityValue={n > 0 ? { text: String(n) } : undefined}
                accessibilityState={{ selected: tab === t.id }}
                onPress={() => setTab(t.id)}
                style={[styles.tab, tab === t.id && styles.tabOn]}
              >
                <Ionicons name={t.icon} size={15} color={theme.colors.ink} />
                <Text style={styles.tabText}>{t.label}</Text>
                {n > 0 ? <Text style={styles.tabBadge}>{n}</Text> : null}
              </Pressable>
            )
          })}
          {/* PENDING(challenge-outcome-tab): Outcome — approved, makers working, written up, guide published. */}
          <Pressable accessibilityRole="tab" onPress={() => router.push(pendingHref('challenge-outcome-tab'))} style={styles.tab}>
            <Ionicons name="flag-outline" size={15} color={theme.colors.ink} />
            <Text style={styles.tabText}>Outcome</Text>
          </Pressable>
```

Move the conversation: change `{tab === 'makers' && canRead ? (` (the `<View accessibilityRole="list" accessibilityLabel="Conversation" …>` block) to sit under a Thread card, and the composer to the Thread tab:

```tsx
        {tab === 'thread' ? (
          <Card style={styles.panel}>
            <TabHead id="thread" />
          </Card>
        ) : null}

        {tab === 'thread' && canRead ? (
          <View accessibilityRole="list" accessibilityLabel="Conversation" style={styles.log}>
            {/* … the existing messages.map body, unchanged … */}
          </View>
        ) : null}
```

`onContentSizeChange={() => canRead && tab === 'thread' && logRef.current?.scrollToEnd({ animated: false })}` and `{canRead && tab === 'thread' ? (` on the footer composer. Add to `styles`:

```tsx
  tabBadge: {
    minWidth: 18,
    paddingHorizontal: 5,
    borderRadius: theme.radii.pill,
    overflow: 'hidden',
    textAlign: 'center',
    fontFamily: theme.fonts.black,
    fontSize: 11,
    lineHeight: 18,
    color: theme.colors.ink,
    backgroundColor: theme.colors.accentLight,
  },
```

The header comment of the file: "The conversation lives under Makers" no longer applies — delete that sentence wherever it appears.

- [ ] **Step 4: Run the tests to see them pass**

Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/challenges/detail-screen.test.tsx` → PASS.

- [ ] **Step 5: Ship the item**

The `PENDING(challenge-thread-tab)` comment went in Step 3. Set `shipped: true`, `node scripts/pending.mjs`, drift test.

- [ ] **Step 6: Commit**

```bash
git status --short
git add packages/mobile/components/challenges/detail-screen.tsx packages/mobile/tests/unit/components/challenges/detail-screen.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(mobile): a challenge's thread has its own tab, and the tabs carry counts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 4: The Outcome tab (`challenge-outcome-tab`)

**Files:**
- Create: `packages/types/src/challenges.ts`
- Modify: `packages/types/src/index.ts` (re-export)
- Modify: `packages/mobile/components/challenges/detail-screen.tsx`
- Modify: `packages/web/app/get-involved/design-challenges/[id]/page.tsx` (uses the shared steps)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/web/tests/unit/lib/challenge-outcome.test.ts` (new); `packages/mobile/tests/unit/components/challenges/detail-screen.test.tsx`

**Interfaces:**
- Consumes: `Tab`, `TABS`, `tabs` filter (Task 3).
- Produces: from `@splat-connect/types`: `type OutcomeState = 'done' | 'now' | 'todo'`, `OUTCOME_STEPS: readonly { label: string; note: { mobile: string; web: string } }[]`, `outcomeStates(status: ToyIdeaStatus): OutcomeState[]`. Task 5 adds `PARTICIPANT_ROLE_LABEL` to the same file.

Copy: the four steps — labels "Idea approved" / "Makers working" / "Written up as a guide" / "Guide published" (MB, WB). Notes per platform, because the boards differ: MB "An admin reads it and opens it as a challenge." / "People join and the thread records what has been tried." / "A maker turns the solution into a draft guide. It reads Waiting until approved." / "The draft goes through the same review as any other guide."; WB the same first note, then "People join and the thread becomes the record of what has been tried." / "A maker turns the solution into a draft guide. The challenge reads Waiting until it is approved." / "The draft goes through the same review as any other guide before a family sees it." (web's current strings, which are WB's). Tab hint "What happens when somebody solves it." (MB, WB).

- [ ] **Step 1: Write the failing tests**

`packages/web/tests/unit/lib/challenge-outcome.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { OUTCOME_STEPS, outcomeStates } from '@splat-connect/types'

describe('outcomeStates', () => {
  it('puts a pending idea at the first step, a live challenge at the second, a graduated one at the third', () => {
    expect(outcomeStates('pending')).toEqual(['now', 'todo', 'todo', 'todo'])
    expect(outcomeStates('challenge')).toEqual(['done', 'now', 'todo', 'todo'])
    expect(outcomeStates('graduated')).toEqual(['done', 'done', 'now', 'todo'])
  })
  it('leaves every step to do on a rejected idea', () => {
    expect(outcomeStates('rejected')).toEqual(['todo', 'todo', 'todo', 'todo'])
  })
  it('names the board’s four steps', () => {
    expect(OUTCOME_STEPS.map((s) => s.label)).toEqual([
      'Idea approved', 'Makers working', 'Written up as a guide', 'Guide published',
    ])
  })
})
```

Append to `detail-screen.test.tsx` inside `describe('ChallengeDetailScreen')`:

```tsx
  it('follows a graduated challenge to the write-up on the Outcome tab', async () => {
    mockGet.mockResolvedValue(detail({ status: 'graduated', tutorial_id: 'tut7' }))
    render(<ChallengeDetailScreen id="c1" />)
    fireEvent.press(await screen.findByRole('tab', { name: 'Outcome' }))
    expect(screen.getByText('What happens when somebody solves it.')).toBeTruthy()
    expect(screen.getByText('Guide published')).toBeTruthy()
    expect(screen.getByText('People join and the thread records what has been tried.')).toBeTruthy()
  })

  it('draws no Outcome for a question, which never becomes a guide', async () => {
    mockGet.mockResolvedValue(detail({ kind: 'question' }))
    render(<ChallengeDetailScreen id="c1" />)
    expect(await screen.findByRole('tab', { name: 'Brief' })).toBeTruthy()
    expect(screen.queryByRole('tab', { name: 'Outcome' })).toBeNull()
  })
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/lib/challenge-outcome.test.ts` → FAIL (not exported).
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/challenges/detail-screen.test.tsx` → FAIL.

- [ ] **Step 3: The shared steps**

`packages/types/src/challenges.ts`:

```ts
/**
 * The pure rules behind a design challenge's detail, shared by web and mobile
 * (docs/superpowers/specs/2026-10-01-challenges-makers-build-design.md).
 */
import type { ToyIdeaStatus } from './index'

export type OutcomeState = 'done' | 'now' | 'todo'

/** The Outcome tab's four steps. The two boards word the notes differently,
 *  so each platform reads its own; the labels are the same on both. */
export const OUTCOME_STEPS = [
  {
    label: 'Idea approved',
    note: {
      mobile: 'An admin reads it and opens it as a challenge.',
      web: 'An admin reads it and opens it as a challenge.',
    },
  },
  {
    label: 'Makers working',
    note: {
      mobile: 'People join and the thread records what has been tried.',
      web: 'People join and the thread becomes the record of what has been tried.',
    },
  },
  {
    label: 'Written up as a guide',
    note: {
      mobile: 'A maker turns the solution into a draft guide. It reads Waiting until approved.',
      web: 'A maker turns the solution into a draft guide. The challenge reads Waiting until it is approved.',
    },
  },
  {
    label: 'Guide published',
    note: {
      mobile: 'The draft goes through the same review as any other guide.',
      web: 'The draft goes through the same review as any other guide before a family sees it.',
    },
  },
] as const

// The board's CDAT: where each status stands on the four steps.
const OUTCOME_AT: Record<ToyIdeaStatus, number> = { pending: 0, challenge: 1, graduated: 2, rejected: 0 }

/** Each step's state for an idea at this status. A rejected idea went nowhere,
 *  so every step is still to do. */
export function outcomeStates(status: ToyIdeaStatus): OutcomeState[] {
  const at = OUTCOME_AT[status]
  return OUTCOME_STEPS.map((_, i) =>
    status === 'rejected' ? 'todo' : i < at ? 'done' : i === at ? 'now' : 'todo'
  )
}
```

In `packages/types/src/index.ts`, beside the other re-exports:

```ts
export { OUTCOME_STEPS, outcomeStates } from './challenges'
export type { OutcomeState } from './challenges'
```

- [ ] **Step 4: Mobile**

In `detail-screen.tsx`:
- `type Tab = 'status' | 'brief' | 'constraints' | 'makers' | 'thread' | 'outcome'` and append to `TABS`:

```tsx
  { id: 'outcome', label: 'Outcome', icon: 'flag-outline', title: 'Outcome', hint: 'What happens when somebody solves it.' },
```

- Extend the filter: `const tabs = TABS.filter((t) => (listed || (t.id !== 'makers' && t.id !== 'thread')) && !(question && t.id === 'outcome'))`.
- Delete the `PENDING(challenge-outcome-tab)` comment and its pending `Pressable` after the map; drop `pendingHref` from the imports if nothing else uses it.
- Import `OUTCOME_STEPS, outcomeStates` from `@splat-connect/types`, and add after the `tab === 'thread'` blocks:

```tsx
        {tab === 'outcome' ? (
          <Card style={styles.panel}>
            <TabHead id="outcome" />
            <View accessibilityRole="list">
              {OUTCOME_STEPS.map((s, i) => {
                const state = outcomeStates(challenge.status)[i]
                return (
                  <View key={s.label} style={styles.event}>
                    <View style={[styles.stepDot, STEP_TONE[state]]}>
                      <Ionicons name={STEP_ICON[state]} size={13} color={state === 'done' ? theme.colors.surface : theme.colors.ink} />
                    </View>
                    <View style={styles.eventText}>
                      <Text style={[styles.eventTitle, state === 'todo' && styles.stepTodo]}>{s.label}</Text>
                      <Text style={styles.eventDate}>{s.note.mobile}</Text>
                    </View>
                  </View>
                )
              })}
            </View>
          </Card>
        ) : null}
```

  with, above the component:

```tsx
// The board's CDSTEP: a tick, a dot, a dash.
const STEP_ICON = { done: 'checkmark', now: 'ellipse', todo: 'remove' } as const
const STEP_TONE = {
  done: { backgroundColor: theme.colors.primaryDark },
  now: { backgroundColor: theme.colors.honeySoft },
  todo: { backgroundColor: theme.colors.surfaceSunken },
} as const
```

  and styles `stepDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }`, `stepTodo: { color: theme.colors.muted }`.

- [ ] **Step 5: Web reads the shared steps**

In `packages/web/app/get-involved/design-challenges/[id]/page.tsx` delete the local `OUTCOME_STEPS` const and `const outcomeAt = graduated ? 2 : 1`, import `OUTCOME_STEPS, outcomeStates` from `@splat-connect/types`, and in the outcome tab:

```tsx
              <ol className="flex list-none flex-col gap-3 p-0">
                {OUTCOME_STEPS.map(({ label, note }, i) => {
                  const state = outcomeStates(challenge.status)[i]
```

  rendering `{note.web}` where it rendered `{note}`. The rest of the block is unchanged.

- [ ] **Step 6: Run the tests to see them pass**

Run both commands from Step 2 → PASS. `pnpm typecheck` → exit 0.

- [ ] **Step 7: Ship the item**

Set `shipped: true` on `'challenge-outcome-tab'`, `node scripts/pending.mjs`, drift test.

- [ ] **Step 8: Commit**

```bash
git status --short
git add packages/types/src/challenges.ts packages/types/src/index.ts packages/mobile/components/challenges/detail-screen.tsx "packages/web/app/get-involved/design-challenges/[id]/page.tsx" packages/web/tests/unit/lib/challenge-outcome.test.ts packages/mobile/tests/unit/components/challenges/detail-screen.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(challenges): the Outcome tab on mobile, with the four steps shared with web

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 5: Each maker's role and join date (`challenge-maker-meta`)

**Files:**
- Modify: `packages/api/src/routes/public.ts` (`GET /challenges/:id`)
- Modify: `packages/types/src/index.ts` (`ToyIdeaParticipant.role`, `ToyIdeaDetail.writing_up`), `packages/types/src/challenges.ts` (`PARTICIPANT_ROLE_LABEL`)
- Modify: `packages/mobile/components/challenges/detail-screen.tsx` (Makers rows)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/api/tests/integration/toy-ideas/maker-meta.test.ts` (new); `packages/mobile/tests/unit/components/challenges/detail-screen.test.tsx`

**Interfaces:**
- Consumes: `shortDate` from `components/challenges/challenge-status.ts` (mobile's Hermes-safe one).
- Produces: each public participant carries `role: Role`. `ToyIdeaDetail.writing_up?: { profile_id: string; name: string; started_at: string } | null` — the graduated guide's primary contributor (`tutorial_contributors.role = 'primary'`) and the guide's `created_at`; null unless graduated with a guide. A function `writingUp(admin, idea)` in public.ts that Task 10 gives a `hideAuthor` argument and Task 11 renders. `PARTICIPANT_ROLE_LABEL: Record<Role, string>` from `@splat-connect/types`.

Spec vs code: graduation (`admin.ts` POST `/ideas/:id/graduate`) inserts the idea's author as `primary` and every participant as `collaborator`, so `writing_up` names the author and no maker row reads "writing it up" until graduation picks a maker. Implemented literally; flagged for Byron. `profiles.role` is `admin | contributor`; the board's "OT" is not stored anywhere.

Copy: row meta "{role} · joined {date}[ · writing it up]" (MB `cdMakers` notes: "Maker · joined 16 Aug · writing it up"); "You" for the viewer (MB). Role words: "Maker" (MB) for contributor, "Admin" (no board — flagged).

- [ ] **Step 1: Write the failing tests**

`packages/api/tests/integration/toy-ideas/maker-meta.test.ts`:

```ts
/**
 * Maker rows on a public brief: each participant's role, and who is writing
 * the guide up once the challenge graduates.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let author: TestUser
let maker: TestUser
let ideaId: string
let tutorialId: string

beforeAll(async () => {
  author = await createTestUser('contributor')
  maker = await createTestUser('contributor')
  const admin = adminClient()
  tutorialId = (
    await admin.from('tutorials').insert({ title: 'Draft', description: 'D', difficulty: 'medium', status: 'draft' }).select('id, created_at').single()
  ).data!.id
  ideaId = (
    await admin
      .from('toy_ideas')
      .insert({ author_id: author.id, title: 'T', summary: 'S', status: 'graduated', tutorial_id: tutorialId })
      .select('id')
      .single()
  ).data!.id
  await admin.from('toy_idea_participants').insert({ idea_id: ideaId, profile_id: maker.id })
  await admin.from('tutorial_contributors').insert([
    { tutorial_id: tutorialId, profile_id: author.id, role: 'primary' },
    { tutorial_id: tutorialId, profile_id: maker.id, role: 'collaborator' },
  ])
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('toy_ideas').delete().eq('id', ideaId)
  await admin.from('tutorials').delete().eq('id', tutorialId)
  await deleteTestUser(author.id)
  await deleteTestUser(maker.id)
})

describe('GET /api/public/challenges/:id — maker meta', () => {
  it('gives each participant their role, and names who is writing it up', async () => {
    const res = await app.request(`/api/public/challenges/${ideaId}`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      participants: { profile_id: string; role: string }[]
      writing_up: { profile_id: string; name: string; started_at: string } | null
    }
    expect(body.participants).toEqual([expect.objectContaining({ profile_id: maker.id, role: 'contributor' })])
    expect(body.writing_up).toMatchObject({ profile_id: author.id })
    expect(typeof body.writing_up!.started_at).toBe('string')
  })

  it('has nobody writing up a challenge that has not graduated', async () => {
    await adminClient().from('toy_ideas').update({ status: 'challenge' }).eq('id', ideaId)
    const body = (await (await app.request(`/api/public/challenges/${ideaId}`)).json()) as { writing_up: unknown }
    expect(body.writing_up).toBeNull()
    await adminClient().from('toy_ideas').update({ status: 'graduated' }).eq('id', ideaId)
  })
})
```

Append to `detail-screen.test.tsx` inside `describe('ChallengeDetailScreen')`:

```tsx
  it('gives each maker their role and join date, and marks the viewer and the writer', async () => {
    mockGet.mockResolvedValue(
      detail({
        status: 'graduated',
        participants: [
          { profile_id: 'p1', name: 'Tom Beattie', role: 'contributor', joined_at: '2026-08-16T03:00:00Z' },
          { profile_id: 'viewer1', name: 'Viewer', role: 'contributor', joined_at: '2026-09-02T03:00:00Z' },
        ],
        writing_up: { profile_id: 'p1', name: 'Tom Beattie', started_at: '2026-09-02T03:00:00Z' },
      })
    )
    render(<ChallengeDetailScreen id="c1" />)
    fireEvent.press(await screen.findByRole('tab', { name: 'Makers' }))
    expect(screen.getByText('Tom Beattie')).toBeTruthy()
    expect(screen.getByText('Maker · joined 16 Aug · writing it up')).toBeTruthy()
    expect(screen.getByText('You')).toBeTruthy()
    expect(screen.getByText('Maker · joined 2 Sep')).toBeTruthy()
  })
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/toy-ideas/maker-meta.test.ts` → FAIL (`role` undefined, `writing_up` undefined).
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/challenges/detail-screen.test.tsx` → FAIL.

- [ ] **Step 3: The API**

In `packages/api/src/routes/public.ts` add `import { profileName } from '../profile-name.js'` and, above `publicRoutes.get('/challenges/:id', …)`:

```ts
/**
 * Who is writing a graduated challenge up: the draft guide's primary
 * contributor, and when the draft was made. Graduation (admin.ts) makes the
 * idea's author primary, so today this names the author.
 */
async function writingUp(
  admin: ReturnType<typeof createAdminClient>,
  idea: { status: string; tutorial_id: string | null }
): Promise<{ profile_id: string; name: string; started_at: string } | null> {
  if (idea.status !== 'graduated' || !idea.tutorial_id) return null
  const [{ data: primary }, { data: guide }] = await Promise.all([
    admin.from('tutorial_contributors').select('profile_id').eq('tutorial_id', idea.tutorial_id).eq('role', 'primary').limit(1).maybeSingle(),
    admin.from('tutorials').select('created_at').eq('id', idea.tutorial_id).maybeSingle(),
  ])
  if (!primary || !guide) return null
  const id = primary.profile_id as string
  return { profile_id: id, name: await profileName(admin, id, 'A maker'), started_at: guide.created_at as string }
}
```

In the route: the participants select becomes `'idea_id, profile_id, joined_at, profiles!toy_idea_participants_profile_id_fkey(name, role)'`; each mapped participant gains `role: p.profiles?.role ?? 'contributor'`; and the response gains `writing_up: await writingUp(admin, idea as { status: string; tutorial_id: string | null })`.

In `packages/types/src/index.ts`: `ToyIdeaParticipant` gains

```ts
  /** profiles.role, on the public brief only — admin or contributor. */
  role?: Role
```

and `ToyIdeaDetail` gains

```ts
  /** The graduated guide's primary contributor and when the draft began. */
  writing_up?: { profile_id: string; name: string; started_at: string } | null
```

In `packages/types/src/challenges.ts` add `import type { Role, ToyIdeaStatus } from './index'` (replacing the single-type import) and:

```ts
/** profiles.role in the board's words on a Makers row. "OT" is not stored. */
export const PARTICIPANT_ROLE_LABEL: Record<Role, string> = { contributor: 'Maker', admin: 'Admin' }
```

and re-export it from index.ts beside `OUTCOME_STEPS`.

- [ ] **Step 4: Mobile rows**

In `detail-screen.tsx`, replace the Makers tab's participant `Pill` list (and its `PENDING(challenge-maker-meta)` comment) with:

```tsx
              <View accessibilityRole="list" style={styles.makerList}>
                {challenge.participants.map((p) => {
                  const meta = [
                    p.role ? PARTICIPANT_ROLE_LABEL[p.role] : null,
                    `joined ${shortDate(p.joined_at)}`,
                    challenge.writing_up?.profile_id === p.profile_id ? 'writing it up' : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                  return (
                    <View key={p.profile_id} style={styles.makerRow}>
                      <Text style={styles.makerName}>{p.profile_id === viewerId ? 'You' : p.name ?? 'Someone'}</Text>
                      <Text style={styles.eventDate}>{meta}</Text>
                    </View>
                  )
                })}
              </View>
```

Import `PARTICIPANT_ROLE_LABEL` from `@splat-connect/types`. Styles: `makerList: { gap: theme.spacing(2) }`, `makerRow: { padding: theme.spacing(3), borderRadius: theme.radii.field, backgroundColor: theme.colors.surfaceSunken, gap: 2 }`, `makerName: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.ink }`. Keep the `tagRow` style (the contact prefs still use it).

- [ ] **Step 5: Run the tests to see them pass**

Run both commands from Step 2 → PASS. The first test in the file ('renders the brief the public route returns') still finds 'Sam' on the Makers tab.

- [ ] **Step 6: Ship the item**

Set `shipped: true` on `'challenge-maker-meta'`, `node scripts/pending.mjs`, drift test.

- [ ] **Step 7: Commit**

```bash
git status --short
git add packages/api/src/routes/public.ts packages/types/src/index.ts packages/types/src/challenges.ts packages/mobile/components/challenges/detail-screen.tsx packages/api/tests/integration/toy-ideas/maker-meta.test.ts packages/mobile/tests/unit/components/challenges/detail-screen.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(challenges): maker rows say role and join date, and who is writing it up

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 6: A public save count (`challenge-saves-stat`, migration 105)

**Files:**
- Create: `supabase/migrations/105_challenge_save_count.sql`
- Modify: `packages/api/src/routes/public.ts` (detail select)
- Modify: `packages/types/src/index.ts` (`ToyIdeaDetail.save_count`)
- Modify: `packages/mobile/components/challenges/challenge-status.ts` (`challengeStats`), `packages/mobile/components/challenges/detail-screen.tsx` (drop the marker)
- Modify: `packages/web/app/get-involved/design-challenges/[id]/page.tsx` (stat tiles)
- Modify: `scripts/check-schema-guards.sh`, `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/api/tests/integration/toy-ideas/save-count.test.ts`, `packages/web/tests/unit/pages/challenge-detail.test.tsx` (new); `packages/mobile/tests/unit/components/challenges/challenge-status.test.ts`

**Interfaces:**
- Consumes: 073's `saves_by_entity_idx`.
- Produces: `public.save_count(public.toy_ideas) returns int` (SECURITY DEFINER, number only). `GET /api/public/challenges/:id` returns `save_count: number`. `ToyIdeaDetail.save_count?: number`. `challengeStats` returns makers / posts / saves / days open (a question: people in / answers / saves / days open). The web page test file and its `brief()` / `serve()` / `renderPage()` helpers, which Tasks 8, 10 and 11 extend.

Copy: "save" / "saves" (MB `cdStats`, WB), beside the existing "makers", "posts", "days open".

- [ ] **Step 1: Write the failing tests**

`packages/api/tests/integration/toy-ideas/save-count.test.ts`:

```ts
/** 105: how many accounts saved a challenge — a number, never who. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let author: TestUser
let saver: TestUser
let ideaId: string

beforeAll(async () => {
  author = await createTestUser('contributor')
  saver = await createTestUser('contributor')
  ideaId = (
    await adminClient().from('toy_ideas').insert({ author_id: author.id, title: 'T', summary: 'S', status: 'challenge' }).select('id').single()
  ).data!.id
  await adminClient().from('saves').insert({ profile_id: saver.id, entity_type: 'challenge', entity_id: ideaId })
})

afterAll(async () => {
  await adminClient().from('saves').delete().eq('entity_id', ideaId)
  await adminClient().from('toy_ideas').delete().eq('id', ideaId)
  await deleteTestUser(author.id)
  await deleteTestUser(saver.id)
})

describe('105 challenge save count', () => {
  it('is a computed field on toy_ideas', async () => {
    const { data, error } = await adminClient().from('toy_ideas').select('id, save_count').eq('id', ideaId).single()
    expect(error).toBeNull()
    expect(data!.save_count).toBe(1)
  })

  it('rides on the public brief as a number, with no saver in it', async () => {
    const res = await app.request(`/api/public/challenges/${ideaId}`)
    const text = await res.text()
    expect(JSON.parse(text).save_count).toBe(1)
    expect(text).not.toContain(saver.id)
  })
})
```

In `packages/mobile/tests/unit/components/challenges/challenge-status.test.ts`, replace `describe('challengeStats')`'s two tests:

```ts
  it('gives makers, posts, saves and days open', () => {
    expect(challengeStats(brief({ maker_count: 3, answer_count: 4, save_count: 11 }), now)).toEqual([
      { n: 3, label: 'makers' },
      { n: 4, label: 'posts' },
      { n: 11, label: 'saves' },
      { n: 23, label: 'days open' },
    ])
  })
  it('stops counting days once it is solved or answered', () => {
    expect(challengeStats(brief({ status: 'graduated' }), now)).toHaveLength(3)
    expect(challengeStats(brief({ kind: 'question', answered_at: '2026-08-10T00:00:00Z', save_count: 1 }), now)).toEqual([
      { n: 0, label: 'people in' },
      { n: 0, label: 'answers' },
      { n: 1, label: 'save' },
    ])
  })
```

`packages/web/tests/unit/pages/challenge-detail.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ChallengeDetailPage from '@/app/get-involved/design-challenges/[id]/page'
import { getCapabilities } from '@/lib/capabilities'

vi.mock('@/lib/capabilities', () => ({ getCapabilities: vi.fn(async () => null) }))
vi.mock('@/lib/saves', () => ({ getSavedIds: async () => null }))
vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn() } }))
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { post: vi.fn() } }))
vi.mock('@/components/challenge-thread', () => ({ ChallengeThread: () => null }))
vi.mock('@/components/save-button', () => ({ SaveButton: () => null }))
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound')
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))
vi.mock('next/image', () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }))

export const brief = (over: object = {}) => ({
  id: 'c1', author_id: 'a1', author_name: 'Priya', title: 'Bubbles', summary: 'One switch.',
  description: 'Three to five seconds.', intended_use: null, primary_user: null, contact_prefs: [],
  status: 'challenge', tutorial_id: null, kind: 'challenge', answer_message_id: null, answered_at: null,
  created_at: '2026-08-02T03:00:00Z', updated_at: '2026-08-02T03:00:00Z', participants: [],
  maker_count: 0, answer_count: 0, save_count: 0, writing_up: null,
  ...over,
})

function serve(body: object) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), { status: 200 })))
}

async function renderPage(tab?: string) {
  render(await ChallengeDetailPage({ params: Promise.resolve({ id: 'c1' }), searchParams: Promise.resolve({ tab }) }))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getCapabilities).mockResolvedValue(null)
})

describe('ChallengeDetailPage', () => {
  it('shows makers, posts, saves and days open', async () => {
    serve(brief({ answer_count: 4, save_count: 11 }))
    await renderPage()
    expect(screen.getByText('posts')).toBeInTheDocument()
    expect(screen.getByText('11')).toBeInTheDocument()
    expect(screen.getByText('saves')).toBeInTheDocument()
  })
})
```

(The file keeps `brief`, `serve` and `renderPage` at module level; later tasks append `it(...)` blocks inside this `describe`. Drop the `export` on `brief` if the linter refuses exports from a test file.)

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/toy-ideas/save-count.test.ts` → FAIL (`column toy_ideas.save_count does not exist`).
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/challenges/challenge-status.test.ts` → FAIL.
Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/pages/challenge-detail.test.tsx` → FAIL (no "saves").

- [ ] **Step 3: The migration**

`supabase/migrations/105_challenge_save_count.sql`:

```sql
-- 105 — how many accounts saved a challenge (challenge-saves-stat).
--
-- 073's save_count(toys), for toy_ideas: a PostgREST computed field, SECURITY
-- DEFINER because a saver's rows are visible only to the saver (044), stable
-- sql so it inlines per row. A number, never a who. Overloads 073's by its
-- argument type; 073's saves_by_entity_idx serves both.
--
-- DOWN:
--   drop function if exists public.save_count(public.toy_ideas);

create or replace function public.save_count(i public.toy_ideas)
returns int
language sql stable security definer set search_path = ''
as $$
  select count(*)::int from public.saves
   where entity_type = 'challenge' and entity_id = i.id
$$;
```

Run: `supabase migration up`.

In `scripts/check-schema-guards.sh`, before `) as t(guard, ok)`, add a comma after the last row and:

```sql
  -- 105. Without definer it counts only the caller's own save (044's RLS): always 0 or 1.
  ('105 save_count(toy_ideas) is security definer',
   (select count(*) = 1 from pg_proc p
      where p.proname = 'save_count' and p.pronamespace = 'public'::regnamespace
        and p.prosecdef and pg_get_function_identity_arguments(p.oid) = 'i toy_ideas'))
```

- [ ] **Step 4: API, types, both screens**

`public.ts` detail select: append `, save_count` to the column list string (after `updated_at`). Types: `ToyIdeaDetail` gains `/** 105: how many accounts saved it. */ save_count?: number`.

`challenge-status.ts`, `challengeStats` (and its doc comment: drop "Saves are left out…"):

```ts
/** The stat tiles (MB cdStats): makers, posts, saves, and days open while it is open. */
export function challengeStats(c: ToyIdeaDetail, now: Date): { n: number; label: string }[] {
  const question = c.kind === 'question'
  const tile = (n: number, one: string, many: string) => ({ n, label: n === 1 ? one : many })
  const stats = [
    question
      ? tile(c.maker_count ?? c.participants.length, 'person in', 'people in')
      : tile(c.maker_count ?? c.participants.length, 'maker', 'makers'),
    question ? tile(c.answer_count ?? 0, 'answer', 'answers') : tile(c.answer_count ?? 0, 'post', 'posts'),
    tile(c.save_count ?? 0, 'save', 'saves'),
  ]
```

(the days-open push below is unchanged). In `detail-screen.tsx` delete the `// PENDING(challenge-saves-stat): …` line.

Web page — replace the two-tile grid in the status tab:

```tsx
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                {(
                  [
                    question
                      ? [answers, answers === 1 ? 'answer' : 'answers']
                      : [makers.length, makers.length === 1 ? 'maker' : 'makers'],
                    ...(question ? [] : [[answers, answers === 1 ? 'post' : 'posts']]),
                    [challenge.save_count ?? 0, challenge.save_count === 1 ? 'save' : 'saves'],
                    [daysOpen, daysOpen === 1 ? 'day open' : 'days open'],
                  ] as [number, string][]
                ).map(([n, label]) => (
```

(the tile markup inside is unchanged).

- [ ] **Step 5: Run the tests to see them pass**

Run the three commands from Step 2 → PASS.

- [ ] **Step 6: Ship the item**

Set `shipped: true` on `'challenge-saves-stat'`, `node scripts/pending.mjs`, drift test.

- [ ] **Step 7: Commit**

```bash
git status --short
git add supabase/migrations/105_challenge_save_count.sql packages/api/src/routes/public.ts packages/types/src/index.ts packages/mobile/components/challenges/challenge-status.ts packages/mobile/components/challenges/detail-screen.tsx "packages/web/app/get-involved/design-challenges/[id]/page.tsx" scripts/check-schema-guards.sh packages/api/tests/integration/toy-ideas/save-count.test.ts packages/web/tests/unit/pages/challenge-detail.test.tsx packages/mobile/tests/unit/components/challenges/challenge-status.test.ts packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(challenges): a public save count among the stat tiles (105)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 7: A photo on Submit an idea (`idea-photo`, migration 106)

**Files:**
- Create: `supabase/migrations/106_idea_photo.sql`
- Modify: `packages/api/src/routes/upload.ts` (POST `/idea-photo`), `packages/api/src/routes/toy-ideas.ts` (`readIdeaBody` takes `photo_url`)
- Modify: `packages/types/src/index.ts` (`ToyIdea.photo_url`)
- Modify: `packages/mobile/lib/upload.ts` (`UploadPath`), `packages/mobile/components/challenges/submit-idea-screen.tsx`
- Modify: `packages/web/components/idea-form.tsx`
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/api/tests/integration/toy-ideas/photo.test.ts` (new); `packages/mobile/tests/unit/components/challenges/submit-idea-screen.test.tsx`, `packages/web/tests/unit/components/idea-form.test.tsx`

**Interfaces:**
- Consumes: `readIdeaBody` (Task 1); `PHOTO_MIME`, `PHOTO_MAX_BYTES` in upload.ts.
- Produces: `toy_ideas.photo_url text` (≤ 1000, granted to anon). `POST /api/upload/idea-photo` (multipart, `file` only) → `{ url }`, stored at `toy-photos/ideas/<caller>/<uuid>.<ext>`. `readIdeaBody(body, userId)` — the second argument is new; a `photo_url` must start with the caller's own `…/toy-photos/ideas/<userId>/` public prefix, else 400 "That photo was not uploaded from this account.". `ToyIdea.photo_url?: string | null`. Task 8 renders it; Task 9's revised-idea prefill carries it.

Spec vs code: there is no ideas/photos bucket. This follows 093's note-photo route (service role, public `toy-photos` bucket). A pending idea's photo is therefore public to anyone holding its unguessable URL before review — flagged for Byron.

Copy: "Photo" · "Tap to add a photo" (MB); "Photos (optional)" · "Drop a photo of the toy" (WB). "That photo was not uploaded from this account." and "Could not upload the photo. Please try again." (no board — the second is community-notes' existing line).

- [ ] **Step 1: Write the failing tests**

`packages/api/tests/integration/toy-ideas/photo.test.ts`:

```ts
/**
 * 106: an idea may carry one photo, uploaded before the idea exists and filed
 * under its author. The idea only takes a photo from the author's own folder.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let author: TestUser
let other: TestUser
const ids: string[] = []
// A 1×1 PNG.
const PNG = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='), (ch) => ch.charCodeAt(0))

const upload = (u: TestUser) => {
  const form = new FormData()
  form.append('file', new Blob([PNG], { type: 'image/png' }), 'toy.png')
  return app.request('/api/upload/idea-photo', { method: 'POST', headers: { Authorization: `Bearer ${u.token}` }, body: form })
}
const post = (u: TestUser, body: unknown) =>
  app.request('/api/ideas', {
    method: 'POST',
    headers: { Authorization: `Bearer ${u.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

beforeAll(async () => {
  author = await createTestUser('contributor')
  other = await createTestUser('contributor')
})

afterAll(async () => {
  await adminClient().from('toy_ideas').delete().in('id', ids)
  await deleteTestUser(author.id)
  await deleteTestUser(other.id)
})

describe('106 idea photo', () => {
  it('uploads into the author’s folder and keeps the URL on the idea', async () => {
    const res = await upload(author)
    expect(res.status).toBe(200)
    const { url } = (await res.json()) as { url: string }
    expect(url).toContain(`/toy-photos/ideas/${author.id}/`)
    const idea = await post(author, { title: 'T', summary: 'S', photo_url: url })
    expect(idea.status).toBe(201)
    const row = (await idea.json()) as { id: string; photo_url: string }
    ids.push(row.id)
    expect(row.photo_url).toBe(url)
  })

  it('refuses a photo from anywhere else, including another author’s folder', async () => {
    const { url } = (await (await upload(other)).json()) as { url: string }
    for (const photo_url of [url, 'https://example.com/x.png']) {
      const res = await post(author, { title: 'T', summary: 'S', photo_url })
      expect(res.status).toBe(400)
      expect(((await res.json()) as { error: string }).error).toBe('That photo was not uploaded from this account.')
    }
  })

  it('lets anon read the photo of a published challenge', async () => {
    const id = (
      await adminClient().from('toy_ideas').insert({ author_id: author.id, title: 'T', summary: 'S', status: 'challenge', photo_url: 'https://example.com/p.png' }).select('id').single()
    ).data!.id
    ids.push(id)
    const anon = createClient(process.env.SUPABASE_URL ?? 'http://localhost:54321', process.env.SUPABASE_ANON_KEY ?? '')
    const { data, error } = await anon.from('toy_ideas').select('photo_url').eq('id', id).single()
    expect(error).toBeNull()
    expect(data!.photo_url).toBe('https://example.com/p.png')
  })
})
```

In `submit-idea-screen.test.tsx` add, above the `api-client` mock:

```tsx
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: true })),
  launchImageLibraryAsync: jest.fn(async () => ({
    canceled: false,
    assets: [{ uri: 'file:///toy.jpg', fileName: 'toy.jpg', mimeType: 'image/jpeg' }],
  })),
}))
const mockUpload = jest.fn()
jest.mock('../../../../lib/upload', () => ({ uploadFile: (...a: unknown[]) => mockUpload(...a) }))
```

and append inside the `describe`:

```tsx
  it('adds a photo, uploaded before the idea, and sends its URL', async () => {
    mockUpload.mockResolvedValue({ url: 'https://x.supabase.co/storage/v1/object/public/toy-photos/ideas/viewer1/a.jpg' })
    render(<SubmitIdeaScreen />)
    fillEverything()
    fireEvent.press(screen.getByRole('button', { name: 'Tap to add a photo' }))
    await waitFor(() =>
      expect(mockUpload).toHaveBeenCalledWith('/api/upload/idea-photo', '', { uri: 'file:///toy.jpg', name: 'toy.jpg', mimeType: 'image/jpeg' }, null)
    )
    fireEvent.press(screen.getByRole('button', { name: 'Submit idea' }))
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        '/api/ideas',
        expect.objectContaining({ photo_url: 'https://x.supabase.co/storage/v1/object/public/toy-photos/ideas/viewer1/a.jpg' })
      )
    )
  })
```

In `idea-form.test.tsx`, change the browser-api-client mock to `{ browserApiClient: { post: vi.fn(), postFormData: vi.fn() } }` and append:

```tsx
  it('uploads a photo and sends its URL with the idea', async () => {
    vi.mocked(browserApiClient.postFormData).mockResolvedValue({ url: 'https://x/ideas/u/a.png' })
    render(<IdeaForm />)
    fireEvent.change(screen.getByLabelText(/drop a photo of the toy/i), {
      target: { files: [new File(['x'], 'a.png', { type: 'image/png' })] },
    })
    await waitFor(() => expect(browserApiClient.postFormData).toHaveBeenCalledWith('/api/upload/idea-photo', expect.any(FormData)))
    fireEvent.change(screen.getByLabelText(/^title$/i), { target: { value: 'T' } })
    fireEvent.change(screen.getByLabelText(/^summary$/i), { target: { value: 'S' } })
    fireEvent.click(screen.getByRole('button', { name: /submit for review/i }))
    await waitFor(() =>
      expect(browserApiClient.post).toHaveBeenCalledWith('/api/ideas', expect.objectContaining({ photo_url: 'https://x/ideas/u/a.png' }))
    )
  })
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/toy-ideas/photo.test.ts` → FAIL (404 on `/api/upload/idea-photo`).
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/challenges/submit-idea-screen.test.tsx` → FAIL.
Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/components/idea-form.test.tsx` → FAIL.

- [ ] **Step 3: The migration**

`supabase/migrations/106_idea_photo.sql`:

```sql
-- 106 — one photo on an idea (idea-photo, challenge-brief-photo).
--
-- A public URL in toy-photos under ideas/<author>/, written by the API's
-- /upload/idea-photo with the service role (the same shape as 093's note
-- photos). The API refuses any URL outside the caller's own folder; the CHECK
-- only bounds the text. Public on a published challenge, so it joins 040's
-- anon column grant.
--
-- DOWN:
--   revoke select (photo_url) on public.toy_ideas from anon;
--   alter table public.toy_ideas drop column if exists photo_url;

alter table public.toy_ideas
  add column photo_url text check (photo_url is null or length(photo_url) <= 1000);

grant select (photo_url) on public.toy_ideas to anon;
```

Run: `supabase migration up`.

- [ ] **Step 4: The upload route and the API**

`packages/api/src/routes/upload.ts`, after the `/note-photo` route (or after `/step-photo` if note-photo is not there yet):

```ts
/**
 * The photo on Submit an idea (106). It is chosen before the idea exists, so
 * it is filed under its author, ideas/<author>/<uuid>, and the service role
 * writes it: toy-photos' storage policy (032) admits only a tutorial's
 * contributors. POST /api/ideas takes a photo only from the caller's folder.
 * ponytail: a withdrawn or never-sent idea leaves its photo; sweep ideas/
 * against toy_ideas.photo_url if storage ever matters.
 */
upload.post('/idea-photo', async (c) => {
  const file = (await c.req.formData()).get('file') as File | null
  if (!file) return c.json({ error: 'file is required' }, 400)
  if (!PHOTO_MIME.includes(file.type)) return c.json({ error: 'Photos need to be a JPEG, PNG, WebP, AVIF or HEIC image.' }, 400)
  if (file.size > PHOTO_MAX_BYTES) return c.json({ error: 'Photos need to be under 10 MB.' }, 400)
  const admin = createAdminClient()
  const ext = file.name.split('.').pop() ?? 'jpg'
  const { data, error } = await admin.storage
    .from('toy-photos')
    .upload(`ideas/${c.get('userId')}/${crypto.randomUUID()}.${ext}`, file, { upsert: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ url: admin.storage.from('toy-photos').getPublicUrl(data.path).data.publicUrl })
})
```

`packages/api/src/routes/toy-ideas.ts`:

```ts
/** The public URL /upload/idea-photo hands back for this author's folder. */
const ideaPhotoPrefix = (userId: string) =>
  `${process.env.SUPABASE_URL}/storage/v1/object/public/toy-photos/ideas/${userId}/`
```

Change the signature to `function readIdeaBody(body: unknown, userId: string): Record<string, unknown> | string | null`, and before `return out`:

```ts
  // 106: one optional photo, and only one this author uploaded.
  const photo = source.photo_url ?? null
  if (photo !== null && (typeof photo !== 'string' || !photo.startsWith(ideaPhotoPrefix(userId)) || photo.length > 1000)) {
    return 'That photo was not uploaded from this account.'
  }
  out.photo_url = photo
```

In `toyIdeas.post('/')`:

```ts
  const fields = readIdeaBody(await c.req.json().catch(() => null), c.get('userId'))
  if (typeof fields === 'string') return c.json({ error: fields }, 400)
  if (!fields) return c.json({ error: 'A title and a summary are required.' }, 400)
```

Types: `ToyIdea` gains `/** 106: one photo, a public URL. */ photo_url?: string | null`.

- [ ] **Step 5: The two forms**

`packages/mobile/lib/upload.ts`, in `UploadPath`:

```ts
  // 106: Submit an idea's photo, sent with no id field (idField null).
  | '/api/upload/idea-photo'
```

`submit-idea-screen.tsx` — imports `Image, Pressable` from react-native, `* as ImagePicker from 'expo-image-picker'`, `{ uploadFile } from '../../lib/upload'`. State `const [photo, setPhoto] = useState<string | null>(null)`. Add:

```tsx
  async function addPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) return setError('Photo library access is needed to choose a photo.')
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'] })
    const asset = result.canceled ? null : result.assets?.[0]
    if (!asset) return
    try {
      const { url } = await uploadFile('/api/upload/idea-photo', '', {
        uri: asset.uri,
        name: asset.fileName ?? 'photo.jpg',
        mimeType: asset.mimeType ?? 'image/jpeg',
      }, null)
      setPhoto(url)
    } catch {
      setError('Could not upload the photo. Please try again.')
    }
  }
```

Post `photo_url: photo` with the idea. Replace `<PendingButton pending="idea-photo" … />` with:

```tsx
              <Text style={styles.legend}>Photo</Text>
              <Pressable
                onPress={() => void addPhoto()}
                accessibilityRole="button"
                accessibilityLabel="Tap to add a photo"
                style={styles.photoSlot}
              >
                {photo ? (
                  <Image source={{ uri: photo }} style={styles.photo} accessibilityIgnoresInvertColors />
                ) : (
                  <Text style={styles.scopeHint}>Tap to add a photo</Text>
                )}
              </Pressable>
```

Styles: `photoSlot: { height: 130, borderRadius: 16, borderWidth: theme.border.hairline, borderStyle: 'dashed', borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: theme.spacing(2) }`, `photo: { width: '100%', height: '100%' }`. Drop `PendingButton` from the `../ui/pending` import (PendingRow stays until Task 10).

`packages/web/components/idea-form.tsx` — state `const [photo, setPhoto] = useState<string | null>(null)`; post `photo_url: photo`; after the Why it matters block:

```tsx
      <div>
        <span className="field-label">Photos (optional)</span>
        <label className="grid min-h-[150px] cursor-pointer place-items-center overflow-hidden rounded-[18px] border border-dashed border-line text-sm font-bold text-muted">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- a just-uploaded preview, not a page image
            <img src={photo} alt="" className="h-[150px] w-full object-cover" />
          ) : (
            'Drop a photo of the toy'
          )}
          <input
            type="file"
            accept="image/*"
            aria-label="Drop a photo of the toy"
            className="sr-only"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return
              const fd = new FormData()
              fd.append('file', file)
              try {
                setPhoto((await browserApiClient.postFormData<{ url: string }>('/api/upload/idea-photo', fd)).url)
              } catch {
                setError('Could not upload the photo. Please try again.')
              }
            }}
          />
        </label>
      </div>
```

- [ ] **Step 6: Run the tests to see them pass**

Run the three commands from Step 2 → PASS. Also `pnpm --filter @splat-connect/api exec vitest run tests/unit/routes/toy-ideas.test.ts` → PASS (no photo sent, `photo_url: null`).

- [ ] **Step 7: Ship the item**

The `pending="idea-photo"` button went in Step 5. Set `shipped: true` on `'idea-photo'`, `node scripts/pending.mjs`, drift test.

- [ ] **Step 8: Commit**

```bash
git status --short
git add supabase/migrations/106_idea_photo.sql packages/api/src/routes/upload.ts packages/api/src/routes/toy-ideas.ts packages/types/src/index.ts packages/mobile/lib/upload.ts packages/mobile/components/challenges/submit-idea-screen.tsx packages/web/components/idea-form.tsx packages/api/tests/integration/toy-ideas/photo.test.ts packages/mobile/tests/unit/components/challenges/submit-idea-screen.test.tsx packages/web/tests/unit/components/idea-form.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(ideas): a photo on Submit an idea, filed under its author (106)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 8: The brief's hero photo and "What a solution has to do" (`challenge-brief-photo`)

**Files:**
- Modify: `packages/api/src/routes/public.ts` (detail select)
- Modify: `packages/mobile/components/challenges/detail-screen.tsx` (Brief tab)
- Modify: `packages/web/app/get-involved/design-challenges/[id]/page.tsx` (brief tab)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/api/tests/integration/toy-ideas/photo.test.ts`, `packages/mobile/tests/unit/components/challenges/detail-screen.test.tsx`, `packages/web/tests/unit/pages/challenge-detail.test.tsx`

**Interfaces:**
- Consumes: `toy_ideas.photo_url` (Task 7); the page test helpers (Task 6).
- Produces: `GET /api/public/challenges/:id` carries `photo_url`. Both briefs: photo (when set), then the summary, then "What a solution has to do" with `description` (when set).

Spec vs code: the spec maps the box to `summary`. The board's brief opens with the summary paragraph (the card line, verbatim) and the box holds the requirement, so the box takes `description` — what both clients already show second today. Flagged for Byron.

Copy: "What a solution has to do" (MB, WB).

- [ ] **Step 1: Write the failing tests**

Append to `photo.test.ts`:

```ts
  it('puts the photo on the public brief', async () => {
    const id = (
      await adminClient().from('toy_ideas').insert({ author_id: author.id, title: 'T', summary: 'S', status: 'challenge', photo_url: 'https://example.com/hero.png' }).select('id').single()
    ).data!.id
    ids.push(id)
    const body = (await (await app.request(`/api/public/challenges/${id}`)).json()) as { photo_url: string }
    expect(body.photo_url).toBe('https://example.com/hero.png')
  })
```

Append to `detail-screen.test.tsx`:

```tsx
  it('leads the brief with the photo, then the summary, then what a solution has to do', async () => {
    mockGet.mockResolvedValue(detail({ photo_url: 'https://example.com/hero.png' }))
    render(<ChallengeDetailScreen id="c1" />)
    fireEvent.press(await screen.findByRole('tab', { name: 'Brief' }))
    expect(screen.getByTestId('challenge-photo').props.source).toEqual({ uri: 'https://example.com/hero.png' })
    expect(screen.getByText('What a solution has to do')).toBeTruthy()
    expect(screen.getByText('She swipes rather than presses, so a button never latches.')).toBeTruthy()
  })
```

Append inside `describe('ChallengeDetailPage')` in `challenge-detail.test.tsx`:

```tsx
  it('leads the brief with the photo and says what a solution has to do', async () => {
    serve(brief({ photo_url: 'http://localhost:54321/storage/v1/object/public/toy-photos/ideas/a1/p.png' }))
    await renderPage('brief')
    expect(screen.getByRole('img').getAttribute('src')).toContain('/toy-photos/ideas/a1/p.png')
    expect(screen.getByRole('heading', { name: 'What a solution has to do' })).toBeInTheDocument()
    expect(screen.getByText('Three to five seconds.')).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run them to see them fail**

Run the integration file, `jest tests/unit/components/challenges/detail-screen.test.tsx`, and `vitest run tests/unit/pages/challenge-detail.test.tsx` → each FAILS.

- [ ] **Step 3: Implement**

`public.ts`: append `, photo_url` to the detail column list.

Mobile Brief tab (replace the `PENDING(challenge-brief-photo)` comment and the Brief body):

```tsx
            {challenge.photo_url ? (
              <Image
                testID="challenge-photo"
                source={{ uri: challenge.photo_url }}
                style={styles.hero}
                accessibilityIgnoresInvertColors
              />
            ) : null}
            <Text style={styles.quiet}>{challenge.summary}</Text>
            {challenge.description ? (
              <View>
                <Text style={styles.blockTitle}>What a solution has to do</Text>
                <Text style={styles.fieldValue}>{challenge.description}</Text>
              </View>
            ) : null}
```

Import `Image` from react-native; style `hero: { height: 160, borderRadius: 16, width: '100%' }`. The `summary` style may now be unused — delete it if so. The 'renders the brief the public route returns' test still finds both strings.

Web brief tab — add `import Image from 'next/image'` and `import { safePhotoSrc } from '@/lib/photo-src'`, compute `const photo = safePhotoSrc(challenge.photo_url)` near the top, and start the brief tab with:

```tsx
              {photo && (
                <div className="relative aspect-[16/9] overflow-hidden rounded-[18px] border border-line shadow-[var(--e1)]">
                  <Image src={photo} alt="" fill className="object-cover" />
                </div>
              )}
```

and rename the first heading of the triples from `'What it needs to do'` to `'What a solution has to do'` (keep the Intended use / Who it's for rows, which Task 1 made conditional).

- [ ] **Step 4: Run the tests to see them pass**

Run the three commands → PASS.

- [ ] **Step 5: Ship the item**

Set `shipped: true` on `'challenge-brief-photo'`, `node scripts/pending.mjs`, drift test.

- [ ] **Step 6: Commit**

```bash
git status --short
git add packages/api/src/routes/public.ts packages/mobile/components/challenges/detail-screen.tsx "packages/web/app/get-involved/design-challenges/[id]/page.tsx" packages/api/tests/integration/toy-ideas/photo.test.ts packages/mobile/tests/unit/components/challenges/detail-screen.test.tsx packages/web/tests/unit/pages/challenge-detail.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(challenges): the brief leads with the idea's photo and what a solution has to do

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 9: The author's own pending or rejected idea (`challenge-author-states`, migration 107)

**Files:**
- Create: `supabase/migrations/107_idea_withdraw.sql`, `packages/web/components/idea-author-actions.tsx`
- Modify: `packages/api/src/routes/toy-ideas.ts` (GET `/mine/:id`, DELETE `/:id`)
- Modify: `packages/mobile/components/challenges/detail-screen.tsx`, `challenge-status.ts` (`challengePill`), `my-screen.tsx` (own rows open), `submit-idea-screen.tsx` (`from` prefill), `packages/mobile/app/(tabs)/explore/challenges/new.tsx`
- Modify: `packages/web/app/dashboard/challenges/page.tsx`, `packages/web/app/get-involved/submit-an-idea/page.tsx`, `packages/web/components/idea-form.tsx` (`initial`)
- Modify: `scripts/check-schema-guards.sh`, `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/api/tests/integration/toy-ideas/withdraw.test.ts`, `packages/web/tests/unit/components/idea-author-actions.test.tsx` (new); `packages/mobile/tests/unit/components/challenges/{detail-screen,challenge-status,my-screen,submit-idea-screen}.test.tsx`, `packages/web/tests/unit/pages/dashboard-challenges.test.tsx`, `packages/web/tests/unit/components/idea-form.test.tsx`

**Interfaces:**
- Consumes: `listed`, `tabs` (Task 3); `photo` state in the mobile form (Task 7).
- Produces: `GET /api/ideas/mine/:id` → the caller's own `ToyIdea` at any status (incl. `review_note`), 404 otherwise. `DELETE /api/ideas/:id` → 204 when the caller's idea was pending and is gone; 409 "Only an idea still waiting for review can be withdrawn." when it is the caller's but no longer pending; 404 otherwise. A `mine` flag in the mobile detail (`useState(false)`) that Task 10 also sets. `SubmitIdeaScreen({ from }: { from?: string })` and `IdeaForm({ initial }: { initial?: ToyIdea })` pre-fill from an idea. `IdeaAuthorActions({ id, status })`.

Spec vs code: 037 grants authenticated `insert, update` only, so 107 adds `grant delete` with the new author-only, pending-only policy. With the grant, 037's admin `for all` policy also lets an admin delete an idea through PostgREST directly (the API still offers no admin delete).

Copy (MB/WB `CSTM`): meta "Submitted {date} · only you can see this"; pending head "An admin is reading it", body MB "Nothing is public yet. Most ideas are answered inside a week — approved, it opens as a challenge; if not, you get a reason."; button "Withdraw the idea"; toast "Withdrawn — nothing was published". Rejected head "Not taken forward", body "An admin read it and decided it is not one for SPLAT. Nothing was published. The reason is below — a revised idea is welcome."; "Why it was not taken forward:" (MB/WB, bold) + note; button "Submit a revised idea". Pills "Waiting" / "Declined" (MB `CSTAGE` → stage words). "Could not withdraw this idea. Please try again." (no board — flagged).

- [ ] **Step 1: Write the failing tests**

`packages/api/tests/integration/toy-ideas/withdraw.test.ts`:

```ts
/**
 * 107: an author reads their own idea at any status, and withdraws it while
 * nobody has reviewed it. Nothing else can withdraw anything.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let author: TestUser
let stranger: TestUser
const ids: string[] = []

const call = (u: TestUser, path: string, method = 'GET') =>
  app.request(path, { method, headers: { Authorization: `Bearer ${u.token}` } })
const idea = async (status: string, review_note: string | null = null) => {
  const id = (
    await adminClient().from('toy_ideas').insert({ author_id: author.id, title: 'T', summary: 'S', status, review_note }).select('id').single()
  ).data!.id as string
  ids.push(id)
  return id
}
const exists = async (id: string) => !!(await adminClient().from('toy_ideas').select('id').eq('id', id).maybeSingle()).data

beforeAll(async () => {
  author = await createTestUser('contributor')
  stranger = await createTestUser('contributor')
})

afterAll(async () => {
  await adminClient().from('toy_ideas').delete().in('id', ids)
  await deleteTestUser(author.id)
  await deleteTestUser(stranger.id)
})

describe('GET /api/ideas/mine/:id', () => {
  it('gives the author their rejected idea with its reason, and nobody else anything', async () => {
    const id = await idea('rejected', 'Closer to a clinical aid.')
    const own = await call(author, `/api/ideas/mine/${id}`)
    expect(own.status).toBe(200)
    expect(await own.json()).toMatchObject({ id, status: 'rejected', review_note: 'Closer to a clinical aid.' })
    expect((await call(stranger, `/api/ideas/mine/${id}`)).status).toBe(404)
    expect((await call(author, '/api/ideas/mine/not-a-uuid')).status).toBe(404)
  })
})

describe('107 DELETE /api/ideas/:id', () => {
  it('withdraws the author’s pending idea', async () => {
    const id = await idea('pending')
    expect((await call(author, `/api/ideas/${id}`, 'DELETE')).status).toBe(204)
    expect(await exists(id)).toBe(false)
  })

  it('refuses anyone but the author, and leaves the idea', async () => {
    const id = await idea('pending')
    expect((await call(stranger, `/api/ideas/${id}`, 'DELETE')).status).toBe(404)
    expect(await exists(id)).toBe(true)
  })

  it('refuses an idea that has been reviewed, and says why', async () => {
    for (const status of ['challenge', 'rejected', 'graduated']) {
      const id = await idea(status)
      const res = await call(author, `/api/ideas/${id}`, 'DELETE')
      expect(res.status).toBe(409)
      expect(((await res.json()) as { error: string }).error).toBe('Only an idea still waiting for review can be withdrawn.')
      expect(await exists(id)).toBe(true)
    }
  })
})
```

Mobile `challenge-status.test.ts` — extend 'is Live, Waiting, Answered or Became a guide':

```ts
    expect(challengePill({ status: 'pending', kind: 'challenge', answered_at: null }).label).toBe('Waiting')
    expect(challengePill({ status: 'rejected', kind: 'challenge', answered_at: null }).label).toBe('Declined')
```

Mobile `detail-screen.test.tsx` — append inside `describe('ChallengeDetailScreen')`:

```tsx
  describe('the author’s own idea before it is public', () => {
    const own = (status: string, over: object = {}) => {
      mockUseCapabilities.mockReturnValue(viewer('author1'))
      mockGet.mockImplementation((path: string) =>
        path === '/api/ideas/mine/c1'
          ? Promise.resolve(detail({ status, review_note: null, participants: undefined, ...over }))
          : Promise.reject(new Error('404'))
      )
    }

    it('reads a pending idea from the author’s own list and withdraws it', async () => {
      own('pending')
      mockDelete.mockResolvedValue(undefined)
      render(<ChallengeDetailScreen id="c1" />)
      expect(await screen.findByText('An admin is reading it')).toBeTruthy()
      expect(screen.getByText(/· only you can see this$/)).toBeTruthy()
      fireEvent.press(screen.getByRole('button', { name: 'Withdraw the idea' }))
      await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/api/ideas/c1'))
      expect(await screen.findByText('Withdrawn — nothing was published')).toBeTruthy()
    })

    it('gives a rejected idea its reason and a way to send a revised one', async () => {
      own('rejected', { review_note: 'Closer to a clinical aid.' })
      render(<ChallengeDetailScreen id="c1" />)
      expect(await screen.findByText('Not taken forward')).toBeTruthy()
      expect(screen.getByText('Closer to a clinical aid.')).toBeTruthy()
      fireEvent.press(screen.getByRole('button', { name: 'Submit a revised idea' }))
      expect(mockPush).toHaveBeenCalledWith('/explore/challenges/new?from=c1')
    })

    it('never asks for the author’s copy when nobody is signed in', async () => {
      mockUseCapabilities.mockReturnValue(signedOut)
      mockGet.mockRejectedValue(new Error('404'))
      render(<ChallengeDetailScreen id="c1" />)
      expect(await screen.findByText("Couldn't load this challenge.")).toBeTruthy()
      expect(mockGet).not.toHaveBeenCalledWith('/api/ideas/mine/c1')
    })
  })
```

Mobile `my-screen.test.tsx` — replace 'opens a published idea, and refuses to link one with no public page' with:

```tsx
  it('opens every idea of your own, published or not', async () => {
    respond([
      idea({ id: 'live', title: 'Published one', status: 'challenge' }),
      idea({ id: 'quiet', title: 'Pending one', status: 'pending' }),
    ])
    render(<MyChallengesScreen />)
    fireEvent.press(await screen.findByRole('button', { name: 'Published one' }))
    expect(mockPush).toHaveBeenCalledWith('/explore/challenges/live')
    fireEvent.press(screen.getByRole('button', { name: 'Pending one' }))
    expect(mockPush).toHaveBeenCalledWith('/explore/challenges/quiet')
  })
```

Mobile `submit-idea-screen.test.tsx` — change the api-client mock to `{ apiClient: { post: (...a: unknown[]) => mockPost(...a), get: (...a: unknown[]) => mockGet(...a) } }` with `const mockGet = jest.fn()`, and append:

```tsx
  it('starts a revised idea from the rejected one', async () => {
    mockGet.mockResolvedValue({
      id: 'c1', title: 'Old title', summary: 'Old summary', description: 'Old why', kind: 'challenge',
      contact_prefs: ['co_design'], photo_url: null, status: 'rejected',
    })
    render(<SubmitIdeaScreen from="c1" />)
    expect(await screen.findByDisplayValue('Old title')).toBeTruthy()
    expect(screen.getByDisplayValue('Old why')).toBeTruthy()
    expect(mockGet).toHaveBeenCalledWith('/api/ideas/mine/c1')
  })
```

`packages/web/tests/unit/components/idea-author-actions.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { IdeaAuthorActions } from '@/components/idea-author-actions'
import { browserApiClient } from '@/lib/browser-api-client'

const refresh = vi.fn()
const toast = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('@/components/toast', () => ({ useToast: () => toast }))
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { delete: vi.fn() } }))

describe('IdeaAuthorActions', () => {
  it('withdraws a pending idea and says nothing was published', async () => {
    vi.mocked(browserApiClient.delete).mockResolvedValue(undefined)
    render(<IdeaAuthorActions id="i1" status="pending" />)
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw the idea' }))
    await waitFor(() => expect(browserApiClient.delete).toHaveBeenCalledWith('/api/ideas/i1'))
    expect(toast).toHaveBeenCalledWith('Withdrawn — nothing was published')
    expect(refresh).toHaveBeenCalled()
  })

  it('offers a revised idea for a rejected one', () => {
    render(<IdeaAuthorActions id="i1" status="rejected" />)
    expect(screen.getByRole('link', { name: 'Submit a revised idea' }).getAttribute('href')).toBe(
      '/get-involved/submit-an-idea?from=i1'
    )
  })

  it('offers nothing on an idea that is public', () => {
    const { container } = render(<IdeaAuthorActions id="i1" status="challenge" />)
    expect(container).toBeEmptyDOMElement()
  })
})
```

In `dashboard-challenges.test.tsx` add `vi.mock('@/components/idea-author-actions', () => ({ IdeaAuthorActions: ({ status }: { status: string }) => <span>actions:{status}</span> }))` and append:

```tsx
  it('puts the author’s actions on their own pending and rejected ideas', async () => {
    mockLists({ mine: [idea({ id: 'a', status: 'pending' }), idea({ id: 'b', title: 'Kazoo', status: 'rejected' })] })
    render(await DashboardChallengesPage())
    expect(screen.getByText('actions:pending')).toBeInTheDocument()
    expect(screen.getByText('actions:rejected')).toBeInTheDocument()
  })
```

In `idea-form.test.tsx` append:

```tsx
  it('starts from the idea it revises', () => {
    render(<IdeaForm initial={{ id: 'i1', author_id: 'a', title: 'Old', summary: 'Sum', description: 'Why', intended_use: null, primary_user: null, contact_prefs: [], status: 'rejected', review_note: 'No', tutorial_id: null, created_at: '', updated_at: '' }} />)
    expect(screen.getByLabelText(/^title$/i)).toHaveValue('Old')
    expect(screen.getByLabelText(/why it matters/i)).toHaveValue('Why')
  })
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/toy-ideas/withdraw.test.ts` → FAIL (404 on `/mine/:id`, DELETE not routed).
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/challenges` → FAIL.
Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/components/idea-author-actions.test.tsx tests/unit/pages/dashboard-challenges.test.tsx tests/unit/components/idea-form.test.tsx` → FAIL.

- [ ] **Step 3: The migration**

`supabase/migrations/107_idea_withdraw.sql`:

```sql
-- 107 — an author withdraws their own idea while it is pending
-- (challenge-author-states).
--
-- 037 gave authenticated no delete at all ("a rejected idea is resubmitted,
-- not amended"). Withdrawing is narrower than amending: only the author, only
-- before review — nothing was ever public, and participants and messages
-- cannot exist on a pending idea (038's join policy). The API conditions the
-- delete on the same two things, so an idea approved between the screen
-- loading and the tap is not withdrawn.
--
-- DOWN:
--   drop policy if exists "Authors withdraw a pending idea" on public.toy_ideas;
--   revoke delete on public.toy_ideas from authenticated;

grant delete on public.toy_ideas to authenticated;

create policy "Authors withdraw a pending idea"
  on public.toy_ideas for delete to authenticated
  using (author_id = auth.uid() and status = 'pending');
```

Run: `supabase migration up`. Guard row in `check-schema-guards.sh`:

```sql
  -- 107. A wider delete policy would let an author pull a live challenge and its thread.
  ('107 toy_ideas delete is the author''s, while pending',
   (select count(*) = 1 from pg_policies
      where schemaname = 'public' and tablename = 'toy_ideas' and cmd = 'DELETE'
        and qual like '%auth.uid()%' and qual like '%pending%'))
```

- [ ] **Step 4: The API**

In `packages/api/src/routes/toy-ideas.ts` add `import { INVALID_TEXT_REPRESENTATION } from '../supabase/pg-errors.js'`, and after `toyIdeas.get('/mine', …)`:

```ts
/**
 * The caller's own idea at any status, review_note included — the mobile
 * detail's fallback when the public read 404s a pending or rejected one, and
 * the source a revised idea starts from. 037's "Authors see their own ideas at
 * any status" is the check; the author filter keeps a published idea someone
 * else wrote from answering here.
 */
toyIdeas.get('/mine/:id', async (c) => {
  const { data, error } = await createUserClient(c.get('token'))
    .from('toy_ideas')
    .select('*')
    .eq('id', c.req.param('id'))
    .eq('author_id', c.get('userId'))
    .maybeSingle()
  if (error && error.code !== INVALID_TEXT_REPRESENTATION) return c.json({ error: error.message }, 500)
  if (!data) return c.json({ error: 'Not found' }, 404)
  return c.json(data)
})
```

and, before `export default toyIdeas`:

```ts
/**
 * Withdraw a pending idea (107). Conditioned on author and status in the
 * DELETE itself, so the policy and this route agree and a review that lands
 * mid-tap wins. A miss is told apart afterwards: the caller's own idea that
 * moved on is a 409 with a reason; anything else is not theirs to know about.
 */
toyIdeas.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const userId = c.get('userId')
  const client = createUserClient(c.get('token'))
  const { data, error } = await client
    .from('toy_ideas')
    .delete()
    .eq('id', id)
    .eq('author_id', userId)
    .eq('status', 'pending')
    .select('id')
  if (error && error.code !== INVALID_TEXT_REPRESENTATION) return c.json({ error: error.message }, 500)
  if (data?.length) return c.body(null, 204)
  const { data: own } = await client.from('toy_ideas').select('id').eq('id', id).eq('author_id', userId).maybeSingle()
  return own
    ? c.json({ error: 'Only an idea still waiting for review can be withdrawn.' }, 409)
    : c.json({ error: 'Not found' }, 404)
})
```

- [ ] **Step 5: Mobile**

`challenge-status.ts`, `challengePill`, first lines:

```ts
  // The author's own idea before it is public (challenge-author-states): the
  // board's stage words for pending and rejected.
  if (c.status === 'pending') return { status: 'pending', label: 'Waiting' }
  if (c.status === 'rejected') return { status: 'rejected', label: 'Declined' }
```

`detail-screen.tsx`:
- Imports: `ToyIdea` type, `useFlash, FlashLine` from `../ui/Flash`. State: `const [mine, setMine] = useState(false)`, `const [withdrawn, setWithdrawn] = useState(false)`. Move `const viewerId = caps?.profile.id ?? null` above the load effect.
- Replace the load effect's fetch (and its `PENDING(challenge-author-states)` comment):

```tsx
  useEffect(() => {
    let ignore = false
    apiClient
      .get<ToyIdeaDetail>(`/api/public/challenges/${id}`)
      .catch(async (err) => {
        // A pending or rejected idea 404s publicly. Its author reads it from
        // their own list instead (challenge-author-states); nobody else can.
        if (!viewerId) throw err
        const own = await apiClient.get<ToyIdea>(`/api/ideas/mine/${id}`)
        if (!ignore) setMine(true)
        return { ...own, author_name: caps?.profile.name ?? null, participants: [], maker_count: 0, answer_count: 0 } as ToyIdeaDetail
      })
      .then((data) => {
        if (!ignore) setChallenge(data)
      })
      .catch(() => {})
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [id, reloadKey, viewerId])
```

- `const isAuthor = viewerId !== null && (challenge?.author_id === viewerId || mine)`.
- Add, beside `leave()`:

```tsx
  async function withdraw() {
    setBusy(true)
    setActionError(null)
    try {
      await apiClient.delete(`/api/ideas/${id}`)
      setWithdrawn(true)
    } catch {
      setActionError('Could not withdraw this idea. Please try again.')
    } finally {
      setBusy(false)
    }
  }
```

- After the `if (loading)` block:

```tsx
  if (withdrawn) {
    return (
      <View style={styles.screen}>
        <EmptyState icon="arrow-undo-outline" title="Withdrawn — nothing was published" />
      </View>
    )
  }
```

- `headline`: add two leading cases:

```tsx
  const headline =
    challenge.status === 'pending'
      ? { title: 'An admin is reading it', body: 'Nothing is public yet. Most ideas are answered inside a week — approved, it opens as a challenge; if not, you get a reason.' }
      : challenge.status === 'rejected'
        ? { title: 'Not taken forward', body: 'An admin read it and decided it is not one for SPLAT. Nothing was published. The reason is below — a revised idea is welcome.' }
        : challenge.status === 'graduated'
          ? /* … the existing chain, unchanged … */
```

- Meta line: `{listed ? `Published ${shortDate(challenge.created_at)} · ${challenge.author_name ?? 'anonymous'}` : `Submitted ${shortDate(challenge.created_at)} · only you can see this`}` (`listed` must be computed before the return — move Task 3's `listed`/`tabs`/`badge` lines above `headline`).
- Action row: in the `isAuthor ?` branch render

```tsx
              challenge.status === 'pending' ? (
                <Button label="Withdraw the idea" variant="secondary" loading={busy} onPress={() => void withdraw()} />
              ) : challenge.status === 'rejected' ? (
                <Button label="Submit a revised idea" variant="accent" onPress={() => router.push(`/explore/challenges/new?from=${id}`)} />
              ) : (
                <Text style={styles.quiet}>This is your challenge.</Text>
              )
```

  and render the `SaveButton` only when `listed`.
- In the Status card, after the headline box:

```tsx
            {challenge.status === 'rejected' && challenge.review_note ? (
              <Text style={styles.note}>
                <Text style={styles.noteLead}>Why it was not taken forward: </Text>
                {challenge.review_note}
              </Text>
            ) : null}
```

  and wrap the stats row in `{listed ? (…) : null}`. Styles: `note: { padding: theme.spacing(3), borderRadius: 14, backgroundColor: theme.colors.apricotSoft, fontFamily: theme.fonts.regular, fontSize: 13.5, lineHeight: 20, color: theme.colors.ink }`, `noteLead: { fontFamily: theme.fonts.black }`.

`my-screen.tsx`, `IdeaRow`: delete `linkable` and its comment, `onPress={onOpen}`, `accessibilityHint="Opens the challenge."`. Update the comment above `openChallenge` if it says pending ideas cannot open.

`submit-idea-screen.tsx`: `export function SubmitIdeaScreen({ from }: { from?: string } = {})`, add `useEffect` to the react import, and:

```tsx
  // "Submit a revised idea" (challenge-author-states): start from the
  // rejected one. A new idea is filed; the old one stays as it was judged.
  useEffect(() => {
    if (!from) return
    apiClient
      .get<ToyIdea>(`/api/ideas/mine/${from}`)
      .then((idea) => {
        setDraft({ title: idea.title, summary: idea.summary, description: idea.description ?? '' })
        setKind(idea.kind ?? 'challenge')
        setPrefs(idea.contact_prefs)
        setPhoto(idea.photo_url ?? null)
      })
      .catch(() => {})
  }, [from])
```

`packages/mobile/app/(tabs)/explore/challenges/new.tsx`:

```tsx
// packages/mobile/app/(tabs)/explore/challenges/new.tsx
import { useLocalSearchParams } from 'expo-router'
import { SubmitIdeaScreen } from '../../../../components/challenges/submit-idea-screen'

export default function SubmitIdeaRoute() {
  const { from } = useLocalSearchParams<{ from?: string }>()
  return <SubmitIdeaScreen from={from} />
}
```

- [ ] **Step 6: Web**

`packages/web/components/idea-author-actions.tsx`:

```tsx
'use client'
/**
 * The author's two moves on their own idea before it is public
 * (challenge-author-states): withdraw it while pending, or start a revised one
 * once it is rejected. A rejected idea is never edited — the revised one is
 * new, so the thing an admin judged stays as it was.
 */
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ToyIdeaStatus } from '@splat-connect/types'
import { browserApiClient } from '@/lib/browser-api-client'
import { useToast } from '@/components/toast'

export function IdeaAuthorActions({ id, status }: { id: string; status: ToyIdeaStatus }) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (status === 'rejected') {
    return (
      <Link href={`/get-involved/submit-an-idea?from=${id}`} className="btn btn-coral min-h-11 px-[18px] text-sm">
        Submit a revised idea
      </Link>
    )
  }
  if (status !== 'pending') return null

  async function withdraw() {
    setBusy(true)
    setError(null)
    try {
      await browserApiClient.delete(`/api/ideas/${id}`)
      toast('Withdrawn — nothing was published')
      router.refresh()
    } catch {
      setError('Could not withdraw this idea. Please try again.')
      setBusy(false)
    }
  }

  return (
    <span className="flex flex-col gap-1.5">
      <button type="button" disabled={busy} onClick={withdraw} className="btn btn-quiet min-h-11 px-[18px] text-sm">
        Withdraw the idea
      </button>
      {error && (
        <span role="alert" className="text-[13px] text-[var(--bad)]">
          {error}
        </span>
      )}
    </span>
  )
}
```

`packages/web/app/dashboard/challenges/page.tsx`: import it; in `IdeaCard`, after the pending hint block, add `{!idea.joined && <IdeaAuthorActions id={idea.id} status={idea.status} />}`. (Pending and rejected cards are plain `div`s, never inside the `BoundaryLink`, so a button there is valid.) Update the file comment's "an unlinkable idea stays a plain card" to add "with the author's withdraw / revise action".

`packages/web/components/idea-form.tsx`: `export function IdeaForm({ initial }: { initial?: ToyIdea } = {})`, and seed state:

```tsx
  const [fields, setFields] = useState<Fields>(
    initial
      ? {
          kind: initial.kind ?? 'challenge',
          title: initial.title,
          summary: initial.summary,
          description: initial.description ?? '',
          contact_prefs: initial.contact_prefs,
        }
      : EMPTY_FIELDS
  )
  const [photo, setPhoto] = useState<string | null>(initial?.photo_url ?? null)
```

`packages/web/app/get-involved/submit-an-idea/page.tsx`: take `searchParams: Promise<{ from?: string }>`, and when signed in and `from` is set, `const initial = await apiClient.get<ToyIdea>(`/api/ideas/mine/${from}`).catch(() => undefined)` (import `apiClient` from `@/lib/api-client`); render `<IdeaForm initial={initial} />`.

- [ ] **Step 7: Run the tests to see them pass**

Run the three commands from Step 2 → PASS. `pnpm typecheck` → exit 0.

- [ ] **Step 8: Ship the item**

The `PENDING(challenge-author-states)` comment went in Step 5. Set `shipped: true`, `node scripts/pending.mjs`, drift test.

- [ ] **Step 9: Commit**

```bash
git status --short
git add supabase/migrations/107_idea_withdraw.sql packages/api/src/routes/toy-ideas.ts packages/mobile/components/challenges/detail-screen.tsx packages/mobile/components/challenges/challenge-status.ts packages/mobile/components/challenges/my-screen.tsx packages/mobile/components/challenges/submit-idea-screen.tsx "packages/mobile/app/(tabs)/explore/challenges/new.tsx" packages/web/components/idea-author-actions.tsx packages/web/app/dashboard/challenges/page.tsx packages/web/app/get-involved/submit-an-idea/page.tsx packages/web/components/idea-form.tsx scripts/check-schema-guards.sh packages/api/tests/integration/toy-ideas/withdraw.test.ts packages/web/tests/unit/components/idea-author-actions.test.tsx packages/web/tests/unit/pages/dashboard-challenges.test.tsx packages/web/tests/unit/components/idea-form.test.tsx packages/mobile/tests/unit/components/challenges/detail-screen.test.tsx packages/mobile/tests/unit/components/challenges/challenge-status.test.ts packages/mobile/tests/unit/components/challenges/my-screen.test.tsx packages/mobile/tests/unit/components/challenges/submit-idea-screen.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(ideas): the author sees their pending or rejected idea, withdraws or revises it (107)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 10: Post anonymously (`idea-anonymous`, migration 108)

**Files:**
- Create: `supabase/migrations/108_idea_anonymous.sql`
- Modify: `packages/api/src/routes/toy-ideas.ts` (`readIdeaBody`), `packages/api/src/routes/public.ts` (detail, `writingUp`)
- Modify: `packages/types/src/index.ts` (`ToyIdea.anonymous`, `ToyIdeaDetail.author_id`)
- Modify: `packages/mobile/components/challenges/submit-idea-screen.tsx`, `detail-screen.tsx`
- Modify: `packages/web/components/idea-form.tsx`, `packages/web/app/get-involved/design-challenges/[id]/page.tsx`
- Modify: `scripts/check-schema-guards.sh`, `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/api/tests/integration/toy-ideas/anonymous.test.ts` (new); `packages/mobile/tests/unit/components/challenges/{submit-idea-screen,detail-screen}.test.tsx`, `packages/web/tests/unit/components/idea-form.test.tsx`, `packages/web/tests/unit/pages/challenge-detail.test.tsx`

**Interfaces:**
- Consumes: `readIdeaBody(body, userId)` (Task 7); `writingUp` (Task 5); `GET /api/ideas/mine/:id` and the mobile `mine` flag (Task 9).
- Produces: `toy_ideas.anonymous boolean not null default false` (anon may read it; anon may no longer read `author_id`). `POST /api/ideas` takes `anonymous: boolean` (anything else → 400). The public detail returns `author_name: null` and `author_id: null` when anonymous, and `writingUp(admin, idea, hideAuthor)` returns null when the writer is the anonymous author. `ToyIdeaDetail extends Omit<ToyIdea, 'author_id'>` with `author_id: string | null`.

Spec vs code: hiding the name alone would not hide the author — 040 grants anon `author_id`, and the API returns it. 108 revokes `author_id` from anon (every policy that reads it is `to authenticated`: 038/041/042) and the detail drops it. Signed-in readers keep 037's table grant, and the thread's `sender_id` still identifies the author to participants; flagged for Byron.

Copy: "Post anonymously" (MB); "Post this anonymously. Your name will not appear on the challenge." (WB); meta "Published {date} · anonymous" (MB, already the mobile fallback); web's existing "submitted anonymously" / "Anonymous".

- [ ] **Step 1: Write the failing tests**

`packages/api/tests/integration/toy-ideas/anonymous.test.ts`:

```ts
/**
 * 108: an anonymous idea's author never leaves the API on a public read —
 * not the name, not the id — while admins and the author still see both.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let author: TestUser
let admin: TestUser
let ideaId: string
const NAME = `Anon Author ${Date.now()}`
const anon = () => createClient(process.env.SUPABASE_URL ?? 'http://localhost:54321', process.env.SUPABASE_ANON_KEY ?? '')

beforeAll(async () => {
  author = await createTestUser('contributor')
  admin = await createTestUser('admin')
  await adminClient().from('profiles').update({ name: NAME }).eq('id', author.id)
  const res = await app.request('/api/ideas', {
    method: 'POST',
    headers: { Authorization: `Bearer ${author.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Quiet', summary: 'S', anonymous: true }),
  })
  ideaId = ((await res.json()) as { id: string }).id
  await adminClient().from('toy_ideas').update({ status: 'challenge' }).eq('id', ideaId)
})

afterAll(async () => {
  await adminClient().from('toy_ideas').delete().eq('id', ideaId)
  await deleteTestUser(author.id)
  await deleteTestUser(admin.id)
})

describe('108 idea anonymous', () => {
  it('stores the choice', async () => {
    const { data } = await adminClient().from('toy_ideas').select('anonymous').eq('id', ideaId).single()
    expect(data!.anonymous).toBe(true)
  })

  it('refuses an anonymous flag that is not true or false', async () => {
    const res = await app.request('/api/ideas', {
      method: 'POST',
      headers: { Authorization: `Bearer ${author.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'T', summary: 'S', anonymous: 'yes' }),
    })
    expect(res.status).toBe(400)
  })

  it('never puts the author on the public brief or the public list', async () => {
    const detail = await (await app.request(`/api/public/challenges/${ideaId}`)).text()
    expect(JSON.parse(detail)).toMatchObject({ author_name: null, author_id: null, anonymous: true })
    const list = await (await app.request('/api/public/challenges')).text()
    for (const body of [detail, list]) {
      expect(body).not.toContain(author.id)
      expect(body).not.toContain(NAME)
    }
  })

  it('lets anon read the flag but not the author id, straight from the table', async () => {
    expect((await anon().from('toy_ideas').select('anonymous').eq('id', ideaId).single()).error).toBeNull()
    expect((await anon().from('toy_ideas').select('author_id').eq('id', ideaId).single()).error).not.toBeNull()
  })

  it('still names the author to an admin and to the author', async () => {
    const queue = (await (
      await app.request('/api/admin/ideas', { headers: { Authorization: `Bearer ${admin.token}` } })
    ).json()) as { id: string; author_id: string }[]
    expect(queue.find((i) => i.id === ideaId)?.author_id).toBe(author.id)
    const own = await app.request(`/api/ideas/mine/${ideaId}`, { headers: { Authorization: `Bearer ${author.token}` } })
    expect(own.status).toBe(200)
  })
})
```

Mobile `submit-idea-screen.test.tsx` append:

```tsx
  it('posts anonymously when asked to', async () => {
    render(<SubmitIdeaScreen />)
    fillEverything()
    fireEvent.press(screen.getByRole('checkbox', { name: 'Post anonymously' }))
    fireEvent.press(screen.getByRole('button', { name: 'Submit idea' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/ideas', expect.objectContaining({ anonymous: true })))
  })
```

and add `anonymous: false` to the two exact `toHaveBeenCalledWith('/api/ideas', {…})` bodies from Task 1.

Mobile `detail-screen.test.tsx` append:

```tsx
  it('reads an anonymous challenge as anonymous, and still knows its own author', async () => {
    mockUseCapabilities.mockReturnValue(viewer('author1'))
    mockGet.mockImplementation((path: string) =>
      path === '/api/ideas/mine/c1'
        ? Promise.resolve(detail())
        : Promise.resolve(detail({ author_id: null, author_name: null, anonymous: true }))
    )
    render(<ChallengeDetailScreen id="c1" />)
    expect(await screen.findByText(/· anonymous$/)).toBeTruthy()
    expect(await screen.findByText('This is your challenge.')).toBeTruthy()
  })
```

Web `idea-form.test.tsx` append:

```tsx
  it('posts anonymously when the box is ticked', async () => {
    render(<IdeaForm />)
    fireEvent.change(screen.getByLabelText(/^title$/i), { target: { value: 'T' } })
    fireEvent.change(screen.getByLabelText(/^summary$/i), { target: { value: 'S' } })
    fireEvent.click(screen.getByLabelText('Post this anonymously. Your name will not appear on the challenge.'))
    fireEvent.click(screen.getByRole('button', { name: /submit for review/i }))
    await waitFor(() => expect(browserApiClient.post).toHaveBeenCalledWith('/api/ideas', expect.objectContaining({ anonymous: true })))
  })
```

Web `challenge-detail.test.tsx` — add `import { apiClient } from '@/lib/api-client'` and append inside the describe:

```tsx
  it('shows an anonymous challenge as anonymous, and lets its author see it is theirs', async () => {
    vi.mocked(getCapabilities).mockResolvedValue({ profile: { id: 'a1', name: 'Priya' } } as never)
    vi.mocked(apiClient.get).mockResolvedValue({ id: 'c1' })
    serve(brief({ author_id: null, author_name: null, anonymous: true }))
    await renderPage()
    expect(screen.getByText(/submitted anonymously/)).toBeInTheDocument()
    expect(screen.getByText('You have joined')).toBeInTheDocument()
    expect(apiClient.get).toHaveBeenCalledWith('/api/ideas/mine/c1')
  })
```

(The author counts as joined on web — `joined` covers the author, as it already does by id.)

- [ ] **Step 2: Run them to see them fail**

Run the integration file → FAIL (`column toy_ideas.anonymous does not exist`). Run the four unit files → FAIL.

- [ ] **Step 3: The migration**

`supabase/migrations/108_idea_anonymous.sql`:

```sql
-- 108 — post an idea anonymously (idea-anonymous).
--
-- The public brief leaves the author off when this is set; admins and the
-- author still see them. Hiding the name alone would not hide the author: 040
-- granted anon author_id, and a profile id is a name one call away. Nothing
-- anon reads needs it — every policy that tests toy_ideas.author_id is
-- `to authenticated` (038, 041, 042) — so it leaves anon's grant here.
-- Signed-in readers keep 037's table grant (flagged, not fixed: narrowing it
-- breaks /mine's author filter).
--
-- DOWN:
--   grant select (author_id) on public.toy_ideas to anon;
--   revoke select (anonymous) on public.toy_ideas from anon;
--   alter table public.toy_ideas drop column if exists anonymous;

alter table public.toy_ideas add column anonymous boolean not null default false;

grant select (anonymous) on public.toy_ideas to anon;
revoke select (author_id) on public.toy_ideas from anon;
```

Run: `supabase migration up`. Guard row:

```sql
  -- 108. With author_id readable, "anonymous" is a name one PostgREST call away.
  ('108 anon cannot read toy_ideas.author_id',
   (select not has_column_privilege('anon', 'public.toy_ideas', 'author_id', 'select')))
```

- [ ] **Step 4: The API**

`readIdeaBody`, before `return out`:

```ts
  // 108: true or false, nothing else — a typo must not publish a name.
  const anonymous = source.anonymous ?? false
  if (typeof anonymous !== 'boolean') return null
  out.anonymous = anonymous
```

`public.ts`:
- Detail select: append `, anonymous`.
- `writingUp` gains the author rule:

```ts
async function writingUp(
  admin: ReturnType<typeof createAdminClient>,
  idea: { status: string; tutorial_id: string | null; author_id: string },
  hideAuthor: boolean
) {
  // … unchanged up to `const id = primary.profile_id as string`, then:
  // An anonymous author is not named here either (108).
  if (hideAuthor && id === idea.author_id) return null
```

- The response:

```ts
  const { profiles, ...rest } = idea as Record<string, any>
  const hidden = rest.anonymous === true
  return c.json({
    ...rest,
    ...counts.get(idea.id),
    // 108: no name and no id for an anonymous author — the id is a name one
    // call away. The author recognises their own through /api/ideas/mine/:id.
    author_id: hidden ? null : rest.author_id,
    author_name: hidden ? null : profiles?.name ?? null,
    writing_up: await writingUp(admin, rest as { status: string; tutorial_id: string | null; author_id: string }, hidden),
    participants: /* unchanged */,
  })
```

Types: `ToyIdea` gains `/** 108: no name on the public brief. */ anonymous?: boolean`; `ToyIdeaDetail`:

```ts
export interface ToyIdeaDetail extends Omit<ToyIdea, 'author_id'>, Partial<ChallengeCounts> {
  /** Null on an anonymous challenge (108). */
  author_id: string | null
```

- [ ] **Step 5: Mobile**

`submit-idea-screen.tsx`: state `const [anonymous, setAnonymous] = useState(false)`; post `anonymous`; in the revise effect add `setAnonymous(idea.anonymous ?? false)`. Replace `<PendingRow pending="idea-anonymous" … />` with:

```tsx
              <Pressable
                onPress={() => setAnonymous((v) => !v)}
                accessibilityRole="checkbox"
                accessibilityLabel="Post anonymously"
                accessibilityState={{ checked: anonymous }}
                style={styles.checkRow}
              >
                <Ionicons name={anonymous ? 'checkbox' : 'square-outline'} size={22} color={theme.colors.ink} />
                <Text style={styles.checkText}>Post anonymously</Text>
              </Pressable>
```

Import `Ionicons` from `@expo/vector-icons`; drop the now-empty `../ui/pending` import. Styles `checkRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2), minHeight: 44 }`, `checkText: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.text }`.

`detail-screen.tsx`, after the load effect:

```tsx
  // An anonymous challenge comes back with no author_id (108). Its author
  // still owns it here — the thread, the controls — through their own list.
  useEffect(() => {
    if (!viewerId || !challenge || challenge.author_id !== null) return
    let ignore = false
    apiClient
      .get(`/api/ideas/mine/${id}`)
      .then(() => {
        if (!ignore) setMine(true)
      })
      .catch(() => {})
    return () => {
      ignore = true
    }
  }, [viewerId, challenge, id])
```

- [ ] **Step 6: Web**

`idea-form.tsx`: state `const [anonymous, setAnonymous] = useState(initial?.anonymous ?? false)`; post `anonymous`; before the error line:

```tsx
      <label className="flex items-start gap-3 text-sm text-ink">
        <input type="checkbox" className="field-check mt-0.5" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
        Post this anonymously. Your name will not appear on the challenge.
      </label>
```

`design-challenges/[id]/page.tsx` (it already imports nothing from `@/lib/api-client` — add `import { apiClient } from '@/lib/api-client'`), after `const viewerId = …`:

```tsx
  // 108: an anonymous brief carries no author_id; the author still owns it.
  const own =
    viewerId !== null && challenge.author_id === null
      ? await apiClient.get(`/api/ideas/mine/${challenge.id}`).then(() => true, () => false)
      : false
  const authorId = challenge.author_id ?? (own ? viewerId : null)
```

`joined` becomes `viewerId !== null && (viewerId === authorId || challenge.participants.some((p) => p.profile_id === viewerId))`, and `<ChallengeThread … authorId={authorId ?? ''} />` (an empty id matches no sender, which is the point for everyone but the author).

- [ ] **Step 7: Run the tests to see them pass**

Run the integration file and the four unit files → PASS. Re-run `tests/integration/toy-ideas/idea-lifecycle.test.ts` and `maker-meta.test.ts` → PASS. `pnpm typecheck` → exit 0 (fix any `author_id` consumer the compiler names by reading `authorId`, not by casting).

- [ ] **Step 8: Ship the item**

The `pending="idea-anonymous"` row went in Step 5. Set `shipped: true`, `node scripts/pending.mjs`, drift test.

- [ ] **Step 9: Commit**

```bash
git status --short
git add supabase/migrations/108_idea_anonymous.sql packages/api/src/routes/toy-ideas.ts packages/api/src/routes/public.ts packages/types/src/index.ts packages/mobile/components/challenges/submit-idea-screen.tsx packages/mobile/components/challenges/detail-screen.tsx packages/web/components/idea-form.tsx "packages/web/app/get-involved/design-challenges/[id]/page.tsx" scripts/check-schema-guards.sh packages/api/tests/integration/toy-ideas/anonymous.test.ts packages/mobile/tests/unit/components/challenges/submit-idea-screen.test.tsx packages/mobile/tests/unit/components/challenges/detail-screen.test.tsx packages/web/tests/unit/components/idea-form.test.tsx packages/web/tests/unit/pages/challenge-detail.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(ideas): post an idea anonymously; no name or id leaves a public read (108)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 11: Following a challenge while it is written up (`challenge-writeup-stage`, migration 109)

**Files:**
- Create: `supabase/migrations/109_challenge_guide_published.sql`, `packages/web/components/follow-writeup.tsx`
- Modify: `packages/api/src/routes/saves.ts` (saved challenges include graduated)
- Modify: `packages/types/src/index.ts` (`NotificationType`, bucket, `COPY`)
- Modify: `packages/mobile/components/challenges/detail-screen.tsx`, `packages/mobile/lib/notifications.ts` (`linkFor`)
- Modify: `packages/web/app/get-involved/design-challenges/[id]/page.tsx`, `packages/web/components/notifications-list.tsx` (`ICON`, `linkFor`)
- Modify: `scripts/check-schema-guards.sh`, `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/api/tests/integration/toy-ideas/writeup.test.ts`, `packages/web/tests/unit/components/follow-writeup.test.tsx` (new); `packages/mobile/tests/unit/components/challenges/detail-screen.test.tsx`, `packages/mobile/tests/unit/lib/notifications.test.ts`, `packages/web/tests/unit/lib/notification-bucket.test.ts`, `packages/web/tests/unit/pages/challenge-detail.test.tsx`

**Interfaces:**
- Consumes: `ToyIdeaDetail.writing_up` (Task 5, anonymous-safe since Task 10); `useSaves` (mobile); `POST /api/saves` (044).
- Produces: notification type `challenge_guide_published` (subject `tutorial_id`, title in `tutorial_title`, actor `SPLAT`), bucket `challenges`. Trigger `tutorials_challenge_guide_published` (AFTER UPDATE OF status ON tutorials, when it becomes `approved`) calling SECURITY DEFINER `public.notify_challenge_guide_published()`: one row per account that saved a challenge whose `tutorial_id` is the guide, skipping the guide's contributors and anyone already told. `GET /api/saves/challenges` lists `challenge` and `graduated` ideas. `FollowWriteup({ id, signedIn, next })` on web.

Spec vs code: the guide is approved by two routes (`admin.ts` PATCH `/tutorials/:id/status`, `tutorial-orgs.ts` POST `/:id/review`), so the notification is a trigger both pass through, not route code. 077's one-subject check already admits `tutorial_id`; only the type check changes.

Copy: head "Somebody solved it"; body MB "A maker is turning the solution into a guide. The brief stays up, with the guide linked once it is approved." (web already shows WB's longer line); card "{maker} is writing this up" / MB "Started {date}. The draft still goes through review before a family sees it.", WB "Started {date}. Graduating created a draft guide, not a published one — it goes through review like any other before a family sees it."; button "Follow the write-up"; toast "You will be told when the guide is published" (MB, WB). Notification line `The guide from a challenge you follow is published: "{title}"` (no board — flagged). Web follow failure reuses "That did not go through. Try once more." (makers-wanted-board).

- [ ] **Step 1: Write the failing tests**

`packages/api/tests/integration/toy-ideas/writeup.test.ts`:

```ts
/**
 * 109: everyone who saved a challenge hears when the guide it became is
 * published — once, whichever route approved it, and never a contributor.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let author: TestUser
let saver: TestUser
let contributorSaver: TestUser
let admin: TestUser
let ideaId: string
let tutorialId: string

const told = async (u: TestUser) =>
  (
    await adminClient()
      .from('notifications')
      .select('id, tutorial_title')
      .eq('recipient_id', u.id)
      .eq('type', 'challenge_guide_published')
      .eq('tutorial_id', tutorialId)
  ).data ?? []
const approve = (status: string) =>
  app.request(`/api/admin/tutorials/${tutorialId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${admin.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })

beforeAll(async () => {
  ;[author, saver, contributorSaver, admin] = await Promise.all([
    createTestUser('contributor'), createTestUser('contributor'), createTestUser('contributor'), createTestUser('admin'),
  ])
  const db = adminClient()
  tutorialId = (await db.from('tutorials').insert({ title: 'Bubble guide', description: 'D', difficulty: 'easy', status: 'pending' }).select('id').single()).data!.id
  ideaId = (
    await db.from('toy_ideas').insert({ author_id: author.id, title: 'T', summary: 'S', status: 'graduated', tutorial_id: tutorialId }).select('id').single()
  ).data!.id
  await db.from('tutorial_contributors').insert({ tutorial_id: tutorialId, profile_id: contributorSaver.id, role: 'collaborator' })
  await db.from('saves').insert([
    { profile_id: saver.id, entity_type: 'challenge', entity_id: ideaId },
    { profile_id: contributorSaver.id, entity_type: 'challenge', entity_id: ideaId },
  ])
})

afterAll(async () => {
  const db = adminClient()
  await db.from('saves').delete().eq('entity_id', ideaId)
  await db.from('toy_ideas').delete().eq('id', ideaId)
  await db.from('notifications').delete().eq('tutorial_id', tutorialId)
  await db.from('tutorials').delete().eq('id', tutorialId)
  await Promise.all([author, saver, contributorSaver, admin].map((u) => deleteTestUser(u.id)))
})

describe('109 challenge guide published', () => {
  it('keeps a graduated challenge on its saver’s list', async () => {
    const res = await app.request('/api/saves/challenges', { headers: { Authorization: `Bearer ${saver.token}` } })
    expect(((await res.json()) as { id: string }[]).map((c) => c.id)).toContain(ideaId)
  })

  it('tells the saver once the guide is approved, and not the contributor who saved it', async () => {
    expect((await approve('approved')).status).toBe(200)
    expect(await told(saver)).toEqual([expect.objectContaining({ tutorial_title: 'Bubble guide' })])
    expect(await told(contributorSaver)).toEqual([])
  })

  it('does not tell them twice when the guide is approved again', async () => {
    await approve('pending')
    await approve('approved')
    expect(await told(saver)).toHaveLength(1)
  })

  it('fires on any approval, not just the admin route', async () => {
    const db = adminClient()
    await db.from('notifications').delete().eq('tutorial_id', tutorialId)
    await db.from('tutorials').update({ status: 'pending' }).eq('id', tutorialId)
    await db.from('tutorials').update({ status: 'approved' }).eq('id', tutorialId)
    expect(await told(saver)).toHaveLength(1)
  })
})
```

`packages/web/tests/unit/components/follow-writeup.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { FollowWriteup } from '@/components/follow-writeup'
import { browserApiClient } from '@/lib/browser-api-client'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { post: vi.fn() } }))

describe('FollowWriteup', () => {
  it('saves the challenge and says what happens next, on the page', async () => {
    vi.mocked(browserApiClient.post).mockResolvedValue(undefined)
    render(<FollowWriteup id="c1" signedIn next="/get-involved/design-challenges/c1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Follow the write-up' }))
    await waitFor(() =>
      expect(browserApiClient.post).toHaveBeenCalledWith('/api/saves', { entity_type: 'challenge', entity_id: 'c1' })
    )
    expect(await screen.findByText('You will be told when the guide is published')).toBeInTheDocument()
  })

  it('sends a signed-out reader to sign in first', () => {
    render(<FollowWriteup id="c1" signedIn={false} next="/get-involved/design-challenges/c1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Follow the write-up' }))
    expect(push).toHaveBeenCalledWith('/login?next=%2Fget-involved%2Fdesign-challenges%2Fc1')
  })
})
```

In `challenge-detail.test.tsx` append:

```tsx
  it('names who is writing a graduated challenge up', async () => {
    serve(brief({ status: 'graduated', writing_up: { profile_id: 'p1', name: 'Tom Beattie', started_at: '2026-09-02T03:00:00Z' } }))
    await renderPage()
    expect(screen.getByText('Tom Beattie is writing this up')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Follow the write-up' })).toBeInTheDocument()
  })
```

In mobile `detail-screen.test.tsx`, replace 'closes joining on a graduated challenge and points at the guide it became' with:

```tsx
  it('offers to follow a graduated challenge’s write-up, and names who is writing it', async () => {
    mockGet.mockResolvedValue(
      detail({
        status: 'graduated',
        tutorial_id: 'tut7',
        writing_up: { profile_id: 'p1', name: 'Tom Beattie', started_at: '2026-09-02T03:00:00Z' },
      })
    )
    render(<ChallengeDetailScreen id="c1" />)
    expect(await screen.findByText('Somebody solved it')).toBeTruthy()
    expect(screen.getByText('Tom Beattie is writing this up')).toBeTruthy()
    expect(screen.getByText('Started 2 Sep. The draft still goes through review before a family sees it.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Join this challenge' })).toBeNull()
    fireEvent.press(screen.getByRole('button', { name: 'Follow the write-up' }))
    await waitFor(() => expect(mockToggle).toHaveBeenCalledWith('challenges', 'c1'))
    expect(await screen.findByText('You will be told when the guide is published')).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Read the guide' }))
    expect(mockPush).toHaveBeenCalledWith('/guides/tut7')
  })
```

In `packages/mobile/tests/unit/lib/notifications.test.ts`, inside `describe('linkFor')`:

```ts
  it('opens the published guide for a followed challenge', () => {
    expect(linkFor(notification({ type: 'challenge_guide_published', tutorial_id: 't9' }))).toBe('/guides/t9')
  })
```

In `packages/web/tests/unit/lib/notification-bucket.test.ts`: raise the `NOTIFICATION_TYPES.length` expectation by one from whatever it is when you start (30 at the time of writing → 31), and in 'buckets ideas and challenges together' add `expect(notificationBucket('challenge_guide_published')).toBe('challenges')`.

- [ ] **Step 2: Run them to see them fail**

Run the integration file → FAIL (the saved list leaves the graduated idea out; no notification). Run the two web component/page files, the mobile detail and notifications tests, and the bucket test → FAIL.

- [ ] **Step 3: The migration**

Before writing it: `grep -ln "notifications_type_check" supabase/migrations/*.sql | sort | tail -1`. If it prints anything after `093_tutorial_notes.sql`, copy THAT file's list into both lists below and keep the one new value.

`supabase/migrations/109_challenge_guide_published.sql`:

```sql
-- 109 — tell the people following a challenge when its guide is published
-- (challenge-writeup-stage).
--
-- "Follow the write-up" saves the challenge (044). When the guide a challenge
-- graduated into is approved, every account that saved the challenge gets
-- challenge_guide_published — except the guide's own contributors, who get
-- tutorial_approved already, and anyone told before (a guide can go back to
-- review after an edit and be approved again).
--
-- A trigger, not route code: a guide is approved by an admin (admin.ts) or by
-- a backing organisation's leader under their own JWT (tutorial-orgs.ts), and
-- this is the one place both pass through. SECURITY DEFINER because the
-- leader's session can read neither other people's saves (044) nor write
-- their notifications.
--
-- Subject: tutorial_id, title in tutorial_title — 077's one-subject check
-- already admits it, so only the type check is recreated.
--
-- DOWN:
--   drop trigger if exists tutorials_challenge_guide_published on public.tutorials;
--   drop function if exists public.notify_challenge_guide_published();
--   (restore 093's notifications_type_check)

-- 046's guard, again: abort rather than drop a type the live constraint allows.
do $$
declare
  def  text;
  lost text;
begin
  select pg_get_constraintdef(oid) into def
    from pg_constraint
   where conname = 'notifications_type_check' and conrelid = 'public.notifications'::regclass;
  if def is null then raise exception 'notifications_type_check is absent'; end if;
  select string_agg(distinct m[1], ', ') into lost
    from regexp_matches(def, '''([a-z_]+)''', 'g') as m
   where m[1] not in (
     'collaborator_invited', 'collaborator_accepted', 'collaborator_declined',
     'collaborator_removed', 'collaborator_left',
     'tutorial_approved', 'tutorial_rejected',
     'toy_request', 'toy_accepted', 'toy_rejected', 'toy_withdrawn', 'toy_message',
     'idea_approved', 'idea_rejected',
     'challenge_joined', 'challenge_left', 'challenge_removed',
     'idea_graduated', 'backing_requested', 'tutorial_submitted',
     'build_shot_posted', 'build_approved', 'print_started', 'print_ready',
     'tutorial_thanked',
     'org_event_published', 'org_story_published', 'org_message', 'org_thanked',
     'tutorial_noted',
     'challenge_guide_published'
   );
  if lost is not null then
    raise exception 'live notifications_type_check permits values 109 would drop: %', lost;
  end if;
end $$;

alter table public.notifications drop constraint notifications_type_check;

alter table public.notifications add constraint notifications_type_check
  check (type in (
    'collaborator_invited', 'collaborator_accepted', 'collaborator_declined',
    'collaborator_removed', 'collaborator_left',
    'tutorial_approved', 'tutorial_rejected',
    'toy_request', 'toy_accepted', 'toy_rejected', 'toy_withdrawn', 'toy_message',
    'idea_approved', 'idea_rejected',
    'challenge_joined', 'challenge_left', 'challenge_removed',
    'idea_graduated', 'backing_requested', 'tutorial_submitted',
    'build_shot_posted', 'build_approved', 'print_started', 'print_ready',
    'tutorial_thanked',
    'org_event_published', 'org_story_published', 'org_message', 'org_thanked',
    'tutorial_noted',
    -- new in 109
    'challenge_guide_published'
  ));

create or replace function public.notify_challenge_guide_published()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.notifications (recipient_id, type, tutorial_id, tutorial_title, actor_name)
  select distinct s.profile_id, 'challenge_guide_published', new.id, new.title, 'SPLAT'
    from public.toy_ideas i
    join public.saves s on s.entity_type = 'challenge' and s.entity_id = i.id
   where i.tutorial_id = new.id
     and not exists (
       select 1 from public.tutorial_contributors c
        where c.tutorial_id = new.id and c.profile_id = s.profile_id)
     and not exists (
       select 1 from public.notifications n
        where n.recipient_id = s.profile_id and n.type = 'challenge_guide_published' and n.tutorial_id = new.id);
  return new;
end
$$;

revoke execute on function public.notify_challenge_guide_published() from public, anon, authenticated;

create trigger tutorials_challenge_guide_published
  after update of status on public.tutorials
  for each row
  when (new.status = 'approved' and old.status is distinct from 'approved')
  execute function public.notify_challenge_guide_published();
```

Run: `supabase migration up`. Guard rows:

```sql
  -- 109. The 046 shape: a narrower constraint drops every follower notification silently.
  ('109 notifications_type_check permits challenge_guide_published',
   (select count(*) = 1 from pg_constraint
      where conname = 'notifications_type_check'
        and pg_get_constraintdef(oid) like '%challenge_guide_published%')),

  -- 109. Without the trigger, "You will be told" is a promise nobody keeps.
  ('109 tutorials_challenge_guide_published trigger exists',
   (select count(*) = 1 from pg_trigger
      where tgname = 'tutorials_challenge_guide_published' and tgrelid = 'public.tutorials'::regclass))
```

- [ ] **Step 4: The API and the types**

`packages/api/src/routes/saves.ts`: add `in(column: string, values: string[]): EntityQuery` to `type EntityQuery`, and the challenges source:

```ts
  challenges: {
    table: 'toy_ideas',
    // GET /public/challenges' columns, never '*': review_note is an admin's
    // private rejection reasoning, and a saved list is no wider than its page.
    select: 'id, title, summary, contact_prefs, status, kind, answered_at, created_at',
    // Graduated too: "Follow the write-up" is a save on a graduated challenge.
    filter: (q: EntityQuery) => q.in('status', ['challenge', 'graduated']),
  },
```

`packages/types/src/index.ts`: add `| 'challenge_guide_published'` to `NotificationType`; `challenge_guide_published: 'challenges',` to `NOTIFICATION_BUCKET`; to `COPY`:

```ts
  // 109: to everyone who followed the write-up. The guide's own contributors
  // get tutorial_approved instead.
  challenge_guide_published: (n) => `The guide from a challenge you follow is published: "${n.tutorial_title}"`,
```

`packages/web/components/notifications-list.tsx`: `challenge_guide_published: [Check, 'var(--tok)'],` in `ICON`, and in `linkFor`, beside the `tutorial_noted` line: `if (n.type === 'challenge_guide_published' && n.tutorial_id) return `/tutorials/${n.tutorial_id}``. `packages/mobile/lib/notifications.ts`, beside its `tutorial_noted` line: `if (n.type === 'challenge_guide_published' && n.tutorial_id) return `/guides/${n.tutorial_id}``.

- [ ] **Step 5: Mobile**

`detail-screen.tsx`:
- `const [flash, setFlash] = useFlash()` (import `useFlash, FlashLine` if Task 9 did not already).
- The graduated headline (inside the existing chain) becomes `{ title: 'Somebody solved it', body: 'A maker is turning the solution into a guide. The brief stays up, with the guide linked once it is approved.' }` and the `// PENDING(challenge-writeup-stage): …` comment goes.
- Add:

```tsx
  // "Follow the write-up" is a save (challenge-writeup-stage): 109 tells every
  // saver when the guide is published. Never unsaves — following twice is fine.
  async function follow() {
    if (!saves.isSaved('challenges', id)) await saves.toggle('challenges', id)
    setFlash('You will be told when the guide is published')
  }
```

- In the action row, the last branch (`<Text style={styles.quiet}>This challenge has moved on to write-up…</Text>`) becomes:

```tsx
            ) : challenge.status === 'graduated' ? (
              <Button label="Follow the write-up" onPress={() => void follow()} />
            ) : (
              <Text style={styles.quiet}>
                This challenge has moved on to write-up, so joining is no longer open.
              </Text>
            )}
```

  and `<FlashLine message={flash} />` goes directly under the action row.
- In the Status card, after the headline box:

```tsx
            {challenge.status === 'graduated' && challenge.writing_up ? (
              <View style={styles.makerRow}>
                <Text style={styles.makerName}>{`${challenge.writing_up.name} is writing this up`}</Text>
                <Text style={styles.eventDate}>
                  {`Started ${shortDate(challenge.writing_up.started_at)}. The draft still goes through review before a family sees it.`}
                </Text>
              </View>
            ) : null}
```

- [ ] **Step 6: Web**

`packages/web/components/follow-writeup.tsx`:

```tsx
'use client'
/**
 * "Follow the write-up" on a graduated challenge (challenge-writeup-stage). A
 * save under another name: 109 tells every saver when the guide is published.
 * Says so inline — the public challenge page has no toast host.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { NotePencil } from '@phosphor-icons/react/dist/ssr'
import { browserApiClient } from '@/lib/browser-api-client'

export function FollowWriteup({ id, signedIn, next }: { id: string; signedIn: boolean; next: string }) {
  const router = useRouter()
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function follow() {
    if (!signedIn) return router.push(`/login?next=${encodeURIComponent(next)}`)
    setError(null)
    try {
      await browserApiClient.post('/api/saves', { entity_type: 'challenge', entity_id: id })
      setDone(true)
    } catch {
      setError('That did not go through. Try once more.')
    }
  }

  return (
    <span className="flex flex-col items-start gap-1.5">
      <button type="button" onClick={follow} className="btn btn-primary min-h-12 px-[22px] text-[15px]">
        <NotePencil weight="bold" aria-hidden="true" /> Follow the write-up
      </button>
      {done && (
        <span role="status" className="text-[13px] font-bold text-muted">
          You will be told when the guide is published
        </span>
      )}
      {error && (
        <span role="alert" className="text-[13px] text-[var(--bad)]">
          {error}
        </span>
      )}
    </span>
  )
}
```

`design-challenges/[id]/page.tsx`: import it; in the header buttons replace `{graduated ? null : joined ? (` with `{graduated ? (<FollowWriteup id={challenge.id} signedIn={viewerId !== null} next={base} />) : joined ? (`. In the status tab, after the tinted head box:

```tsx
              {graduated && challenge.writing_up && (
                <div className="flex items-start gap-3 rounded-[18px] border border-line bg-[var(--canvas)] p-4">
                  <span
                    aria-hidden="true"
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--tcoral)] text-[15px] font-extrabold text-[var(--tink)]"
                  >
                    {initials(challenge.writing_up.name, '?')}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-extrabold">{challenge.writing_up.name} is writing this up</span>
                    <span className="mt-1 block text-sm leading-[1.5] text-muted">
                      Started {new Date(challenge.writing_up.started_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}.
                      {' '}Graduating created a draft guide, not a published one — it goes through review like any other
                      before a family sees it.
                    </span>
                  </span>
                </div>
              )}
```

- [ ] **Step 7: Run the tests to see them pass**

Run every command from Step 2 → PASS. Also `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/saves/saves.test.ts` → PASS.

- [ ] **Step 8: Ship the item**

Set `shipped: true` on `'challenge-writeup-stage'`, `node scripts/pending.mjs`, drift test.

- [ ] **Step 9: Commit**

```bash
git status --short
git add supabase/migrations/109_challenge_guide_published.sql packages/api/src/routes/saves.ts packages/types/src/index.ts packages/mobile/components/challenges/detail-screen.tsx packages/mobile/lib/notifications.ts packages/web/components/follow-writeup.tsx "packages/web/app/get-involved/design-challenges/[id]/page.tsx" packages/web/components/notifications-list.tsx scripts/check-schema-guards.sh packages/api/tests/integration/toy-ideas/writeup.test.ts packages/web/tests/unit/components/follow-writeup.test.tsx packages/web/tests/unit/pages/challenge-detail.test.tsx packages/web/tests/unit/lib/notification-bucket.test.ts packages/mobile/tests/unit/components/challenges/detail-screen.test.tsx packages/mobile/tests/unit/lib/notifications.test.ts packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(challenges): follow the write-up, and hear when the guide is published (109)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 12: Named constraints on a challenge (`challenge-constraints`, migration 110)

**Files:**
- Create: `supabase/migrations/110_idea_constraints.sql`
- Modify: `packages/api/src/routes/toy-ideas.ts` (POST `/:id/constraints`), `packages/api/src/routes/public.ts` (detail embeds them)
- Modify: `packages/types/src/index.ts` (`IdeaConstraint`, `ToyIdeaDetail.constraints`)
- Modify: `packages/mobile/components/challenges/detail-screen.tsx` (Constraints tab, badge, add form)
- Modify: `scripts/check-schema-guards.sh`, `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/api/tests/integration/toy-ideas/constraints.test.ts` (new); `packages/mobile/tests/unit/components/challenges/detail-screen.test.tsx`

**Interfaces:**
- Consumes: `badge`, `listed` (Task 3); `isAuthor`, `joined`, `reloadKey` in the mobile detail.
- Produces: table `toy_idea_constraints(id, idea_id, label, note, added_by, created_at)`. `POST /api/ideas/:id/constraints` `{ label, note? }` → 201 `IdeaConstraint`; 400 "A constraint needs a name of up to 80 characters." / "Keep the note to 300 characters."; 403 "Only the author or a maker on this challenge can add a constraint."; 404 for an unknown idea. `interface IdeaConstraint { id: string; label: string; note: string | null }`; `ToyIdeaDetail.constraints?: IdeaConstraint[]` (oldest first; never `added_by`, which would name an anonymous author).

The spec's delete permission (whoever added it, or the author) is the RLS policy; no route or button deletes one yet — the spec draws none.

Copy: "{label}" over "{note}" (MB `cdConstraints` rows); "Add a constraint" (spec — not on the board, flagged); field labels "Constraint", "Note (optional)" (no board — flagged); "Could not add that constraint. Please try again." (no board — flagged).

- [ ] **Step 1: Write the failing tests**

`packages/api/tests/integration/toy-ideas/constraints.test.ts`:

```ts
/**
 * 110: constraints on a challenge — readable wherever the challenge is,
 * written by its author or a current maker, and nobody else.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let author: TestUser
let maker: TestUser
let stranger: TestUser
let ideaId: string

const add = (u: TestUser, body: unknown) =>
  app.request(`/api/ideas/${ideaId}/constraints`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${u.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

beforeAll(async () => {
  ;[author, maker, stranger] = await Promise.all([createTestUser('contributor'), createTestUser('contributor'), createTestUser('contributor')])
  ideaId = (
    await adminClient().from('toy_ideas').insert({ author_id: author.id, title: 'T', summary: 'S', status: 'challenge', anonymous: true }).select('id').single()
  ).data!.id
  await adminClient().from('toy_idea_participants').insert({ idea_id: ideaId, profile_id: maker.id })
})

afterAll(async () => {
  await adminClient().from('toy_ideas').delete().eq('id', ideaId)
  await Promise.all([author, maker, stranger].map((u) => deleteTestUser(u.id)))
})

describe('110 idea constraints', () => {
  it('takes one from the author and one from a maker who joined', async () => {
    expect((await add(author, { label: 'Fluid and electronics share one enclosure', note: 'Anything you add sits above the waterline.' })).status).toBe(201)
    expect((await add(maker, { label: 'It has to survive a fall' })).status).toBe(201)
  })

  it('refuses someone who has not joined', async () => {
    const res = await add(stranger, { label: 'Mine' })
    expect(res.status).toBe(403)
    expect(((await res.json()) as { error: string }).error).toBe('Only the author or a maker on this challenge can add a constraint.')
  })

  it('refuses an empty or over-long label and an over-long note, in a sentence', async () => {
    for (const body of [{ label: '  ' }, { label: 'x'.repeat(81) }]) {
      const res = await add(author, body)
      expect(res.status).toBe(400)
      expect(((await res.json()) as { error: string }).error).toBe('A constraint needs a name of up to 80 characters.')
    }
    expect((await add(author, { label: 'L', note: 'x'.repeat(301) })).status).toBe(400)
  })

  it('lists them on the public brief, oldest first, without who added them', async () => {
    const text = await (await app.request(`/api/public/challenges/${ideaId}`)).text()
    expect(JSON.parse(text).constraints.map((c: { label: string }) => c.label)).toEqual([
      'Fluid and electronics share one enclosure',
      'It has to survive a fall',
    ])
    expect(text).not.toContain(author.id)
  })

  it('lets anon read a constraint but not who added it', async () => {
    const anon = createClient(process.env.SUPABASE_URL ?? 'http://localhost:54321', process.env.SUPABASE_ANON_KEY ?? '')
    expect((await anon.from('toy_idea_constraints').select('label').eq('idea_id', ideaId)).data).toHaveLength(2)
    expect((await anon.from('toy_idea_constraints').select('added_by').eq('idea_id', ideaId)).error).not.toBeNull()
  })
})
```

Append to mobile `detail-screen.test.tsx`:

```tsx
  it('lists named constraints with a count, and lets a maker who joined add one', async () => {
    let brief = joinedDetail({ constraints: [{ id: 'k1', label: 'Fluid and electronics share one enclosure', note: 'Anything you add sits above the waterline, or is sealed.' }] })
    mockGet.mockImplementation((path: string) =>
      path === '/api/public/challenges/c1' ? Promise.resolve(brief) : Promise.resolve([])
    )
    mockPost.mockImplementation(() => {
      brief = { ...brief, constraints: [...(brief as { constraints: object[] }).constraints, { id: 'k2', label: 'It has to survive a fall', note: null }] }
      return Promise.resolve({})
    })
    render(<ChallengeDetailScreen id="c1" />)
    const tab = await screen.findByRole('tab', { name: 'Constraints' })
    expect(tab.props.accessibilityValue).toEqual({ text: '1' })
    fireEvent.press(tab)
    expect(screen.getByText('Anything you add sits above the waterline, or is sealed.')).toBeTruthy()
    expect(screen.queryByText('Turning on a bubble machine during therapy.')).toBeNull()
    fireEvent.changeText(screen.getByLabelText('Constraint'), 'It has to survive a fall')
    fireEvent.press(screen.getByRole('button', { name: 'Add a constraint' }))
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/api/ideas/c1/constraints', { label: 'It has to survive a fall', note: null })
    )
    expect(await screen.findByText('It has to survive a fall')).toBeTruthy()
  })

  it('falls back to intended use and who it is for when there are no constraints, and offers no form to a stranger', async () => {
    render(<ChallengeDetailScreen id="c1" />)
    fireEvent.press(await screen.findByRole('tab', { name: 'Constraints' }))
    expect(screen.getByText('Turning on a bubble machine during therapy.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Add a constraint' })).toBeNull()
  })
```

- [ ] **Step 2: Run them to see them fail**

Run the integration file → FAIL (`relation "public.toy_idea_constraints" does not exist`). Run the mobile file → FAIL.

- [ ] **Step 3: The migration**

`supabase/migrations/110_idea_constraints.sql`:

```sql
-- 110 — named constraints on a challenge (challenge-constraints).
--
-- "What makes this harder than it looks", as rows: a label and an optional
-- note. They replace intended use / primary user on the Constraints tab; an
-- idea without any falls back to those two (103 left them nullable).
--
--   read    wherever the idea is readable — the subquery runs under the
--           reader's own toy_ideas RLS, so a pending idea's stay private.
--   insert  the idea's author, or a maker on it who has not been removed.
--   delete  whoever added it, or the author (no route uses it yet).
--
-- Anon reads every column but added_by: on an anonymous challenge the
-- author's id is the author's name one call away (108).
--
-- DOWN:
--   drop table if exists public.toy_idea_constraints;

create table public.toy_idea_constraints (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.toy_ideas (id) on delete cascade,
  label text not null check (length(btrim(label)) between 1 and 80),
  note text check (note is null or length(note) <= 300),
  added_by uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index toy_idea_constraints_idea_idx on public.toy_idea_constraints (idea_id, created_at);

alter table public.toy_idea_constraints enable row level security;

create policy toy_idea_constraints_read on public.toy_idea_constraints for select to anon, authenticated
  using (exists (select 1 from public.toy_ideas i where i.id = idea_id));

create policy toy_idea_constraints_insert on public.toy_idea_constraints for insert to authenticated
  with check (
    added_by = auth.uid()
    and (
      exists (select 1 from public.toy_ideas i where i.id = idea_id and i.author_id = auth.uid())
      or exists (
        select 1 from public.toy_idea_participants p
         where p.idea_id = toy_idea_constraints.idea_id and p.profile_id = auth.uid() and p.removed_at is null)
    )
  );

create policy toy_idea_constraints_delete on public.toy_idea_constraints for delete to authenticated
  using (
    added_by = auth.uid()
    or exists (select 1 from public.toy_ideas i where i.id = idea_id and i.author_id = auth.uid())
  );

create policy toy_idea_constraints_admin on public.toy_idea_constraints for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select (id, idea_id, label, note, created_at) on public.toy_idea_constraints to anon;
grant select, insert, delete on public.toy_idea_constraints to authenticated;
```

Run: `supabase migration up`. Guard row:

```sql
  -- 110. Without RLS anyone could add constraints to any challenge.
  ('110 toy_idea_constraints has RLS on',
   (select relrowsecurity from pg_class where oid = 'public.toy_idea_constraints'::regclass))
```

- [ ] **Step 4: The API**

`toy-ideas.ts`, after the messages routes:

```ts
/**
 * Add a named constraint (110). The insert policy is the permission check —
 * the idea's author or a maker on it who was not removed — so a refusal is a
 * 42501. Limits checked here and by the table.
 */
toyIdeas.post('/:id/constraints', async (c) => {
  const parsed = await c.req.json().catch(() => null)
  const label = typeof parsed?.label === 'string' ? parsed.label.trim() : ''
  const note = typeof parsed?.note === 'string' ? parsed.note.trim() : ''
  if (label.length < 1 || label.length > 80) {
    return c.json({ error: 'A constraint needs a name of up to 80 characters.' }, 400)
  }
  if (note.length > 300) return c.json({ error: 'Keep the note to 300 characters.' }, 400)

  const { data, error } = await createUserClient(c.get('token'))
    .from('toy_idea_constraints')
    .insert({ idea_id: c.req.param('id'), label, note: note || null, added_by: c.get('userId') })
    .select('id, label, note')
    .single()
  if (error?.code === RLS_VIOLATION) {
    return c.json({ error: 'Only the author or a maker on this challenge can add a constraint.' }, 403)
  }
  if (error?.code === INVALID_TEXT_REPRESENTATION || error?.code === '23503') return c.json({ error: 'Not found' }, 404)
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data, 201)
})
```

`public.ts` detail — beside the participants read:

```ts
  // 110. Never added_by: on an anonymous challenge that is the author's id.
  const { data: constraints, error: constraintsError } = await admin
    .from('toy_idea_constraints')
    .select('id, label, note')
    .eq('idea_id', idea.id)
    .order('created_at', { ascending: true })
  if (constraintsError) return c.json({ error: constraintsError.message }, 500)
```

and `constraints: constraints ?? [],` in the response. Types:

```ts
/** A named constraint on a challenge (110). Who added it is never public. */
export interface IdeaConstraint {
  id: string
  label: string
  note: string | null
}
```

and `ToyIdeaDetail` gains `constraints?: IdeaConstraint[]`.

- [ ] **Step 5: Mobile**

`detail-screen.tsx`:
- `badge` gains `constraints: challenge.constraints?.length ?? 0`.
- State `const [constraintLabel, setConstraintLabel] = useState('')`, `const [constraintNote, setConstraintNote] = useState('')`.
- Add:

```tsx
  async function addConstraint() {
    const label = constraintLabel.trim()
    if (!label) return
    setBusy(true)
    setActionError(null)
    try {
      await apiClient.post(`/api/ideas/${id}/constraints`, { label, note: constraintNote.trim() || null })
      setConstraintLabel('')
      setConstraintNote('')
      setReloadKey((k) => k + 1)
    } catch {
      setActionError('Could not add that constraint. Please try again.')
    } finally {
      setBusy(false)
    }
  }
```

- Replace the Constraints card body (the `PENDING(challenge-constraints)` comment and the two `Field`s) with:

```tsx
            {challenge.constraints?.length ? (
              <View accessibilityRole="list" style={styles.makerList}>
                {challenge.constraints.map((k) => (
                  <View key={k.id} style={styles.makerRow}>
                    <Text style={styles.makerName}>{k.label}</Text>
                    {k.note ? <Text style={styles.eventDate}>{k.note}</Text> : null}
                  </View>
                ))}
              </View>
            ) : (
              // Ideas from before 110 carry these two instead (103 kept them).
              <>
                {challenge.intended_use ? <Field label="Intended use" value={challenge.intended_use} /> : null}
                {challenge.primary_user ? <Field label="Who it's for" value={challenge.primary_user} /> : null}
              </>
            )}
            {listed && (isAuthor || joined) ? (
              <View style={styles.addConstraint}>
                <TextField accessibilityLabel="Constraint" placeholder="Constraint" maxLength={80} value={constraintLabel} onChangeText={setConstraintLabel} />
                <TextField accessibilityLabel="Note (optional)" placeholder="Note (optional)" maxLength={300} multiline value={constraintNote} onChangeText={setConstraintNote} />
                <Button label="Add a constraint" variant="secondary" disabled={busy || !constraintLabel.trim()} onPress={() => void addConstraint()} />
              </View>
            ) : null}
```

  Style `addConstraint: { gap: theme.spacing(1) }`.

- [ ] **Step 6: Run the tests to see them pass**

Run both commands from Step 2 → PASS.

- [ ] **Step 7: Ship the item**

Set `shipped: true` on `'challenge-constraints'`, `node scripts/pending.mjs`, drift test.

- [ ] **Step 8: Commit**

```bash
git status --short
git add supabase/migrations/110_idea_constraints.sql packages/api/src/routes/toy-ideas.ts packages/api/src/routes/public.ts packages/types/src/index.ts packages/mobile/components/challenges/detail-screen.tsx scripts/check-schema-guards.sh packages/api/tests/integration/toy-ideas/constraints.test.ts packages/mobile/tests/unit/components/challenges/detail-screen.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(challenges): named constraints, added by the author or a maker who joined (110)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 13: Build time and rough cost on each request (`makers-row-meta`)

**Files:**
- Modify: `packages/types/src/builds.ts` (`buildRowMeta`), `packages/types/src/index.ts` (re-export)
- Modify: `packages/api/src/routes/toy-transactions.ts` (`boardGuides`, GET `/open-builds`)
- Modify: `packages/mobile/components/builds/makers-wanted-screen.tsx`, `packages/web/components/makers-wanted-board.tsx`
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/api/tests/integration/toy-transactions/row-meta.test.ts`, `packages/mobile/tests/unit/components/builds/makers-wanted-screen.test.tsx`, `packages/web/tests/unit/components/makers-wanted-board.test.tsx` (new); `packages/web/tests/unit/lib/build-options.test.ts`

**Interfaces:**
- Consumes: batch 1's `partsTotalCents(parts)` (`packages/types/src/guides.ts`) and `parts.price_cents` (086); `tutorials.build_minutes` (066); `formatBuildTime`, `formatCents` (types index).
- Produces: `buildRowMeta(t: { build_minutes?: number | null; parts_total_cents?: number | null }): string | null` from `@splat-connect/types` — "20 min · ~$28.00", either half left out when unknown, null when both are. `boardGuides(admin, tutorialIds)` in toy-transactions.ts → `{ guides: Map<string, BoardGuide> } | { error }`, where `BoardGuide = { id; title; difficulty; status; build_minutes: number | null; parts_total_cents: number | null }`; Task 14 reuses it. Open-builds rows' `tutorial` gains `build_minutes` and `parts_total_cents`. The mobile and web test files with their `build()` fixture (Tasks 14 and 15 extend them).

Copy: "{time} · ~{cost}" (MB/WB row pill `{{ r.time }} · ~{{ r.cost }}`). The cost is `formatCents`, so it reads "~$28.00" where the board's sample reads "~$28" — money formatting stays in one place.

- [ ] **Step 1: Write the failing tests**

Append to `packages/web/tests/unit/lib/build-options.test.ts`:

```ts
import { buildRowMeta } from '@splat-connect/types'

describe('buildRowMeta', () => {
  it('reads time then rough cost, leaving out whichever is unknown', () => {
    expect(buildRowMeta({ build_minutes: 20, parts_total_cents: 2800 })).toBe('20 min · ~$28.00')
    expect(buildRowMeta({ build_minutes: 90, parts_total_cents: null })).toBe('1.5 h')
    expect(buildRowMeta({ build_minutes: null, parts_total_cents: 600 })).toBe('~$6.00')
    expect(buildRowMeta({ build_minutes: null, parts_total_cents: null })).toBeNull()
  })
})
```

(merge the import into the file's existing `@splat-connect/types` import).

`packages/api/tests/integration/toy-transactions/row-meta.test.ts`:

```ts
/**
 * Makers wanted rows carry the guide's build time and rough parts cost — the
 * cost only when every required part is priced (batch 1's partsTotalCents).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let family: TestUser
let maker: TestUser
const guides: string[] = []

const guide = async (prices: (number | null)[]) => {
  const id = (
    await adminClient().from('tutorials').insert({ title: `Meta ${Date.now()}`, description: 'G', difficulty: 'easy', status: 'approved', build_minutes: 20 }).select('id').single()
  ).data!.id as string
  guides.push(id)
  await adminClient().from('parts').insert(prices.map((price_cents, i) => ({ tutorial_id: id, name: `Part ${i}`, quantity: 1, is_optional: false, price_cents })))
  await adminClient().from('toy_transactions').insert({
    type: 'build', status: 'requested', tutorial_id: id, requester_id: family.id, travel_km: 10, requester_suburb: 'Newtown',
  })
  return id
}

beforeAll(async () => {
  family = await createTestUser('contributor')
  maker = await createTestUser('contributor')
})

afterAll(async () => {
  const db = adminClient()
  await db.from('toy_transactions').delete().in('tutorial_id', guides)
  await db.from('parts').delete().in('tutorial_id', guides)
  await db.from('tutorials').delete().in('id', guides)
  await deleteTestUser(family.id)
  await deleteTestUser(maker.id)
})

describe('open-builds row meta', () => {
  it('carries build time and the parts total, and no total when a required part is unpriced', async () => {
    const priced = await guide([1500, 1300])
    const unpriced = await guide([1500, null])
    const rows = (await (
      await app.request('/api/toy-transactions/open-builds', { headers: { Authorization: `Bearer ${maker.token}` } })
    ).json()) as { tutorial_id: string; tutorial: { build_minutes: number; parts_total_cents: number | null } }[]
    expect(rows.find((r) => r.tutorial_id === priced)!.tutorial).toMatchObject({ build_minutes: 20, parts_total_cents: 2800 })
    expect(rows.find((r) => r.tutorial_id === unpriced)!.tutorial).toMatchObject({ build_minutes: 20, parts_total_cents: null })
  })
})
```

(If `parts` has other NOT NULL columns, add them as the guides plan's 086 test does — read `supabase/migrations/001_schema.sql`'s `create table public.parts` first.)

`packages/mobile/tests/unit/components/builds/makers-wanted-screen.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { MakersWantedScreen } from '../../../../components/builds/makers-wanted-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))
const mockPush = jest.fn()
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return {
    Stack: { Screen: () => null },
    useRouter: () => ({ push: mockPush }),
    useLocalSearchParams: () => ({}),
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
  }
})
const mockGet = jest.fn()
const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a) },
}))

export const build = (over: object = {}) => ({
  id: 'b1', tutorial_id: 'g1', build_brief: 'Leo lights up at bubbles.', travel_km: 10, urgency: 'No rush',
  child_label: 'Leo, 3', requester_suburb: 'Newtown', family_has_toy: false, created_at: '2026-09-28T00:00:00Z', mine: false,
  tutorial: { id: 'g1', title: 'Bubble machine', difficulty: 'easy', status: 'approved', build_minutes: 20, parts_total_cents: 2800 },
  ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockResolvedValue([build()])
})

describe('MakersWantedScreen', () => {
  it('shows each guide’s build time and rough parts cost', async () => {
    render(<MakersWantedScreen />)
    expect(await screen.findByText('20 min · ~$28.00')).toBeTruthy()
  })

  it('leaves the cost off when a part is unpriced', async () => {
    mockGet.mockResolvedValue([build({ tutorial: { id: 'g1', title: 'Bubble machine', difficulty: 'easy', status: 'approved', build_minutes: 20, parts_total_cents: null } })])
    render(<MakersWantedScreen />)
    expect(await screen.findByText('20 min')).toBeTruthy()
    expect(screen.queryByText(/~\$/)).toBeNull()
  })
})
```

(`waitFor`, `fireEvent` and `mockPost`/`mockPush` are used by Tasks 14–15.)

`packages/web/tests/unit/components/makers-wanted-board.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MakersWantedBoard, type OpenBuild } from '@/components/makers-wanted-board'
import { browserApiClient } from '@/lib/browser-api-client'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { post: vi.fn(), get: vi.fn() } }))

const build = (over: Partial<OpenBuild> = {}): OpenBuild => ({
  id: 'b1', tutorial_id: 'g1', build_brief: 'Leo lights up at bubbles.', travel_km: 10, urgency: 'No rush',
  child_label: 'Leo, 3', requester_suburb: 'Newtown', family_has_toy: false, created_at: '2026-09-28T00:00:00Z', mine: false,
  tutorial: { id: 'g1', title: 'Bubble machine', difficulty: 'easy', status: 'approved', build_minutes: 20, parts_total_cents: 2800 },
  ...over,
})

beforeEach(() => vi.clearAllMocks())

describe('MakersWantedBoard', () => {
  it('shows each guide’s build time and rough parts cost', () => {
    render(<MakersWantedBoard builds={[build()]} />)
    expect(screen.getByText('20 min · ~$28.00')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/lib/build-options.test.ts tests/unit/components/makers-wanted-board.test.tsx` → FAIL.
Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/toy-transactions/row-meta.test.ts` → FAIL (`build_minutes` absent from `tutorial`).
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/builds/makers-wanted-screen.test.tsx` → FAIL.

- [ ] **Step 3: Implement**

`packages/types/src/builds.ts`, append:

```ts
import { formatBuildTime, formatCents } from './index'

/**
 * A Makers wanted row's "20 min · ~$28.00" (MB r.time · ~r.cost). Either half
 * is left out when unknown — a guide with an unpriced required part has no
 * total (partsTotalCents) — and the whole thing is null when both are.
 */
export function buildRowMeta(t: { build_minutes?: number | null; parts_total_cents?: number | null }): string | null {
  const bits = [
    t.build_minutes ? formatBuildTime(t.build_minutes) : null,
    t.parts_total_cents != null ? `~${formatCents(t.parts_total_cents)}` : null,
  ].filter(Boolean)
  return bits.length ? bits.join(' · ') : null
}
```

(The import sits at the top of the file. `index.ts` re-exports `builds.ts`, and these two are function declarations, so the cycle resolves at call time.) Add `buildRowMeta` to the `./builds` re-export in index.ts.

`toy-transactions.ts`: add `partsTotalCents` to the `@splat-connect/types` import, and above GET `/open-builds`:

```ts
type BoardGuide = {
  id: string
  title: string
  difficulty: string | null
  status: string
  build_minutes: number | null
  parts_total_cents: number | null
}

/**
 * The guide half of a Makers wanted row: what it is, how hard, how long, and
 * roughly what the parts cost (makers-row-meta). The total is batch 1's
 * partsTotalCents — null unless every required part is priced. Named columns
 * only: a select naming a column that does not exist fails whole and every
 * card reads as "a guide that is no longer published".
 */
async function boardGuides(
  admin: ReturnType<typeof createAdminClient>,
  tutorialIds: string[]
): Promise<{ guides: Map<string, BoardGuide> } | { error: { message: string } }> {
  const { data, error } = await admin
    .from('tutorials')
    .select('id, title, difficulty, status, build_minutes, parts(is_optional, price_cents)')
    .in('id', tutorialIds)
  if (error) return { error }
  return {
    guides: new Map(
      ((data ?? []) as (Omit<BoardGuide, 'parts_total_cents'> & { parts: { is_optional: boolean; price_cents: number | null }[] | null })[]).map(
        ({ parts, ...g }) => [g.id, { ...g, parts_total_cents: partsTotalCents(parts ?? []) }]
      )
    ),
  }
}
```

In GET `/open-builds`, replace the guides query and its map with:

```ts
  const found = await boardGuides(admin, rows.map((r) => r.tutorial_id as string))
  if ('error' in found) return c.json({ error: found.error.message }, 500)
  const guide = found.guides
```

(Move the "Named columns only…" comment into `boardGuides`, as above.)

Mobile `makers-wanted-screen.tsx`: `OpenBuild.tutorial` gains `build_minutes: number | null; parts_total_cents: number | null`; import `buildRowMeta` from `@splat-connect/types`; in `BuildCard`, `const meta = b.tutorial ? buildRowMeta(b.tutorial) : null` and in the `pills` row, between the difficulty pill and "Family covers parts":

```tsx
            {meta ? <Text style={[styles.pill, { backgroundColor: theme.colors.surfaceSunken }]}>{meta}</Text> : null}
```

Delete the `{/* PENDING(makers-row-meta): … */}` comment.

Web `makers-wanted-board.tsx`: `OpenBuild.tutorial` gains the same two fields; import `buildRowMeta`; in the pill row after the difficulty pill:

```tsx
                        {b.tutorial && buildRowMeta(b.tutorial) && (
                          <span className="rounded-full bg-[var(--surface2)] px-2.5 py-[3px] text-ink">{buildRowMeta(b.tutorial)}</span>
                        )}
```

- [ ] **Step 4: Run the tests to see them pass**

Run the four commands from Step 2 → PASS. Re-run `tests/integration/toy-transactions/open-builds.test.ts` → PASS.

- [ ] **Step 5: Ship the item**

Set `shipped: true` on `'makers-row-meta'`, `node scripts/pending.mjs`, drift test.

- [ ] **Step 6: Commit**

```bash
git status --short
git add packages/types/src/builds.ts packages/types/src/index.ts packages/api/src/routes/toy-transactions.ts packages/mobile/components/builds/makers-wanted-screen.tsx packages/web/components/makers-wanted-board.tsx packages/api/tests/integration/toy-transactions/row-meta.test.ts packages/mobile/tests/unit/components/builds/makers-wanted-screen.test.tsx packages/web/tests/unit/components/makers-wanted-board.test.tsx packages/web/tests/unit/lib/build-options.test.ts packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(builds): Makers wanted rows say the guide's build time and rough parts cost

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 14: Live and Done on Makers wanted (`makers-live-done-tabs`)

**Files:**
- Modify: `packages/api/src/routes/toy-transactions.ts` (GET `/builds-board`)
- Modify: `packages/mobile/components/builds/makers-wanted-screen.tsx`, `packages/web/components/makers-wanted-board.tsx`
- Modify: `scripts/parity/app-screen-map.json` (drop the `makers_wanted` `explained` rule), `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/api/tests/integration/toy-transactions/builds-board.test.ts` (new); `packages/mobile/tests/unit/components/builds/makers-wanted-screen.test.tsx`, `packages/web/tests/unit/components/makers-wanted-board.test.tsx`

**Interfaces:**
- Consumes: `boardGuides` (Task 13); `ownerSideName` (toy-transactions.ts).
- Produces: `GET /api/toy-transactions/builds-board?tab=live|done&page=N` (signed in) → up to 20 rows, newest first: the open-builds row's columns (never `requester_id`), `tutorial: BoardGuide | null`, `maker_name: string`, `mine: boolean` (the caller asked), `party: boolean` (the caller asked or is building it). 400 "tab must be live or done". `type BoardBuild = OpenBuild & { maker_name: string; party: boolean }` in both clients.

Spec vs code: Live/Done read claimed rows with the admin client (064 admits unclaimed ones only), so the route itself must keep a build addressed to a named maker — private to two people — off the board. It lists only rows with `travel_km` set, which only the open-board form sends (064 makes POST /build require it there). Ponytail-marked in the code.

Copy: tabs MB "Needs a maker" / "Live" / "Done" / "Yours"; WB "Needs a maker" / "Live" / "Handed over" / "Your requests"; counts on the first and last only (MB/WB `mwTabs`). Pills "Live" / "Handed over"; footers "{maker} is building it", "You are building it", "Built by {maker}" (MB/WB `T`); "Thread" (MB) / "Open the thread" (WB) on a live row of your own. "Show more builds" (no board — the web `ShowMoreButton` pattern, flagged).

- [ ] **Step 1: Write the failing tests**

`packages/api/tests/integration/toy-transactions/builds-board.test.ts`:

```ts
/**
 * Live and Done: claimed and handed-over builds from the board, with the
 * maker named and the family no more identified than on the open row. A
 * build asked of a named maker never appears.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let family: TestUser
let maker: TestUser
let onlooker: TestUser
let tutorialId: string
const MAKER = `Tom ${Date.now()}`

const board = async (u: TestUser, q: string) =>
  app.request(`/api/toy-transactions/builds-board?${q}`, { headers: { Authorization: `Bearer ${u.token}` } })
type Row = { id: string; maker_name: string; mine: boolean; party: boolean; requester_id?: string }

beforeAll(async () => {
  ;[family, maker, onlooker] = await Promise.all([createTestUser('contributor'), createTestUser('contributor'), createTestUser('contributor')])
  const db = adminClient()
  await db.from('profiles').update({ name: MAKER }).eq('id', maker.id)
  tutorialId = (await db.from('tutorials').insert({ title: `Board ${Date.now()}`, description: 'G', difficulty: 'easy', status: 'approved' }).select('id').single()).data!.id
  const base = { type: 'build', tutorial_id: tutorialId, requester_id: family.id, owner_id: maker.id, owner_code: '111111', requester_code: '222222' }
  await db.from('toy_transactions').insert([
    { ...base, status: 'accepted', travel_km: 10, requester_suburb: 'Newtown', child_label: 'Leo, 3' },
    { ...base, status: 'completed', travel_km: 5, requester_suburb: 'Enmore' },
    // Asked of this maker by name: private to the two of them.
    { ...base, status: 'accepted', build_brief: 'Just for you' },
  ])
})

afterAll(async () => {
  await adminClient().from('toy_transactions').delete().eq('tutorial_id', tutorialId)
  await adminClient().from('tutorials').delete().eq('id', tutorialId)
  await Promise.all([family, maker, onlooker].map((u) => deleteTestUser(u.id)))
})

describe('GET /api/toy-transactions/builds-board', () => {
  it('lists a claimed board build under Live with its maker, and never the family', async () => {
    const res = await board(onlooker, 'tab=live')
    expect(res.status).toBe(200)
    const text = await res.text()
    const rows = (JSON.parse(text) as Row[]).filter((r) => r.maker_name === MAKER)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ mine: false, party: false })
    expect(text).not.toContain(family.id)
    expect(text).not.toContain('Just for you')
  })

  it('marks the maker and the family as parties to their own build', async () => {
    const forMaker = ((await (await board(maker, 'tab=live')).json()) as Row[]).find((r) => r.maker_name === MAKER)
    const forFamily = ((await (await board(family, 'tab=live')).json()) as Row[]).find((r) => r.maker_name === MAKER)
    expect(forMaker).toMatchObject({ party: true, mine: false })
    expect(forFamily).toMatchObject({ party: true, mine: true })
  })

  it('lists a handed-over board build under Done', async () => {
    const rows = ((await (await board(onlooker, 'tab=done')).json()) as Row[]).filter((r) => r.maker_name === MAKER)
    expect(rows).toHaveLength(1)
  })

  it('answers a page past the end with nothing, and refuses an unknown tab', async () => {
    expect(await (await board(onlooker, 'tab=done&page=999')).json()).toEqual([])
    expect((await board(onlooker, 'tab=open')).status).toBe(400)
  })
})
```

Append to the mobile `makers-wanted-screen.test.tsx`:

```tsx
  it('reads Live and Done from the board feed, naming the maker', async () => {
    mockGet.mockImplementation((path: string) =>
      path.startsWith('/api/toy-transactions/builds-board?tab=live')
        ? Promise.resolve([build({ id: 'l1', maker_name: 'Tom Beattie', party: false })])
        : path.startsWith('/api/toy-transactions/builds-board?tab=done')
          ? Promise.resolve([build({ id: 'd1', maker_name: 'Rachel Kaur', party: false })])
          : Promise.resolve([build()])
    )
    render(<MakersWantedScreen />)
    const live = await screen.findByRole('tab', { name: 'Live' })
    expect(live.props.accessibilityValue).toBeUndefined()
    fireEvent.press(live)
    expect(await screen.findByText('Tom Beattie is building it')).toBeTruthy()
    expect(mockGet).toHaveBeenCalledWith('/api/toy-transactions/builds-board?tab=live&page=0')
    fireEvent.press(screen.getByRole('tab', { name: 'Done' }))
    expect(await screen.findByText('Built by Rachel Kaur')).toBeTruthy()
    expect(screen.getByText('Handed over')).toBeTruthy()
  })
```

Append to the web `makers-wanted-board.test.tsx`:

```tsx
  it('fetches Live when its tab is picked and names who is building', async () => {
    vi.mocked(browserApiClient.get).mockResolvedValue([{ ...build({ id: 'l1' }), maker_name: 'Tom Beattie', party: false }])
    render(<MakersWantedBoard builds={[build()]} />)
    fireEvent.mouseDown(screen.getByRole('tab', { name: /^Live/ }))
    expect(await screen.findByText('Tom Beattie is building it')).toBeInTheDocument()
    expect(browserApiClient.get).toHaveBeenCalledWith('/api/toy-transactions/builds-board?tab=live&page=0')
    expect(screen.getByRole('tab', { name: /^Handed over/ })).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run them to see them fail**

Run the integration file → FAIL (404 — no route). Run the mobile and web board tests → FAIL.

- [ ] **Step 3: The API**

`toy-transactions.ts`, directly after GET `/open-builds` (it must stay above `toyTransactions.get('/:id', …)`):

```ts
const BOARD_PAGE = 20

/**
 * GET /api/toy-transactions/builds-board?tab=live|done&page=N
 *
 * Makers wanted's Live and Done tabs (makers-live-done-tabs): claimed builds
 * still open, and handed-over ones, newest first, 20 a page. Read with the
 * admin client — 064's policy admits only unclaimed rows — so this route is
 * the filter. The family is no more identified than on the open card: never
 * requester_id. The maker is named; the board says who is building it.
 *
 * ponytail: "came from the board" is read off travel_km, which only the open
 * form sends (POST /build requires it there; ask-for-build-form never sends
 * it). A from_board column if an addressed request ever starts sending one.
 */
toyTransactions.get('/builds-board', async (c) => {
  const tab = c.req.query('tab')
  if (tab !== 'live' && tab !== 'done') return c.json({ error: 'tab must be live or done' }, 400)
  const page = Math.max(0, Number.parseInt(c.req.query('page') ?? '0', 10) || 0)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('toy_transactions')
    .select('id, tutorial_id, build_brief, travel_km, urgency, child_label, requester_suburb, family_has_toy, requester_id, owner_id, owner_org_id, created_at')
    .eq('type', 'build')
    .eq('status', tab === 'live' ? 'accepted' : 'completed')
    .not('travel_km', 'is', null)
    .order('updated_at', { ascending: false })
    .range(page * BOARD_PAGE, page * BOARD_PAGE + BOARD_PAGE - 1)
  if (error) return c.json({ error: error.message }, 500)

  const rows = data ?? []
  const found = await boardGuides(admin, rows.map((r) => r.tutorial_id as string))
  if ('error' in found) return c.json({ error: found.error.message }, 500)

  const userId = c.get('userId')
  return c.json(
    await Promise.all(
      rows.map(async ({ requester_id, owner_id, owner_org_id, ...rest }) => ({
        ...rest,
        tutorial: found.guides.get(rest.tutorial_id as string) ?? null,
        maker_name: await ownerSideName(admin, { owner_id, owner_org_id }, 'A maker'),
        mine: requester_id === userId,
        party: requester_id === userId || owner_id === userId,
      }))
    )
  )
})
```

- [ ] **Step 4: Mobile**

`makers-wanted-screen.tsx`:
- Header comment: delete the "Live and Done tabs" bullet.
- Types and state:

```tsx
/** GET /api/toy-transactions/builds-board, one row. */
type BoardBuild = OpenBuild & { maker_name: string; party: boolean }

type Tab = 'open' | 'live' | 'done' | 'mine'
const BOARD_PAGE = 20
// The board's four tabs; counts on the first and last only (MB mwTabs).
const TABS: [Tab, string, string | null][] = [
  ['open', 'Needs a maker', theme.colors.mintSoft],
  ['live', 'Live', null],
  ['done', 'Done', null],
  ['mine', 'Yours', theme.colors.apricotSoft],
]
```

```tsx
  const [board, setBoard] = useState<BoardBuild[]>([])
  const [boardPage, setBoardPage] = useState(0)
  const [boardMore, setBoardMore] = useState(false)

  const loadBoard = useCallback(async (t: 'live' | 'done', page: number) => {
    try {
      const rows = await apiClient.get<BoardBuild[]>(`/api/toy-transactions/builds-board?tab=${t}&page=${page}`)
      setBoard((cur) => (page === 0 ? rows : [...cur, ...rows]))
      setBoardPage(page)
      setBoardMore(rows.length === BOARD_PAGE)
      setLoadFailed(false)
    } catch (err) {
      console.error('[MakersWantedScreen] builds-board fetch failed:', err)
      setLoadFailed(true)
    }
  }, [])

  function pick(t: Tab) {
    setTab(t)
    if (t === 'live' || t === 'done') {
      setBoard([])
      void loadBoard(t, 0)
    }
  }

  const onBoard = tab === 'live' || tab === 'done'
  const inTab: (OpenBuild | BoardBuild)[] = onBoard ? board : builds.filter((b) => (tab === 'mine' ? b.mine : !b.mine))
```

  (`count` is unchanged; `shown` filters `inTab` by range as before.)
- The tab bar maps `TABS`; each tab `onPress={() => pick(k)}`, `accessibilityLabel={label}`, `accessibilityValue={tint && n > 0 ? { text: String(n) } : undefined}`, and renders the count only when `tint && n > 0`.
- Delete the `PENDING(makers-live-done-tabs)` comment and the Live/Done `Chip` row under it (and `pendingHref` from the import if unused).
- Empty-state body: wrap the existing body text in `{onBoard ? null : (…)}`.
- After the list: `{onBoard && boardMore ? <Button label="Show more builds" variant="secondary" onPress={() => void loadBoard(tab as 'live' | 'done', boardPage + 1)} /> : null}`.
- `BuildCard` takes `kind: 'open' | 'live' | 'done'` (pass `onBoard ? tab : 'open'`) and `b: OpenBuild & Partial<Pick<BoardBuild, 'maker_name' | 'party'>>`:

```tsx
  // The board's T: status pill and footer per stage.
  const stage =
    kind === 'live'
      ? { tint: theme.colors.honeySoft, icon: 'hammer' as const, label: 'Live', foot: b.party && !b.mine ? 'You are building it' : `${b.maker_name} is building it` }
      : kind === 'done'
        ? { tint: theme.colors.mintSoft, icon: 'checkmark-circle' as const, label: 'Handed over', foot: `Built by ${b.maker_name}` }
        : b.mine
          ? { tint: theme.colors.apricotSoft, icon: 'hourglass' as const, label: 'Waiting for a maker', foot: `Visible to makers within ${b.travel_km} km` }
          : { tint: theme.colors.mintSoft, icon: 'hand-left' as const, label: 'Needs a maker', foot: 'Unclaimed' }
```

  Use `stage.tint` / `stage.icon` / `stage.label` in the status pill and `stage.foot` in the footer text. Footer buttons: `kind === 'live' && b.party` → `<Button label="Thread" variant="secondary" onPress={onTrack} … />`; `kind === 'open'` → the existing mine/claim buttons; `kind === 'done'` → none.

- [ ] **Step 5: Web**

`makers-wanted-board.tsx`:
- Header comment: replace "The board's four tabs are … only the two it can fill are drawn." with "Live and Handed over read GET /builds-board as their tab is picked."
- `type BoardBuild = OpenBuild & { maker_name: string; party: boolean }`; `const [tab, setTab] = useState<'open' | 'live' | 'done' | 'mine'>('open')`; state `board`, `boardPage`, `boardMore` and a `loadBoard(t, page)` as on mobile, with `browserApiClient.get<BoardBuild[]>(…)` and `setError(e instanceof Error ? e.message : 'That did not go through. Try once more.')` on failure.
- `onValueChange={(v) => { setTab(v as typeof tab); if (v === 'live' || v === 'done') { setBoard([]); void loadBoard(v, 0) } }}`.
- Triggers: `[['open', 'Needs a maker', 'var(--tmint)'], ['live', 'Live', null], ['done', 'Handed over', null], ['mine', 'Your requests', 'var(--tcoral)']]`, count rendered only when the tint is set.
- `inTab = onBoard ? board : builds.filter(…)`; in the card, the same `stage` switch as mobile with the WB words (pill "Live" `var(--tamber)` + `Hammer`, "Handed over" `var(--tok)` + `SealCheck` from phosphor; footers as listed in Copy; the open/mine footers stay "Nobody has claimed this yet" / "This is your request"); a live row with `party` gets `<Link href={`/dashboard/exchanges/build/${b.id}`} className="btn btn-quiet min-h-11 px-[18px] text-sm">Open the thread</Link>`; claim/ask buttons only when the row is open.
- Under the list: `{onBoard && boardMore && (<button type="button" onClick={() => loadBoard(tab as 'live' | 'done', boardPage + 1)} className="btn btn-quiet mx-auto mt-8 block">Show more builds</button>)}`.

In `scripts/parity/app-screen-map.json`, delete the `makers_wanted` entry's `explained` key (its one rule names `makers-live-done-tabs`).

- [ ] **Step 6: Run the tests to see them pass**

Run the three commands from Step 2 → PASS. Re-run Task 13's mobile and web board tests → PASS.

- [ ] **Step 7: Ship the item**

Set `shipped: true` on `'makers-live-done-tabs'`, `node scripts/pending.mjs`, drift test (it also checks no `explained` rule names a shipped id).

- [ ] **Step 8: Commit**

```bash
git status --short
git add packages/api/src/routes/toy-transactions.ts packages/mobile/components/builds/makers-wanted-screen.tsx packages/web/components/makers-wanted-board.tsx scripts/parity/app-screen-map.json packages/api/tests/integration/toy-transactions/builds-board.test.ts packages/mobile/tests/unit/components/builds/makers-wanted-screen.test.tsx packages/web/tests/unit/components/makers-wanted-board.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(builds): Live and Done on Makers wanted, from the board's own builds

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 15: Ask first (`makers-ask-first`, migration 111)

**Files:**
- Create: `supabase/migrations/111_build_request_questions.sql`
- Create: `packages/mobile/components/builds/ask-first-screen.tsx`, `packages/mobile/app/(my)/exchanges/build/ask/[id].tsx`
- Create: `packages/web/components/build-questions.tsx`, `packages/web/app/dashboard/exchanges/build/[id]/ask/page.tsx`
- Modify: `packages/api/src/routes/toy-transactions.ts` (GET/POST `/:id/questions`; POST `/:id/claim` copies them)
- Modify: `packages/types/src/builds.ts` (`BuildQuestions` types), `packages/types/src/index.ts` (`NotificationType`, bucket, `COPY`, re-export)
- Modify: `packages/mobile/app/(my)/_layout.tsx`, `packages/mobile/components/builds/makers-wanted-screen.tsx`, `packages/mobile/components/builds/build-thread-screen.tsx`, `packages/mobile/lib/notifications.ts`, `packages/mobile/lib/pending-icons.ts`
- Modify: `packages/web/components/makers-wanted-board.tsx`, `packages/web/app/dashboard/exchanges/build/[id]/page.tsx`, `packages/web/components/notifications-list.tsx`, `packages/web/lib/pending-icons.ts`
- Modify: `scripts/check-schema-guards.sh`, `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/api/tests/integration/toy-transactions/questions.test.ts`, `packages/mobile/tests/unit/components/builds/ask-first-screen.test.tsx`, `packages/web/tests/unit/components/build-questions.test.tsx` (new); `packages/mobile/tests/unit/components/builds/makers-wanted-screen.test.tsx`, `packages/mobile/tests/unit/lib/notifications.test.ts`, `packages/web/tests/unit/lib/notification-bucket.test.ts`

**Interfaces:**
- Consumes: `subjectName`, `profileName` (toy-transactions.ts); 064's open-build read policy.
- Produces: table `build_request_questions(id, transaction_id, maker_id, sender_id, body, created_at)`. `GET /api/toy-transactions/:id/questions` → `BuildQuestions` (404 to a stranger to a claimed build). `POST /api/toy-transactions/:id/questions` `{ body, maker_id? }` → 201 `BuildQuestion`; 400 "Write a question of up to 1000 characters."; 404 "That maker has not asked about this request." (family naming a maker who never asked); 409 "Somebody has already claimed this one." once claimed. Notification `build_question` (subject `toy_transaction_id`, bucket `exchanges`). Claim copies the claiming maker's questions into `toy_transaction_messages`, ahead of the claim line. From `@splat-connect/types`:

```ts
export interface BuildQuestion { id: string; sender_id: string; body: string; created_at: string }
export interface BuildQuestionThread { maker_id: string; maker_name: string; messages: BuildQuestion[] }
export interface BuildQuestions {
  transaction_id: string
  tutorial_title: string
  requester_suburb: string | null
  /** Unclaimed and still requested: questions can be asked. */
  open: boolean
  /** The caller is the family who asked for the build. */
  family: boolean
  /** The family sees one per maker who asked; a maker sees their own. */
  threads: BuildQuestionThread[]
}
```

Spec vs code: 077's one-subject check already admits `toy_transaction_id`, so only the type check changes.

Copy (MB `CARD.asking`): kicker "Asking first", title "Not claimed yet", body "Ask about the parts or the switch. Claiming is one tap when you are ready."; "Ask first" (MB/WB); "I'll build this" (existing); "Family in {suburb}" (existing); "Message" / "Send" (the build thread's composer). Notification line "{actor} wrote about {guide} before anyone claimed it" (no board — flagged). "Could not send that. Please try again." (no board — flagged).

- [ ] **Step 1: Write the failing tests**

`packages/api/tests/integration/toy-transactions/questions.test.ts`:

```ts
/**
 * 111: before claiming, a maker asks the family privately. One thread per
 * (request, maker): the family reads every thread, a maker only their own.
 * Asking stops at the claim, and the claimer's questions move into the build
 * thread.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let family: TestUser
let makerA: TestUser
let makerB: TestUser
let tutorialId: string
let txId: string

const ask = (u: TestUser, body: object) =>
  app.request(`/api/toy-transactions/${txId}/questions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${u.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
const read = async (u: TestUser) => app.request(`/api/toy-transactions/${txId}/questions`, { headers: { Authorization: `Bearer ${u.token}` } })
type Q = { open: boolean; family: boolean; threads: { maker_id: string; messages: { body: string }[] }[] }

beforeAll(async () => {
  ;[family, makerA, makerB] = await Promise.all([createTestUser('contributor'), createTestUser('contributor'), createTestUser('contributor')])
  const db = adminClient()
  tutorialId = (await db.from('tutorials').insert({ title: `Ask ${Date.now()}`, description: 'G', difficulty: 'easy', status: 'approved' }).select('id').single()).data!.id
  txId = (
    await db.from('toy_transactions').insert({ type: 'build', status: 'requested', tutorial_id: tutorialId, requester_id: family.id, travel_km: 10, requester_suburb: 'Newtown' }).select('id').single()
  ).data!.id
})

afterAll(async () => {
  const db = adminClient()
  await db.from('notifications').delete().eq('toy_transaction_id', txId)
  await db.from('toy_transactions').delete().eq('id', txId)
  await db.from('tutorials').delete().eq('id', tutorialId)
  await Promise.all([family, makerA, makerB].map((u) => deleteTestUser(u.id)))
})

describe('111 build request questions', () => {
  it('lets a maker ask, tells the family, and the family answer in that thread', async () => {
    expect((await ask(makerA, { body: 'Which switch do you have?' })).status).toBe(201)
    const { data: told } = await adminClient().from('notifications').select('type').eq('recipient_id', family.id).eq('toy_transaction_id', txId)
    expect(told).toEqual([{ type: 'build_question' }])
    expect((await ask(family, { body: 'A 100 mm button.', maker_id: makerA.id })).status).toBe(201)
  })

  it('shows the family every thread and a maker only their own', async () => {
    expect((await ask(makerB, { body: 'Do you have the toy?' })).status).toBe(201)
    const forFamily = (await (await read(family)).json()) as Q
    expect(forFamily.family).toBe(true)
    expect(forFamily.threads.map((t) => t.maker_id).sort()).toEqual([makerA.id, makerB.id].sort())
    const forB = (await (await read(makerB)).json()) as Q
    expect(forB.threads.map((t) => t.maker_id)).toEqual([makerB.id])
    expect(JSON.stringify(forB)).not.toContain('Which switch do you have?')
  })

  it('keeps a maker in their own thread whatever maker_id they send', async () => {
    await ask(makerB, { body: 'Sneaky', maker_id: makerA.id })
    const forA = (await (await read(makerA)).json()) as Q
    expect(JSON.stringify(forA)).not.toContain('Sneaky')
  })

  it('refuses the family answering a maker who never asked, and an empty or long question', async () => {
    const stranger = await ask(family, { body: 'Hello?', maker_id: family.id })
    expect(stranger.status).toBe(404)
    for (const body of ['  ', 'x'.repeat(1001)]) expect((await ask(makerA, { body })).status).toBe(400)
  })

  it('stops at the claim, and moves the claimer’s questions into the build thread', async () => {
    expect((await app.request(`/api/toy-transactions/${txId}/claim`, { method: 'POST', headers: { Authorization: `Bearer ${makerA.token}` } })).status).toBe(200)
    expect((await ask(makerB, { body: 'Too late?' })).status).toBe(409)
    const { data: msgs } = await adminClient().from('toy_transaction_messages').select('body, kind').eq('transaction_id', txId).order('created_at')
    const bodies = (msgs ?? []).map((m) => m.body)
    expect(bodies).toEqual(expect.arrayContaining(['Which switch do you have?', 'A 100 mm button.']))
    expect(bodies).not.toContain('Do you have the toy?')
    expect(bodies.indexOf('A 100 mm button.')).toBeLessThan(bodies.findIndex((b) => b.endsWith('claimed this build.')))
  })

  it('still lets the losing maker read their own thread, and nobody else in', async () => {
    expect((await read(makerB)).status).toBe(200)
    const outsider = await createTestUser('contributor')
    expect((await read(outsider)).status).toBe(404)
    await deleteTestUser(outsider.id)
  })
})
```

`packages/mobile/tests/unit/components/builds/ask-first-screen.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { AskFirstScreen } from '../../../../components/builds/ask-first-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))
const mockReplace = jest.fn()
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return {
    useRouter: () => ({ replace: mockReplace }),
    useFocusEffect: (effect: () => void | (() => void)) => useEffect(effect, [effect]),
  }
})
const mockGet = jest.fn()
const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a) },
}))
const mockCaps = jest.fn()
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => mockCaps() }))
const as = (id: string) => ({ caps: { profile: { id, name: 'Me' } } })

const questions = (over: object = {}) => ({
  transaction_id: 'b1', tutorial_title: 'Bubble machine', requester_suburb: 'Newtown', open: true, family: false,
  threads: [{ maker_id: 'm1', maker_name: 'Tom', messages: [{ id: 'q1', sender_id: 'm1', body: 'Which switch?', created_at: '2026-09-30T00:00:00Z' }] }],
  ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  mockCaps.mockReturnValue(as('m1'))
  mockGet.mockResolvedValue(questions())
  mockPost.mockResolvedValue({})
})

describe('AskFirstScreen', () => {
  it('shows the board’s stage card and lets the maker ask', async () => {
    render(<AskFirstScreen id="b1" />)
    expect(await screen.findByText('Not claimed yet')).toBeTruthy()
    expect(screen.getByText('Ask about the parts or the switch. Claiming is one tap when you are ready.')).toBeTruthy()
    fireEvent.changeText(screen.getByLabelText('Message'), 'Any batteries?')
    fireEvent.press(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/b1/questions', { body: 'Any batteries?' }))
  })

  it('claims in one tap and goes to the build thread', async () => {
    render(<AskFirstScreen id="b1" />)
    fireEvent.press(await screen.findByRole('button', { name: "I'll build this" }))
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/exchanges/build/b1'))
  })

  it('lets the family pick which maker to answer, and offers them no claim', async () => {
    mockCaps.mockReturnValue(as('fam'))
    mockGet.mockResolvedValue(
      questions({
        family: true,
        threads: [
          { maker_id: 'm1', maker_name: 'Tom', messages: [{ id: 'q1', sender_id: 'm1', body: 'Which switch?', created_at: '2026-09-30T00:00:00Z' }] },
          { maker_id: 'm2', maker_name: 'Rachel', messages: [{ id: 'q2', sender_id: 'm2', body: 'Have the toy?', created_at: '2026-09-30T01:00:00Z' }] },
        ],
      })
    )
    render(<AskFirstScreen id="b1" />)
    fireEvent.press(await screen.findByRole('radio', { name: 'Rachel' }))
    expect(screen.getByLabelText('Rachel said: Have the toy?')).toBeTruthy()
    fireEvent.changeText(screen.getByLabelText('Message'), 'Yes')
    fireEvent.press(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/b1/questions', { body: 'Yes', maker_id: 'm2' }))
    expect(screen.queryByRole('button', { name: "I'll build this" })).toBeNull()
  })
})
```

Append to the mobile `makers-wanted-screen.test.tsx`:

```tsx
  it('opens Ask first for an open request', async () => {
    render(<MakersWantedScreen />)
    fireEvent.press(await screen.findByRole('button', { name: 'Ask first' }))
    expect(mockPush).toHaveBeenCalledWith('/exchanges/build/ask/b1')
  })
```

`packages/web/tests/unit/components/build-questions.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { BuildQuestionsThread } from '@/components/build-questions'
import { browserApiClient } from '@/lib/browser-api-client'

const refresh = vi.fn()
const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push }) }))
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { post: vi.fn() } }))

const data = {
  transaction_id: 'b1', tutorial_title: 'Bubble machine', requester_suburb: 'Newtown', open: true, family: false,
  threads: [{ maker_id: 'm1', maker_name: 'Tom', messages: [{ id: 'q1', sender_id: 'fam', body: 'A big button.', created_at: '2026-09-30T00:00:00Z' }] }],
}

describe('BuildQuestionsThread', () => {
  it('shows the stage card and the family’s reply, and sends a question', async () => {
    vi.mocked(browserApiClient.post).mockResolvedValue({})
    render(<BuildQuestionsThread data={data} viewerId="m1" makerId={null} />)
    expect(screen.getByText('Asking first')).toBeInTheDocument()
    expect(screen.getByText('Not claimed yet')).toBeInTheDocument()
    expect(screen.getByText('A big button.')).toBeInTheDocument()
    expect(screen.getByText('Family in Newtown')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), { target: { value: 'Batteries?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(browserApiClient.post).toHaveBeenCalledWith('/api/toy-transactions/b1/questions', { body: 'Batteries?' }))
    expect(refresh).toHaveBeenCalled()
  })
})
```

Mobile `notifications.test.ts` (`describe('linkFor')`):

```ts
  it('opens Ask first for a question about an unclaimed build', () => {
    expect(linkFor(notification({ type: 'build_question', toy_transaction_id: 'b1' }))).toBe('/exchanges/build/ask/b1')
  })
```

Web `notification-bucket.test.ts`: raise the length by one again, and add `'build_question'` to the sorted `typesInBucket('exchanges')` list (it sorts first: `'build_approved', 'build_question', 'build_shot_posted', …`).

- [ ] **Step 2: Run them to see them fail**

Run the integration file → FAIL (`relation "public.build_request_questions" does not exist` / 404). Run the three new unit files, the makers screen test, and the two notification tests → FAIL.

- [ ] **Step 3: The migration**

Re-read the latest type check first: `grep -ln "notifications_type_check" supabase/migrations/*.sql | sort | tail -1` → `109_challenge_guide_published.sql` (or later — copy that one's list).

`supabase/migrations/111_build_request_questions.sql`:

```sql
-- 111 — Ask first: a maker's private questions before claiming a build
-- (makers-ask-first).
--
-- One thread per (request, maker). The family reads every thread on their
-- request; a maker reads their own, before and after the claim. Writing stops
-- at the claim: a maker into their own thread, the family into any thread on
-- their request (the API also requires that maker to have asked). On claim the
-- API copies the claimer's thread into toy_transaction_messages, so the build
-- thread starts with what was asked.
--
-- toy_transactions is read inside the policies as the caller: a maker who is
-- not a party sees an unclaimed build through 064's open-builds policy, which
-- is exactly the window asking is allowed in.
--
-- build_question rides on toy_transaction_id — 077's one-subject check already
-- admits it, so only the type check is recreated.
--
-- DOWN:
--   drop table if exists public.build_request_questions;
--   (restore 109's notifications_type_check)

create table public.build_request_questions (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.toy_transactions (id) on delete cascade,
  maker_id uuid not null references public.profiles (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index build_request_questions_thread_idx
  on public.build_request_questions (transaction_id, maker_id, created_at);

alter table public.build_request_questions enable row level security;

create policy build_request_questions_read on public.build_request_questions for select to authenticated
  using (
    maker_id = auth.uid()
    or exists (select 1 from public.toy_transactions t where t.id = transaction_id and t.requester_id = auth.uid())
  );

create policy build_request_questions_insert on public.build_request_questions for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.toy_transactions t
       where t.id = transaction_id
         and t.type = 'build' and t.status = 'requested'
         and t.owner_id is null and t.owner_org_id is null
         and (
           (maker_id = auth.uid() and t.requester_id <> auth.uid())
           or t.requester_id = auth.uid()
         )
    )
  );

grant select, insert on public.build_request_questions to authenticated;

-- 046's guard, again.
do $$
declare
  def  text;
  lost text;
begin
  select pg_get_constraintdef(oid) into def
    from pg_constraint
   where conname = 'notifications_type_check' and conrelid = 'public.notifications'::regclass;
  if def is null then raise exception 'notifications_type_check is absent'; end if;
  select string_agg(distinct m[1], ', ') into lost
    from regexp_matches(def, '''([a-z_]+)''', 'g') as m
   where m[1] not in (
     'collaborator_invited', 'collaborator_accepted', 'collaborator_declined',
     'collaborator_removed', 'collaborator_left',
     'tutorial_approved', 'tutorial_rejected',
     'toy_request', 'toy_accepted', 'toy_rejected', 'toy_withdrawn', 'toy_message',
     'idea_approved', 'idea_rejected',
     'challenge_joined', 'challenge_left', 'challenge_removed',
     'idea_graduated', 'backing_requested', 'tutorial_submitted',
     'build_shot_posted', 'build_approved', 'print_started', 'print_ready',
     'tutorial_thanked',
     'org_event_published', 'org_story_published', 'org_message', 'org_thanked',
     'tutorial_noted', 'challenge_guide_published',
     'build_question'
   );
  if lost is not null then
    raise exception 'live notifications_type_check permits values 111 would drop: %', lost;
  end if;
end $$;

alter table public.notifications drop constraint notifications_type_check;

alter table public.notifications add constraint notifications_type_check
  check (type in (
    'collaborator_invited', 'collaborator_accepted', 'collaborator_declined',
    'collaborator_removed', 'collaborator_left',
    'tutorial_approved', 'tutorial_rejected',
    'toy_request', 'toy_accepted', 'toy_rejected', 'toy_withdrawn', 'toy_message',
    'idea_approved', 'idea_rejected',
    'challenge_joined', 'challenge_left', 'challenge_removed',
    'idea_graduated', 'backing_requested', 'tutorial_submitted',
    'build_shot_posted', 'build_approved', 'print_started', 'print_ready',
    'tutorial_thanked',
    'org_event_published', 'org_story_published', 'org_message', 'org_thanked',
    'tutorial_noted', 'challenge_guide_published',
    -- new in 111
    'build_question'
  ));
```

Run: `supabase migration up`. Guard rows:

```sql
  -- 111. Without RLS every maker reads every other maker's questions.
  ('111 build_request_questions has RLS on',
   (select relrowsecurity from pg_class where oid = 'public.build_request_questions'::regclass)),

  ('111 notifications_type_check permits build_question',
   (select count(*) = 1 from pg_constraint
      where conname = 'notifications_type_check'
        and pg_get_constraintdef(oid) like '%build_question%'))
```

- [ ] **Step 4: Types and the API**

`packages/types/src/builds.ts`: append the three interfaces from Interfaces; re-export them as types from index.ts beside `BuildUrgency`. In index.ts add `| 'build_question'` to `NotificationType`, `build_question: 'exchanges',` to the bucket, and to `COPY`:

```ts
  // 111: either way round — a maker asking, or the family answering — before a claim.
  build_question: (n) => `${n.actor_name} wrote about ${n.toy_name} before anyone claimed it`,
```

`toy-transactions.ts` — import the types; add, after POST `/:id/claim`:

```ts
/** The build row the two question routes decide by, read past RLS. */
async function loadBuild(admin: ReturnType<typeof createAdminClient>, id: string) {
  const { data, error } = await admin
    .from('toy_transactions')
    .select('id, type, status, requester_id, owner_id, owner_org_id, tutorial_id, toy_id, requester_suburb')
    .eq('id', id)
    .maybeSingle()
  if (error && error.code !== INVALID_TEXT_REPRESENTATION) return { error }
  if (!data || data.type !== 'build') return { missing: true as const }
  return { tx: data, open: data.status === 'requested' && !data.owner_id && !data.owner_org_id }
}

/**
 * GET /api/toy-transactions/:id/questions — Ask first (makers-ask-first).
 * RLS (111) picks the rows: every thread for the family, a maker's own for a
 * maker. Somebody with no thread on a build that is no longer open learns
 * nothing about it.
 */
toyTransactions.get('/:id/questions', async (c) => {
  const userId = c.get('userId')
  const admin = createAdminClient()
  const loaded = await loadBuild(admin, c.req.param('id'))
  if ('error' in loaded) return c.json({ error: loaded.error!.message }, 500)
  if ('missing' in loaded) return c.json({ error: 'Not found' }, 404)
  const { tx, open } = loaded
  const family = tx.requester_id === userId

  const { data: rows, error } = await createUserClient(c.get('token'))
    .from('build_request_questions')
    .select('id, maker_id, sender_id, body, created_at')
    .eq('transaction_id', tx.id)
    .order('created_at', { ascending: true })
  if (error) return c.json({ error: error.message }, 500)
  if (!family && !open && !(rows ?? []).length) return c.json({ error: 'Not found' }, 404)

  const makerIds = [...new Set((rows ?? []).map((r) => r.maker_id as string))]
  const names = new Map(await Promise.all(makerIds.map(async (m) => [m, await profileName(admin, m, 'A maker')] as const)))
  const body: BuildQuestions = {
    transaction_id: tx.id,
    tutorial_title: await subjectName(admin, tx as { type: string; toy_id: string | null; tutorial_id: string | null }),
    requester_suburb: tx.requester_suburb,
    open,
    family,
    threads: makerIds.map((m) => ({
      maker_id: m,
      maker_name: names.get(m)!,
      messages: (rows ?? []).filter((r) => r.maker_id === m).map(({ maker_id: _m, ...q }) => q as BuildQuestion),
    })),
  }
  return c.json(body)
})

/**
 * POST /api/toy-transactions/:id/questions — body: { body, maker_id? }.
 * A maker always writes into their own thread (any maker_id they send is
 * ignored); the family names the thread, and only a maker who asked has one.
 * The insert runs as the caller, so 111's policy is the last word.
 */
toyTransactions.post('/:id/questions', async (c) => {
  const parsed = await c.req.json().catch(() => null)
  const text = typeof parsed?.body === 'string' ? parsed.body.trim() : ''
  if (text.length < 1 || text.length > 1000) return c.json({ error: 'Write a question of up to 1000 characters.' }, 400)

  const userId = c.get('userId')
  const admin = createAdminClient()
  const loaded = await loadBuild(admin, c.req.param('id'))
  if ('error' in loaded) return c.json({ error: loaded.error!.message }, 500)
  if ('missing' in loaded) return c.json({ error: 'Not found' }, 404)
  const { tx, open } = loaded
  if (!open) return c.json({ error: 'Somebody has already claimed this one.' }, 409)

  const family = tx.requester_id === userId
  let makerId = userId
  if (family) {
    makerId = typeof parsed?.maker_id === 'string' ? parsed.maker_id : ''
    const { data: asked } = await admin
      .from('build_request_questions')
      .select('id')
      .eq('transaction_id', tx.id)
      .eq('maker_id', makerId)
      .eq('sender_id', makerId)
      .limit(1)
      .maybeSingle()
    if (!asked) return c.json({ error: 'That maker has not asked about this request.' }, 404)
  }

  const { data, error } = await createUserClient(c.get('token'))
    .from('build_request_questions')
    .insert({ transaction_id: tx.id, maker_id: makerId, sender_id: userId, body: text })
    .select('id, sender_id, body, created_at')
    .single()
  if (error?.code === RLS_VIOLATION) return c.json({ error: 'You cannot ask about this request.' }, 403)
  if (error) return c.json({ error: error.message }, 500)

  await admin.from('notifications').insert({
    recipient_id: family ? makerId : tx.requester_id,
    type: 'build_question',
    toy_transaction_id: tx.id,
    toy_name: await subjectName(admin, tx as { type: string; toy_id: string | null; tutorial_id: string | null }),
    // The family is "Family in Newtown" to a maker until a claim, as on the card.
    actor_name: family ? `Family in ${tx.requester_suburb ?? 'your area'}` : await profileName(admin, userId, 'A maker'),
  })
  return c.json(data, 201)
})
```

In POST `/:id/claim`, after the conditional update succeeds and before the `${makerName} claimed this build.` system message:

```ts
  // What this maker asked first stays with the build (makers-ask-first): their
  // thread is copied in with its own times, so it reads ahead of the claim.
  const { data: asked } = await admin
    .from('build_request_questions')
    .select('sender_id, body, created_at')
    .eq('transaction_id', tx.id)
    .eq('maker_id', userId)
    .order('created_at', { ascending: true })
  if (asked?.length) {
    await admin.from('toy_transaction_messages').insert(
      asked.map((q) => ({ transaction_id: tx.id, sender_id: q.sender_id, kind: 'user', body: q.body, created_at: q.created_at }))
    )
  }
```

- [ ] **Step 5: Mobile**

`packages/mobile/components/builds/ask-first-screen.tsx`:

```tsx
// packages/mobile/components/builds/ask-first-screen.tsx
/**
 * Ask first (makers-ask-first): a maker's private questions to the family
 * before claiming, laid out as the board's build thread at its "asking" stage.
 * The family sees one thread per maker who asked and picks which to answer.
 * Claiming is the same one tap as on the board, and the thread moves into the
 * build thread (POST /:id/claim copies it).
 */
import { useCallback, useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { apiMessage, type BuildQuestions } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { useCapabilities } from '../../lib/capabilities'
import { theme } from '../../lib/theme'
import { Screen } from '../ui/Screen'
import { Card } from '../ui/Card'
import { Chip } from '../ui/Chip'
import { Button } from '../ui/Button'
import { TextField } from '../ui/TextField'
import { MessageBubble } from '../ui/MessageBubble'
import { SkeletonRow } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'
import { ErrorRow } from '../ui/ErrorRow'

export function AskFirstScreen({ id }: { id: string }) {
  const router = useRouter()
  const { caps } = useCapabilities()
  const viewerId = caps?.profile.id ?? null
  const [data, setData] = useState<BuildQuestions | null>(null)
  const [failed, setFailed] = useState(false)
  const [makerId, setMakerId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setData(await apiClient.get<BuildQuestions>(`/api/toy-transactions/${id}/questions`))
      setFailed(false)
    } catch (err) {
      console.error('[AskFirstScreen] questions fetch failed:', err)
      setFailed(true)
    }
  }, [id])

  useFocusEffect(
    useCallback(() => {
      void load()
    }, [load])
  )

  if (!data) {
    return failed ? (
      <Screen>
        <EmptyState icon="cloud-offline-outline" title="Couldn't load the board." hint="Check your connection and try again." />
      </Screen>
    ) : (
      <Screen>
        <SkeletonRow />
      </Screen>
    )
  }

  const thread = data.family
    ? data.threads.find((t) => t.maker_id === (makerId ?? data.threads[0]?.maker_id))
    : data.threads[0]
  // Whoever is not the viewer: the maker to the family, "Family in …" to a maker.
  const otherName = data.family ? thread?.maker_name ?? 'A maker' : `Family in ${data.requester_suburb ?? 'your area'}`
  const canWrite = data.open && (!data.family || thread !== undefined)

  async function send() {
    const body = draft.trim()
    if (!body || !data) return
    setBusy(true)
    setError(null)
    try {
      await apiClient.post(`/api/toy-transactions/${id}/questions`, data.family ? { body, maker_id: thread!.maker_id } : { body })
      setDraft('')
      await load()
    } catch (err) {
      setError(apiMessage(err, 'Could not send that. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  async function claim() {
    setBusy(true)
    setError(null)
    try {
      await apiClient.post(`/api/toy-transactions/${id}/claim`, {})
      router.replace(`/exchanges/build/${id}`)
    } catch (err) {
      setError(apiMessage(err, 'That did not go through. Try once more.'))
      setBusy(false)
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card style={styles.stage}>
          <Text style={styles.kicker}>Asking first</Text>
          <Text style={styles.title}>Not claimed yet</Text>
          <Text style={styles.body}>Ask about the parts or the switch. Claiming is one tap when you are ready.</Text>
        </Card>
        <Text style={styles.guide}>{data.tutorial_title}</Text>

        {data.family && data.threads.length > 1 ? (
          <View accessibilityRole="radiogroup" style={styles.chips}>
            {data.threads.map((t) => (
              <Chip
                key={t.maker_id}
                role="radio"
                label={t.maker_name}
                active={t.maker_id === thread?.maker_id}
                onPress={() => setMakerId(t.maker_id)}
              />
            ))}
          </View>
        ) : null}

        <View accessibilityRole="list" accessibilityLabel="Conversation" style={styles.log}>
          {(thread?.messages ?? []).map((m) => (
            <MessageBubble
              key={m.id}
              message={{ ...m, kind: 'user' }}
              mine={m.sender_id === viewerId}
              senderName={otherName}
            />
          ))}
        </View>

        <ErrorRow message={error} />

        {canWrite ? (
          <View style={styles.composer}>
            <View style={styles.composerField}>
              <TextField accessibilityLabel="Message" placeholder="Message" value={draft} onChangeText={setDraft} multiline maxLength={1000} />
            </View>
            <Button label="Send" disabled={busy || !draft.trim()} onPress={() => void send()} />
          </View>
        ) : null}

        {data.open && !data.family ? (
          <Button label="I'll build this" loading={busy} onPress={() => void claim()} />
        ) : null}
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { paddingBottom: theme.spacing(6), gap: theme.spacing(3) },
  stage: { gap: theme.spacing(1), padding: theme.spacing(4), backgroundColor: theme.colors.mintSoft },
  kicker: { fontFamily: theme.fonts.black, fontSize: 11, letterSpacing: 0.9, textTransform: 'uppercase', color: theme.colors.ink },
  title: { fontFamily: theme.fonts.display, fontSize: theme.type.body, color: theme.colors.ink },
  body: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.ink, lineHeight: 19 },
  guide: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(1.5) },
  log: { gap: theme.spacing(2) },
  composer: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing(2) },
  composerField: { flex: 1 },
})
```

`packages/mobile/app/(my)/exchanges/build/ask/[id].tsx`:

```tsx
import { useLocalSearchParams } from 'expo-router'
import { AskFirstScreen } from '../../../../../components/builds/ask-first-screen'

export default function AskFirstRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return <AskFirstScreen id={id} />
}
```

`packages/mobile/app/(my)/_layout.tsx`, after the `exchanges/build/[id]` screen: `<Stack.Screen name="exchanges/build/ask/[id]" options={{ title: 'Ask first' }} />`.

`makers-wanted-screen.tsx`: header comment — delete the "Ask first" bullet; `BuildCard` gains `onAsk: () => void` (passed `() => router.push(`/exchanges/build/ask/${b.id}`)`) and the `PendingButton pending="makers-ask-first"` becomes `<Button label="Ask first" variant="ghost" onPress={onAsk} style={styles.footButton} />`; drop the `../ui/pending` import if nothing else in the file uses it (the `PENDING(locations-and-distance)` comment stays — it is a comment, not an import).

`build-thread-screen.tsx`: under the head card, for the family on an unclaimed request:

```tsx
          {c.isFamily && tx.status === 'requested' && !tx.owner_id && !tx.owner_org_id ? (
            <Button label="Asking first" variant="secondary" onPress={() => router.push(`/exchanges/build/ask/${id}`)} />
          ) : null}
```

(use the screen's existing `router`; add `const router = useRouter()` from expo-router if it has none).

`packages/mobile/lib/notifications.ts`, first line of `linkFor`: `if (n.type === 'build_question' && n.toy_transaction_id) return `/exchanges/build/ask/${n.toy_transaction_id}``. `packages/mobile/lib/pending-icons.ts`: delete the `'makers-ask-first'` entry.

- [ ] **Step 6: Web**

`packages/web/components/build-questions.tsx`:

```tsx
'use client'
/**
 * Ask first (makers-ask-first): the private thread between one maker and the
 * family before anyone claims. The family picks the maker by ?maker=; a maker
 * sees their own. Server-rendered data, refreshed after each send.
 */
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { BuildQuestions } from '@splat-connect/types'
import { browserApiClient } from '@/lib/browser-api-client'

export function BuildQuestionsThread({ data, viewerId, makerId }: { data: BuildQuestions; viewerId: string; makerId: string | null }) {
  const router = useRouter()
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const thread = data.family ? data.threads.find((t) => t.maker_id === (makerId ?? data.threads[0]?.maker_id)) : data.threads[0]
  const other = data.family ? thread?.maker_name ?? 'A maker' : `Family in ${data.requester_suburb ?? 'your area'}`

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const body = draft.trim()
    if (!body) return
    setBusy(true)
    setError(null)
    try {
      await browserApiClient.post(
        `/api/toy-transactions/${data.transaction_id}/questions`,
        data.family ? { body, maker_id: thread!.maker_id } : { body }
      )
      setDraft('')
      router.refresh()
    } catch {
      setError('Could not send that. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function claim() {
    setBusy(true)
    try {
      await browserApiClient.post(`/api/toy-transactions/${data.transaction_id}/claim`, {})
      router.push(`/dashboard/exchanges/build/${data.transaction_id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not go through. Try once more.')
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-card p-5" style={{ background: 'var(--tmint)', color: 'var(--tink)' }}>
        <p className="text-xs font-extrabold uppercase tracking-[.08em]">Asking first</p>
        <p className="mt-1 font-display text-xl font-extrabold">Not claimed yet</p>
        <p className="mt-1 text-sm leading-[1.5]">Ask about the parts or the switch. Claiming is one tap when you are ready.</p>
      </div>
      <h1 className="font-display text-2xl font-extrabold text-ink">{data.tutorial_title}</h1>

      {data.family && data.threads.length > 1 && (
        <nav aria-label="Makers who asked" className="flex flex-wrap gap-2">
          {data.threads.map((t) => (
            <Link
              key={t.maker_id}
              href={`?maker=${t.maker_id}`}
              aria-current={t.maker_id === thread?.maker_id ? 'page' : undefined}
              className={`chip ${t.maker_id === thread?.maker_id ? 'bg-[var(--b100)]' : ''}`}
            >
              {t.maker_name}
            </Link>
          ))}
        </nav>
      )}

      <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
        {(thread?.messages ?? []).map((m) => (
          <li key={m.id} className={`max-w-[80%] rounded-[18px] px-4 py-3 text-[15px] ${m.sender_id === viewerId ? 'self-end bg-[var(--b100)]' : 'bg-[var(--surface2)]'}`}>
            {m.sender_id !== viewerId && <span className="block text-xs font-extrabold text-muted">{other}</span>}
            {m.body}
          </li>
        ))}
      </ol>

      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}

      {data.open && (!data.family || thread) && (
        <form onSubmit={send} className="flex items-start gap-2.5">
          <textarea aria-label="Message" placeholder="Message" rows={2} maxLength={1000} value={draft} onChange={(e) => setDraft(e.target.value)} className="field flex-1" />
          <button type="submit" disabled={busy || !draft.trim()} className="btn btn-primary min-h-11 px-[18px]">
            Send
          </button>
        </form>
      )}
      {data.open && !data.family && (
        <button type="button" disabled={busy} onClick={claim} className="btn btn-primary min-h-12 self-start px-[22px]">
          I&apos;ll build this
        </button>
      )}
    </div>
  )
}
```

`packages/web/app/dashboard/exchanges/build/[id]/ask/page.tsx`:

```tsx
/**
 * Ask first (makers-ask-first): GET /api/toy-transactions/:id/questions, then
 * the client thread. A 404 from the API (a stranger to a claimed build) is a
 * page-level not found.
 */
import { notFound } from 'next/navigation'
import type { BuildQuestions } from '@splat-connect/types'
import { requireCapabilities } from '@/lib/require-capabilities'
import { apiClient } from '@/lib/api-client'
import { BuildQuestionsThread } from '@/components/build-questions'

export default async function AskFirstPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ maker?: string }>
}) {
  const caps = await requireCapabilities()
  const { id } = await params
  const { maker } = await searchParams
  const data = await apiClient.get<BuildQuestions>(`/api/toy-transactions/${id}/questions`).catch(() => null)
  if (!data) notFound()
  return (
    <div className="max-w-[760px]">
      <BuildQuestionsThread data={data} viewerId={caps.profile.id} makerId={maker ?? null} />
    </div>
  )
}
```

`makers-wanted-board.tsx`: replace the `<PendingButton pending="makers-ask-first" … />` with `<Link href={`/dashboard/exchanges/build/${b.id}/ask`} className="btn btn-quiet min-h-11 px-[18px] text-sm">Ask first</Link>`; drop the `PendingButton` import; replace the header comment's "ponytail: the artboard draws a second button, "Ask first" … Add it when messages can belong to an unowned transaction." paragraph with "Ask first opens a private thread with the family (111) without claiming."

`packages/web/app/dashboard/exchanges/build/[id]/page.tsx`, above `<StageRailCard …>`:

```tsx
        {tx.status === 'requested' && !tx.owner_id && !tx.owner_org_id && tx.requester_id === caps.profile.id && (
          <Link href={`/dashboard/exchanges/build/${id}/ask`} className="btn btn-quiet mb-4">
            Asking first
          </Link>
        )}
```

`notifications-list.tsx`: `build_question: [ChatCircleDots, 'var(--tmint)'],` in `ICON` (import `ChatCircleDots` from phosphor if absent), and as the first line of `linkFor`: `if (n.type === 'build_question' && n.toy_transaction_id) return `/dashboard/exchanges/build/${n.toy_transaction_id}/ask``. `packages/web/lib/pending-icons.ts`: delete the `'makers-ask-first'` entry and `ChatCircleDots` from its import if unused. (`tests/unit/components/pending-button.test.tsx` keeps `pending="makers-ask-first"` — tests are outside the registry's reference scan, and the component only builds a link.)

- [ ] **Step 7: Run the tests to see them pass**

Run every command from Step 2 → PASS. Re-run `tests/integration/toy-transactions/open-builds.test.ts` and `builds.test.ts` → PASS (claim without questions copies nothing). `pnpm typecheck` → exit 0.

- [ ] **Step 8: Ship the item**

Set `shipped: true` on `'makers-ask-first'`, `node scripts/pending.mjs`, drift test.

- [ ] **Step 9: Commit**

```bash
git status --short
git add supabase/migrations/111_build_request_questions.sql packages/api/src/routes/toy-transactions.ts packages/types/src/builds.ts packages/types/src/index.ts packages/mobile/components/builds/ask-first-screen.tsx "packages/mobile/app/(my)/exchanges/build/ask/[id].tsx" "packages/mobile/app/(my)/_layout.tsx" packages/mobile/components/builds/makers-wanted-screen.tsx packages/mobile/components/builds/build-thread-screen.tsx packages/mobile/lib/notifications.ts packages/mobile/lib/pending-icons.ts packages/web/components/build-questions.tsx "packages/web/app/dashboard/exchanges/build/[id]/ask/page.tsx" packages/web/components/makers-wanted-board.tsx "packages/web/app/dashboard/exchanges/build/[id]/page.tsx" packages/web/components/notifications-list.tsx packages/web/lib/pending-icons.ts scripts/check-schema-guards.sh packages/api/tests/integration/toy-transactions/questions.test.ts packages/mobile/tests/unit/components/builds/ask-first-screen.test.tsx packages/mobile/tests/unit/components/builds/makers-wanted-screen.test.tsx packages/mobile/tests/unit/lib/notifications.test.ts packages/web/tests/unit/components/build-questions.test.tsx packages/web/tests/unit/lib/notification-bucket.test.ts packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(builds): Ask first — a private thread with the family before claiming (111)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 16: Full verification and graph update

No new code. Every check the spec names, in an order where a failure points at one thing.

**Files:**
- Modify (generated only): `graphify-out/*`, `scripts/parity/parity-report.json`, `scripts/parity/app-parity-report.json`, `scripts/parity/mobile-report.json`

- [ ] **Step 1: Registry and drift**

Run: `node scripts/pending.mjs --check`
Expected: `docs/PENDING.md is up to date`
Run: `git grep -nE 'PENDING\((idea-required-fields|build-request-options|challenge-thread-tab|challenge-outcome-tab|challenge-maker-meta|challenge-saves-stat|idea-photo|challenge-brief-photo|challenge-author-states|idea-anonymous|challenge-writeup-stage|challenge-constraints|makers-row-meta|makers-live-done-tabs|makers-ask-first)\)|pending="(idea-required-fields|build-request-options|challenge-thread-tab|challenge-outcome-tab|challenge-maker-meta|challenge-saves-stat|idea-photo|challenge-brief-photo|challenge-author-states|idea-anonymous|challenge-writeup-stage|challenge-constraints|makers-row-meta|makers-live-done-tabs|makers-ask-first)"' -- . ':!docs/**' ':!packages/types/src/pending.ts' ':!**/tests/**'`
Expected: no output.
Run the drift test. Expected: `Tests  11 passed (11)`.

- [ ] **Step 2: Types and unit suites**

Run: `pnpm typecheck` → exit 0.
Run: `pnpm --filter @splat-connect/api test:unit` → all pass.
Run: `pnpm --filter @splat-connect/web test:unit` → all pass.
Run: `pnpm --filter @splat-connect/mobile test:unit` → all pass.

- [ ] **Step 3: API integration against a clean local database**

Run: `supabase db reset` (applies every migration through 111 from scratch — proves 103–111 each run on their own, including 104's constraint swap, 108's revoke and the two type-check guards), then `pnpm --filter @splat-connect/api test:integration`.
Expected: all pass, including `tests/integration/toy-ideas/{optional-fields,maker-meta,save-count,photo,withdraw,anonymous,writeup,constraints}.test.ts` and `tests/integration/toy-transactions/{build-note,row-meta,builds-board,questions}.test.ts`.

- [ ] **Step 4: E2E** (web and mobile never at the same time)

Run: `pnpm --filter @splat-connect/web test:e2e` → PASS (any spec that filled the idea form's Intended use / Primary user fails here: update it to the board's fields, importing only from `tests/e2e/helpers.ts`).
Then: `pnpm --filter @splat-connect/mobile test:e2e` → PASS.

- [ ] **Step 5: Parity re-run**

Run: `./scripts/parity/stack.sh up`, then from `packages/web`: `node ../../scripts/parity/run.js` and `node ../../scripts/parity/app.js --id challenge_detail,challenge_new,makers_wanted,mw_new,build_thread`.
Expected: web keeps its prior count with no new findings on `/get-involved/design-challenges/[id]`, `/get-involved/submit-an-idea`, `/get-involved/makers-wanted`; the app screens report no `pending` exemption errors. A new finding is a real divergence to fix or explain with `why: "intended"` and a reason — never `why: "pending"` naming a shipped id. Then `node scripts/parity/mobile.js --id challenge_detail,challenge_new,makers_wanted` for the 390px width check (the four Makers wanted tabs and four stat tiles must fit one row).

- [ ] **Step 6: Graph update**

Run: `graphify update .`
Expected: completes without error; `graphify-out/` updated.

- [ ] **Step 7: Commit the generated reports**

```bash
git add graphify-out scripts/parity/parity-report.json scripts/parity/app-parity-report.json scripts/parity/mobile-report.json
git commit -m "chore(challenges): parity reports and graph after the challenges and makers batch

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

Hosted database: migrations 103–111 are **not** pushed by this plan. Pushing to the live "development" project is a separate step Byron approves (`supabase db push`, then `pnpm db:guards`, which now checks the 105, 107, 108, 109, 110 and 111 rows). 108 revokes a column from anon on the live project: check no deployed client reads `toy_ideas.author_id` with the anon key first (`git grep -n "toy_ideas" packages/mobile packages/web` — only the provision script, which uses the service role).
