# Mobile Guide Authoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mobile tutorial editor's horizontal step rail with a checklist hub and one screen per section, autosaving throughout, and stop the API reporting success for deletes it did not perform.

**Architecture:** The 931-line `editor.tsx` splits into a pure gap module, one state hook, a hub, and six section screens under a nested expo-router stack. The hub's rows are `getMissingFields` rendered directly, so "what is missing" and "where you fix it" stop being two separate ideas. All writes go through one hook that owns debouncing, serialisation, the `updated_at` concurrency token and the approved→pending requeue, so no section screen knows about any of them.

**Tech Stack:** React Native 0.86 / Expo SDK 54, expo-router, TypeScript strict, Jest + @testing-library/react-native 13, Playwright (mobile web target), Hono + Supabase on the API.

**Spec:** `docs/superpowers/specs/2026-09-02-mobile-guide-authoring-design.md`, then
`docs/superpowers/specs/2026-09-02-web-draft-delete-design.md` (Phase 2, Task 10).

## Global Constraints

- **Debounce is 250ms, not the spec's 800ms.** `lib/use-child-profile.ts` already autosaves at 250 and is the established precedent; matching it beats inventing a second interval. This is the one deliberate deviation from the spec.
- **Every PATCH carries `updated_at`.** The API uses it as an optimistic-concurrency token and 400s without it. The response's `updated_at` must be merged back before the next write starts.
- **A save on an `approved` or `rejected` tutorial also sets `status: 'pending'`.** RLS only admits contributor updates in draft/pending/rejected.
- **Never claim a write landed when it did not.** A failed save keeps the value on screen and surfaces an error; it never silently reverts or falsely reports success.
- **STL is assistive-tech only.** A `toy_adaptation` never shows the row, never reports the gap.
- **Delete is draft-only, and absent rather than disabled off a draft.**
- **Copy:** "Delete draft" (never "Delete guide"). Section labels: Details, Safety, Parts, Tools, Files, 3D print files.
- Follow the existing file-header comment style: a `// packages/mobile/...` path line, then a comment explaining *why* where the reason is not obvious.

---

### Task 1: The gap module

Pure logic, no React. Extracted from `editor.tsx` so the hub's correctness is a function that can be tested as one.

**Files:**
- Create: `packages/mobile/lib/tutorial-sections.ts`
- Test: `packages/mobile/tests/unit/lib/tutorial-sections.test.ts`

**Interfaces:**
- Consumes: `TutorialWithDetails`, `TutorialKind` from `@splat-connect/types`
- Produces:
  - `type SectionId = 'details' | 'safety' | 'parts' | 'tools' | 'files' | 'stl'`
  - `interface Gap { section: SectionId; label: string }`
  - `getMissingFields(t: TutorialWithDetails): Gap[]`
  - `sectionsFor(kind: TutorialKind): SectionId[]`
  - `SECTION_LABEL: Record<SectionId, string>`
  - `sectionSummary(section: SectionId, t: TutorialWithDetails): string`

- [ ] **Step 1: Write the failing test**

```ts
// packages/mobile/tests/unit/lib/tutorial-sections.test.ts
import {
  getMissingFields,
  sectionsFor,
  sectionSummary,
  SECTION_LABEL,
} from '../../../lib/tutorial-sections'
import type { TutorialWithDetails } from '@splat-connect/types'

const base = (over: Partial<TutorialWithDetails> = {}): TutorialWithDetails =>
  ({
    id: 't1',
    title: 'A guide',
    description: null,
    kind: 'toy_adaptation',
    difficulty: 'easy',
    maturity: 'complete',
    status: 'draft',
    updated_at: '2026-09-02T00:00:00Z',
    safety_declared_at: '2026-09-02T00:00:00Z',
    tutorial_pdf_url: 'p.pdf',
    toy_photo_url: 'p.jpg',
    parts: [{ name: 'Switch' }],
    tools: [{ name: 'Screwdriver' }],
    stl_files: [],
    tutorial_contributors: [],
    tutorial_recommendations: [],
    ...over,
  }) as unknown as TutorialWithDetails

describe('getMissingFields', () => {
  it('reports nothing for a complete toy adaptation', () => {
    expect(getMissingFields(base())).toEqual([])
  })

  // The one divergence from web's lib/validation.ts, deliberate: safety is its
  // own row on the hub, so its gap must route there rather than to Details.
  it('routes the safety gap to its own section, not to details', () => {
    const gaps = getMissingFields(base({ safety_declared_at: null }))
    expect(gaps).toEqual([{ section: 'safety', label: 'The safety declaration' }])
  })

  it('reports every gap of an empty draft, each against the section that closes it', () => {
    const gaps = getMissingFields(
      base({
        title: '  ',
        difficulty: 'nonsense' as never,
        tutorial_pdf_url: null,
        toy_photo_url: null,
        parts: [],
        tools: [],
        safety_declared_at: null,
      })
    )
    expect(gaps).toEqual([
      { section: 'details', label: 'A title' },
      { section: 'details', label: 'A difficulty' },
      { section: 'files', label: 'The guide PDF' },
      { section: 'files', label: 'A photo' },
      { section: 'parts', label: 'A part' },
      { section: 'tools', label: 'A tool' },
      { section: 'safety', label: 'The safety declaration' },
    ])
  })

  it('requires an STL only for assistive tech', () => {
    expect(getMissingFields(base({ kind: 'toy_adaptation', stl_files: [] }))).toEqual([])
    expect(getMissingFields(base({ kind: 'assistive_tech', stl_files: [] }))).toEqual([
      { section: 'stl', label: 'A 3D-print file' },
    ])
  })
})

describe('sectionsFor', () => {
  it('gives a toy adaptation five sections and no STL', () => {
    expect(sectionsFor('toy_adaptation')).toEqual(['details', 'safety', 'parts', 'tools', 'files'])
  })

  it('adds STL for assistive tech', () => {
    expect(sectionsFor('assistive_tech')).toEqual([
      'details', 'safety', 'parts', 'tools', 'files', 'stl',
    ])
  })
})

describe('sectionSummary', () => {
  it('says what is missing, in the words the row shows', () => {
    expect(sectionSummary('parts', base({ parts: [] }))).toBe('None yet - at least one')
    expect(sectionSummary('tools', base({ tools: [] }))).toBe('None yet - at least one')
    expect(sectionSummary('files', base({ tutorial_pdf_url: null, toy_photo_url: null })))
      .toBe('Guide PDF and a photo')
    expect(sectionSummary('files', base({ toy_photo_url: null }))).toBe('A photo')
    expect(sectionSummary('stl', base({ kind: 'assistive_tech', stl_files: [] })))
      .toBe('No STL yet')
    expect(sectionSummary('safety', base({ safety_declared_at: null }))).toBe('Not declared yet')
  })

  it('describes what is there once a section is complete', () => {
    expect(sectionSummary('details', base())).toBe('Toy adaptation - Easy')
    expect(sectionSummary('parts', base())).toBe('1 part')
    expect(sectionSummary('tools', base({ tools: [{ name: 'a' }, { name: 'b' }] as never })))
      .toBe('2 tools')
    expect(sectionSummary('files', base())).toBe('PDF and photo added')
  })
})

describe('SECTION_LABEL', () => {
  it('labels every section', () => {
    expect(SECTION_LABEL).toEqual({
      details: 'Details',
      safety: 'Safety',
      parts: 'Parts',
      tools: 'Tools',
      files: 'Files',
      stl: '3D print files',
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/mobile && npx jest tests/unit/lib/tutorial-sections.test.ts`
Expected: FAIL — `Cannot find module '../../../lib/tutorial-sections'`

- [ ] **Step 3: Write the implementation**

```ts
// packages/mobile/lib/tutorial-sections.ts
//
// What a draft still needs, and which screen closes each gap.
//
// Ported from web's lib/validation.ts getMissingFields, with one deliberate
// divergence: the safety gap reports `section: 'safety'` rather than riding
// along with details, because the hub gives safety a row of its own. Every
// other rule is the same eight lines in the same order — a change there is the
// reminder to bring this copy along.
import type { Difficulty, TutorialKind, TutorialWithDetails } from '@splat-connect/types'
import { KIND_LABEL } from '@splat-connect/types'

export type SectionId = 'details' | 'safety' | 'parts' | 'tools' | 'files' | 'stl'

export interface Gap {
  section: SectionId
  label: string
}

export const SECTION_LABEL: Record<SectionId, string> = {
  details: 'Details',
  safety: 'Safety',
  parts: 'Parts',
  tools: 'Tools',
  files: 'Files',
  stl: '3D print files',
}

const DIFFICULTIES: string[] = ['easy', 'medium', 'hard']

export function getMissingFields(tutorial: TutorialWithDetails): Gap[] {
  const missing: Gap[] = []
  if (!tutorial.title.trim()) missing.push({ section: 'details', label: 'A title' })
  if (!DIFFICULTIES.includes(tutorial.difficulty))
    missing.push({ section: 'details', label: 'A difficulty' })
  if (!tutorial.tutorial_pdf_url?.trim()) missing.push({ section: 'files', label: 'The guide PDF' })
  if (!tutorial.toy_photo_url?.trim()) missing.push({ section: 'files', label: 'A photo' })
  if (tutorial.parts.length === 0) missing.push({ section: 'parts', label: 'A part' })
  if (tutorial.tools.length === 0) missing.push({ section: 'tools', label: 'A tool' })
  // A printed part is what an assistive-tech tutorial IS, so it cannot be
  // submitted without one. A toy adaptation has no STL section at all, so the
  // gap must never appear for it.
  if (tutorial.kind === 'assistive_tech' && tutorial.stl_files.length === 0)
    missing.push({ section: 'stl', label: 'A 3D-print file' })
  if (!tutorial.safety_declared_at) missing.push({ section: 'safety', label: 'The safety declaration' })
  return missing
}

/** The rows this tutorial's kind shows, in hub order. */
export function sectionsFor(kind: TutorialKind): SectionId[] {
  const base: SectionId[] = ['details', 'safety', 'parts', 'tools', 'files']
  return kind === 'assistive_tech' ? [...base, 'stl'] : base
}

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
}

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`

/**
 * The line under a row's name. An incomplete section says what it is waiting
 * for; a complete one says what it holds. Prose rather than a status dot,
 * because "None yet" is the instruction and a dot is only a colour.
 */
export function sectionSummary(section: SectionId, t: TutorialWithDetails): string {
  switch (section) {
    case 'details':
      return `${KIND_LABEL[t.kind]} - ${DIFFICULTY_LABEL[t.difficulty] ?? 'No difficulty'}`
    case 'safety':
      return t.safety_declared_at ? 'Declared' : 'Not declared yet'
    case 'parts':
      return t.parts.length ? count(t.parts.length, 'part') : 'None yet - at least one'
    case 'tools':
      return t.tools.length ? count(t.tools.length, 'tool') : 'None yet - at least one'
    case 'files': {
      const pdf = Boolean(t.tutorial_pdf_url?.trim())
      const photo = Boolean(t.toy_photo_url?.trim())
      if (pdf && photo) return 'PDF and photo added'
      if (!pdf && !photo) return 'Guide PDF and a photo'
      return pdf ? 'A photo' : 'The guide PDF'
    }
    case 'stl':
      return t.stl_files.length ? count(t.stl_files.length, 'file') : 'No STL yet'
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/mobile && npx jest tests/unit/lib/tutorial-sections.test.ts`
Expected: PASS, 5 suites of assertions

- [ ] **Step 5: Commit**

```bash
git add packages/mobile/lib/tutorial-sections.ts packages/mobile/tests/unit/lib/tutorial-sections.test.ts
git commit -m "feat(mobile): the gap module the hub is built from"
```

---

### Task 2: The API stops reporting deletes it did not perform

Independent of everything else; do it early so the mobile UI is never written against a response that lies.

**Files:**
- Modify: `packages/api/src/routes/tutorials.ts:260-268`
- Test: `packages/api/tests/integration/tutorials/delete-draft-only.test.ts`

**Interfaces:**
- Produces: `DELETE /api/tutorials/:id` → `204` when a row was deleted, `409 { error: 'Only draft guides can be deleted.' }` when none was.

- [ ] **Step 1: Write the failing test**

```ts
// packages/api/tests/integration/tutorials/delete-draft-only.test.ts
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { acceptTerms, createProject } from '../../helpers/orgs.js'
import app from '../../../src/app.js'

let author: TestUser

beforeAll(async () => {
  author = await createTestUser()
  await acceptTerms(author.id, 'contributor_terms')
})

afterAll(async () => {
  await deleteTestUser(author.id)
})

const del = (id: string) =>
  app.request(`/api/tutorials/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${author.token}` },
  })

const exists = async (id: string) => {
  const { data } = await adminClient().from('tutorials').select('id').eq('id', id).maybeSingle()
  return Boolean(data)
}

describe('DELETE /api/tutorials/:id', () => {
  it('deletes a draft', async () => {
    const id = await createProject({ authorId: author.id, status: 'draft' })
    const res = await del(id)
    expect(res.status).toBe(204)
    expect(await exists(id)).toBe(false)
  })

  // RLS refuses these, and a policy matching zero rows is not a Postgres error
  // — so before this change the route answered 204 and the caller believed it.
  it.each(['pending', 'approved', 'rejected'] as const)(
    'refuses a %s tutorial with 409 and leaves it in place',
    async (status) => {
      const id = await createProject({ authorId: author.id, status })
      const res = await del(id)
      expect(res.status).toBe(409)
      expect(await res.json()).toEqual({ error: 'Only draft guides can be deleted.' })
      expect(await exists(id)).toBe(true)
      await adminClient().from('tutorials').delete().eq('id', id)
    }
  )
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/api && npx vitest run tests/integration/tutorials/delete-draft-only.test.ts`
Expected: the draft case passes; all three refusal cases FAIL with `expected 204 to be 409`.

> If `createProject` does not accept a `status` option, read `packages/api/tests/helpers/orgs.ts` and insert the row with `adminClient()` directly plus a `tutorial_contributors` row for `author.id` — the helper's shape is what matters, not its name.

- [ ] **Step 3: Write the implementation**

```ts
// packages/api/src/routes/tutorials.ts — replacing the existing delete handler
tutorials.delete('/:id', async (c) => {
  const supabase = createUserClient(c.get('token'))
  // .select() is load-bearing, not decoration. RLS
  // (001_schema.sql "Contributors can delete own draft tutorials") only admits
  // a delete while status = 'draft', and a policy that matches zero rows is not
  // an error — so without the returned rows this route answered 204 for a
  // delete it had not performed, and every client believed it.
  const { data, error } = await supabase
    .from('tutorials')
    .delete()
    .eq('id', c.req.param('id'))
    .select('id')
  if (error) return c.json({ error: error.message }, 500)
  if (!data || data.length === 0)
    return c.json({ error: 'Only draft guides can be deleted.' }, 409)
  return c.body(null, 204)
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/api && npx vitest run tests/integration/tutorials/delete-draft-only.test.ts`
Expected: PASS, 4 cases

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/routes/tutorials.ts packages/api/tests/integration/tutorials/delete-draft-only.test.ts
git commit -m "fix(api): a refused tutorial delete answers 409, not a false 204"
```

---

### Task 3: The draft state hook

One owner for loading, debounced writes, the concurrency token and the requeue. Section screens get a save function and never see any of it.

**Files:**
- Create: `packages/mobile/lib/use-tutorial-draft.tsx` (JSX in the provider, so `.tsx`)
- Test: `packages/mobile/tests/unit/lib/use-tutorial-draft.test.tsx`

**Interfaces:**
- Consumes: `apiClient` from `lib/api-client`; `ItemRow` is declared here and re-used by Task 6.
- Produces:
  - `interface ItemRow { name: string; quantity?: number; is_optional: boolean; buy_links: BuyLink[] }`
  - `type DraftSaveState = 'idle' | 'saving' | 'saved' | 'error'`
  - `interface TutorialDraft { tutorial, loading, loadError, saveState, saveError, save, saveNow, replaceItems, flush, reload }`
  - `useTutorialDraft(id: string): TutorialDraft`
  - `save(fields: Record<string, unknown>): void` — debounced 250ms
  - `saveNow(fields: Record<string, unknown>): Promise<void>` — immediate, awaited (uploads, submit)
  - `replaceItems(noun: 'parts' | 'tools', rows: ItemRow[]): void` — debounced
  - `flush(): Promise<void>` — send anything pending now
  - `TutorialDraftProvider` / `useDraft()` — context wrapper so the stack shares one instance

- [ ] **Step 1: Write the failing test**

```tsx
// packages/mobile/tests/unit/lib/use-tutorial-draft.test.tsx
import { Text } from 'react-native'
import { render, screen, act, waitFor } from '@testing-library/react-native'
import { TutorialDraftProvider, useDraft } from '../../../lib/use-tutorial-draft'

const mockGet = jest.fn()
const mockPost = jest.fn()
const mockPatch = jest.fn()
jest.mock('../../../lib/api-client', () => ({
  apiClient: {
    get: (...a: unknown[]) => mockGet(...a),
    post: (...a: unknown[]) => mockPost(...a),
    patch: (...a: unknown[]) => mockPatch(...a),
    delete: jest.fn(),
  },
}))

const loaded = {
  id: 't1',
  title: 'A guide',
  kind: 'toy_adaptation',
  difficulty: 'easy',
  status: 'draft',
  updated_at: 'v1',
  parts: [],
  tools: [],
  stl_files: [],
  tutorial_contributors: [],
  tutorial_recommendations: [],
}

let draft: ReturnType<typeof useDraft>
function Probe() {
  draft = useDraft()
  return <Text>{draft.tutorial?.title ?? 'none'}</Text>
}
const mount = () =>
  render(
    <TutorialDraftProvider id="t1">
      <Probe />
    </TutorialDraftProvider>
  )

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers()
  mockGet.mockResolvedValue(loaded)
})
afterEach(() => jest.useRealTimers())

it('loads the tutorial once', async () => {
  mount()
  await waitFor(() => expect(screen.getByText('A guide')).toBeTruthy())
  expect(mockGet).toHaveBeenCalledWith('/api/tutorials/t1')
})

it('debounces a save and sends the updated_at it last saw', async () => {
  mount()
  await waitFor(() => expect(draft.tutorial).toBeTruthy())
  mockPatch.mockResolvedValue({ ...loaded, title: 'Renamed', updated_at: 'v2' })

  act(() => { draft.save({ title: 'Ren' }) })
  act(() => { draft.save({ title: 'Renamed' }) })
  expect(mockPatch).not.toHaveBeenCalled()

  await act(async () => { jest.advanceTimersByTime(250) })
  expect(mockPatch).toHaveBeenCalledTimes(1)
  expect(mockPatch).toHaveBeenCalledWith('/api/tutorials/t1', {
    title: 'Renamed',
    updated_at: 'v1',
  })
})

it('carries the fresh updated_at into the next save', async () => {
  mount()
  await waitFor(() => expect(draft.tutorial).toBeTruthy())
  mockPatch.mockResolvedValue({ ...loaded, updated_at: 'v2' })

  await act(async () => { draft.save({ title: 'One' }); jest.advanceTimersByTime(250) })
  await act(async () => { draft.save({ title: 'Two' }); jest.advanceTimersByTime(250) })

  expect(mockPatch).toHaveBeenNthCalledWith(2, '/api/tutorials/t1', {
    title: 'Two',
    updated_at: 'v2',
  })
})

it.each(['approved', 'rejected'] as const)(
  're-queues a %s tutorial to pending on save',
  async (status) => {
    mockGet.mockResolvedValue({ ...loaded, status })
    mount()
    await waitFor(() => expect(draft.tutorial).toBeTruthy())
    mockPatch.mockResolvedValue({ ...loaded, status: 'pending', updated_at: 'v2' })

    await act(async () => { draft.save({ title: 'Edited' }); jest.advanceTimersByTime(250) })

    expect(mockPatch).toHaveBeenCalledWith('/api/tutorials/t1', {
      title: 'Edited',
      updated_at: 'v1',
      status: 'pending',
    })
  }
)

it('does not re-queue a draft', async () => {
  mount()
  await waitFor(() => expect(draft.tutorial).toBeTruthy())
  mockPatch.mockResolvedValue({ ...loaded, updated_at: 'v2' })
  await act(async () => { draft.save({ title: 'Edited' }); jest.advanceTimersByTime(250) })
  expect(mockPatch).toHaveBeenCalledWith('/api/tutorials/t1', {
    title: 'Edited',
    updated_at: 'v1',
  })
})

it('keeps the edit on screen and reports an error when a save fails', async () => {
  mount()
  await waitFor(() => expect(draft.tutorial).toBeTruthy())
  mockPatch.mockRejectedValue(new Error('500'))

  await act(async () => { draft.save({ title: 'Renamed' }); jest.advanceTimersByTime(250) })

  expect(draft.saveState).toBe('error')
  expect(draft.saveError).toBe('Could not save. Your changes are still here - try again.')
  // Optimistic value survives the failure: never silently discard typing.
  expect(draft.tutorial?.title).toBe('Renamed')
})

it('posts the replace-set for parts and drops rows with no name', async () => {
  mount()
  await waitFor(() => expect(draft.tutorial).toBeTruthy())
  mockPost.mockResolvedValue([{ id: 'p1', name: 'Switch', quantity: 2, is_optional: false, buy_links: [] }])

  await act(async () => {
    draft.replaceItems('parts', [
      { name: 'Switch', quantity: 2, is_optional: false, buy_links: [] },
      { name: '   ', quantity: 1, is_optional: false, buy_links: [] },
    ])
    jest.advanceTimersByTime(250)
  })

  expect(mockPost).toHaveBeenCalledWith('/api/tutorials/t1/parts', {
    parts: [{ name: 'Switch', quantity: 2, is_optional: false, buy_links: [] }],
  })
  expect(draft.tutorial?.parts).toHaveLength(1)
})

it('posts tools without a quantity', async () => {
  mount()
  await waitFor(() => expect(draft.tutorial).toBeTruthy())
  mockPost.mockResolvedValue([{ id: 'x1', name: 'Screwdriver', is_optional: true, buy_links: [] }])

  await act(async () => {
    draft.replaceItems('tools', [{ name: 'Screwdriver', is_optional: true, buy_links: [] }])
    jest.advanceTimersByTime(250)
  })

  expect(mockPost).toHaveBeenCalledWith('/api/tutorials/t1/tools', {
    tools: [{ name: 'Screwdriver', is_optional: true, buy_links: [] }],
  })
})

it('flush sends a pending save immediately', async () => {
  mount()
  await waitFor(() => expect(draft.tutorial).toBeTruthy())
  mockPatch.mockResolvedValue({ ...loaded, updated_at: 'v2' })

  act(() => { draft.save({ title: 'Leaving' }) })
  await act(async () => { await draft.flush() })

  expect(mockPatch).toHaveBeenCalledWith('/api/tutorials/t1', {
    title: 'Leaving',
    updated_at: 'v1',
  })
})

it('reports a load failure', async () => {
  mockGet.mockRejectedValue(new Error('offline'))
  mount()
  await waitFor(() => expect(draft.loadError).toBe(true))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/mobile && npx jest tests/unit/lib/use-tutorial-draft.test.tsx`
Expected: FAIL — `Cannot find module '../../../lib/use-tutorial-draft'`

- [ ] **Step 3: Write the implementation**

```tsx
// packages/mobile/lib/use-tutorial-draft.ts
//
// One owner for every write the guide editor makes.
//
// The sections used to each carry their own copy of three rules: send the
// updated_at the screen last saw (the API's optimistic-concurrency token, which
// 400s without it), re-queue an approved or rejected tutorial to pending
// (RLS only admits contributor updates in draft/pending/rejected), and merge
// the response back before writing again. Six screens is six chances to forget
// one, so they live here instead and a section screen only ever calls save().
//
// The debounce/serialise shape is lib/use-child-profile.ts's, including its
// 250ms: writes queue on one promise chain so a second save always sees the
// updated_at the first established, rather than racing it into a 409.
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { BuyLink, Part, StlFile, Tool, TutorialWithDetails } from '@splat-connect/types'
import { apiClient } from './api-client'

// GET /api/tutorials/:id embeds this join; it is on that one contributor-facing
// route, not on the shared type. See packages/api/src/routes/tutorials.ts.
export type EditorTutorial = TutorialWithDetails & { reviewed_for?: { name: string } | null }

/** One editable row of the parts/tools replace-set. `quantity` is only ever
 *  read for parts — tools leave it undefined and the stepper never renders. */
export interface ItemRow {
  name: string
  quantity?: number
  is_optional: boolean
  buy_links: BuyLink[]
}

export type DraftSaveState = 'idle' | 'saving' | 'saved' | 'error'

const SAVE_ERROR = 'Could not save. Your changes are still here - try again.'
const DEBOUNCE_MS = 250

export interface TutorialDraft {
  tutorial: EditorTutorial | null
  loading: boolean
  loadError: boolean
  saveState: DraftSaveState
  saveError: string | null
  /** Debounced PATCH. Optimistic: the value is on screen before it lands. */
  save: (fields: Record<string, unknown>) => void
  /** Immediate, awaited PATCH — uploads and submit, which have a result to show. */
  saveNow: (fields: Record<string, unknown>) => Promise<void>
  /** Debounced replace-set POST. Blank-named rows are never sent. */
  replaceItems: (noun: 'parts' | 'tools', rows: ItemRow[]) => void
  /** Send anything pending now — called when a section screen is left. */
  flush: () => Promise<void>
  reload: () => void
}

export function useTutorialDraft(id: string): TutorialDraft {
  const [tutorial, setTutorial] = useState<EditorTutorial | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [saveState, setSaveState] = useState<DraftSaveState>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const pendingFields = useRef<Record<string, unknown>>({})
  const pendingItems = useRef<Partial<Record<'parts' | 'tools', ItemRow[]>>>({})
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const writes = useRef<Promise<unknown>>(Promise.resolve())
  // The token and status the next write must quote. Refs, not state: a write
  // queued behind another needs the value the earlier one established, and
  // reading it off a render-time closure would quote a stale one.
  const token = useRef<string | null>(null)
  const status = useRef<string>('draft')

  useEffect(() => {
    let ignore = false
    const load = apiClient
      .get<EditorTutorial>(`/api/tutorials/${id}`)
      .then((data) => {
        token.current = data.updated_at
        status.current = data.status
        if (!ignore) {
          setTutorial(data)
          setLoadError(false)
        }
      })
      .catch((err) => {
        console.error('[useTutorialDraft] fetch failed:', err)
        if (!ignore) setLoadError(true)
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    writes.current = load
    return () => {
      ignore = true
    }
  }, [id, reloadKey])

  function absorb(updated: Partial<EditorTutorial> & { updated_at?: string; status?: string }) {
    if (updated.updated_at) token.current = updated.updated_at
    if (updated.status) status.current = updated.status
    setTutorial((prev) => (prev ? { ...prev, ...updated } : (updated as EditorTutorial)))
  }

  async function patchNow(fields: Record<string, unknown>) {
    const updated = await apiClient.patch<EditorTutorial>(`/api/tutorials/${id}`, {
      ...fields,
      updated_at: token.current,
      // RLS refuses a status-preserving update on an approved or rejected row,
      // so an edit there is also a re-submission. Same call web's edit page makes.
      ...(status.current === 'approved' || status.current === 'rejected'
        ? { status: 'pending' as const }
        : {}),
    })
    absorb(updated)
  }

  async function postItems(noun: 'parts' | 'tools', rows: ItemRow[]) {
    const clean = rows.filter((r) => r.name.trim())
    if (noun === 'parts') {
      const saved = await apiClient.post<Part[]>(`/api/tutorials/${id}/parts`, {
        parts: clean.map(({ name, quantity, is_optional, buy_links }) => ({
          name,
          quantity: quantity ?? 1,
          is_optional,
          buy_links,
        })),
      })
      setTutorial((prev) => (prev ? { ...prev, parts: saved } : prev))
    } else {
      const saved = await apiClient.post<Tool[]>(`/api/tutorials/${id}/tools`, {
        tools: clean.map(({ name, is_optional, buy_links }) => ({ name, is_optional, buy_links })),
      })
      setTutorial((prev) => (prev ? { ...prev, tools: saved } : prev))
    }
  }

  /** Drain whatever is queued, on the one write chain. */
  function drain(): Promise<void> {
    const fields = pendingFields.current
    const items = pendingItems.current
    pendingFields.current = {}
    pendingItems.current = {}
    const hasFields = Object.keys(fields).length > 0
    const nouns = Object.keys(items) as ('parts' | 'tools')[]
    if (!hasFields && nouns.length === 0) return Promise.resolve()

    writes.current = writes.current
      .then(async () => {
        setSaveState('saving')
        setSaveError(null)
        if (hasFields) await patchNow(fields)
        for (const noun of nouns) await postItems(noun, items[noun] as ItemRow[])
        setSaveState('saved')
      })
      .catch((err) => {
        console.error('[useTutorialDraft] save failed:', err)
        // The optimistic value stays on screen. Reverting it would throw away
        // typing the contributor can still see and would have to redo.
        setSaveState('error')
        setSaveError(SAVE_ERROR)
      })
    return writes.current as Promise<void>
  }

  function schedule() {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(drain, DEBOUNCE_MS)
  }

  function save(fields: Record<string, unknown>) {
    pendingFields.current = { ...pendingFields.current, ...fields }
    setTutorial((prev) => (prev ? ({ ...prev, ...fields } as EditorTutorial) : prev))
    schedule()
  }

  function replaceItems(noun: 'parts' | 'tools', rows: ItemRow[]) {
    pendingItems.current = { ...pendingItems.current, [noun]: rows }
    schedule()
  }

  async function saveNow(fields: Record<string, unknown>) {
    pendingFields.current = { ...pendingFields.current, ...fields }
    if (timer.current) clearTimeout(timer.current)
    await drain()
  }

  async function flush() {
    if (timer.current) clearTimeout(timer.current)
    await drain()
  }

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  return {
    tutorial,
    loading,
    loadError,
    saveState,
    saveError,
    save,
    saveNow,
    replaceItems,
    flush,
    reload: () => setReloadKey((k) => k + 1),
  }
}

// The stack shares one instance: the hub and all six sections read and write
// the same draft, so a section's save is already reflected when you go back.
const DraftContext = createContext<TutorialDraft | null>(null)

export function TutorialDraftProvider({ id, children }: { id: string; children: React.ReactNode }) {
  const draft = useTutorialDraft(id)
  return <DraftContext.Provider value={draft}>{children}</DraftContext.Provider>
}

export function useDraft(): TutorialDraft {
  const draft = useContext(DraftContext)
  if (!draft) throw new Error('useDraft must be used inside a TutorialDraftProvider')
  return draft
}
```

> The file contains JSX, so it must be named `use-tutorial-draft.tsx`, not `.ts`. Create it with the `.tsx` extension; the test's import path is unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/mobile && npx jest tests/unit/lib/use-tutorial-draft.test.tsx`
Expected: PASS, 11 cases

- [ ] **Step 5: Commit**

```bash
git add packages/mobile/lib/use-tutorial-draft.tsx packages/mobile/tests/unit/lib/use-tutorial-draft.test.tsx
git commit -m "feat(mobile): one owner for the guide editor's writes"
```

---

### Task 4: The hub

**Files:**
- Create: `packages/mobile/components/my-tutorials/hub.tsx`
- Test: `packages/mobile/tests/unit/components/my-tutorials/hub.test.tsx`

**Interfaces:**
- Consumes: `useDraft`, `getMissingFields`, `sectionsFor`, `SECTION_LABEL`, `sectionSummary`
- Produces: `TutorialHub({ id, justCreated }: { id: string; justCreated?: boolean })`
- testIDs: `hub-row-<section>`, `hub-submit`, `hub-menu-trigger`, `hub-menu-delete`, `hub-menu-my-tutorials`, `hub-created-note`

- [ ] **Step 1: Write the failing test**

```tsx
// packages/mobile/tests/unit/components/my-tutorials/hub.test.tsx
import { Alert } from 'react-native'
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { TutorialHub } from '../../../../components/my-tutorials/hub'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const mockPush = jest.fn()
const mockReplace = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
}))

const draft = {
  tutorial: null as unknown,
  loading: false,
  loadError: false,
  saveState: 'idle',
  saveError: null,
  save: jest.fn(),
  saveNow: jest.fn().mockResolvedValue(undefined),
  replaceItems: jest.fn(),
  flush: jest.fn().mockResolvedValue(undefined),
  reload: jest.fn(),
}
jest.mock('../../../../lib/use-tutorial-draft', () => ({
  useDraft: () => draft,
}))

const mockDelete = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: (...a: unknown[]) => mockDelete(...a) },
}))

const tutorial = (over = {}) => ({
  id: 't1',
  title: 'Roaring dinosaur',
  kind: 'assistive_tech',
  difficulty: 'medium',
  maturity: 'complete',
  status: 'draft',
  updated_at: 'v1',
  safety_declared_at: null,
  tutorial_pdf_url: null,
  toy_photo_url: null,
  parts: [],
  tools: [],
  stl_files: [],
  tutorial_contributors: [],
  tutorial_recommendations: [],
  ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  draft.tutorial = tutorial()
  draft.loading = false
  draft.loadError = false
})

it('shows a row per section with what each still needs', () => {
  render(<TutorialHub id="t1" />)
  expect(screen.getByTestId('hub-row-details')).toBeTruthy()
  expect(screen.getByTestId('hub-row-safety')).toBeTruthy()
  expect(screen.getByText('None yet - at least one')).toBeTruthy()
  expect(screen.getByText('Guide PDF and a photo')).toBeTruthy()
})

it('omits the STL row for a toy adaptation', () => {
  draft.tutorial = tutorial({ kind: 'toy_adaptation' })
  render(<TutorialHub id="t1" />)
  expect(screen.queryByTestId('hub-row-stl')).toBeNull()
  expect(screen.getByTestId('hub-row-files')).toBeTruthy()
})

it('opens a section when its row is tapped', () => {
  render(<TutorialHub id="t1" />)
  fireEvent.press(screen.getByTestId('hub-row-parts'))
  expect(mockPush).toHaveBeenCalledWith('/tutorials/t1/parts')
})

it('counts what is ready and what is left', () => {
  draft.tutorial = tutorial({ safety_declared_at: '2026-09-02', parts: [{ name: 'a' }] })
  render(<TutorialHub id="t1" />)
  // details + safety + parts done of six sections
  expect(screen.getByText('3 of 6 ready')).toBeTruthy()
  expect(screen.getByText('4 things still needed')).toBeTruthy()
})

it('disables submit while anything is missing and enables it when nothing is', () => {
  render(<TutorialHub id="t1" />)
  expect(screen.getByTestId('hub-submit')).toBeDisabled()

  draft.tutorial = tutorial({
    safety_declared_at: '2026-09-02',
    tutorial_pdf_url: 'p.pdf',
    toy_photo_url: 'p.jpg',
    parts: [{ name: 'a' }],
    tools: [{ name: 'b' }],
    stl_files: [{ id: 's', filename: 'a.stl' }],
  })
  screen.rerender(<TutorialHub id="t1" />)
  expect(screen.getByTestId('hub-submit')).toBeEnabled()
})

it('submits for review through the draft hook', async () => {
  draft.tutorial = tutorial({
    safety_declared_at: '2026-09-02',
    tutorial_pdf_url: 'p.pdf',
    toy_photo_url: 'p.jpg',
    parts: [{ name: 'a' }],
    tools: [{ name: 'b' }],
    stl_files: [{ id: 's', filename: 'a.stl' }],
  })
  render(<TutorialHub id="t1" />)
  fireEvent.press(screen.getByTestId('hub-submit'))
  await waitFor(() => expect(draft.saveNow).toHaveBeenCalledWith({ status: 'pending' }))
})

it('offers Delete draft on a draft', () => {
  render(<TutorialHub id="t1" />)
  fireEvent.press(screen.getByTestId('hub-menu-trigger'))
  expect(screen.getByTestId('hub-menu-delete')).toBeTruthy()
  expect(screen.getByText('Delete draft')).toBeTruthy()
})

// Absent, not disabled: a control that can never work should not be drawn.
it.each(['pending', 'approved', 'rejected'] as const)(
  'omits Delete draft entirely on a %s guide',
  (status) => {
    draft.tutorial = tutorial({ status })
    render(<TutorialHub id="t1" />)
    fireEvent.press(screen.getByTestId('hub-menu-trigger'))
    expect(screen.queryByTestId('hub-menu-delete')).toBeNull()
    expect(screen.getByTestId('hub-menu-my-tutorials')).toBeTruthy()
  }
)

it('deletes a draft after confirmation and returns to the list', async () => {
  const spy = jest.spyOn(Alert, 'alert')
  mockDelete.mockResolvedValue(undefined)
  render(<TutorialHub id="t1" />)
  fireEvent.press(screen.getByTestId('hub-menu-trigger'))
  fireEvent.press(screen.getByTestId('hub-menu-delete'))

  const confirm = spy.mock.calls[0][2]?.find((b) => b.text === 'Delete')
  await confirm?.onPress?.()

  expect(mockDelete).toHaveBeenCalledWith('/api/tutorials/t1')
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/tutorials'))
  spy.mockRestore()
})

it('leaves for My tutorials from the menu', () => {
  render(<TutorialHub id="t1" />)
  fireEvent.press(screen.getByTestId('hub-menu-trigger'))
  fireEvent.press(screen.getByTestId('hub-menu-my-tutorials'))
  expect(mockReplace).toHaveBeenCalledWith('/tutorials')
})

it('reassures a contributor once, only just after creation', () => {
  const { rerender } = render(<TutorialHub id="t1" justCreated />)
  expect(screen.getByTestId('hub-created-note')).toBeTruthy()
  fireEvent.press(screen.getByLabelText('Dismiss'))
  expect(screen.queryByTestId('hub-created-note')).toBeNull()

  rerender(<TutorialHub id="t1" />)
  expect(screen.queryByTestId('hub-created-note')).toBeNull()
})

// The spec's "More" section: read-only facts, below the checklist. Not in the
// menu, which holds actions.
it('lists the three things that are edited on the web', () => {
  draft.tutorial = tutorial({
    tutorial_contributors: [{ profiles: { name: 'Ada' } }],
    tutorial_recommendations: [{ id: 'r1' }],
  })
  render(<TutorialHub id="t1" />)
  expect(screen.getByText('Collaborators')).toBeTruthy()
  expect(screen.getByText('Ada - edit on the web')).toBeTruthy()
  expect(screen.getByText('Recommendations')).toBeTruthy()
  expect(screen.getByText('1 of 3 - edit on the web')).toBeTruthy()
  expect(screen.getByText('Backed by')).toBeTruthy()
})

it('shows a load failure rather than an empty hub', () => {
  draft.tutorial = null
  draft.loadError = true
  render(<TutorialHub id="t1" />)
  expect(screen.getByText("Couldn't load this guide.")).toBeTruthy()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/mobile && npx jest tests/unit/components/my-tutorials/hub.test.tsx`
Expected: FAIL — `Cannot find module '.../hub'`

- [ ] **Step 3: Write the implementation**

```tsx
// packages/mobile/components/my-tutorials/hub.tsx
//
// The guide editor's front door, and its progress display.
//
// This replaces a six-pill horizontal rail. The rail said where you were and
// never how much was left, and the Review step it led to joined the gaps into
// prose — so the one screen that knew what was wrong could not take you to
// where it was fixed. Here every gap getMissingFields reports is a row you can
// tap, and Submit sits under the count that gates it.
import { useState } from 'react'
import { View, Text, ScrollView, Pressable, Alert, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { apiClient } from '../../lib/api-client'
import { useDraft } from '../../lib/use-tutorial-draft'
import {
  getMissingFields,
  sectionsFor,
  sectionSummary,
  SECTION_LABEL,
  type SectionId,
} from '../../lib/tutorial-sections'
import { theme } from '../../lib/theme'
import { Screen } from '../ui/Screen'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { SkeletonRow } from '../ui/Skeleton'
import { EmptyState } from '../ui/EmptyState'

export function TutorialHub({ id, justCreated }: { id: string; justCreated?: boolean }) {
  const router = useRouter()
  const { tutorial, loading, loadError, saveNow } = useDraft()
  const [menuOpen, setMenuOpen] = useState(false)
  const [noteDismissed, setNoteDismissed] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return (
      <Screen>
        <SkeletonRow />
        <SkeletonRow />
      </Screen>
    )
  }

  if (loadError || !tutorial) {
    return (
      <Screen>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load this guide."
          hint="Check your connection and try again."
        />
      </Screen>
    )
  }

  const missing = getMissingFields(tutorial)
  const sections = sectionsFor(tutorial.kind)
  const incomplete = new Set(missing.map((g) => g.section))
  const ready = sections.filter((s) => !incomplete.has(s)).length
  const isDraft = tutorial.status === 'draft'

  async function handleSubmit() {
    setSubmitting(true)
    try {
      await saveNow({ status: 'pending' })
    } finally {
      setSubmitting(false)
    }
  }

  function handleDelete() {
    setMenuOpen(false)
    Alert.alert('Delete this draft?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.delete(`/api/tutorials/${id}`)
            router.replace('/tutorials')
          } catch (err) {
            console.error('[TutorialHub] delete failed:', err)
          }
        },
      },
    ])
  }

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Text numberOfLines={1} style={styles.title}>
          {tutorial.title || 'Untitled guide'}
        </Text>
        <Pressable
          testID="hub-menu-trigger"
          accessibilityRole="button"
          accessibilityLabel="More actions"
          onPress={() => setMenuOpen((o) => !o)}
          style={styles.kebab}
          hitSlop={8}
        >
          <Ionicons name="ellipsis-horizontal" size={18} color={theme.colors.ink} />
        </Pressable>
      </View>

      {menuOpen ? (
        <View style={styles.menu}>
          <Pressable
            testID="hub-menu-my-tutorials"
            accessibilityRole="button"
            onPress={() => { setMenuOpen(false); router.replace('/tutorials') }}
            style={styles.menuItem}
          >
            <Text style={styles.menuText}>My tutorials</Text>
          </Pressable>
          {/* Rendered only on a draft. RLS refuses the delete on any other
              status, so a control here would be one that cannot work. */}
          {isDraft ? (
            <Pressable
              testID="hub-menu-delete"
              accessibilityRole="button"
              onPress={handleDelete}
              style={[styles.menuItem, styles.menuItemLast]}
            >
              <Text style={[styles.menuText, styles.menuTextDanger]}>Delete draft</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {justCreated && !noteDismissed ? (
        <View testID="hub-created-note" style={styles.note}>
          <View style={styles.noteText}>
            <Text style={styles.noteTitle}>Draft saved</Text>
            <Text style={styles.noteBody}>
              Finish it now, or come back any time - it&apos;s waiting in My tutorials.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            onPress={() => setNoteDismissed(true)}
            hitSlop={8}
          >
            <Ionicons name="close" size={18} color={theme.colors.mintDeep} />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.statusRow}>
        <Badge status={tutorial.status} />
        <Text style={styles.progressText}>
          {ready} of {sections.length} ready
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.rows}>
        {sections.map((section) => {
          const done = !incomplete.has(section)
          return (
            <Pressable
              key={section}
              testID={`hub-row-${section}`}
              accessibilityRole="button"
              accessibilityLabel={`${SECTION_LABEL[section]}. ${sectionSummary(section, tutorial)}`}
              onPress={() => router.push(`/tutorials/${id}/${section}`)}
              style={[styles.row, done && styles.rowDone]}
            >
              <View style={[styles.mark, done ? styles.markDone : styles.markTodo]}>
                <Ionicons
                  name={done ? 'checkmark' : 'alert'}
                  size={14}
                  color={done ? theme.colors.ink : theme.colors.apricotDeep}
                />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{SECTION_LABEL[section]}</Text>
                <Text style={styles.rowSummary}>{sectionSummary(section, tutorial)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
            </Pressable>
          )
        })}

        {/* Read-only facts, not actions — so they sit under the checklist
            rather than in the menu. Backing is a second fetch on web and is
            not one here: "ask on the web" is the whole of what mobile can say
            about it, and a request for it would be a fetch to say so. */}
        <Text style={styles.moreHeading}>More</Text>
        <View style={styles.moreRow}>
          <Text style={styles.moreLabel}>Backed by</Text>
          <Text style={styles.moreValue}>Ask on the web</Text>
        </View>
        <View style={styles.moreRow}>
          <Text style={styles.moreLabel}>Collaborators</Text>
          <Text style={styles.moreValue}>
            {tutorial.tutorial_contributors.map((c) => c.profiles.name).join(', ') || 'Just you'}
            {' - edit on the web'}
          </Text>
        </View>
        <View style={styles.moreRow}>
          <Text style={styles.moreLabel}>Recommendations</Text>
          <Text style={styles.moreValue}>
            {tutorial.tutorial_recommendations.length} of 3 - edit on the web
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Button
          testID="hub-submit"
          label="Submit for review"
          variant="accent"
          onPress={handleSubmit}
          disabled={missing.length > 0 || tutorial.status !== 'draft'}
          loading={submitting}
        />
        <Text style={styles.footnote}>
          {tutorial.status === 'pending'
            ? 'Submitted - waiting for review'
            : tutorial.status === 'approved'
              ? 'Approved - in Guides'
              : missing.length > 0
                ? `${missing.length} thing${missing.length === 1 ? '' : 's'} still needed`
                : 'Everything is ready'}
        </Text>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2), marginBottom: theme.spacing(3) },
  title: { flex: 1, fontFamily: theme.fonts.black, fontSize: theme.type.title, color: theme.colors.ink, letterSpacing: -0.4 },
  kebab: {
    width: 34, height: 34, alignItems: 'center', justifyContent: 'center',
    borderWidth: theme.border.thin, borderColor: theme.colors.ink,
    borderRadius: theme.radii.sm, backgroundColor: theme.colors.surface,
  },
  menu: {
    borderWidth: theme.border.thin, borderColor: theme.colors.ink,
    borderRadius: theme.radii.md, backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing(3), overflow: 'hidden', ...theme.shadow(4),
  },
  menuItem: { padding: theme.spacing(3), borderBottomWidth: theme.border.thin, borderBottomColor: theme.colors.ink },
  menuItemLast: { borderBottomWidth: 0 },
  menuText: { fontFamily: theme.fonts.bold, fontSize: theme.type.body, color: theme.colors.ink },
  menuTextDanger: { color: theme.colors.danger },
  note: {
    flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing(2),
    backgroundColor: theme.colors.mintSoft, borderWidth: theme.border.thin,
    borderColor: theme.colors.ink, borderRadius: theme.radii.md,
    padding: theme.spacing(3), marginBottom: theme.spacing(3), ...theme.shadow(3),
  },
  noteText: { flex: 1 },
  noteTitle: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.ink },
  noteBody: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.mintDeep, lineHeight: 18 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2), marginBottom: theme.spacing(3) },
  progressText: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.muted },
  rows: { gap: theme.spacing(2), paddingBottom: theme.spacing(4) },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3),
    backgroundColor: theme.colors.surface, borderWidth: theme.border.thin,
    borderColor: theme.colors.ink, borderRadius: theme.radii.md,
    padding: theme.spacing(3), ...theme.shadow(3),
  },
  rowDone: { backgroundColor: theme.colors.mintSoft },
  mark: {
    width: 28, height: 28, alignItems: 'center', justifyContent: 'center',
    borderWidth: theme.border.thin, borderColor: theme.colors.ink, borderRadius: theme.radii.sm,
  },
  markDone: { backgroundColor: theme.colors.mint },
  markTodo: { backgroundColor: theme.colors.apricotSoft },
  rowText: { flex: 1 },
  rowTitle: { fontFamily: theme.fonts.bold, fontSize: theme.type.body, color: theme.colors.ink },
  rowSummary: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted },
  moreHeading: {
    fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.muted,
    textTransform: 'uppercase', letterSpacing: 0.6, marginTop: theme.spacing(5), marginBottom: theme.spacing(2),
  },
  moreRow: { marginBottom: theme.spacing(3) },
  moreLabel: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.ink },
  moreValue: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted },
  footer: { paddingTop: theme.spacing(3), paddingBottom: theme.spacing(2) },
  footnote: {
    fontFamily: theme.fonts.regular, fontSize: theme.type.caption,
    color: theme.colors.muted, textAlign: 'center', marginTop: theme.spacing(2),
  },
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/mobile && npx jest tests/unit/components/my-tutorials/hub.test.tsx`
Expected: PASS, 13 cases

- [ ] **Step 5: Commit**

```bash
git add packages/mobile/components/my-tutorials/hub.tsx packages/mobile/tests/unit/components/my-tutorials/hub.test.tsx
git commit -m "feat(mobile): the guide editor's checklist hub"
```

---

### Task 5: Details and Safety sections

**Files:**
- Create: `packages/mobile/components/my-tutorials/sections/details-section.tsx`
- Create: `packages/mobile/components/my-tutorials/sections/safety-section.tsx`
- Test: `packages/mobile/tests/unit/components/my-tutorials/details-section.test.tsx`
- Test: `packages/mobile/tests/unit/components/my-tutorials/safety-section.test.tsx`

**Interfaces:**
- Consumes: `useDraft()` (Task 3), `SaveChip` (declared below, exported from `sections/save-chip.tsx`)
- Produces: `DetailsSection()`, `SafetySection()`, `SaveChip({ state }: { state: DraftSaveState })`

- [ ] **Step 1: Write the failing tests**

```tsx
// packages/mobile/tests/unit/components/my-tutorials/details-section.test.tsx
import { render, screen, fireEvent } from '@testing-library/react-native'
import { DetailsSection } from '../../../../components/my-tutorials/sections/details-section'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const draft = {
  tutorial: {
    id: 't1', title: 'Roaring dinosaur', description: null,
    kind: 'toy_adaptation', difficulty: 'easy', maturity: 'complete',
    status: 'draft', updated_at: 'v1', parts: [], tools: [], stl_files: [],
    tutorial_contributors: [], tutorial_recommendations: [], safety_declared_at: null,
  } as Record<string, unknown>,
  loading: false, loadError: false, saveState: 'idle', saveError: null,
  save: jest.fn(), saveNow: jest.fn(), replaceItems: jest.fn(),
  flush: jest.fn().mockResolvedValue(undefined), reload: jest.fn(),
}
jest.mock('../../../../lib/use-tutorial-draft', () => ({ useDraft: () => draft }))

beforeEach(() => jest.clearAllMocks())

it('saves the title as it is typed', () => {
  render(<DetailsSection />)
  fireEvent.changeText(screen.getByLabelText('Title'), 'Roaring T-rex')
  expect(draft.save).toHaveBeenCalledWith({ title: 'Roaring T-rex' })
})

it('saves a blank description as null, not an empty string', () => {
  render(<DetailsSection />)
  fireEvent.changeText(screen.getByLabelText('Description'), '   ')
  expect(draft.save).toHaveBeenCalledWith({ description: null })
})

it('saves a chip choice', () => {
  render(<DetailsSection />)
  fireEvent.press(screen.getByText('Medium'))
  expect(draft.save).toHaveBeenCalledWith({ difficulty: 'medium' })
  fireEvent.press(screen.getByText('Assistive tech'))
  expect(draft.save).toHaveBeenCalledWith({ kind: 'assistive_tech' })
})

it('shows the save state', () => {
  draft.saveState = 'saving'
  render(<DetailsSection />)
  expect(screen.getByText('Saving...')).toBeTruthy()
})

it('shows a save failure without losing the edit', () => {
  draft.saveState = 'error'
  draft.saveError = 'Could not save. Your changes are still here - try again.'
  render(<DetailsSection />)
  expect(screen.getByText('Could not save. Your changes are still here - try again.')).toBeTruthy()
  expect(screen.getByLabelText('Title').props.value).toBe('Roaring dinosaur')
})
```

```tsx
// packages/mobile/tests/unit/components/my-tutorials/safety-section.test.tsx
import { render, screen, fireEvent } from '@testing-library/react-native'
import { SafetySection } from '../../../../components/my-tutorials/sections/safety-section'
import { SAFETY_CHECKLIST } from '@splat-connect/types'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const draft = {
  tutorial: { id: 't1', safety_declared_at: null, status: 'draft' } as Record<string, unknown>,
  loading: false, loadError: false, saveState: 'idle', saveError: null,
  save: jest.fn(), saveNow: jest.fn(), replaceItems: jest.fn(),
  flush: jest.fn().mockResolvedValue(undefined), reload: jest.fn(),
}
jest.mock('../../../../lib/use-tutorial-draft', () => ({ useDraft: () => draft }))

beforeEach(() => {
  jest.clearAllMocks()
  draft.tutorial = { id: 't1', safety_declared_at: null, status: 'draft' }
})

it('lists every checklist point', () => {
  render(<SafetySection />)
  for (const item of SAFETY_CHECKLIST) expect(screen.getByText(new RegExp(item.slice(0, 20)))).toBeTruthy()
})

// The client only ever affirms; the server stamps the timestamp.
it('affirms rather than sets a date', () => {
  render(<SafetySection />)
  fireEvent.press(screen.getByTestId('safety-declare'))
  expect(draft.save).toHaveBeenCalledWith({ safety_declared: true })
})

it('shows the declaration once made and offers no way to unmake it', () => {
  draft.tutorial = { id: 't1', safety_declared_at: '2026-09-02T00:00:00Z', status: 'draft' }
  render(<SafetySection />)
  expect(screen.getByText(/Declared on/)).toBeTruthy()
  expect(screen.queryByTestId('safety-declare')).toBeNull()
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/mobile && npx jest tests/unit/components/my-tutorials/details-section.test.tsx tests/unit/components/my-tutorials/safety-section.test.tsx`
Expected: FAIL — modules not found

- [ ] **Step 3: Write the implementations**

```tsx
// packages/mobile/components/my-tutorials/sections/save-chip.tsx
// The only feedback that a write happened, now the Save buttons are gone.
import { Text, StyleSheet } from 'react-native'
import { theme } from '../../../lib/theme'
import type { DraftSaveState } from '../../../lib/use-tutorial-draft'

const LABEL: Record<DraftSaveState, string | null> = {
  idle: null,
  saving: 'Saving...',
  saved: 'Saved',
  // The error itself is shown by an ErrorRow in the section; a chip saying
  // "Error" as well would be the same news twice.
  error: null,
}

export function SaveChip({ state }: { state: DraftSaveState }) {
  const label = LABEL[state]
  if (!label) return null
  return <Text style={styles.chip}>{label}</Text>
}

const styles = StyleSheet.create({
  chip: {
    fontFamily: theme.fonts.semiBold,
    fontSize: theme.type.caption,
    color: theme.colors.mintDeep,
    alignSelf: 'flex-end',
    marginBottom: theme.spacing(2),
  },
})
```

```tsx
// packages/mobile/components/my-tutorials/sections/details-section.tsx
//
// Title, description and the three chip rows. Everything writes through
// useDraft().save, which debounces and carries the concurrency token — there is
// no Save button here, and no local copy of the tutorial to fall out of sync.
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import type { Difficulty, TutorialKind, TutorialMaturity } from '@splat-connect/types'
import { KIND_LABEL, MATURITY_LABEL } from '@splat-connect/types'
import { useDraft } from '../../../lib/use-tutorial-draft'
import { theme } from '../../../lib/theme'
import { Screen } from '../../ui/Screen'
import { TextField } from '../../ui/TextField'
import { Chip } from '../../ui/Chip'
import { ErrorRow } from '../../auth-screen'
import { SaveChip } from './save-chip'

const KIND_OPTIONS: { label: string; value: TutorialKind }[] = [
  { label: KIND_LABEL.toy_adaptation, value: 'toy_adaptation' },
  { label: KIND_LABEL.assistive_tech, value: 'assistive_tech' },
]
const DIFFICULTY_OPTIONS: { label: string; value: Difficulty }[] = [
  { label: 'Easy', value: 'easy' },
  { label: 'Medium', value: 'medium' },
  { label: 'Hard', value: 'hard' },
]
const MATURITY_OPTIONS = (Object.keys(MATURITY_LABEL) as TutorialMaturity[]).map((m) => ({
  label: MATURITY_LABEL[m],
  value: m,
}))

export function DetailsSection() {
  const { tutorial, save, saveState, saveError } = useDraft()
  if (!tutorial) return null

  return (
    <Screen>
      <SaveChip state={saveState} />
      <ScrollView showsVerticalScrollIndicator={false} automaticallyAdjustKeyboardInsets>
        <TextField
          label="Title"
          accessibilityLabel="Title"
          value={tutorial.title}
          onChangeText={(text) => save({ title: text })}
        />
        <TextField
          label="Description"
          accessibilityLabel="Description"
          value={tutorial.description ?? ''}
          multiline
          onChangeText={(text) => save({ description: text.trim() ? text : null })}
        />

        <Text style={styles.label}>Kind</Text>
        <View style={styles.chipRow}>
          {KIND_OPTIONS.map((o) => (
            <Chip key={o.value} label={o.label} active={tutorial.kind === o.value} onPress={() => save({ kind: o.value })} />
          ))}
        </View>

        <Text style={styles.label}>Difficulty</Text>
        <View style={styles.chipRow}>
          {DIFFICULTY_OPTIONS.map((o) => (
            <Chip key={o.value} label={o.label} active={tutorial.difficulty === o.value} onPress={() => save({ difficulty: o.value })} />
          ))}
        </View>

        <Text style={styles.label}>How far along is it?</Text>
        <View style={styles.chipRow}>
          {MATURITY_OPTIONS.map((o) => (
            <Chip key={o.value} label={o.label} active={tutorial.maturity === o.value} onPress={() => save({ maturity: o.value })} />
          ))}
        </View>
        <Text style={styles.hint}>Only complete guides appear in the public library listing.</Text>

        <ErrorRow message={saveError} />
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  label: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.text, marginBottom: theme.spacing(2) },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2), marginBottom: theme.spacing(4) },
  hint: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted, lineHeight: 18, marginBottom: theme.spacing(4) },
})
```

```tsx
// packages/mobile/components/my-tutorials/sections/safety-section.tsx
//
// Its own screen rather than a block at the bottom of Details, because it is
// its own gate: a guide cannot be submitted without it, and a checklist buried
// under three chip rows was one nobody read.
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { SAFETY_CHECKLIST } from '@splat-connect/types'
import { useDraft } from '../../../lib/use-tutorial-draft'
import { theme } from '../../../lib/theme'
import { Screen } from '../../ui/Screen'
import { ErrorRow } from '../../auth-screen'
import { SaveChip } from './save-chip'

export function SafetySection() {
  const { tutorial, save, saveState, saveError } = useDraft()
  if (!tutorial) return null

  const declared = tutorial.safety_declared_at

  return (
    <Screen>
      <SaveChip state={saveState} />
      <ScrollView showsVerticalScrollIndicator={false}>
        {SAFETY_CHECKLIST.map((item) => (
          <Text key={item} style={styles.item}>
            {'•'} {item}
          </Text>
        ))}

        {declared ? (
          // No way to unmake it: a declaration that can be toggled off is not a
          // declaration. Reversing one is a support conversation, not a tap.
          <Text style={styles.declared}>
            Declared on {new Date(declared).toLocaleDateString('en-AU')}.
          </Text>
        ) : (
          <Pressable
            testID="safety-declare"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: false }}
            onPress={() => save({ safety_declared: true })}
            style={styles.tick}
          >
            <Ionicons name="square-outline" size={20} color={theme.colors.primaryDeep} />
            <Text style={styles.tickText}>
              I have checked this design against every point above. A guide cannot be
              submitted for review without this.
            </Text>
          </Pressable>
        )}

        <ErrorRow message={saveError} />
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  item: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.text, lineHeight: 21, marginBottom: theme.spacing(2) },
  declared: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.label, color: theme.colors.mintDeep, marginTop: theme.spacing(4) },
  tick: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing(2), marginTop: theme.spacing(4) },
  tickText: { flex: 1, fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted, lineHeight: 18 },
})
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/mobile && npx jest tests/unit/components/my-tutorials/details-section.test.tsx tests/unit/components/my-tutorials/safety-section.test.tsx`
Expected: PASS, 8 cases

- [ ] **Step 5: Commit**

```bash
git add packages/mobile/components/my-tutorials/sections packages/mobile/tests/unit/components/my-tutorials/details-section.test.tsx packages/mobile/tests/unit/components/my-tutorials/safety-section.test.tsx
git commit -m "feat(mobile): the details and safety sections"
```

---

### Task 6: Parts and Tools

One component, two nouns — as `ItemsStep` already was.

**Files:**
- Create: `packages/mobile/components/my-tutorials/sections/items-section.tsx`
- Test: `packages/mobile/tests/unit/components/my-tutorials/items-section.test.tsx`

**Interfaces:**
- Consumes: `useDraft()`, `ItemRow` (Task 3)
- Produces: `ItemsSection({ noun }: { noun: 'parts' | 'tools' })`
- testIDs: `items-add`, `item-row-<i>`, `item-remove-<i>`, `item-optional-<i>`, `item-qty-up-<i>`, `item-qty-down-<i>`

- [ ] **Step 1: Write the failing test**

```tsx
// packages/mobile/tests/unit/components/my-tutorials/items-section.test.tsx
import { render, screen, fireEvent } from '@testing-library/react-native'
import { ItemsSection } from '../../../../components/my-tutorials/sections/items-section'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))

const draft = {
  tutorial: {
    id: 't1', status: 'draft',
    parts: [{ id: 'p1', name: 'Switch', quantity: 2, is_optional: false, buy_links: [] }],
    tools: [],
  } as Record<string, unknown>,
  loading: false, loadError: false, saveState: 'idle', saveError: null,
  save: jest.fn(), saveNow: jest.fn(), replaceItems: jest.fn(),
  flush: jest.fn().mockResolvedValue(undefined), reload: jest.fn(),
}
jest.mock('../../../../lib/use-tutorial-draft', () => ({ useDraft: () => draft }))

beforeEach(() => {
  jest.clearAllMocks()
  draft.tutorial = {
    id: 't1', status: 'draft',
    parts: [{ id: 'p1', name: 'Switch', quantity: 2, is_optional: false, buy_links: [] }],
    tools: [],
  }
})

it('seeds its rows from the tutorial', () => {
  render(<ItemsSection noun="parts" />)
  expect(screen.getByLabelText('Part 1 name').props.value).toBe('Switch')
})

it('saves a renamed row through the replace-set', () => {
  render(<ItemsSection noun="parts" />)
  fireEvent.changeText(screen.getByLabelText('Part 1 name'), 'Micro switch')
  expect(draft.replaceItems).toHaveBeenCalledWith('parts', [
    { name: 'Micro switch', quantity: 2, is_optional: false, buy_links: [] },
  ])
})

it('adds and removes rows', () => {
  render(<ItemsSection noun="parts" />)
  fireEvent.press(screen.getByTestId('items-add'))
  expect(screen.getByLabelText('Part 2 name')).toBeTruthy()

  fireEvent.press(screen.getByTestId('item-remove-0'))
  expect(draft.replaceItems).toHaveBeenLastCalledWith('parts', [
    { name: '', quantity: 1, is_optional: false, buy_links: [] },
  ])
})

it('steps a part quantity but never below one', () => {
  render(<ItemsSection noun="parts" />)
  fireEvent.press(screen.getByTestId('item-qty-up-0'))
  expect(draft.replaceItems).toHaveBeenLastCalledWith('parts', [
    { name: 'Switch', quantity: 3, is_optional: false, buy_links: [] },
  ])

  fireEvent.press(screen.getByTestId('item-qty-down-0'))
  fireEvent.press(screen.getByTestId('item-qty-down-0'))
  fireEvent.press(screen.getByTestId('item-qty-down-0'))
  const last = draft.replaceItems.mock.calls.at(-1)?.[1] as { quantity: number }[]
  expect(last[0].quantity).toBe(1)
})

it('toggles optional', () => {
  render(<ItemsSection noun="parts" />)
  fireEvent.press(screen.getByTestId('item-optional-0'))
  expect(draft.replaceItems).toHaveBeenLastCalledWith('parts', [
    { name: 'Switch', quantity: 2, is_optional: true, buy_links: [] },
  ])
})

// Tools have no quantity: the column is not in the table and the stepper would
// write a field the POST does not carry.
it('gives tools no quantity stepper', () => {
  render(<ItemsSection noun="tools" />)
  fireEvent.press(screen.getByTestId('items-add'))
  expect(screen.queryByTestId('item-qty-up-0')).toBeNull()
  fireEvent.changeText(screen.getByLabelText('Tool 1 name'), 'Screwdriver')
  expect(draft.replaceItems).toHaveBeenCalledWith('tools', [
    { name: 'Screwdriver', quantity: undefined, is_optional: false, buy_links: [] },
  ])
})

it('flags a row that cannot be saved yet rather than silently dropping it', () => {
  render(<ItemsSection noun="parts" />)
  fireEvent.press(screen.getByTestId('items-add'))
  expect(screen.getByText('Add a name to save this row')).toBeTruthy()
})

it('offers an empty state when there is nothing yet', () => {
  render(<ItemsSection noun="tools" />)
  expect(screen.getByText('No tools yet.')).toBeTruthy()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/mobile && npx jest tests/unit/components/my-tutorials/items-section.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```tsx
// packages/mobile/components/my-tutorials/sections/items-section.tsx
//
// Parts and tools: one replace-set list, two nouns. Only parts carry a
// quantity, so only parts draw the stepper.
//
// Rows are local state seeded once from the tutorial, because a row being
// typed has no id yet and the server's copy would overwrite it mid-keystroke.
// Every mutation calls replaceItems, which debounces the POST — there is no
// Save button, and switching away no longer discards the list.
import { useState } from 'react'
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useDraft, type ItemRow } from '../../../lib/use-tutorial-draft'
import { theme } from '../../../lib/theme'
import { Screen } from '../../ui/Screen'
import { TextField } from '../../ui/TextField'
import { Button } from '../../ui/Button'
import { ErrorRow } from '../../auth-screen'
import { SaveChip } from './save-chip'

const NOUN_LABEL = { parts: 'Part', tools: 'Tool' } as const

export function ItemsSection({ noun }: { noun: 'parts' | 'tools' }) {
  const { tutorial, replaceItems, saveState, saveError } = useDraft()
  const withQuantity = noun === 'parts'
  const singular = NOUN_LABEL[noun]

  const [rows, setRows] = useState<ItemRow[]>(() =>
    ((tutorial?.[noun] ?? []) as ItemRow[]).map((r) => ({
      name: r.name,
      quantity: withQuantity ? (r.quantity ?? 1) : undefined,
      is_optional: r.is_optional,
      buy_links: r.buy_links ?? [],
    }))
  )

  if (!tutorial) return null

  function commit(next: ItemRow[]) {
    setRows(next)
    replaceItems(noun, next)
  }

  const update = (i: number, patch: Partial<ItemRow>) =>
    commit(rows.map((r, n) => (n === i ? { ...r, ...patch } : r)))

  return (
    <Screen>
      <SaveChip state={saveState} />
      <ScrollView showsVerticalScrollIndicator={false} automaticallyAdjustKeyboardInsets>
        {rows.length === 0 ? (
          <Text style={styles.empty}>No {noun} yet.</Text>
        ) : null}

        {rows.map((row, i) => (
          <View key={i} testID={`item-row-${i}`} style={styles.card}>
            <TextField
              accessibilityLabel={`${singular} ${i + 1} name`}
              placeholder={`${singular} name`}
              value={row.name}
              onChangeText={(text) => update(i, { name: text })}
            />
            <View style={styles.controls}>
              {withQuantity ? (
                <View style={styles.stepper}>
                  <Pressable
                    testID={`item-qty-down-${i}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Decrease quantity for part ${i + 1}`}
                    onPress={() => update(i, { quantity: Math.max(1, (row.quantity ?? 1) - 1) })}
                    style={styles.stepperButton}
                    hitSlop={8}
                  >
                    <Text style={styles.stepperGlyph}>-</Text>
                  </Pressable>
                  <Text style={styles.quantity}>{row.quantity ?? 1}</Text>
                  <Pressable
                    testID={`item-qty-up-${i}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Increase quantity for part ${i + 1}`}
                    onPress={() => update(i, { quantity: (row.quantity ?? 1) + 1 })}
                    style={styles.stepperButton}
                    hitSlop={8}
                  >
                    <Text style={styles.stepperGlyph}>+</Text>
                  </Pressable>
                </View>
              ) : null}
              <Pressable
                testID={`item-optional-${i}`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: row.is_optional }}
                accessibilityLabel={`${singular} ${i + 1} optional`}
                onPress={() => update(i, { is_optional: !row.is_optional })}
                style={styles.optional}
              >
                <Ionicons name={row.is_optional ? 'checkbox' : 'square-outline'} size={20} color={theme.colors.primary} />
                <Text style={styles.optionalLabel}>Optional</Text>
              </Pressable>
              <Pressable
                testID={`item-remove-${i}`}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${singular.toLowerCase()} ${i + 1}`}
                onPress={() => commit(rows.filter((_, n) => n !== i))}
                style={styles.remove}
                hitSlop={8}
              >
                <Ionicons name="close" size={18} color={theme.colors.danger} />
              </Pressable>
            </View>
            {/* Named rather than silently dropped: replaceItems filters blank
                names out of the POST, so without this the row looks saved. */}
            {!row.name.trim() ? <Text style={styles.blankHint}>Add a name to save this row</Text> : null}
          </View>
        ))}

        <Button
          testID="items-add"
          label={`+ Add a ${singular.toLowerCase()}`}
          variant="ghost"
          onPress={() =>
            commit([
              ...rows,
              { name: '', quantity: withQuantity ? 1 : undefined, is_optional: false, buy_links: [] },
            ])
          }
        />
        <ErrorRow message={saveError} />
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  empty: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted, marginBottom: theme.spacing(3) },
  card: {
    backgroundColor: theme.colors.surface, borderWidth: theme.border.thin, borderColor: theme.colors.ink,
    borderRadius: theme.radii.md, padding: theme.spacing(3), marginBottom: theme.spacing(3), ...theme.shadow(3),
  },
  controls: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3) },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) },
  stepperButton: {
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
    borderWidth: theme.border.thin, borderColor: theme.colors.ink, borderRadius: theme.radii.sm,
    backgroundColor: theme.colors.surface,
  },
  stepperGlyph: { fontFamily: theme.fonts.black, fontSize: theme.type.body, color: theme.colors.ink },
  quantity: { fontFamily: theme.fonts.black, fontSize: theme.type.body, color: theme.colors.ink, minWidth: 20, textAlign: 'center' },
  optional: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1) },
  optionalLabel: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted },
  remove: { marginLeft: 'auto' },
  blankHint: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.apricotDeep, marginTop: theme.spacing(2) },
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/mobile && npx jest tests/unit/components/my-tutorials/items-section.test.tsx`
Expected: PASS, 8 cases

- [ ] **Step 5: Commit**

```bash
git add packages/mobile/components/my-tutorials/sections/items-section.tsx packages/mobile/tests/unit/components/my-tutorials/items-section.test.tsx
git commit -m "feat(mobile): the parts and tools section"
```

---

### Task 7: Files and STL

Both already wrote on upload, so this task is a move plus the `saveNow` swap. Uploads are not debounced: there is a result to show and nothing to coalesce.

**Files:**
- Create: `packages/mobile/components/my-tutorials/sections/files-section.tsx`
- Create: `packages/mobile/components/my-tutorials/sections/stl-section.tsx`
- Test: `packages/mobile/tests/unit/components/my-tutorials/files-section.test.tsx`

**Interfaces:**
- Consumes: `useDraft()`, `uploadFile` from `lib/upload`, `supabase` from `lib/supabase`
- Produces: `FilesSection()`, `StlSection()`

- [ ] **Step 1: Write the failing test**

```tsx
// packages/mobile/tests/unit/components/my-tutorials/files-section.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { FilesSection } from '../../../../components/my-tutorials/sections/files-section'
import { StlSection } from '../../../../components/my-tutorials/sections/stl-section'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }) }))
jest.mock('../../../../lib/supabase', () => ({
  supabase: { storage: { from: () => ({ createSignedUrl: jest.fn().mockResolvedValue({ data: { signedUrl: 'u' }, error: null }) }) } },
}))

const mockUploadFile = jest.fn()
jest.mock('../../../../lib/upload', () => ({ uploadFile: (...a: unknown[]) => mockUploadFile(...a) }))

const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { get: jest.fn(), post: (...a: unknown[]) => mockPost(...a), patch: jest.fn(), delete: jest.fn() },
}))

const mockRequestMedia = jest.fn()
const mockLaunchLibrary = jest.fn()
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  requestMediaLibraryPermissionsAsync: (...a: unknown[]) => mockRequestMedia(...a),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: (...a: unknown[]) => mockLaunchLibrary(...a),
}))

const mockGetDocument = jest.fn()
jest.mock('expo-document-picker', () => ({ getDocumentAsync: (...a: unknown[]) => mockGetDocument(...a) }))

const draft = {
  tutorial: { id: 't1', status: 'draft', tutorial_pdf_url: null, toy_photo_url: null, stl_files: [] } as Record<string, unknown>,
  loading: false, loadError: false, saveState: 'idle', saveError: null,
  save: jest.fn(), saveNow: jest.fn().mockResolvedValue(undefined), replaceItems: jest.fn(),
  flush: jest.fn().mockResolvedValue(undefined), reload: jest.fn(),
}
jest.mock('../../../../lib/use-tutorial-draft', () => ({ useDraft: () => draft }))

beforeEach(() => {
  jest.clearAllMocks()
  draft.tutorial = { id: 't1', status: 'draft', tutorial_pdf_url: null, toy_photo_url: null, stl_files: [] }
})

it('uploads a chosen photo and records its url immediately', async () => {
  mockRequestMedia.mockResolvedValue({ granted: true })
  mockLaunchLibrary.mockResolvedValue({ canceled: false, assets: [{ uri: 'file://a.jpg', fileName: 'a.jpg', mimeType: 'image/jpeg' }] })
  mockUploadFile.mockResolvedValue({ url: 'photos/a.jpg' })

  render(<FilesSection />)
  fireEvent.press(screen.getByText('Choose from library'))

  await waitFor(() => expect(draft.saveNow).toHaveBeenCalledWith({ toy_photo_url: 'photos/a.jpg' }))
})

it('explains a refused permission rather than failing silently', async () => {
  mockRequestMedia.mockResolvedValue({ granted: false })
  render(<FilesSection />)
  fireEvent.press(screen.getByText('Choose from library'))
  await waitFor(() =>
    expect(screen.getByText('Photo library access is needed to choose a photo.')).toBeTruthy()
  )
})

it('uploads a chosen PDF', async () => {
  mockGetDocument.mockResolvedValue({ canceled: false, assets: [{ uri: 'file://g.pdf', name: 'g.pdf', mimeType: 'application/pdf' }] })
  mockUploadFile.mockResolvedValue({ url: 'pdfs/g.pdf' })

  render(<FilesSection />)
  fireEvent.press(screen.getByText('Choose PDF from Files'))
  await waitFor(() => expect(draft.saveNow).toHaveBeenCalledWith({ tutorial_pdf_url: 'pdfs/g.pdf' }))
})

it('refuses anything that is not a .stl', async () => {
  mockGetDocument.mockResolvedValue({ canceled: false, assets: [{ uri: 'file://x.txt', name: 'x.txt' }] })
  render(<StlSection />)
  fireEvent.press(screen.getByText('Choose STL from Files'))
  await waitFor(() => expect(screen.getByText('Please choose a .stl file.')).toBeTruthy())
  expect(mockUploadFile).not.toHaveBeenCalled()
})

// /api/upload/stl writes the storage object only; the row is this POST's job.
it('appends an uploaded STL to the replace-set', async () => {
  draft.tutorial = {
    id: 't1', status: 'draft', tutorial_pdf_url: null, toy_photo_url: null,
    stl_files: [{ id: 's1', filename: 'old.stl', file_url: 'stl/old.stl' }],
  }
  mockGetDocument.mockResolvedValue({ canceled: false, assets: [{ uri: 'file://n.stl', name: 'n.stl' }] })
  mockUploadFile.mockResolvedValue({ url: 'stl/n.stl', filename: 'n.stl' })
  mockPost.mockResolvedValue([])

  render(<StlSection />)
  fireEvent.press(screen.getByText('Choose STL from Files'))

  await waitFor(() =>
    expect(mockPost).toHaveBeenCalledWith('/api/tutorials/t1/stl-files', {
      stl_files: [
        { filename: 'old.stl', file_url: 'stl/old.stl' },
        { filename: 'n.stl', file_url: 'stl/n.stl' },
      ],
    })
  )
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/mobile && npx jest tests/unit/components/my-tutorials/files-section.test.tsx`
Expected: FAIL — modules not found

- [ ] **Step 3: Write the implementations**

Port `pickPhoto`, `pickPdf` and `openPdfPreview` from `editor.tsx:409-500` into `files-section.tsx`, and `pickStl` from `editor.tsx:502-540` into `stl-section.tsx`, with three changes each:

1. `useState` for the tutorial becomes `useDraft()`.
2. Every `apiClient.patch(...)` that recorded a url becomes `await saveNow({ toy_photo_url: url })` / `saveNow({ tutorial_pdf_url: url })` — the hook now owns `updated_at` and the requeue, so those two properties come out of the call.
3. `<Screen>` wraps each, with `<SaveChip state={saveState} />` at the top and `<ErrorRow message={localError ?? saveError} />` at the bottom, where `localError` covers the permission and file-type messages that are the section's own.

Keep verbatim: the permission copy, `quality: 0.7`, the `.stl` extension guard, the `createSignedUrl(path, 60)` preview, and the comment explaining why the STL POST re-sends existing rows.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/mobile && npx jest tests/unit/components/my-tutorials/files-section.test.tsx`
Expected: PASS, 5 cases

- [ ] **Step 5: Commit**

```bash
git add packages/mobile/components/my-tutorials/sections/files-section.tsx packages/mobile/components/my-tutorials/sections/stl-section.tsx packages/mobile/tests/unit/components/my-tutorials/files-section.test.tsx
git commit -m "feat(mobile): the files and 3D-print sections"
```

---

### Task 8: Routes, and the old editor goes

**Files:**
- Create: `packages/mobile/app/(my)/tutorials/[id]/_layout.tsx`
- Create: `packages/mobile/app/(my)/tutorials/[id]/index.tsx`, `details.tsx`, `safety.tsx`, `parts.tsx`, `tools.tsx`, `files.tsx`, `stl.tsx`
- Delete: `packages/mobile/app/(my)/tutorials/[id].tsx`
- Delete: `packages/mobile/components/my-tutorials/editor.tsx`
- Delete: `packages/mobile/tests/unit/components/my-tutorials/editor.test.tsx`
- Modify: `packages/mobile/app/(my)/_layout.tsx` (the `tutorials/[id]` Stack.Screen)
- Modify: `packages/mobile/app/(tabs)/guides/new.tsx:52` (the redirect)

**Interfaces:**
- Consumes: everything from Tasks 3–7
- Produces: routes `/tutorials/[id]`, `/tutorials/[id]/{details,safety,parts,tools,files,stl}`

- [ ] **Step 1: Write the layout and route files**

```tsx
// packages/mobile/app/(my)/tutorials/[id]/_layout.tsx
//
// One provider for the whole editor stack, so a section's save is already
// reflected on the hub when you go back — no refetch on focus, and no second
// copy of the draft to fall out of step with the first.
import { Stack, useLocalSearchParams } from 'expo-router'
import { TutorialDraftProvider } from '../../../../lib/use-tutorial-draft'
import { stackScreenOptions } from '../../../../lib/nav-options'

export default function TutorialEditorLayout() {
  const { id } = useLocalSearchParams<{ id: string }>()
  return (
    <TutorialDraftProvider id={id}>
      <Stack screenOptions={{ ...stackScreenOptions, headerBackTitle: 'Back' }}>
        <Stack.Screen name="index" options={{ title: 'Edit guide' }} />
        <Stack.Screen name="details" options={{ title: 'Details' }} />
        <Stack.Screen name="safety" options={{ title: 'Safety' }} />
        <Stack.Screen name="parts" options={{ title: 'Parts' }} />
        <Stack.Screen name="tools" options={{ title: 'Tools' }} />
        <Stack.Screen name="files" options={{ title: 'Files' }} />
        <Stack.Screen name="stl" options={{ title: '3D print files' }} />
      </Stack>
    </TutorialDraftProvider>
  )
}
```

```tsx
// packages/mobile/app/(my)/tutorials/[id]/index.tsx
import { useLocalSearchParams } from 'expo-router'
import { TutorialHub } from '../../../../components/my-tutorials/hub'

export default function TutorialHubRoute() {
  const { id, justCreated } = useLocalSearchParams<{ id: string; justCreated?: string }>()
  return <TutorialHub id={id} justCreated={justCreated === '1'} />
}
```

```tsx
// packages/mobile/app/(my)/tutorials/[id]/details.tsx
import { DetailsSection } from '../../../../components/my-tutorials/sections/details-section'
export default function DetailsRoute() { return <DetailsSection /> }
```

`safety.tsx`, `files.tsx` and `stl.tsx` follow that shape exactly with
`SafetySection`, `FilesSection` and `StlSection`. `parts.tsx` and `tools.tsx`
pass the noun:

```tsx
// packages/mobile/app/(my)/tutorials/[id]/parts.tsx
import { ItemsSection } from '../../../../components/my-tutorials/sections/items-section'
export default function PartsRoute() { return <ItemsSection noun="parts" /> }
```

```tsx
// packages/mobile/app/(my)/tutorials/[id]/tools.tsx
import { ItemsSection } from '../../../../components/my-tutorials/sections/items-section'
export default function ToolsRoute() { return <ItemsSection noun="tools" /> }
```

- [ ] **Step 2: Point the outer layout at the nested stack**

In `packages/mobile/app/(my)/_layout.tsx`, replace the `tutorials/[id]` line. The nested stack now supplies its own headers, so the outer one must not draw a second:

```tsx
<Stack.Screen name="tutorials/[id]" options={{ headerShown: false }} />
```

- [ ] **Step 3: Carry the created flag out of guides/new**

In `packages/mobile/app/(tabs)/guides/new.tsx`, replace line 52:

```tsx
    router.replace({ pathname: '/tutorials/[id]', params: { id, justCreated: '1' } })
```

- [ ] **Step 4: Delete the old editor and its route and test**

```bash
git rm packages/mobile/app/\(my\)/tutorials/\[id\].tsx \
       packages/mobile/components/my-tutorials/editor.tsx \
       packages/mobile/tests/unit/components/my-tutorials/editor.test.tsx
```

- [ ] **Step 5: Run the whole mobile suite and the typechecker**

Run: `cd packages/mobile && npx jest && npx tsc --noEmit`
Expected: PASS, and no type errors. `StepPills` is now unreferenced by this
flow but still exported and still has its own test — leave both.

- [ ] **Step 6: Commit**

```bash
git add -A packages/mobile/app packages/mobile/components/my-tutorials packages/mobile/tests
git commit -m "feat(mobile): the guide editor becomes a hub and six sections"
```

---

### Task 9: The e2e walk follows the hub

**Files:**
- Modify: `packages/mobile/tests/e2e/guides-authoring.spec.ts`

- [ ] **Step 1: Rewrite the walk**

The spec's shape is unchanged — sign up, create a draft, fill every section,
submit — but the navigation and the waits move:

- `getByRole('tab', { name: 'Details' })` becomes `getByTestId('hub-row-details')`.
- Each section is entered by tapping its row and left with the header back button
  (`page.goBack()` is wrong — it is a stack, not history; use
  `page.getByLabel('Back').click()`, and if the native header back has no
  accessible name under react-native-web, add `headerBackButtonTestID` or assert
  on the hub reappearing after `page.getByTestId('hub-row-parts')` becomes visible again).
- The three `Save` button clicks go. Each edit is followed by waiting the
  debounced write out, exactly as the spec already waits on PATCHes today:

```ts
  const saved = page.waitForResponse(
    (r) => r.url().includes(`/api/tutorials/${id}`) && r.request().method() === 'PATCH'
  )
  await page.getByLabel('Title').fill(title)
  expect((await saved).status()).toBe(200)
```

- The safety tick is on its own screen: `hub-row-safety` → `safety-declare`.
- Submission is `page.getByTestId('hub-submit').click()` from the hub, after
  asserting it went from disabled to enabled.
- Add one assertion the old spec could not make: after filling parts, going back
  to the hub shows `1 part` on the parts row.

- [ ] **Step 2: Run the spec**

Run: `cd packages/mobile && npx playwright test tests/e2e/guides-authoring.spec.ts`
Expected: PASS. Requires local Supabase (`npx supabase start`, Docker running) —
the config's webServer pair boots the API on 3102 and the web export on 3103.

- [ ] **Step 3: Commit**

```bash
git add packages/mobile/tests/e2e/guides-authoring.spec.ts
git commit -m "test(mobile): the authoring walk follows the hub"
```

---

### Task 10: Web — a contributor can delete their own draft

**Phase 2.** Implements `docs/superpowers/specs/2026-09-02-web-draft-delete-design.md`. Depends on Task 2.

**Files:**
- Modify: `packages/web/app/tutorials/[id]/edit/page.tsx`
- Test: `packages/web/tests/unit/pages/edit-tutorial.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to the existing describe block in `edit-tutorial.test.tsx`, matching however
that file already builds its tutorial fixture and renders the page:

```tsx
describe('deleting a draft', () => {
  it('offers delete on a draft', async () => {
    renderEditPage(tutorial({ status: 'draft' }))
    expect(await screen.findByRole('button', { name: /delete draft/i })).toBeInTheDocument()
  })

  // Absent, not disabled: RLS refuses the delete off a draft, so a control here
  // would be one that cannot work, and "how do I enable it?" has no answer.
  it.each(['pending', 'approved', 'rejected'] as const)('offers no delete on a %s guide', (status) => {
    renderEditPage(tutorial({ status }))
    expect(screen.queryByRole('button', { name: /delete draft/i })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/web && npx vitest run tests/unit/pages/edit-tutorial.test.tsx`
Expected: FAIL — no such button

- [ ] **Step 3: Write the implementation**

In `packages/web/app/tutorials/[id]/edit/page.tsx`, alongside the existing step
row (follow `toy-editor.tsx:149` for placement):

```tsx
{tutorial.status === 'draft' && (
  <DeleteEntityButton
    endpoint={`/api/tutorials/${id}`}
    redirectTo="/dashboard"
    label="draft"
  />
)}
```

with `import { DeleteEntityButton } from '@/components/delete-entity-button'`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/web && npx vitest run tests/unit/pages/edit-tutorial.test.tsx && npx tsc --noEmit`
Expected: PASS, 4 new cases, no type errors

- [ ] **Step 5: Commit**

```bash
git add packages/web/app/tutorials/\[id\]/edit/page.tsx packages/web/tests/unit/pages/edit-tutorial.test.tsx
git commit -m "feat(web): a contributor can delete their own draft"
```

---

## Final verification

- [ ] `cd packages/mobile && npx jest && npx tsc --noEmit`
- [ ] `cd packages/api && npx vitest run && npx tsc --noEmit`
- [ ] `cd packages/web && npx vitest run && npx tsc --noEmit`
- [ ] `graphify update .`
