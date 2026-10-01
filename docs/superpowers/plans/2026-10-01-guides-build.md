# Guides Build (Sub-project 4, Batch 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the 20 Guides items in `packages/types/src/pending.ts` (UI-only, new columns, new tables, community notes) and ship each one out of the registry.

**Architecture:** One task per registry item, in the spec's Order. Each slice that touches the schema adds one migration (085–093), the API checks every limit with a hand-written validator that answers 400 with a plain sentence (the API has no zod), and the database repeats the limit as a CHECK. Shared pure logic goes in a new `packages/types/src/guides.ts` (parts total, caption realignment, print-setting rows) or in mobile `lib/` (tick storage, step %, section count, note summaries, review rows). Every count is a SECURITY DEFINER computed field or its own table — never a column on `tutorials`.

**Tech Stack:** Hono + supabase-js + vitest (api), Next.js App Router + vitest + Playwright (web), Expo Router / React Native + jest + RNTL (mobile), Postgres migrations via the Supabase CLI.

**Spec:** `docs/superpowers/specs/2026-10-01-guides-build-design.md`

## Global Constraints

- **No counter columns on `tutorials`.** 014's trigger bumps `updated_at` and PATCH 409s on a stale token. Counts are `stable`, `security definer`, `set search_path = ''` computed fields (066's `thanks_count` shape) or separate tables.
- **One migration per slice, numbered from 085:** 085 tool notes, 086 part prices, 087 photo captions, 088 print settings, 089 works with, 090 safety notes, 091 builds, 092 view counts, 093 community notes. Each has a `-- DOWN:` block like 066. Each migration's test asserts its objects exist (selecting the new column/function through the admin client fails loudly if a repaired-not-run migration left it out); a security-relevant object also gets a row in `scripts/check-schema-guards.sh`.
- **Limits are checked twice:** the API returns 400 with a plain sentence; the CHECK in the database backs it (`23514` → 400, already mapped in PATCH).
- **Shipping an item:** delete every `PENDING(<id>)` / `pending="<id>"` reference, set `shipped: true` on the entry (never delete it — `pending-registry.test.ts` counts 104), run `node scripts/pending.mjs`, delete any `explained` rule in `scripts/parity/screen-map.json` / `app-screen-map.json` whose `pending` is the id (drop the `explained` key if it empties), and run the drift test. One commit per item.
- **Mobile is a second consumer of every column.** On each column change, `grep -rn "<column>" packages/mobile`. The parts/tools editors on both platforms rebuild every row on save, so each must carry new columns through or one save erases them.
- **Copy is quoted from the boards** (`Splat Connect frontend overhaul/SPLAT Connect - Mobile.dc.html`, `SPLAT Connect - Web.dc.html`), numbers as numerals. Pinned revisions are **not** in the PDF, so the board's "including in the PDF" / "and in the PDF" clauses are dropped.
- **Names come from the admin client**, never a PostgREST `profiles(...)` / `organizations(...)` embed in a user/anon select (033/045 column grants fail the whole query silently).
- **Web e2e specs import only from `tests/e2e/helpers.ts` / `lib/`,** never a component. Never run web and mobile e2e at the same time.
- **Device storage only through `resolveAuthStorage()`** (`lib/supabase-storage.ts`); SecureStore keys use only `[A-Za-z0-9._-]`.
- **Stage only this task's files.** The tree already holds unrelated changes (`CLAUDE.md` modified; `packages/web/zz3_57656.mjs` and `selfIdentity.plist` untracked) that must never be committed: where a commit step names a directory, run `git status --short` first and `git restore --staged` anything that is not the task's.
- Commit messages end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV
  ```

## Review Focus

1. **A save from an editor that predates a column erases it.** Web `EditItemsSection.toInput` and mobile `ItemsEditor`'s seed + `postItems` rebuild every part/tool from four fields; a price, note or get-by set on one platform must survive an edit on the other. Pinned by tests in Task 12 (tools) and Task 13 (parts).
2. **Photos move without their captions.** Web reorders/removes photos with `{ photo_urls }` alone, and mobile can merge a debounced caption edit into the same PATCH as a cover change. The API realigns by URL when captions are absent; mobile sends realigned captions itself. Pinned by Task 14's API and files-section tests.
3. **The guide changes under a parent's ticks.** Ticks for steps that no longer exist are ignored, % never passes 100, a corrupt or unreadable store starts empty, and a storage write failure keeps the tick in memory. Pinned by Task 9's `guide-progress` tests.
4. **Counting never touches the editor's token.** Logging a build, a view and a note must leave `tutorials.updated_at` unchanged. Pinned by Tasks 18, 19, 20 integration tests.
5. **A failed view bump never fails the read.** If `bump_tutorial_view` errors (missing on a repaired DB, a network blip), the public guide still answers 200. Pinned by Task 19's unit test.

## Files

New:
- `packages/types/src/guides.ts` — `partsTotalCents`, `realignCaptions`, `TOOL_GET_BY_LABEL`, `printSettingRows`, `printSettingsLine`, `checkedOn`.
- `packages/web/tests/unit/lib/guides.test.ts` — its tests (types tests live in web, like `contributor-badges.test.ts`).
- `packages/mobile/lib/guide-progress.ts` (+ test) — `ticksKey`, `parseTicks`, `stepProgress`, `useDeviceTicks`.
- `packages/mobile/lib/guide-notes.ts` (+ test) — `GuideNote`, `useGuideNotes`, `noteSummary`.
- `packages/mobile/lib/review-checklist.ts` (+ test) — `reviewRows`, `reviewLead`.
- `packages/mobile/components/ui/Flash.tsx` — `useFlash`, `FlashLine` (the app has no toast).
- `packages/mobile/components/guides/{guide-steps,guide-tools,community-notes}.tsx` (+ tests).
- `packages/mobile/components/my-tutorials/sections/backing-section.tsx`, `packages/mobile/app/(my)/tutorials/[id]/backing.tsx`.
- `packages/api/src/routes/{safety-notes,tutorial-notes}.ts`.
- `packages/web/components/{mark-build-done-button,prices-checked-field,edit-safety-notes-section}.tsx`.
- `supabase/migrations/085_tool_notes.sql` … `093_tutorial_notes.sql`.
- `packages/api/tests/integration/guides/*.test.ts`, `packages/api/tests/unit/routes/public-views.test.ts`.

## Commands used throughout

- API integration (needs `supabase start`; apply new migrations with `supabase migration up`): `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts <file>`
- API unit: `pnpm --filter @splat-connect/api exec vitest run <file>`
- Drift test: `pnpm --filter @splat-connect/api exec vitest run tests/unit/pending-features.test.ts tests/unit/pending-registry.test.ts` → `Tests  11 passed (11)`
- Web unit: `pnpm --filter @splat-connect/web exec vitest run <file>`
- Web e2e: `pnpm --filter @splat-connect/web exec playwright test <file>`
- Mobile unit: `pnpm --filter @splat-connect/mobile exec jest <file>`
- Typecheck: `pnpm typecheck`

---

### Task 1: Loading caption (`guides-loading-caption`)

**Files:**
- Modify: `packages/mobile/components/home/library-screen.tsx` (loading branch of `ListEmptyComponent`, styles)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/mobile/tests/unit/components/home/library-screen.test.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing other tasks use.

- [ ] **Step 1: Write the failing test** (append inside `describe('LibraryScreen', …)`)

```tsx
  it('captions the skeletons while guides load', async () => {
    mockEndpoints({ tutorials: new Promise(() => {}) })
    render(<LibraryScreen />)
    expect(await screen.findByText('Loading guides…')).toBeTruthy()
  })
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/home/library-screen.test.tsx -t "captions the skeletons"`
Expected: FAIL — `Unable to find an element with text: Loading guides…`

- [ ] **Step 3: Implement** — replace the loading branch and its PENDING comment:

```tsx
          loading ? (
            // The board's caption sits under the skeletons, centred.
            <View accessibilityLabel="Loading guides">
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
              <Text style={styles.loadingCaption}>Loading guides…</Text>
            </View>
          ) : error ? (
```

Add to `styles`:

```ts
  loadingCaption: {
    marginTop: theme.spacing(1),
    textAlign: 'center',
    fontFamily: theme.fonts.semiBold,
    fontSize: 13,
    color: theme.colors.muted,
  },
```

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/home/library-screen.test.tsx`
Expected: PASS (all tests in the file)

- [ ] **Step 5: Ship the item** — in `packages/types/src/pending.ts` add `shipped: true,` to `'guides-loading-caption'`; run `node scripts/pending.mjs` (prints `wrote docs/PENDING.md (104 items)`); no parity rule names this id. Run the drift test. Expected: `Tests  11 passed (11)`.

- [ ] **Step 6: Commit**

```bash
git add packages/mobile/components/home/library-screen.tsx packages/mobile/tests/unit/components/home/library-screen.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(mobile): the guides list says Loading guides… under its skeletons

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 2: Clear filters on both empty states (`clear-filters-empty`)

**Files:**
- Modify: `packages/mobile/components/home/library-screen.tsx` (empty state, a `clearFilters` handler)
- Modify: `packages/mobile/components/toys/toy-library-screen.tsx` (empty state, import line 31)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/mobile/tests/unit/components/home/library-screen.test.tsx`, `packages/mobile/tests/unit/components/toys/toy-library-screen.test.tsx`

**Interfaces:**
- Consumes / Produces: nothing shared.

- [ ] **Step 1: Write the failing tests**

In `library-screen.test.tsx`:

```tsx
  it('clears every filter from the empty state in one tap', async () => {
    render(<LibraryScreen />)
    await screen.findByText('Build a Robot Arm')
    fireEvent.changeText(screen.getByPlaceholderText('Search by toy name'), 'zzz')
    expect(screen.queryByText('Build a Robot Arm')).toBeNull()
    fireEvent.press(screen.getByText('Clear filters'))
    expect(screen.getByText('Build a Robot Arm')).toBeTruthy()
    expect(screen.getByText('Advanced Gearbox')).toBeTruthy()
  })
```

In `toy-library-screen.test.tsx`:

```tsx
  it('clears every filter from the empty state in one tap', async () => {
    mockGet.mockResolvedValue([toy({ id: 't1', name: 'Bubble machine' })])
    render(<ToyLibraryScreen />)
    await screen.findByText('Bubble machine')
    fireEvent.changeText(screen.getByPlaceholderText('Search by toy name'), 'zzz')
    fireEvent.press(screen.getByText('Clear filters'))
    expect(screen.getByText('Bubble machine')).toBeTruthy()
    expect(mockPush).not.toHaveBeenCalledWith(expect.objectContaining({ pathname: '/not-built' }))
  })
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/home/library-screen.test.tsx tests/unit/components/toys/toy-library-screen.test.tsx -t "clears every filter"`
Expected: FAIL — the list stays empty (the button opens Not built yet).

- [ ] **Step 3: Implement**

`library-screen.tsx`, beside `onRefresh`:

```tsx
  const clearFilters = () => {
    setSearch('')
    setDifficulty(null)
    setKind('all')
    setQuick(false)
    setPrintable(false)
    setSuitsOnly(false)
  }
```

and in the empty `EmptyState` (Suits-your-child counts as a filter here, though not in the heading's `filtered`):

```tsx
              {filtered || suitsOnly ? (
                <Button label="Clear filters" variant="secondary" onPress={clearFilters} style={styles.retry} />
              ) : null}
```

Remove the `PendingButton` import if `grep -n PendingButton packages/mobile/components/home/library-screen.tsx` shows no other use.

`toy-library-screen.tsx`: change line 31 to `import { pendingHref } from '../ui/pending'`, add

```tsx
  const clearFilters = () => {
    setSearch('')
    setCondition(null)
    setSwitchAdaptedOnly(false)
    setAvailableOnly(false)
  }
```

and replace the PendingButton with `{filtered ? <Button label="Clear filters" variant="secondary" onPress={clearFilters} style={styles.retry} /> : null}`.

- [ ] **Step 4: Run the tests to see them pass**

Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/home/library-screen.test.tsx tests/unit/components/toys/toy-library-screen.test.tsx`
Expected: PASS

- [ ] **Step 5: Ship the item** — `shipped: true` on `'clear-filters-empty'`; `node scripts/pending.mjs`; no parity rule; drift test → `Tests  11 passed (11)`.

- [ ] **Step 6: Commit**

```bash
git add packages/mobile/components/home/library-screen.tsx packages/mobile/components/toys/toy-library-screen.tsx packages/mobile/tests/unit/components/home/library-screen.test.tsx packages/mobile/tests/unit/components/toys/toy-library-screen.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(mobile): Clear filters on the Guides and Toy library empty states

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 3: Search by part (`guides-search-parts`)

The public list is fetched whole and filtered on the phone (the endpoint is not paged and the search is per keystroke), so the server's half is carrying each guide's part names in the list payload; the match stays where the other matches are.

**Files:**
- Modify: `packages/api/src/routes/public.ts:33` (list select)
- Modify: `packages/mobile/components/home/library-screen.tsx` (`ListedTutorial`, `matchesQuery`)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/api/tests/integration/guides/search-parts.test.ts` (new), `packages/mobile/tests/unit/components/home/library-screen.test.tsx`

**Interfaces:**
- Produces: `GET /api/public/tutorials` rows carry `parts: { name: string }[]`.

- [ ] **Step 1: Write the failing tests**

`packages/api/tests/integration/guides/search-parts.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createProject } from '../../helpers/orgs.js'

let author: TestUser
let guide: string

beforeAll(async () => {
  author = await createTestUser('contributor')
  guide = await createProject({ authorId: author.id, status: 'approved', title: 'Search Parts Fixture' })
  await adminClient().from('parts').insert({ tutorial_id: guide, name: 'Jelly Bean switch', quantity: 1, is_optional: false, buy_links: [] })
})

afterAll(async () => {
  await adminClient().from('tutorials').delete().eq('id', guide)
  await deleteTestUser(author.id)
})

describe('GET /api/public/tutorials', () => {
  it('carries each guide’s part names so a search can match them', async () => {
    const res = await app.request('/api/public/tutorials')
    const rows = (await res.json()) as { id: string; parts: { name: string }[] }[]
    expect(rows.find((r) => r.id === guide)?.parts).toEqual([{ name: 'Jelly Bean switch' }])
  })
})
```

In `library-screen.test.tsx`:

```tsx
  it('matches a guide by the parts it uses', async () => {
    mockEndpoints({
      tutorials: Promise.resolve([
        row({ id: '1', title: 'Bubble machine', parts: [{ name: 'Jelly Bean switch' }] }),
        row({ id: '2', title: 'Robot arm', parts: [{ name: 'Servo' }] }),
      ]),
    })
    render(<LibraryScreen />)
    await screen.findByText('Bubble machine')
    fireEvent.changeText(screen.getByPlaceholderText('Search by toy name'), 'jelly')
    expect(screen.getByText('Bubble machine')).toBeTruthy()
    expect(screen.queryByText('Robot arm')).toBeNull()
  })
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/guides/search-parts.test.ts`
Expected: FAIL — `parts` is `undefined`.
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/home/library-screen.test.tsx -t "parts it uses"`
Expected: FAIL — `Bubble machine` not found.

- [ ] **Step 3: Implement**

`public.ts` list select:

```ts
    .select('*, thanks_count, has_stl, parts(name), tutorial_orgs(status, organizations(id, name))')
```

`library-screen.tsx`:

```ts
/** The public list embeds only accepted backings on each row, and each guide's part names. */
type ListedTutorial = Tutorial & { tutorial_orgs?: TutorialOrg[]; parts?: { name: string }[] }
```

and replace the PENDING line plus `matchesQuery`:

```ts
      const matchesQuery =
        !q ||
        t.title.toLowerCase().includes(q) ||
        (t.description?.toLowerCase().includes(q) ?? false) ||
        (t.parts ?? []).some((p) => p.name.toLowerCase().includes(q))
```

- [ ] **Step 4: Run the tests to see them pass**

Run both commands from Step 2. Expected: PASS.

- [ ] **Step 5: Ship the item** — `shipped: true` on `'guides-search-parts'`; `node scripts/pending.mjs`; no parity rule; drift test → `Tests  11 passed (11)`.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/routes/public.ts packages/api/tests/integration/guides/search-parts.test.ts packages/mobile/components/home/library-screen.tsx packages/mobile/tests/unit/components/home/library-screen.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(guides): searching the guides list matches the parts a guide uses

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 4: Cover photo, switch type and age range on New guide (`new-guide-fields`)

PATCH already accepts `photo_urls`, `switch_target`, `age_min`, `age_max`. The cover is uploaded after the author is linked (the upload route checks `tutorial_contributors`), and the extras are best effort: a failure still opens the editor, which has every field.

**Files:**
- Modify: `packages/mobile/app/(tabs)/guides/new.tsx`
- Modify: `scripts/parity/app-screen-map.json` (`guide_new`: delete the three `"pending": "new-guide-fields"` rules; keep the `form sheet` rule)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/mobile/tests/unit/app/guides-new.test.tsx`

**Interfaces:**
- Consumes: `SWITCH_TARGET_LABEL` from `@splat-connect/types`, `uploadFile` from `lib/upload`.

- [ ] **Step 1: Write the failing test**

Add near the other mocks:

```tsx
const mockLibrary = jest.fn()
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchImageLibraryAsync: (...a: unknown[]) => mockLibrary(...a),
}))
```

and the test:

```tsx
  it('sends the cover, switch type and age range once the draft exists', async () => {
    mockPost.mockResolvedValue({ id: 'uuid-1' })
    mockGet.mockResolvedValue({ updated_at: 'v1' })
    mockPatch.mockResolvedValue({})
    mockUpload.mockResolvedValue({ url: 'https://x.test/toy-photos/uuid-1/cover.jpg' })
    mockLibrary.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cover.jpg', fileName: 'cover.jpg', mimeType: 'image/jpeg' }] })
    render(<NewGuideRoute />)
    fireEvent.changeText(screen.getByPlaceholderText('Title'), 'Light-up drum')
    fireEvent.press(screen.getByLabelText('Add a cover photo'))
    await screen.findByText('Cover photo chosen')
    fireEvent.press(screen.getByText('Big button'))
    fireEvent.changeText(screen.getByLabelText('Youngest age'), '3')
    fireEvent.changeText(screen.getByLabelText('Oldest age'), '7')
    fireEvent.press(screen.getByLabelText('Create draft'))
    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith('/api/tutorials/uuid-1', {
        updated_at: 'v1',
        photo_urls: ['https://x.test/toy-photos/uuid-1/cover.jpg'],
        switch_target: 'large',
        age_min: 3,
        age_max: 7,
      })
    )
    expect(mockUpload).toHaveBeenCalledWith('/api/upload/photo', 'uuid-1', { uri: 'file:///cover.jpg', name: 'cover.jpg', mimeType: 'image/jpeg' })
    expect(mockReplace).toHaveBeenCalled()
  })

  it('still opens the editor when the extras fail to save', async () => {
    mockPost.mockResolvedValue({ id: 'uuid-1' })
    mockGet.mockRejectedValue(new Error('API GET failed with status 500'))
    render(<NewGuideRoute />)
    fireEvent.changeText(screen.getByPlaceholderText('Title'), 'Light-up drum')
    fireEvent.press(screen.getByText('Big button'))
    fireEvent.press(screen.getByLabelText('Create draft'))
    await waitFor(() => expect(mockReplace).toHaveBeenCalled())
  })
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/app/guides-new.test.tsx`
Expected: FAIL — no element labelled `Add a cover photo`.

- [ ] **Step 3: Implement** in `new.tsx`

Imports: add `import * as ImagePicker from 'expo-image-picker'`, `SWITCH_TARGET_LABEL` to the `@splat-connect/types` value import, and `Pressable` to the `react-native` import.

State, under `difficulty`:

```tsx
  const [cover, setCover] = useState<{ uri: string; name: string; mimeType: string } | null>(null)
  const [switchTarget, setSwitchTarget] = useState<'large' | 'small' | null>(null)
  const [ageMin, setAgeMin] = useState('')
  const [ageMax, setAgeMax] = useState('')
```

Helpers, above `createDraft`:

```tsx
  async function chooseCover() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) return setError('Photo library access is needed to choose a photo.')
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'] })
    const asset = result.canceled ? null : result.assets?.[0]
    if (asset) setCover({ uri: asset.uri, name: asset.fileName ?? 'photo.jpg', mimeType: asset.mimeType ?? 'image/jpeg' })
  }

  // After the draft exists and its author is linked: the photo route checks
  // tutorial_contributors. Best effort — the editor has every one of these.
  async function applyExtras(id: string) {
    const fields: Record<string, unknown> = {}
    if (switchTarget) fields.switch_target = switchTarget
    if (ageMin !== '') fields.age_min = Number(ageMin)
    if (ageMax !== '') fields.age_max = Number(ageMax)
    if (!cover && !Object.keys(fields).length) return
    try {
      const { updated_at } = await apiClient.get<{ updated_at: string }>(`/api/tutorials/${id}`)
      const photo = cover ? (await uploadFile('/api/upload/photo', id, cover)).url : null
      await apiClient.patch(`/api/tutorials/${id}`, { updated_at, ...(photo ? { photo_urls: [photo] } : {}), ...fields })
    } catch (err) {
      console.error('[NewGuideRoute] extras not saved:', err)
    }
  }
```

In `createDraft`, call `await applyExtras(id)` immediately before each `router.replace(...)` (the PDF branch and the blank branch).

Replace the intro `Text` and the PENDING comment with the board's lead:

```tsx
      <Text style={styles.intro}>Two things to start: what the toy is, and one photo. The rest can wait for the editor.</Text>
```

After the Title field, the cover row:

```tsx
        <Text style={styles.label}>Cover photo</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Add a cover photo" onPress={() => void chooseCover()} style={styles.cover}>
          <Text style={styles.termsCopy}>{cover ? 'Cover photo chosen' : 'Tap to add — the finished toy, plain background'}</Text>
        </Pressable>
```

After the Difficulty chips:

```tsx
        <Text style={styles.label}>Switch type</Text>
        <View style={styles.chipRow}>
          {(Object.keys(SWITCH_TARGET_LABEL) as ('large' | 'small')[]).map((v) => (
            <Chip
              key={v}
              label={SWITCH_TARGET_LABEL[v].charAt(0).toUpperCase() + SWITCH_TARGET_LABEL[v].slice(1)}
              active={switchTarget === v}
              onPress={() => setSwitchTarget((cur) => (cur === v ? null : v))}
            />
          ))}
        </View>

        <Text style={styles.label}>Age range</Text>
        <View style={styles.chipRow}>
          <TextField accessibilityLabel="Youngest age" placeholder="From" keyboardType="number-pad" value={ageMin} onChangeText={setAgeMin} boxStyle={styles.ageBox} />
          <TextField accessibilityLabel="Oldest age" placeholder="To" keyboardType="number-pad" value={ageMax} onChangeText={setAgeMax} boxStyle={styles.ageBox} />
        </View>
```

Styles:

```ts
  cover: {
    padding: theme.spacing(4),
    borderRadius: theme.radii.field,
    borderWidth: theme.border.hairline,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
    marginBottom: theme.spacing(4),
  },
  ageBox: { flex: 1 },
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/app/guides-new.test.tsx`
Expected: PASS (the existing tests still pass: no extras means no GET or PATCH).

- [ ] **Step 5: Ship the item** — `shipped: true` on `'new-guide-fields'`; `node scripts/pending.mjs`; delete the three `guide_new` rules naming `new-guide-fields` in `scripts/parity/app-screen-map.json`; drift test → `Tests  11 passed (11)`.

- [ ] **Step 6: Commit**

```bash
git add "packages/mobile/app/(tabs)/guides/new.tsx" packages/mobile/tests/unit/app/guides-new.test.tsx scripts/parity/app-screen-map.json packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(mobile): New guide takes a cover photo, switch type and age range

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 5: Buy links on the phone (`editor-part-buy-links`)

**Files:**
- Modify: `packages/mobile/components/my-tutorials/sections/items-section.tsx`
- Modify: `packages/mobile/lib/use-tutorial-draft.tsx` (`postItems` drops half-filled links)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/mobile/tests/unit/components/my-tutorials/items-section.test.tsx`

**Interfaces:**
- Consumes: `ItemRow.buy_links: BuyLink[]` (already on the type).

- [ ] **Step 1: Write the failing test**

```tsx
it('edits a part’s buy links on the phone', () => {
  render(<ItemsSection noun="parts" />)
  fireEvent.press(screen.getByRole('button', { name: 'Buy links for part 1' }))
  fireEvent.press(screen.getByRole('button', { name: '+ Add a buy link' }))
  fireEvent.changeText(screen.getByLabelText('Part 1 link 1 shop'), 'Jaycar')
  fireEvent.changeText(screen.getByLabelText('Part 1 link 1 address'), 'https://jaycar.com.au/x')
  expect(mockDraft.replaceItems).toHaveBeenLastCalledWith('parts', [
    expect.objectContaining({ name: 'Switch', buy_links: [{ label: 'Jaycar', url: 'https://jaycar.com.au/x' }] }),
  ])
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/my-tutorials/items-section.test.tsx -t "buy links"`
Expected: FAIL — no button `Buy links for part 1`.

- [ ] **Step 3: Implement**

In `ItemsEditor`, add `const [linksOpen, setLinksOpen] = useState<number | null>(null)`. Replace the PendingButton with:

```tsx
              {noun === 'parts' ? (
                <Button
                  label={`Buy links${row.buy_links.length ? ` (${row.buy_links.length})` : ''}`}
                  accessibilityLabel={`Buy links for part ${i + 1}`}
                  variant="ghost"
                  onPress={() => setLinksOpen((cur) => (cur === i ? null : i))}
                />
              ) : null}
```

and after the `controls` row, inside the card:

```tsx
            {noun === 'parts' && linksOpen === i ? (
              <View style={styles.links}>
                {row.buy_links.map((link, n) => (
                  <View key={n} style={styles.linkRow}>
                    <TextField
                      accessibilityLabel={`Part ${i + 1} link ${n + 1} shop`}
                      placeholder="Shop, e.g. Jaycar"
                      value={link.label}
                      onChangeText={(label) => update(i, { buy_links: row.buy_links.map((l, k) => (k === n ? { ...l, label } : l)) })}
                    />
                    <TextField
                      accessibilityLabel={`Part ${i + 1} link ${n + 1} address`}
                      placeholder="https://"
                      autoCapitalize="none"
                      keyboardType="url"
                      value={link.url}
                      onChangeText={(url) => update(i, { buy_links: row.buy_links.map((l, k) => (k === n ? { ...l, url } : l)) })}
                    />
                    <Button
                      label="Remove link"
                      variant="ghost"
                      onPress={() => update(i, { buy_links: row.buy_links.filter((_, k) => k !== n) })}
                    />
                  </View>
                ))}
                <Button
                  label="+ Add a buy link"
                  variant="ghost"
                  onPress={() => update(i, { buy_links: [...row.buy_links, { label: '', url: '' }] })}
                />
              </View>
            ) : null}
```

Styles: `links: { marginTop: theme.spacing(3), gap: theme.spacing(2) }, linkRow: { gap: theme.spacing(1) },`. Remove the `PendingButton` import and the `PENDING(editor-part-buy-links)` is gone with it.

In `use-tutorial-draft.tsx` `postItems`, a link is sent only once it has an address (a half-typed row must not reach the web as a dead link):

```ts
    const links = (r: ItemRow) => r.buy_links.filter((l) => l.url.trim())
```

and use `buy_links: links(r)` in both the parts and the tools mappings.

- [ ] **Step 4: Run the tests to see them pass**

Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/my-tutorials/items-section.test.tsx tests/unit/lib/use-tutorial-draft.test.tsx`
Expected: PASS

- [ ] **Step 5: Ship the item** — `shipped: true` on `'editor-part-buy-links'`; `node scripts/pending.mjs`; no parity rule; drift test → `Tests  11 passed (11)`.

- [ ] **Step 6: Commit**

```bash
git add packages/mobile/components/my-tutorials/sections/items-section.tsx packages/mobile/lib/use-tutorial-draft.tsx packages/mobile/tests/unit/components/my-tutorials/items-section.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(mobile): edit a part's buy links in the phone editor

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 6: Backing in the phone editor (`editor-backing`)

Mirrors web's `EditBackingSection` over the existing `/:id/orgs` routes: read-only once approved, asks only active organisations not yet asked, withdraws by org id.

**Files:**
- Create: `packages/mobile/components/my-tutorials/sections/backing-section.tsx`
- Create: `packages/mobile/app/(my)/tutorials/[id]/backing.tsx`
- Modify: `packages/mobile/app/(my)/tutorials/[id]/_layout.tsx` (one `Stack.Screen`)
- Modify: `packages/mobile/components/my-tutorials/hub.tsx` (the More row)
- Modify: `packages/mobile/components/my-tutorials/sections/details-section.tsx` (lead + a Backing row)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/mobile/tests/unit/components/my-tutorials/backing-section.test.tsx` (new), `hub.test.tsx`

**Interfaces:**
- Consumes: `GET/POST /api/tutorials/:id/orgs`, `DELETE /api/tutorials/:id/orgs/:orgId`, `GET /api/organizations`, `useDraft()`.
- Produces: route `/tutorials/[id]/backing`.

- [ ] **Step 1: Write the failing tests**

`backing-section.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { BackingSection } from '../../../../components/my-tutorials/sections/backing-section'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), back: jest.fn(), canGoBack: () => true }) }))

const mockGet = jest.fn()
const mockPost = jest.fn()
const mockDelete = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: {
    get: (...a: unknown[]) => mockGet(...a),
    post: (...a: unknown[]) => mockPost(...a),
    delete: (...a: unknown[]) => mockDelete(...a),
  },
}))
const mockDraft = { tutorial: { id: 't1', status: 'draft', reviewed_for_org_id: null } }
jest.mock('../../../../lib/use-tutorial-draft', () => ({ useDraft: () => mockDraft }))

const orgs = [
  { id: 'o1', name: 'Northside Therapy', status: 'active', description: null },
  { id: 'o2', name: 'Riverside Makers', status: 'active', description: null },
]

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockImplementation((p: string) =>
    Promise.resolve(p === '/api/organizations' ? orgs : [{ id: 'b1', org_id: 'o1', status: 'pending', organizations: { id: 'o1', name: 'Northside Therapy' } }])
  )
  mockPost.mockResolvedValue({})
  mockDelete.mockResolvedValue(undefined)
})

it('lists who was asked and asks another organisation', async () => {
  render(<BackingSection />)
  expect(await screen.findByText('Deciding')).toBeTruthy()
  fireEvent.press(screen.getByRole('button', { name: 'Ask Riverside Makers' }))
  await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/tutorials/t1/orgs', { org_id: 'o2' }))
})

it('withdraws a request', async () => {
  render(<BackingSection />)
  fireEvent.press(await screen.findByRole('button', { name: 'Withdraw from Northside Therapy' }))
  await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/api/tutorials/t1/orgs/o1'))
})

it('is read-only once the guide is approved', async () => {
  mockDraft.tutorial = { id: 't1', status: 'approved', reviewed_for_org_id: 'o1' }
  render(<BackingSection />)
  await screen.findByText('Northside Therapy')
  expect(screen.queryByRole('button', { name: /Withdraw|Ask / })).toBeNull()
  mockDraft.tutorial = { id: 't1', status: 'draft', reviewed_for_org_id: null }
})
```

In `hub.test.tsx`, in the `'lists what is edited elsewhere, with Backing as a pending row'` test (rename it `'lists what is edited elsewhere, and opens Backing'`), replace the `// PENDING(editor-backing)` comment and the line `expect(screen.getByRole('button', { name: 'Backing' })).toBeTruthy()` with:

```tsx
  fireEvent.press(screen.getByRole('button', { name: /^Backing/ }))
  expect(mockPush).toHaveBeenCalledWith('/tutorials/t1/backing')
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/my-tutorials/backing-section.test.tsx tests/unit/components/my-tutorials/hub.test.tsx`
Expected: FAIL — `Cannot find module …/backing-section`; the hub row pushes `/not-built`.

- [ ] **Step 3: Implement**

`backing-section.tsx`:

```tsx
// packages/mobile/components/my-tutorials/sections/backing-section.tsx
//
// Web's EditBackingSection on the phone, over the same routes. Read-only once
// the guide is approved: policy refuses every change then, and editing an
// approved guide re-queues it, so the two dangerous states never coexist.
import { useCallback, useEffect, useState } from 'react'
import { View, Text, ScrollView, StyleSheet } from 'react-native'
import type { Organization, TutorialOrg } from '@splat-connect/types'
import { apiClient } from '../../../lib/api-client'
import { useDraft } from '../../../lib/use-tutorial-draft'
import { theme } from '../../../lib/theme'
import { Screen } from '../../ui/Screen'
import { Button } from '../../ui/Button'
import { ErrorRow } from '../../ui/ErrorRow'
import { ListRow, Pill } from '../../list/list-kit'

const STATUS = {
  pending: { label: 'Deciding', bg: theme.colors.honeySoft },
  accepted: { label: 'Backing', bg: theme.colors.mintSoft },
  declined: { label: 'Declined', bg: theme.colors.apricotSoft },
} as const

export function BackingSection() {
  const { tutorial } = useDraft()
  const [backing, setBacking] = useState<TutorialOrg[] | null>(null)
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const id = tutorial?.id

  const load = useCallback(() => {
    if (!id) return
    apiClient.get<TutorialOrg[]>(`/api/tutorials/${id}/orgs`).then(setBacking).catch(() => setBacking([]))
    apiClient.get<Organization[]>('/api/organizations').then(setOrgs).catch(() => setOrgs([]))
  }, [id])
  useEffect(load, [load])

  if (!tutorial || !backing) return <Screen />

  const readOnly = tutorial.status === 'approved'
  const asked = new Set(backing.map((b) => b.org_id))
  const available = orgs.filter((o) => !asked.has(o.id) && o.status === 'active')

  async function run(fn: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      load()
    } catch {
      setError('That did not work. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false}>
        {backing.length === 0 ? (
          <Text style={styles.lead}>
            No organisation is backing this project yet. SPLAT will review it — asking an organisation is optional.
          </Text>
        ) : (
          backing.map((b) => {
            const name = b.organizations?.name ?? 'An organisation'
            return (
              <View key={b.id} style={styles.row}>
                <ListRow title={name} meta="" pill={<Pill label={STATUS[b.status].label} bg={STATUS[b.status].bg} />} />
                {readOnly && tutorial.reviewed_for_org_id === b.org_id ? (
                  <Text style={styles.hint}>{name} approved this. Withdrawing means asking SPLAT to unpublish it.</Text>
                ) : null}
                {!readOnly ? (
                  <Button
                    label="Withdraw"
                    accessibilityLabel={`Withdraw from ${name}`}
                    variant="ghost"
                    disabled={busy}
                    onPress={() => void run(() => apiClient.delete(`/api/tutorials/${tutorial.id}/orgs/${b.org_id}`))}
                  />
                ) : null}
              </View>
            )
          })
        )}

        {!readOnly ? (
          <>
            <Text style={styles.label}>Ask another organisation</Text>
            <Text style={styles.hint}>
              Their leaders can read this while they decide, including if they say no. Choose the one or two who know your work.
            </Text>
            {available.length === 0 ? (
              <Text style={styles.hint}>
                {orgs.length === 0 ? 'There are no organisations on the platform yet.' : 'You have already asked every organisation.'}
              </Text>
            ) : (
              available.map((o) => (
                <Button
                  key={o.id}
                  label={o.name}
                  accessibilityLabel={`Ask ${o.name}`}
                  variant="secondary"
                  disabled={busy}
                  style={styles.ask}
                  onPress={() => void run(() => apiClient.post(`/api/tutorials/${tutorial.id}/orgs`, { org_id: o.id }))}
                />
              ))
            )}
          </>
        ) : null}
        <ErrorRow message={error} />
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  lead: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted, lineHeight: 20, marginBottom: theme.spacing(3) },
  row: { marginBottom: theme.spacing(3) },
  label: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.ink, marginTop: theme.spacing(4) },
  hint: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted, lineHeight: 18, marginVertical: theme.spacing(1) },
  ask: { marginTop: theme.spacing(2) },
})
```

`app/(my)/tutorials/[id]/backing.tsx`:

```tsx
import { BackingSection } from '../../../../components/my-tutorials/sections/backing-section'
export default function BackingRoute() { return <BackingSection /> }
```

`_layout.tsx`: add `<Stack.Screen name="backing" options={{ title: 'Backing' }} />` after `stl`.

`hub.tsx`: replace `<PendingRow pending="editor-backing" label="Backing" icon="ribbon-outline" />` and drop the `PendingRow` import:

```tsx
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Backing. ${backingSummary(tutorial)}`}
          onPress={() => router.push(`/tutorials/${id}/backing`)}
          style={styles.moreRow}
        >
          <Text style={styles.moreLabel}>Backing</Text>
          <Text style={styles.moreValue}>{backingSummary(tutorial)}</Text>
        </Pressable>
```

with, above the component:

```ts
/** What the More row says about backing: who said yes, who is still deciding. */
function backingSummary(t: { tutorial_orgs?: { status: string; organizations?: { name: string } | null }[] }): string {
  const rows = t.tutorial_orgs ?? []
  const backing = rows.filter((b) => b.status === 'accepted').map((b) => b.organizations?.name ?? 'An organisation')
  const deciding = rows.filter((b) => b.status === 'pending').length
  if (backing.length) return `Backed by ${backing.join(', ')}${deciding ? ` · ${deciding} still deciding` : ''}`
  return deciding ? `${deciding} still deciding` : 'None yet - optional'
}
```

Also update the hub's comment above `More` ("Backing is a second fetch on web …") to say Backing opens its own screen.

`details-section.tsx`: replace the PENDING comment and lead with the board's lead, and add a row before the footer:

```tsx
        <Text style={styles.lead}>What the toy is, who it suits, and who is backing the guide.</Text>
```

```tsx
        <Button label="Backing" variant="secondary" onPress={() => router.push(`/tutorials/${tutorial.id}/backing`)} />
```

(import `useRouter` from `expo-router`, `Button` from `../../ui/Button`, and call `const router = useRouter()` at the top of `DetailsSection`).

- [ ] **Step 4: Run the tests to see them pass**

Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/my-tutorials`
Expected: PASS (details-section's tests need `expo-router` mocked: add `jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))` to `details-section.test.tsx` if it fails on `useRouter`).

- [ ] **Step 5: Ship the item** — `shipped: true` on `'editor-backing'`; `node scripts/pending.mjs`; no parity rule; drift test → `Tests  11 passed (11)`.

- [ ] **Step 6: Commit**

```bash
git add packages/mobile/components/my-tutorials "packages/mobile/app/(my)/tutorials/[id]" packages/mobile/tests/unit/components/my-tutorials packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(mobile): ask an organisation to back a guide from the phone editor

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 7: Progress and backing on My tutorials rows (`my-tutorials-meta`)

The row's "{ready} of {n} sections done" must be the hub's own number, so the hub's count moves into `lib/tutorial-sections.ts` and both read it. `/mine` today returns no parts/tools/files/steps, so it gains id-only embeds (enough for `getMissingFields`, which reads only lengths) and the backing embed gains `requested_at` for "since".

**Files:**
- Modify: `packages/api/src/routes/tutorials.ts` (`LIST_SELECT` embed, `/mine` select)
- Modify: `packages/mobile/lib/tutorial-sections.ts` (add `sectionProgress`)
- Modify: `packages/mobile/components/my-tutorials/hub.tsx` (use it)
- Modify: `packages/mobile/components/my-tutorials/list-screen.tsx` (`tutorialMeta`)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/mobile/tests/unit/lib/tutorial-sections.test.ts`, `packages/mobile/tests/unit/components/my-tutorials/list-screen.test.tsx`, `packages/api/tests/integration/guides/mine.test.ts` (new)

**Interfaces:**
- Produces: `sectionProgress(t: TutorialWithDetails): { ready: number; total: number }`; `tutorialMeta(t: MineRow): string` exported from `list-screen.tsx`; `/api/tutorials/mine` rows carry `parts(id)`, `tools(id)`, `stl_files(id)`, `steps(id)`, `tutorial_orgs[].requested_at`. Task 19 extends `tutorialMeta`.

- [ ] **Step 1: Write the failing tests**

`tutorial-sections.test.ts` (append):

```ts
describe('sectionProgress', () => {
  it('counts the sections with nothing missing, out of the sections this kind shows', () => {
    const t = { title: 'T', difficulty: 'easy', build_minutes: 30, tutorial_pdf_url: 'x', photo_urls: ['p'], parts: [{}], tools: [], stl_files: [], kind: 'toy_adaptation', safety_declared_at: null } as never
    expect(sectionProgress(t)).toEqual({ ready: 4, total: 6 })
  })
})
```

(import `sectionProgress` alongside the existing imports; `tools` and `safety` are the two gaps, steps never is.)

`list-screen.test.tsx`:

```tsx
  it('says how far a draft has got, and who is holding a submitted one', async () => {
    mockGet.mockResolvedValue([
      tutorial({ id: 'd', title: 'Bubble blower', status: 'draft', build_minutes: 30, parts: [{ id: 'p' }], tools: [{ id: 't' }], stl_files: [], steps: [] }),
      tutorial({
        id: 'w', title: 'Vibrating cushion', status: 'pending',
        tutorial_orgs: [{ id: 'b', status: 'pending', org_id: 'o', requested_at: '2026-08-28T02:00:00Z', organizations: { id: 'o', name: 'Northside Therapy' } }],
      }),
    ])
    render(<MyTutorialsListScreen />)
    expect(await screen.findByText('Draft · 4 of 6 sections done')).toBeTruthy()
    expect(screen.getByText('With Northside Therapy since 28 Aug')).toBeTruthy()
  })
```

`packages/api/tests/integration/guides/mine.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createProject } from '../../helpers/orgs.js'

let author: TestUser
let guide: string

beforeAll(async () => {
  author = await createTestUser('contributor')
  guide = await createProject({ authorId: author.id, status: 'draft', title: 'Mine Fixture' })
  await adminClient().from('parts').insert({ tutorial_id: guide, name: 'Switch', quantity: 1, is_optional: false, buy_links: [] })
})
afterAll(async () => {
  await adminClient().from('tutorials').delete().eq('id', guide)
  await deleteTestUser(author.id)
})

describe('GET /api/tutorials/mine', () => {
  it('carries what the row needs to count its sections', async () => {
    const res = await app.request('/api/tutorials/mine', { headers: { Authorization: `Bearer ${author.token}` } })
    const row = ((await res.json()) as Record<string, unknown[]>[]).find((r) => (r as unknown as { id: string }).id === guide)!
    expect(row.parts).toHaveLength(1)
    expect(row.tools).toEqual([])
    expect(row.stl_files).toEqual([])
    expect(row.steps).toEqual([])
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/lib/tutorial-sections.test.ts tests/unit/components/my-tutorials/list-screen.test.tsx`
Expected: FAIL — `sectionProgress is not a function`; meta text not found.
Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/guides/mine.test.ts`
Expected: FAIL — `row.parts` undefined.

- [ ] **Step 3: Implement**

`tutorials.ts`:

```ts
const LIST_SELECT =
  '*, tutorial_contributors!inner(profile_id), tutorial_orgs(id, status, org_id, requested_at, organizations(id, name))'
```

and in `/mine`:

```ts
    // Ids only: the My tutorials row counts sections the way the editor hub does
    // (getMissingFields reads lengths), and nothing on the row needs more.
    .select(`${LIST_SELECT}, parts(id), tools(id), stl_files(id), steps:tutorial_steps(id)`)
```

`tutorial-sections.ts` (after `sectionsFor`):

```ts
/** The hub's "{ready} of {total} sections complete", shared with My tutorials. */
export function sectionProgress(t: TutorialWithDetails): { ready: number; total: number } {
  const sections = sectionsFor(t.kind)
  const incomplete = new Set(getMissingFields(t).map((g) => g.section))
  return { ready: sections.filter((s) => !incomplete.has(s)).length, total: sections.length }
}
```

`hub.tsx`: replace the `sections` / `incomplete` / `ready` block's `ready` line with `const { ready } = sectionProgress(tutorial)` (keep `sections` and `incomplete`, which the rows use) and import `sectionProgress`.

`list-screen.tsx`: import `shortDate`, `type TutorialOrg`, `type TutorialWithDetails` from `@splat-connect/types` and `sectionProgress` from `../../lib/tutorial-sections`, then:

```ts
type MineRow = Tutorial & { tutorial_orgs?: TutorialOrg[] }

/** The board's row meta: a draft's progress, who is holding a submitted guide, else what it is and who backs it. */
export function tutorialMeta(t: MineRow): string {
  const orgs = t.tutorial_orgs ?? []
  if (t.status === 'draft') {
    const { ready, total } = sectionProgress(t as unknown as TutorialWithDetails)
    return `Draft · ${ready} of ${total} sections done`
  }
  const deciding = orgs.find((o) => o.status === 'pending')
  if (t.status === 'pending' && deciding?.organizations?.name) {
    return `With ${deciding.organizations.name} since ${shortDate(deciding.requested_at)}`
  }
  const backer = orgs.find((o) => o.status === 'accepted')?.organizations?.name
  return [`${KIND_LABEL[t.kind]} · ${t.difficulty}`, backer].filter(Boolean).join(' · ')
}
```

In `TutorialRow` delete the PENDING(my-tutorials-meta) line (keep PENDING(my-tutorials-views) — Task 19 ships it) and set `meta={tutorialMeta(item)}`; widen `item`'s type to `MineRow` and the list state to `MineRow[]`.

- [ ] **Step 4: Run the tests to see them pass**

Run the three commands from Step 2 plus `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/my-tutorials/hub.test.tsx`. Expected: PASS.

- [ ] **Step 5: Ship the item** — `shipped: true` on `'my-tutorials-meta'`; `node scripts/pending.mjs`; no parity rule; drift test → `Tests  11 passed (11)`.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/routes/tutorials.ts packages/api/tests/integration/guides/mine.test.ts packages/mobile/lib/tutorial-sections.ts packages/mobile/components/my-tutorials/hub.tsx packages/mobile/components/my-tutorials/list-screen.tsx packages/mobile/tests/unit packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(mobile): My tutorials rows show a draft's sections done and who holds a submitted guide

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 8: Ask a maker nearby (`guide-ask-a-maker`)

**Files:**
- Modify: `packages/mobile/components/home/detail-screen.tsx` (the PendingRow near the end)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/mobile/tests/unit/components/home/detail-screen.test.tsx`

**Interfaces:**
- Consumes: `app/(tabs)/explore/makers-wanted/new.tsx` reads `?guide=` (`ask-for-build-screen.tsx:40`).

- [ ] **Step 1: Write the failing test**

```tsx
  it('asks a maker nearby with this guide already picked', async () => {
    render(<DetailScreen id="1" />)
    fireEvent.press(await screen.findByRole('button', { name: "Can't build it? Ask a maker nearby" }))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/explore/makers-wanted/new', params: { guide: '1' } })
    expect(screen.getByText('A maker nearby gives the time and the skill; you cover the parts. You agree a pickup in My exchanges.')).toBeTruthy()
  })
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/home/detail-screen.test.tsx -t "maker nearby"`
Expected: FAIL — push was `{ pathname: '/not-built', … }`.

- [ ] **Step 3: Implement** — replace the `PendingRow`:

```tsx
      <AnimatedPressable
        onPress={() => router.push({ pathname: '/explore/makers-wanted/new', params: { guide: tutorial.id } })}
        accessibilityRole="button"
        accessibilityLabel="Can't build it? Ask a maker nearby"
        pressScale={0.985}
        style={styles.printCard}
      >
        <View style={styles.printHeader}>
          <Text style={styles.printTitle}>Can&apos;t build it? Ask a maker nearby</Text>
          <Ionicons name="chevron-forward" size={16} color={theme.colors.primary} />
        </View>
        <Text style={styles.printHint}>
          A maker nearby gives the time and the skill; you cover the parts. You agree a pickup in My exchanges.
        </Text>
      </AnimatedPressable>
```

Drop `PendingRow` from the `../ui/pending` import (PendingButton stays until Tasks 9, 18 and 20).

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/home/detail-screen.test.tsx`
Expected: PASS

- [ ] **Step 5: Ship the item** — `shipped: true` on `'guide-ask-a-maker'`; `node scripts/pending.mjs`; no parity rule; drift test → `Tests  11 passed (11)`.

- [ ] **Step 6: Commit**

```bash
git add packages/mobile/components/home/detail-screen.tsx packages/mobile/tests/unit/components/home/detail-screen.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(mobile): a guide asks a maker nearby, with the guide already picked

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 9: Step tracking on the device (`guide-step-tracking`)

Ticks are kept per guide under `guide-steps.<tutorialId>` as a JSON list of step ids, through `resolveAuthStorage()`. The steps PUT (080) replaces every row, so a re-approved guide's steps get new ids and old ticks are dropped rather than pointing at the wrong step — a `ponytail:` note says so.

**Files:**
- Create: `packages/mobile/lib/guide-progress.ts`, `packages/mobile/tests/unit/lib/guide-progress.test.ts`
- Create: `packages/mobile/components/ui/Flash.tsx`
- Create: `packages/mobile/components/guides/guide-steps.tsx`, `packages/mobile/tests/unit/components/guides/guide-steps.test.tsx`
- Modify: `packages/mobile/components/home/detail-screen.tsx` (Steps section → `GuideSteps`, completion card)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`

**Interfaces:**
- Produces:
  - `ticksKey(kind: 'steps' | 'tools', tutorialId: string): string`
  - `parseTicks(raw: string | null, validIds: readonly string[]): Set<string>`
  - `stepProgress(steps: readonly Pick<TutorialStep, 'id' | 'position' | 'title'>[], ticked: ReadonlySet<string>): { done: number; total: number; pct: number; allDone: boolean; resume: Pick<TutorialStep, 'id' | 'position' | 'title'> | null }`
  - `useDeviceTicks(key: string, validIds: readonly string[]): { ticked: Set<string>; toggle: (id: string) => void; reset: () => void }`
  - `useFlash(ms?: number): readonly [string | null, (message: string) => void]`, `FlashLine({ message })`
  - `GuideSteps({ tutorialId, steps, completion, noteLabels?, extras? })` — `completion: (total: number) => ReactNode`; `noteLabels`/`extras` are added by Task 20.

- [ ] **Step 1: Write the failing tests**

`guide-progress.test.ts`:

```ts
import { renderHook, act, waitFor } from '@testing-library/react-native'
import { parseTicks, stepProgress, ticksKey, useDeviceTicks } from '../../../lib/guide-progress'

const mockGetItem = jest.fn()
const mockSetItem = jest.fn()
jest.mock('../../../lib/supabase-storage', () => ({
  resolveAuthStorage: () => ({
    getItem: (...a: unknown[]) => mockGetItem(...a),
    setItem: (...a: unknown[]) => mockSetItem(...a),
    removeItem: jest.fn(),
  }),
}))

const steps = [
  { id: 'a', position: 1, title: 'Open the battery bay' },
  { id: 'b', position: 2, title: 'Slide the interrupter in' },
  { id: 'c', position: 3, title: null },
]

beforeEach(() => {
  jest.clearAllMocks()
  mockGetItem.mockResolvedValue(null)
  mockSetItem.mockResolvedValue(undefined)
})

describe('parseTicks', () => {
  it('keeps only ticks for steps the guide still has', () => {
    expect([...parseTicks('["a","gone","c"]', ['a', 'b', 'c'])]).toEqual(['a', 'c'])
  })
  it('starts empty on anything that is not a list of ids', () => {
    expect(parseTicks('{"a":1}', ['a']).size).toBe(0)
    expect(parseTicks('not json', ['a']).size).toBe(0)
    expect(parseTicks(null, ['a']).size).toBe(0)
  })
})

describe('stepProgress', () => {
  it('counts done, rounds the percent and points at the first open step', () => {
    expect(stepProgress(steps, new Set(['a']))).toEqual({ done: 1, total: 3, pct: 33, allDone: false, resume: steps[1] })
  })
  it('offers no resume before the first tick or after the last', () => {
    expect(stepProgress(steps, new Set()).resume).toBeNull()
    expect(stepProgress(steps, new Set(['a', 'b', 'c']))).toMatchObject({ pct: 100, allDone: true, resume: null })
  })
  it('never passes 100 when a stale tick is in the set', () => {
    expect(stepProgress(steps, new Set(['a', 'b', 'c', 'gone'])).pct).toBe(100)
  })
  it('is never all done with no steps', () => {
    expect(stepProgress([], new Set()).allDone).toBe(false)
  })
})

describe('useDeviceTicks', () => {
  const key = ticksKey('steps', 'g1')

  it('restores, toggles and saves under the guide’s key', async () => {
    mockGetItem.mockResolvedValue('["a"]')
    const { result } = renderHook(() => useDeviceTicks(key, ['a', 'b']))
    await waitFor(() => expect(result.current.ticked.has('a')).toBe(true))
    act(() => result.current.toggle('b'))
    expect(mockSetItem).toHaveBeenLastCalledWith('guide-steps.g1', '["a","b"]')
    act(() => result.current.reset())
    expect(mockSetItem).toHaveBeenLastCalledWith('guide-steps.g1', '[]')
  })

  it('keeps ticks in memory when the device store fails', async () => {
    mockGetItem.mockRejectedValue(new Error('keychain locked'))
    mockSetItem.mockRejectedValue(new Error('keychain locked'))
    const { result } = renderHook(() => useDeviceTicks(key, ['a']))
    await waitFor(() => expect(mockGetItem).toHaveBeenCalled())
    act(() => result.current.toggle('a'))
    expect(result.current.ticked.has('a')).toBe(true)
  })
})
```

`guide-steps.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { Text } from 'react-native'
import { GuideSteps } from '../../../../components/guides/guide-steps'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockSetItem = jest.fn().mockResolvedValue(undefined)
jest.mock('../../../../lib/supabase-storage', () => ({
  resolveAuthStorage: () => ({ getItem: jest.fn().mockResolvedValue(null), setItem: (...a: unknown[]) => mockSetItem(...a), removeItem: jest.fn() }),
}))

const steps = [
  { id: 'a', tutorial_id: 'g', position: 1, title: 'Open the battery bay', body: 'One screw.', photo_url: null },
  { id: 'b', tutorial_id: 'g', position: 2, title: 'Slide the interrupter in', body: 'Copper side down.', photo_url: null },
]

it('ticks steps, shows progress and where to pick up, and resets', async () => {
  render(<GuideSteps tutorialId="g" steps={steps} completion={(n) => <Text>{`All ${n} steps done`}</Text>} />)
  expect(await screen.findByText('0 of 2 steps done')).toBeTruthy()
  fireEvent.press(screen.getByLabelText('Mark step 1 done'))
  expect(screen.getByText('50%')).toBeTruthy()
  expect(screen.getByText('Pick up at step 2 — Slide the interrupter in')).toBeTruthy()
  fireEvent.press(screen.getByLabelText('Mark step 2 done'))
  expect(screen.getByText('All 2 steps done')).toBeTruthy()
  fireEvent.press(screen.getByRole('button', { name: 'Reset' }))
  expect(screen.getByText('Step progress cleared')).toBeTruthy()
  await waitFor(() => expect(screen.getByText('0 of 2 steps done')).toBeTruthy())
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/lib/guide-progress.test.ts tests/unit/components/guides/guide-steps.test.tsx`
Expected: FAIL — `Cannot find module '../../../lib/guide-progress'`.

- [ ] **Step 3: Implement**

`packages/mobile/lib/guide-progress.ts`:

```ts
// packages/mobile/lib/guide-progress.ts
//
// A parent's ticks on a guide — steps done, tools already owned — kept on the
// device, per guide, the way lib/learn.ts keeps Learn progress. Never a
// source of truth: unreadable storage starts empty, a failed write keeps the
// tick in memory for this visit.
import { useEffect, useRef, useState } from 'react'
import type { TutorialStep } from '@splat-connect/types'
import { resolveAuthStorage } from './supabase-storage'

// SecureStore keys allow [A-Za-z0-9._-]; a uuid fits.
export const ticksKey = (kind: 'steps' | 'tools', tutorialId: string) => `guide-${kind}.${tutorialId}`

/** What the device holds, kept only where it names something the guide still has. */
export function parseTicks(raw: string | null, validIds: readonly string[]): Set<string> {
  if (!raw) return new Set()
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    const valid = new Set(validIds)
    return new Set(parsed.filter((x): x is string => typeof x === 'string' && valid.has(x)))
  } catch {
    return new Set()
  }
}

type StepRef = Pick<TutorialStep, 'id' | 'position' | 'title'>

export function stepProgress(steps: readonly StepRef[], ticked: ReadonlySet<string>) {
  const total = steps.length
  const done = steps.filter((s) => ticked.has(s.id)).length
  return {
    done,
    total,
    pct: total ? Math.round((done / total) * 100) : 0,
    allDone: total > 0 && done === total,
    resume: done > 0 && done < total ? (steps.find((s) => !ticked.has(s.id)) ?? null) : null,
  }
}

// ponytail: ticks are keyed by step id, and 080's PUT gives every step a new id
// on each save, so a guide re-approved after an edit drops its readers' ticks.
// Key by position plus a body hash if parents ever lose progress that way.
export function useDeviceTicks(key: string, validIds: readonly string[]) {
  const storage = resolveAuthStorage()
  const [ticked, setTicked] = useState<Set<string>>(new Set())
  // A tap before the read lands wins: the read would otherwise undo it.
  const touched = useRef(false)
  const ids = validIds.join(',')

  useEffect(() => {
    let ignore = false
    touched.current = false
    storage
      .getItem(key)
      .then((raw) => {
        if (!ignore && !touched.current) setTicked(parseTicks(raw, validIds))
      })
      .catch((err) => console.error('[useDeviceTicks] could not read ticks, keeping them in memory:', err))
    return () => {
      ignore = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ids])

  function write(next: Set<string>) {
    touched.current = true
    setTicked(next)
    storage
      .setItem(key, JSON.stringify([...next]))
      .catch((err) => console.error('[useDeviceTicks] could not save ticks, keeping them in memory:', err))
  }

  return {
    ticked,
    toggle: (id: string) => {
      const next = new Set(ticked)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      write(next)
    },
    reset: () => write(new Set()),
  }
}
```

`packages/mobile/components/ui/Flash.tsx`:

```tsx
// packages/mobile/components/ui/Flash.tsx
//
// The board's toasts, as a line that says it and goes. The app has no toast
// host; a live-region line beside the control is enough for a confirmation.
import { useEffect, useRef, useState } from 'react'
import { Text, StyleSheet } from 'react-native'
import { theme } from '../../lib/theme'

export function useFlash(ms = 2500) {
  const [message, setMessage] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current)
  }, [])
  const flash = (next: string) => {
    if (timer.current) clearTimeout(timer.current)
    setMessage(next)
    timer.current = setTimeout(() => setMessage(null), ms)
  }
  return [message, flash] as const
}

export function FlashLine({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <Text accessibilityLiveRegion="polite" style={styles.flash}>
      {message}
    </Text>
  )
}

const styles = StyleSheet.create({
  flash: {
    alignSelf: 'center',
    marginVertical: theme.spacing(2),
    paddingHorizontal: theme.spacing(3),
    paddingVertical: theme.spacing(1),
    borderRadius: theme.radii.pill,
    backgroundColor: theme.colors.ink,
    color: theme.colors.surface,
    fontFamily: theme.fonts.bold,
    fontSize: theme.type.caption,
  },
})
```

`packages/mobile/components/guides/guide-steps.tsx`:

```tsx
// packages/mobile/components/guides/guide-steps.tsx
//
// The board's Steps block on a guide: tap a step to tick it, a percent and a
// bar, Reset, and "Pick up at step N". Ticks live on the device
// (lib/guide-progress.ts); nothing here is sent anywhere.
import type { ReactNode } from 'react'
import { View, Text, Image, Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { TutorialStep } from '@splat-connect/types'
import { stepProgress, ticksKey, useDeviceTicks } from '../../lib/guide-progress'
import { theme } from '../../lib/theme'
import { Section } from '../ui/Section'
import { Meter } from '../ui/Meter'
import { Button } from '../ui/Button'
import { FlashLine, useFlash } from '../ui/Flash'

export function GuideSteps({
  tutorialId,
  steps,
  completion,
}: {
  tutorialId: string
  steps: TutorialStep[]
  /** Drawn once every step is ticked; given how many there are. */
  completion: (total: number) => ReactNode
}) {
  const { ticked, toggle, reset } = useDeviceTicks(ticksKey('steps', tutorialId), steps.map((s) => s.id))
  const progress = stepProgress(steps, ticked)
  const [flash, setFlash] = useFlash()

  return (
    <Section title="Steps" hint="One action at a time. The PDF has the same guide to print.">
      <View style={styles.head}>
        <Text style={styles.pct}>{`${progress.pct}%`}</Text>
        <View style={styles.headText}>
          <Text style={styles.done}>{`${progress.done} of ${progress.total} steps done`}</Text>
          <View accessibilityRole="progressbar" accessibilityLabel="Build progress" accessibilityValue={{ min: 0, max: 100, now: progress.pct }}>
            <Meter value={progress.pct} max={100} width={150} />
          </View>
        </View>
        <Button
          label="Reset"
          variant="ghost"
          onPress={() => {
            reset()
            setFlash('Step progress cleared')
          }}
        />
      </View>
      <FlashLine message={flash} />
      {progress.resume ? (
        <Text style={styles.resume}>
          {`Pick up at step ${progress.resume.position}${progress.resume.title ? ` — ${progress.resume.title}` : ''}`}
        </Text>
      ) : null}

      {steps.map((st) => {
        const done = ticked.has(st.id)
        return (
          <Pressable
            key={st.id}
            testID={`guide-step-${st.position}`}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: done }}
            accessibilityLabel={done ? `Mark step ${st.position} as not done` : `Mark step ${st.position} done`}
            onPress={() => toggle(st.id)}
            style={[styles.step, done && styles.stepDone]}
          >
            <View style={[styles.stepNum, done && styles.stepNumDone]}>
              {done ? (
                <Ionicons name="checkmark" size={16} color={theme.colors.surface} />
              ) : (
                <Text style={styles.stepNumText}>{st.position}</Text>
              )}
            </View>
            <View style={styles.stepText}>
              {st.title ? <Text style={[styles.stepTitle, done && styles.muted]}>{st.title}</Text> : null}
              <Text style={styles.stepBody}>{st.body}</Text>
              {st.photo_url ? (
                <Image
                  source={{ uri: st.photo_url }}
                  style={styles.stepPhoto}
                  accessibilityLabel={st.title ? `Step ${st.position}: ${st.title}` : `Step ${st.position}`}
                />
              ) : null}
            </View>
          </Pressable>
        )
      })}

      {progress.allDone ? completion(progress.total) : null}
    </Section>
  )
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), marginBottom: theme.spacing(2) },
  pct: { fontFamily: theme.fonts.display, fontSize: 24, color: theme.colors.ink },
  headText: { flex: 1, gap: theme.spacing(1) },
  done: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.ink },
  resume: { fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.ink, marginBottom: theme.spacing(2) },
  step: { flexDirection: 'row', gap: theme.spacing(3), paddingVertical: theme.spacing(2) },
  stepDone: { opacity: 0.7 },
  stepNum: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.accentLight },
  stepNumDone: { backgroundColor: theme.colors.success },
  stepNumText: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.ink },
  stepText: { flex: 1, gap: theme.spacing(1) },
  stepTitle: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.ink },
  muted: { color: theme.colors.muted },
  stepBody: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.text, lineHeight: 21 },
  stepPhoto: { width: '100%', aspectRatio: 4 / 3, borderRadius: theme.radii.field, marginTop: theme.spacing(1), backgroundColor: theme.colors.surfaceSunken },
})
```

`detail-screen.tsx`: replace the whole `{steps.length > 0 ? (<Section title="Steps" …>…</Section>) : null}` block with

```tsx
      {steps.length > 0 ? (
        <GuideSteps
          tutorialId={tutorial.id}
          steps={steps}
          completion={(total) => (
            <View style={styles.doneCard}>
              <Text style={styles.doneTitle}>{`All ${total} steps done`}</Text>
              <Text style={styles.doneBody}>Log it and this build shows up in My SPLAT.</Text>
              <PendingButton pending="guide-build-done" label="Mark this build done" />
              {thanks && !thanks.own && !thanks.thanked ? (
                <Button
                  label={`Say thanks to ${primary?.profiles.name ?? 'the author'}`}
                  variant="secondary"
                  loading={thanking}
                  onPress={() => void sayThanks()}
                />
              ) : null}
            </View>
          )}
        />
      ) : null}
      {steps.length > 0 ? <PendingButton pending="guide-community-notes" label="Add a note" variant="ghost" /> : null}
```

Move the `primary` constant above the `return` if it is declared below the steps block (it already is above). Import `GuideSteps` from `../guides/guide-steps`. Delete the now-unused `step*` styles and add:

```ts
  doneCard: { marginTop: theme.spacing(3), padding: theme.spacing(4), gap: theme.spacing(2), borderRadius: theme.radii.panel, backgroundColor: theme.colors.mintSoft, alignItems: 'center' },
  doneTitle: { fontFamily: theme.fonts.display, fontSize: 20, color: theme.colors.ink },
  doneBody: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.ink, textAlign: 'center' },
```

Detail-screen tests mock no storage: add to `detail-screen.test.tsx`

```tsx
jest.mock('../../../../lib/supabase-storage', () => ({
  resolveAuthStorage: () => ({ getItem: jest.fn().mockResolvedValue(null), setItem: jest.fn().mockResolvedValue(undefined), removeItem: jest.fn() }),
}))
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/lib/guide-progress.test.ts tests/unit/components/guides/guide-steps.test.tsx tests/unit/components/home/detail-screen.test.tsx`
Expected: PASS (the existing `guide-step-<n>` testIDs are kept).

- [ ] **Step 5: Ship the item** — `shipped: true` on `'guide-step-tracking'`; `node scripts/pending.mjs`; no parity rule names it; drift test → `Tests  11 passed (11)`.

- [ ] **Step 6: Commit**

```bash
git add packages/mobile/lib/guide-progress.ts packages/mobile/components/ui/Flash.tsx packages/mobile/components/guides/guide-steps.tsx packages/mobile/components/home/detail-screen.tsx packages/mobile/tests/unit packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(mobile): tick a guide's steps off as you build, kept on the device

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 10: Tools checklist (`guide-tools-checklist`)

**Files:**
- Create: `packages/mobile/components/guides/guide-tools.tsx`, `packages/mobile/tests/unit/components/guides/guide-tools.test.tsx`
- Modify: `packages/mobile/components/home/detail-screen.tsx` (Tools section → `GuideTools`)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`

**Interfaces:**
- Consumes: `ticksKey`, `useDeviceTicks` (Task 9).
- Produces: `GuideTools({ tutorialId, tools })`. Task 12 adds the note and tag inside each row.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen, fireEvent } from '@testing-library/react-native'
import { GuideTools } from '../../../../components/guides/guide-tools'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))
const mockSetItem = jest.fn().mockResolvedValue(undefined)
jest.mock('../../../../lib/supabase-storage', () => ({
  resolveAuthStorage: () => ({ getItem: jest.fn().mockResolvedValue(null), setItem: (...a: unknown[]) => mockSetItem(...a), removeItem: jest.fn() }),
}))

const tools = [
  { id: 't1', tutorial_id: 'g', name: 'Small Phillips screwdriver (#1)', is_optional: false, buy_links: [] },
  { id: 't2', tutorial_id: 'g', name: 'Hot glue gun', is_optional: false, buy_links: [] },
]

it('ticks the tools you already have and links to Learn', async () => {
  render(<GuideTools tutorialId="g" tools={tools} />)
  expect(await screen.findByText('0 of 2 already yours')).toBeTruthy()
  expect(screen.getByText('Not counted in the total above — tools are a one-off.')).toBeTruthy()
  fireEvent.press(screen.getByLabelText('I already have Hot glue gun'))
  expect(screen.getByText('1 of 2 already yours')).toBeTruthy()
  expect(mockSetItem).toHaveBeenLastCalledWith('guide-tools.g', '["t2"]')
  fireEvent.press(screen.getByRole('button', { name: /Tools and materials on Learn/ }))
  expect(mockPush).toHaveBeenCalledWith('/explore/learn/tools-and-materials')
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/guides/guide-tools.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`guide-tools.tsx`:

```tsx
// packages/mobile/components/guides/guide-tools.tsx
//
// The board's "Tools you'll need": tick the ones you already own (kept on the
// device, per guide), and a way into Tools and materials on Learn.
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { Tool } from '@splat-connect/types'
import { ticksKey, useDeviceTicks } from '../../lib/guide-progress'
import { theme } from '../../lib/theme'
import { Section } from '../ui/Section'

export function GuideTools({ tutorialId, tools }: { tutorialId: string; tools: Tool[] }) {
  const router = useRouter()
  const { ticked, toggle } = useDeviceTicks(ticksKey('tools', tutorialId), tools.map((t) => t.id))
  const have = tools.filter((t) => ticked.has(t.id)).length

  return (
    <Section title="Tools you'll need">
      {tools.length ? <Text style={styles.count}>{`${have} of ${tools.length} already yours`}</Text> : null}
      <Text style={styles.hint}>Not counted in the total above — tools are a one-off.</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tools and materials on Learn"
        onPress={() => router.push('/explore/learn/tools-and-materials')}
        style={styles.learn}
      >
        <Ionicons name="construct-outline" size={22} color={theme.colors.ink} />
        <Text style={styles.learnText}>
          You may already own most of these — if you&apos;re a seasoned switch adapter, this list is a formality.{' '}
          <Text style={styles.learnLink}>Tools and materials on Learn →</Text>
        </Text>
      </Pressable>
      {tools.length ? (
        tools.map((t) => {
          const owned = ticked.has(t.id)
          return (
            <View key={t.id} style={styles.row}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: owned }}
                accessibilityLabel={owned ? `I do not have ${t.name}` : `I already have ${t.name}`}
                onPress={() => toggle(t.id)}
                hitSlop={8}
                style={[styles.tick, owned && styles.tickOn]}
              >
                <Ionicons name={owned ? 'checkmark' : 'ellipse-outline'} size={16} color={owned ? theme.colors.surface : theme.colors.muted} />
              </Pressable>
              <View style={styles.rowText}>
                <Text style={[styles.name, owned && styles.owned]}>{`${t.name}${t.is_optional ? ' (optional)' : ''}`}</Text>
              </View>
            </View>
          )
        })
      ) : (
        <Text style={styles.name}>No tools listed.</Text>
      )}
    </Section>
  )
}

const styles = StyleSheet.create({
  count: { alignSelf: 'flex-start', fontFamily: theme.fonts.bold, fontSize: 12, color: theme.colors.muted, backgroundColor: theme.colors.surfaceSunken, borderRadius: theme.radii.pill, paddingHorizontal: theme.spacing(2), paddingVertical: 2 },
  hint: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted, marginVertical: theme.spacing(2) },
  learn: { flexDirection: 'row', gap: theme.spacing(3), padding: theme.spacing(3), borderRadius: theme.radii.field, backgroundColor: theme.colors.accentLight, marginBottom: theme.spacing(3) },
  learnText: { flex: 1, fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.ink, lineHeight: 19 },
  learnLink: { fontFamily: theme.fonts.black },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), paddingVertical: theme.spacing(2) },
  tick: { width: 28, height: 28, borderRadius: 14, borderWidth: theme.border.hairline, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  tickOn: { backgroundColor: theme.colors.success, borderColor: theme.colors.success },
  rowText: { flex: 1, gap: 2 },
  name: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.text },
  owned: { textDecorationLine: 'line-through', color: theme.colors.muted },
})
```

`detail-screen.tsx`: replace both tools PENDING comments' first line (`PENDING(guide-tools-checklist)`) and the whole `<Section title="Tools you'll need" …>…</Section>` with `<GuideTools tutorialId={tutorial.id} tools={tutorial.tools} />`; keep the `PENDING(tool-notes)` comment above it (Task 12 ships it). Import `GuideTools`.

- [ ] **Step 4: Run the tests to see them pass**

Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/guides/guide-tools.test.tsx tests/unit/components/home/detail-screen.test.tsx`
Expected: PASS (`'Screwdriver'` still renders as the row's name).

- [ ] **Step 5: Ship the item** — `shipped: true` on `'guide-tools-checklist'`; `node scripts/pending.mjs`; no parity rule; drift test → `Tests  11 passed (11)`.

- [ ] **Step 6: Commit**

```bash
git add packages/mobile/components/guides/guide-tools.tsx packages/mobile/components/home/detail-screen.tsx packages/mobile/tests/unit/components packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(mobile): tick off the tools you already have on a guide

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 11: Section checklist on Review a guide (`review-checklist`)

The board's six rows: Summary, Steps, Parts, Tools, Safety notes, Files, each OK or Flag, under "{n} sections, {k} complete." Parts gains "with prices" in Task 13 and Safety notes its count in Task 17.

**Files:**
- Create: `packages/mobile/lib/review-checklist.ts`, `packages/mobile/tests/unit/lib/review-checklist.test.ts`
- Modify: `packages/mobile/components/organisation/review-detail-screen.tsx` (the Check block)
- Modify: `scripts/parity/app-screen-map.json` (`org_review`: delete the rule naming `review-checklist` and the emptied `explained` key)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/mobile/tests/unit/components/organisation/review-detail-screen.test.tsx`

**Interfaces:**
- Produces: `type ReviewRow = { title: string; meta: string; ok: boolean }`; `reviewRows(t: TutorialWithDetails): ReviewRow[]`; `reviewLead(rows: ReviewRow[]): string`.

- [ ] **Step 1: Write the failing tests**

`review-checklist.test.ts`:

```ts
import { reviewLead, reviewRows } from '../../../lib/review-checklist'

const base = {
  description: 'An off-the-shelf bubble machine.',
  kind: 'toy_adaptation',
  tutorial_pdf_url: 't/tutorial.pdf',
  safety_declared_at: '2026-09-01T00:00:00Z',
  parts: [{ is_optional: false }, { is_optional: false }, { is_optional: false }],
  tools: [{ is_optional: true }],
  stl_files: [],
  steps: [{ photo_url: 'a' }, { photo_url: 'b' }],
}

it('reads each section the board lists', () => {
  expect(reviewRows(base as never)).toEqual([
    { title: 'Summary', meta: 'Complete', ok: true },
    { title: 'Steps', meta: '2 steps, all photographed', ok: true },
    { title: 'Parts', meta: '3 parts', ok: true },
    { title: 'Tools', meta: '1 optional tool', ok: true },
    { title: 'Safety notes', meta: 'Checklist affirmed', ok: true },
    { title: 'Files', meta: 'PDF · none needed to print', ok: true },
  ])
})

it('flags what is missing and counts it in the lead', () => {
  const rows = reviewRows({ ...base, description: null, steps: [{ photo_url: null }], kind: 'assistive_tech' } as never)
  expect(rows.find((r) => r.title === 'Summary')).toEqual({ title: 'Summary', meta: 'No summary yet', ok: false })
  expect(rows.find((r) => r.title === 'Steps')).toEqual({ title: 'Steps', meta: '1 step, 1 without a photo', ok: false })
  expect(rows.find((r) => r.title === 'Files')).toEqual({ title: 'Files', meta: 'PDF · no STL yet', ok: false })
  expect(reviewLead(rows)).toBe('6 sections, 3 complete.')
})
```

In `review-detail-screen.test.tsx`, replace `expect(screen.getByText('2 parts · 1 tool')).toBeTruthy()` with:

```tsx
    expect(screen.getByText('6 sections, 4 complete.')).toBeTruthy()
    expect(screen.getByText('2 parts')).toBeTruthy()
```

(the fixture has a description, a PDF, two parts, one tool, no steps and no safety declaration.)

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/lib/review-checklist.test.ts tests/unit/components/organisation/review-detail-screen.test.tsx`
Expected: FAIL — module not found; lead text not found.

- [ ] **Step 3: Implement**

`packages/mobile/lib/review-checklist.ts`:

```ts
// packages/mobile/lib/review-checklist.ts
//
// The board's org_review rows: one per section of the guide, what it holds,
// OK or Flag. A suggestion for the reviewer's eye, not a gate — the API's
// submit rules are the gate.
import type { TutorialWithDetails } from '@splat-connect/types'

export type ReviewRow = { title: string; meta: string; ok: boolean }

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`

export function reviewRows(t: TutorialWithDetails): ReviewRow[] {
  const steps = t.steps ?? []
  const bare = steps.filter((s) => !s.photo_url).length
  const optionalTools = t.tools.filter((x) => x.is_optional).length
  const pdf = Boolean(t.tutorial_pdf_url)
  const needsStl = t.kind === 'assistive_tech'
  const stl = t.stl_files.length
  return [
    { title: 'Summary', meta: t.description?.trim() ? 'Complete' : 'No summary yet', ok: Boolean(t.description?.trim()) },
    {
      title: 'Steps',
      meta: !steps.length ? 'No steps yet' : bare ? `${count(steps.length, 'step')}, ${bare} without a photo` : `${count(steps.length, 'step')}, all photographed`,
      ok: steps.length > 0 && bare === 0,
    },
    { title: 'Parts', meta: t.parts.length ? count(t.parts.length, 'part') : 'No parts listed', ok: t.parts.length > 0 },
    {
      title: 'Tools',
      meta: !t.tools.length ? 'No tools listed' : optionalTools === t.tools.length ? count(t.tools.length, 'optional tool') : count(t.tools.length, 'tool'),
      ok: t.tools.length > 0,
    },
    { title: 'Safety notes', meta: t.safety_declared_at ? 'Checklist affirmed' : 'Checklist not affirmed', ok: Boolean(t.safety_declared_at) },
    {
      title: 'Files',
      meta: [pdf ? 'PDF' : 'No PDF yet', stl ? count(stl, 'STL file') : needsStl ? 'no STL yet' : 'none needed to print'].join(' · '),
      ok: pdf && (!needsStl || stl > 0),
    },
  ]
}

export const reviewLead = (rows: ReviewRow[]) => `${rows.length} sections, ${rows.filter((r) => r.ok).length} complete.`
```

`review-detail-screen.tsx`: import `reviewLead, reviewRows`; replace everything inside `<View style={styles.checks}>` after `<ListSection>Check</ListSection>` (the PENDING comment, the PDF row, Parts and tools, 3D print files) with:

```tsx
          <Text style={styles.lead}>{reviewLead(rows)}</Text>
          {rows.map((r) =>
            r.title === 'Files' && tutorial.tutorial_pdf_url ? (
              <CheckRow key={r.title} title={r.title} meta={r.meta} ok={r.ok} label="Open the tutorial PDF" onPress={() => void openPdf()} />
            ) : (
              <CheckRow key={r.title} title={r.title} meta={r.meta} ok={r.ok} />
            )
          )}
```

with `const rows = reviewRows(tutorial)` beside `author`, deleting the now-unused `partCount`/`toolCount`, and a style `lead: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption, color: theme.colors.muted, marginBottom: theme.spacing(2) }`.

- [ ] **Step 4: Run the tests to see them pass**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Ship the item** — `shipped: true` on `'review-checklist'`; `node scripts/pending.mjs`; delete the `org_review` rule (and its `explained` key) in `scripts/parity/app-screen-map.json`; drift test → `Tests  11 passed (11)`.

- [ ] **Step 6: Commit**

```bash
git add packages/mobile/lib/review-checklist.ts packages/mobile/components/organisation/review-detail-screen.tsx packages/mobile/tests/unit scripts/parity/app-screen-map.json packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(mobile): Review a guide checks each section, OK or Flag, with a count

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 12: Tool notes — why, and buy / borrow / substitute (`tool-notes`, migration 085)

**Files:**
- Create: `supabase/migrations/085_tool_notes.sql`
- Create: `packages/types/src/guides.ts`; Modify: `packages/types/src/index.ts` (re-exports, `Tool`)
- Modify: `packages/api/src/routes/sub-resource.ts` (optional `validate`, list check, 23514 → 400)
- Modify: `packages/api/src/routes/tools.ts`
- Modify: `packages/web/components/edit-items-section.tsx` (`withNotes`, `toInput` carries `note`/`get_by`), `packages/web/app/tutorials/[id]/edit/page.tsx` (tools panel, `saveTools` type), `packages/web/components/tutorial-view.tsx` (tool row)
- Modify: `packages/mobile/lib/use-tutorial-draft.tsx` (`ItemRow`, `postItems`), `packages/mobile/components/my-tutorials/sections/items-section.tsx`, `packages/mobile/components/guides/guide-tools.tsx`, `packages/mobile/components/home/detail-screen.tsx` (PENDING line)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/api/tests/integration/guides/tool-notes.test.ts` (new), `packages/web/tests/unit/components/edit-items-section-tools.test.tsx`, `packages/web/tests/unit/components/tutorial-view.test.tsx`, `packages/mobile/tests/unit/components/my-tutorials/items-section.test.tsx`, `packages/mobile/tests/unit/components/guides/guide-tools.test.tsx`

**Interfaces:**
- Produces: `TOOL_GET_BY_LABEL: { buy: 'Buy once'; borrow: 'Borrow'; substitute: 'Substitute' }`, `type ToolGetBy = 'buy' | 'borrow' | 'substitute'` (from `@splat-connect/types`); `Tool.note?: string | null`, `Tool.get_by?: ToolGetBy | null`; `subResourceRoutes({ …, validate?: (items: Item[]) => string | null })`; web `EditItemsSection` prop `withNotes?: boolean`, `ItemInput.note?`, `ItemInput.get_by?`; mobile `ItemRow.note?`, `ItemRow.get_by?`.

- [ ] **Step 1: Write the failing tests**

`packages/api/tests/integration/guides/tool-notes.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createProject } from '../../helpers/orgs.js'

let author: TestUser
let guide: string
const post = (tools: unknown) =>
  app.request(`/api/tutorials/${guide}/tools`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${author.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ tools }),
  })

beforeAll(async () => {
  author = await createTestUser('contributor')
  guide = await createProject({ authorId: author.id, status: 'draft', title: 'Tool Notes Fixture' })
})
afterAll(async () => {
  await adminClient().from('tutorials').delete().eq('id', guide)
  await deleteTestUser(author.id)
})

describe('085 tool notes', () => {
  it('has both columns', async () => {
    const { error } = await adminClient().from('tools').select('note, get_by').limit(1)
    expect(error).toBeNull()
  })

  it('saves a note and how to get the tool', async () => {
    const res = await post([{ name: 'Soldering iron', is_optional: false, buy_links: [], note: 'Borrow from a library or makerspace', get_by: 'borrow' }])
    expect(res.status).toBe(201)
    const { data } = await adminClient().from('tools').select('note, get_by').eq('tutorial_id', guide)
    expect(data).toEqual([{ note: 'Borrow from a library or makerspace', get_by: 'borrow' }])
  })

  it('refuses a long note or an unknown way to get it, and leaves the list alone', async () => {
    const long = await post([{ name: 'Iron', is_optional: false, buy_links: [], note: 'x'.repeat(201) }])
    expect(long.status).toBe(400)
    expect(((await long.json()) as { error: string }).error).toBe("Tool 1's note is over 200 characters")
    expect((await post([{ name: 'Iron', is_optional: false, buy_links: [], get_by: 'steal' }])).status).toBe(400)
    const { count } = await adminClient().from('tools').select('id', { count: 'exact', head: true }).eq('tutorial_id', guide)
    expect(count).toBe(1)
  })
})
```

`edit-items-section-tools.test.tsx` (append inside the describe):

```tsx
  // Review Focus 1: the list is replaced on every save, so a field this editor
  // does not show would be erased by an edit it does.
  it('keeps a tool’s note and get-by through an edit of its name', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <EditItemsSection
        noun="tool"
        withNotes
        initialItems={[{ ...mockTools[0], note: 'Borrow from a library', get_by: 'borrow' }]}
        onSave={onSave}
      />
    )
    fireEvent.click(screen.getByText('Edit'))
    fireEvent.change(screen.getByDisplayValue('Soldering Iron'), { target: { value: 'Soldering iron, 40 W' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith([
        { name: 'Soldering iron, 40 W', is_optional: false, buy_links: [], note: 'Borrow from a library', get_by: 'borrow' },
      ])
    )
  })
```

`tutorial-view.test.tsx` (append; uses the file's `tutorial()` builder):

```tsx
  it('shows each tool’s note and how to get it', () => {
    render(
      <TutorialView
        signedIn
        tutorial={tutorial({ tools: [{ id: 'x', tutorial_id: 't1', name: 'Hot glue gun', is_optional: false, buy_links: [], note: 'Anchoring the jack', get_by: 'borrow' }] })}
      />
    )
    expect(screen.getByText('Anchoring the jack')).toBeInTheDocument()
    expect(screen.getByText('Borrow')).toBeInTheDocument()
  })
```

`items-section.test.tsx`:

```tsx
it('keeps a tool’s note through a rename and sets how to get it', () => {
  mockDraft.tutorial = { ...mockDraft.tutorial, tools: [{ id: 't', name: 'Iron', is_optional: false, buy_links: [], note: 'Borrow one', get_by: null }] }
  render(<ItemsSection noun="tools" />)
  fireEvent.changeText(screen.getByLabelText('Tool 1 name'), 'Soldering iron')
  expect(mockDraft.replaceItems).toHaveBeenLastCalledWith('tools', [expect.objectContaining({ name: 'Soldering iron', note: 'Borrow one' })])
  fireEvent.press(screen.getByText('Borrow'))
  expect(mockDraft.replaceItems).toHaveBeenLastCalledWith('tools', [expect.objectContaining({ get_by: 'borrow' })])
})
```

`guide-tools.test.tsx`:

```tsx
it('says why each tool and how to get it', async () => {
  render(<GuideTools tutorialId="g" tools={[{ ...tools[1], note: 'Anchoring the jack', get_by: 'borrow' }]} />)
  expect(await screen.findByText('Anchoring the jack')).toBeTruthy()
  expect(screen.getByText('Borrow')).toBeTruthy()
})
```

- [ ] **Step 2: Run them to see them fail**

Run (before the migration exists): `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/guides/tool-notes.test.ts`
Expected: FAIL — `column tools.note does not exist`.
Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/components/edit-items-section-tools.test.tsx tests/unit/components/tutorial-view.test.tsx` → FAIL (note dropped; text absent).
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/my-tutorials/items-section.test.tsx tests/unit/components/guides/guide-tools.test.tsx` → FAIL.

- [ ] **Step 3: Implement**

`supabase/migrations/085_tool_notes.sql`:

```sql
-- 085 — why each tool is on the list, and how to get one (tool-notes,
-- decided 2026-09-30: a note, and buy once / borrow / substitute; no tool cost).
--
-- Both on tools, not tutorials: the list is replaced whole on every save
-- (sub-resource.ts), so neither is under PATCH's updated_at check.
--
-- DOWN:
--   alter table public.tools drop column if exists get_by, drop column if exists note;

alter table public.tools
  add column note text check (note is null or length(note) <= 200),
  add column get_by text check (get_by in ('buy', 'borrow', 'substitute'));
```

Apply: `supabase migration up`.

`packages/types/src/guides.ts`:

```ts
/**
 * The pure rules behind a guide's detail and editors, shared by web, mobile
 * and the API (docs/superpowers/specs/2026-10-01-guides-build-design.md).
 */

/** How a family gets a tool (085), in the board's words. */
export const TOOL_GET_BY_LABEL = { buy: 'Buy once', borrow: 'Borrow', substitute: 'Substitute' } as const
export type ToolGetBy = keyof typeof TOOL_GET_BY_LABEL
```

`packages/types/src/index.ts`, beside the other named re-exports at the top:

```ts
export { TOOL_GET_BY_LABEL } from './guides'
export type { ToolGetBy } from './guides'
import type { ToolGetBy } from './guides'
```

and in `interface Tool`:

```ts
  /** 085. Why it is on the list, and how to get one. Optional so fixtures
   *  that predate them need not name them. */
  note?: string | null
  get_by?: ToolGetBy | null
```

`sub-resource.ts` — new option and the POST handler:

```ts
  /** Checked before the old list is deleted, so a refused list changes nothing.
   *  Returns the 400's sentence, or null. */
  validate?: (items: Item[]) => string | null
```

```ts
  router.post(`/:id/${opts.path}`, async (c) => {
    const body = await c.req.json<Record<string, Item[]>>()
    const items = body[opts.bodyKey]
    if (!Array.isArray(items)) return c.json({ error: `${opts.bodyKey} must be a list` }, 400)
    const invalid = opts.validate?.(items)
    if (invalid) return c.json({ error: invalid }, 400)
    const supabase = createUserClient(c.get('token'))
    const tutorialId = c.req.param('id')

    await supabase.from(opts.table).delete().eq('tutorial_id', tutorialId)

    const rows = items.map((item, i) => opts.mapRow(item, tutorialId, i))

    const { data, error } = await supabase.from(opts.table).insert(rows).select()
    // 23514: a CHECK refused a value the validator let through — the caller's, not ours.
    if (error) return c.json({ error: error.message }, error.code === '23514' ? 400 : 500)
    return c.json(data, 201)
  })
```

`tools.ts`:

```ts
import { subResourceRoutes } from './sub-resource.js'

type ToolInput = { name: string; is_optional: boolean; buy_links: unknown[]; note?: string | null; get_by?: string | null }

const GET_BY = new Set(['buy', 'borrow', 'substitute'])

export function toolsError(tools: ToolInput[]): string | null {
  for (const [i, t] of tools.entries()) {
    const n = i + 1
    if (t.note != null && (typeof t.note !== 'string' || t.note.trim().length > 200)) return `Tool ${n}'s note is over 200 characters`
    if (t.get_by != null && !GET_BY.has(t.get_by)) return `Tool ${n}: choose buy once, borrow or substitute`
  }
  return null
}

export default subResourceRoutes<ToolInput>({
  path: 'tools',
  table: 'tools',
  bodyKey: 'tools',
  validate: toolsError,
  mapRow: (t, tutorialId) => ({
    tutorial_id: tutorialId,
    name: t.name,
    is_optional: t.is_optional,
    buy_links: t.buy_links,
    note: t.note?.trim() || null,
    get_by: t.get_by ?? null,
  }),
})
```

Web `edit-items-section.tsx`:
- Types: add `note?: string | null` and `get_by?: ToolGetBy | null` to both `EditableItem` and `ItemInput` (import `type ToolGetBy, TOOL_GET_BY_LABEL` from `@splat-connect/types`); add `withNotes?: boolean` to the props and destructure it.
- `toInput`:

```ts
  function toInput(item: EditableItem | ItemInput): ItemInput {
    return {
      name: item.name,
      is_optional: item.is_optional,
      buy_links: item.buy_links,
      ...(withQuantity ? { quantity: item.quantity ?? 1 } : {}),
      // Carried through, never rebuilt: the list is replaced whole on save.
      ...(withNotes ? { note: item.note ?? null, get_by: item.get_by ?? null } : {}),
    }
  }
```

- `readAddForm`: add `...(withNotes ? { note: ((data.get('note') as string) ?? '').trim() || null, get_by: ((data.get('get_by') as ToolGetBy) || null) } : {}),`
- In the open-row editor after the Optional checkbox and in the add form after its Optional checkbox, render when `withNotes`:

```tsx
                  {withNotes && (
                    <>
                      <input
                        value={draft.note ?? ''}
                        onChange={(e) => setDraft((d) => (d ? { ...d, note: e.target.value } : d))}
                        maxLength={200}
                        className={inputCls}
                        placeholder="Why it is needed, e.g. Borrow from a library or makerspace"
                        aria-label="Note"
                      />
                      <select
                        value={draft.get_by ?? ''}
                        onChange={(e) => setDraft((d) => (d ? { ...d, get_by: (e.target.value as ToolGetBy) || null } : d))}
                        className={inputCls}
                        aria-label="How to get it"
                      >
                        <option value="">How to get it</option>
                        {(Object.keys(TOOL_GET_BY_LABEL) as ToolGetBy[]).map((k) => (
                          <option key={k} value={k}>{TOOL_GET_BY_LABEL[k]}</option>
                        ))}
                      </select>
                    </>
                  )}
```

  (the add form's copy uses `name="note"` / `name="get_by"` with `defaultValue` instead of `value`/`onChange`).

Web edit page: `<EditItemsSection noun="tool" withNotes initialItems={tools} onSave={saveTools} />` and `async function saveTools(newTools: ItemInput[])`.

Web `tutorial-view.tsx`, inside the tool row's text column after the name span:

```tsx
                  {(t.note || t.get_by) && (
                    <span className="flex flex-wrap items-center gap-2 text-sm text-muted">
                      {t.note && <span>{t.note}</span>}
                      {t.get_by && <span className="pill-tag">{TOOL_GET_BY_LABEL[t.get_by]}</span>}
                    </span>
                  )}
```

(import `TOOL_GET_BY_LABEL`).

Mobile `use-tutorial-draft.tsx`: `ItemRow` gains `note?: string | null; get_by?: ToolGetBy | null`; the tools mapping in `postItems` becomes

```ts
        tools: clean.map(({ name, is_optional, buy_links, note, get_by }) => ({ name, is_optional, buy_links, note: note ?? null, get_by: get_by ?? null })),
```

Mobile `items-section.tsx`:
- Seed: add `note: r.note ?? null, get_by: r.get_by ?? null,` to the row mapping; new rows get `note: null, get_by: null`.
- `LEAD.tools` → `'What they need on the bench, and what can be borrowed.'`; delete the `PENDING(tool-notes)` line and fix the comment above `LEAD` to name only part-prices.
- Under each tool card's controls:

```tsx
            {noun === 'tools' ? (
              <>
                <TextField
                  accessibilityLabel={`Tool ${i + 1} note`}
                  placeholder="Borrow from a library or makerspace"
                  maxLength={200}
                  value={row.note ?? ''}
                  onChangeText={(text) => update(i, { note: text || null })}
                />
                <View style={styles.controls}>
                  {(Object.keys(TOOL_GET_BY_LABEL) as ToolGetBy[]).map((k) => (
                    <Chip key={k} label={TOOL_GET_BY_LABEL[k]} active={row.get_by === k} onPress={() => update(i, { get_by: row.get_by === k ? null : k })} />
                  ))}
                </View>
              </>
            ) : null}
```

  (import `Chip` from `../../ui/Chip`, `TOOL_GET_BY_LABEL` and `type ToolGetBy` from `@splat-connect/types`).

Mobile `guide-tools.tsx`, inside `rowText` after the name:

```tsx
                {t.note ? <Text style={styles.why}>{t.note}</Text> : null}
              </View>
              {t.get_by ? <Text style={styles.tag}>{TOOL_GET_BY_LABEL[t.get_by]}</Text> : null}
```

(moving the closing `</View>` accordingly) with styles `why: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted }, tag: { fontFamily: theme.fonts.bold, fontSize: 12, color: theme.colors.ink, backgroundColor: theme.colors.surfaceSunken, borderRadius: theme.radii.pill, paddingHorizontal: theme.spacing(2), paddingVertical: 2, overflow: 'hidden' },`.

`detail-screen.tsx`: delete the `PENDING(tool-notes)` comment.

Grep for other tools consumers: `grep -rn "tools" packages/mobile/lib packages/mobile/components | grep -v test` — nothing else rebuilds tool rows.

- [ ] **Step 4: Run the tests to see them pass**

Run the three commands from Step 2. Expected: PASS. Then `pnpm --filter @splat-connect/api exec vitest run tests/unit/routes/tools.test.ts` (the unit mock still passes — no validator error for valid bodies).

- [ ] **Step 5: Ship the item** — `shipped: true` on `'tool-notes'`; `node scripts/pending.mjs`; no parity rule; drift test → `Tests  11 passed (11)`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/085_tool_notes.sql packages/types/src packages/api/src/routes/sub-resource.ts packages/api/src/routes/tools.ts packages/api/tests/integration/guides/tool-notes.test.ts packages/web/components/edit-items-section.tsx "packages/web/app/tutorials/[id]/edit/page.tsx" packages/web/components/tutorial-view.tsx packages/web/tests/unit/components packages/mobile/lib/use-tutorial-draft.tsx packages/mobile/components packages/mobile/tests/unit docs/PENDING.md
git commit -m "feat(guides): a note per tool and buy once / borrow / substitute (085)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 13: Part prices and the total (`part-prices`, migration 086)

`price_cents` is the cost of the line at its quantity. The total shows only when every non-optional part has a price, and is the sum of those parts — one rule, `partsTotalCents`, read by web, mobile and the hub.

**Files:**
- Create: `supabase/migrations/086_part_prices.sql`
- Modify: `packages/types/src/guides.ts` (`partsTotalCents`, `checkedOn`), `packages/types/src/index.ts` (re-exports, `Part.price_cents`, `Tutorial.prices_checked_on`)
- Modify: `packages/api/src/routes/parts.ts`, `packages/api/src/routes/tutorials.ts` (`EDITABLE`, `fieldError`, PENDING comment)
- Create: `packages/web/components/prices-checked-field.tsx`
- Modify: `packages/web/components/edit-items-section.tsx` (price input, `toInput`), `packages/web/app/tutorials/[id]/edit/page.tsx` (parts panel, `savePricesChecked`), `packages/web/components/tutorial-view.tsx` (Approx. column, total, checked line, rail stat)
- Modify: `packages/mobile/lib/use-tutorial-draft.tsx`, `packages/mobile/components/my-tutorials/sections/items-section.tsx`, `packages/mobile/components/home/detail-screen.tsx` (Parts section), `packages/mobile/lib/tutorial-sections.ts` (parts summary), `packages/mobile/lib/review-checklist.ts` (Parts row)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/web/tests/unit/lib/guides.test.ts` (new), `packages/api/tests/integration/guides/part-prices.test.ts` (new), `packages/web/tests/unit/components/edit-items-section-parts.test.tsx`, `packages/web/tests/e2e/public/tutorial-detail.spec.ts`, mobile `items-section.test.tsx`, `detail-screen.test.tsx`, `review-checklist.test.ts`

**Interfaces:**
- Produces: `partsTotalCents(parts: readonly { is_optional: boolean; price_cents?: number | null }[]): number | null`; `checkedOn(date: string): string` (`'2026-08-02'` → `'2 Aug 2026'`); `Part.price_cents?: number | null`; `Tutorial.prices_checked_on?: string | null`; `fieldError(body: Record<string, unknown>): string | null` in `tutorials.ts` (Tasks 14–16 add lines to it); `ItemInput.price_cents?` / `ItemRow.price_cents?`.

- [ ] **Step 1: Write the failing tests**

`packages/web/tests/unit/lib/guides.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { checkedOn, partsTotalCents } from '@splat-connect/types'

describe('partsTotalCents', () => {
  it('sums the required parts once every one has a price', () => {
    expect(partsTotalCents([{ is_optional: false, price_cents: 600 }, { is_optional: false, price_cents: 450 }, { is_optional: true, price_cents: null }])).toBe(1050)
  })
  it('shows no total while a required part is unpriced', () => {
    expect(partsTotalCents([{ is_optional: false, price_cents: 600 }, { is_optional: false, price_cents: null }])).toBeNull()
    expect(partsTotalCents([{ is_optional: false }])).toBeNull()
  })
  it('shows no total for a list with nothing required', () => {
    expect(partsTotalCents([])).toBeNull()
    expect(partsTotalCents([{ is_optional: true, price_cents: 100 }])).toBeNull()
  })
  it('counts a free part as priced', () => {
    expect(partsTotalCents([{ is_optional: false, price_cents: 0 }])).toBe(0)
  })
})

describe('checkedOn', () => {
  it('writes the date the board way, without shifting a day', () => {
    expect(checkedOn('2026-08-02')).toBe('2 Aug 2026')
  })
})
```

`packages/api/tests/integration/guides/part-prices.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createProject } from '../../helpers/orgs.js'

let author: TestUser
let guide: string
const auth = () => ({ Authorization: `Bearer ${author.token}`, 'Content-Type': 'application/json' })
const postParts = (parts: unknown) =>
  app.request(`/api/tutorials/${guide}/parts`, { method: 'POST', headers: auth(), body: JSON.stringify({ parts }) })
const patch = async (fields: Record<string, unknown>) => {
  const { data } = await adminClient().from('tutorials').select('updated_at').eq('id', guide).single()
  return app.request(`/api/tutorials/${guide}`, { method: 'PATCH', headers: auth(), body: JSON.stringify({ ...fields, updated_at: data!.updated_at }) })
}

beforeAll(async () => {
  author = await createTestUser('contributor')
  guide = await createProject({ authorId: author.id, status: 'draft', title: 'Part Prices Fixture' })
})
afterAll(async () => {
  await adminClient().from('tutorials').delete().eq('id', guide)
  await deleteTestUser(author.id)
})

describe('086 part prices', () => {
  it('has both columns', async () => {
    expect((await adminClient().from('parts').select('price_cents').limit(1)).error).toBeNull()
    expect((await adminClient().from('tutorials').select('prices_checked_on').limit(1)).error).toBeNull()
  })

  it('saves a line price in cents, and no price as null', async () => {
    const res = await postParts([
      { name: 'Relay module', quantity: 1, is_optional: false, buy_links: [], price_cents: 600 },
      { name: 'Big button', quantity: 1, is_optional: false, buy_links: [] },
    ])
    expect(res.status).toBe(201)
    const { data } = await adminClient().from('parts').select('name, price_cents').eq('tutorial_id', guide).order('name')
    expect(data).toEqual([{ name: 'Big button', price_cents: null }, { name: 'Relay module', price_cents: 600 }])
  })

  it('refuses a negative or fractional price', async () => {
    const neg = await postParts([{ name: 'X', quantity: 1, is_optional: false, buy_links: [], price_cents: -1 }])
    expect(neg.status).toBe(400)
    expect(((await neg.json()) as { error: string }).error).toBe("Part 1's price must be a whole number of cents, 0 or more")
    expect((await postParts([{ name: 'X', quantity: 1, is_optional: false, buy_links: [], price_cents: 1.5 }])).status).toBe(400)
  })

  it('takes a prices-checked date through PATCH and refuses anything else', async () => {
    expect((await patch({ prices_checked_on: '2026-08-02' })).status).toBe(200)
    const bad = await patch({ prices_checked_on: 'last week' })
    expect(bad.status).toBe(400)
    expect(((await bad.json()) as { error: string }).error).toBe('Prices checked must be a date')
  })
})
```

`edit-items-section-parts.test.tsx` (append):

```tsx
  it('saves a line price in cents and keeps it through a rename', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <EditItemsSection noun="part" withQuantity initialItems={[{ id: 'p1', name: 'Relay', quantity: 1, is_optional: false, buy_links: [], price_cents: 600 }]} onSave={onSave} />
    )
    fireEvent.click(screen.getByText('Edit'))
    fireEvent.change(screen.getByDisplayValue('Relay'), { target: { value: 'Relay module' } })
    fireEvent.change(screen.getByLabelText('Price'), { target: { value: '6.50' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith([{ name: 'Relay module', quantity: 1, is_optional: false, buy_links: [], price_cents: 650 }])
    )
  })
```

(import `vi`, `waitFor`, `fireEvent` if the file does not already.)

`tutorial-detail.spec.ts` (append):

```ts
test('the parts tab totals the prices once every part has one', async ({ page }) => {
  const contributor = await createContributor()
  const id = await createTutorial(contributor.id, { title: uniqueTitle('E2E Prices'), status: 'approved' })
  const admin = adminClient()
  await admin.from('parts').update({ price_cents: 1250 }).eq('tutorial_id', id)
  await admin.from('tutorials').update({ prices_checked_on: '2026-08-02' }).eq('id', id)

  await page.goto(`/tutorials/${id}`)
  await expect(page.getByRole('cell', { name: 'Total' })).toBeVisible()
  await expect(page.getByRole('cell', { name: '$12.50' }).last()).toBeVisible()
  await expect(page.getByText('Prices last checked 2 Aug 2026')).toBeVisible()
})
```

(add `adminClient` to the helpers import.)

Mobile `items-section.test.tsx`:

```tsx
it('takes a part’s price in dollars and keeps it through a rename', () => {
  mockDraft.tutorial = { ...mockDraft.tutorial, parts: [{ id: 'p1', name: 'Switch', quantity: 2, is_optional: false, buy_links: [], price_cents: 600 }] }
  render(<ItemsSection noun="parts" />)
  fireEvent.changeText(screen.getByLabelText('Part 1 name'), 'Big switch')
  expect(mockDraft.replaceItems).toHaveBeenLastCalledWith('parts', [expect.objectContaining({ name: 'Big switch', price_cents: 600 })])
  fireEvent.changeText(screen.getByLabelText('Part 1 price'), '7.')
  fireEvent.changeText(screen.getByLabelText('Part 1 price'), '7.25')
  expect(mockDraft.replaceItems).toHaveBeenLastCalledWith('parts', [expect.objectContaining({ price_cents: 725 })])
  expect(screen.getByDisplayValue('7.25')).toBeTruthy()
})
```

Mobile `detail-screen.test.tsx`: change `'Servo Motor × 2'` to `'Servo Motor ×2'` in the first test, and add:

```tsx
  it('prices each part and totals them once all are priced', async () => {
    mockEndpoints({
      detail: Promise.resolve({ ...DETAIL, prices_checked_on: '2026-08-02', parts: [{ ...DETAIL.parts[0], price_cents: 1250 }] }),
    })
    render(<DetailScreen id="1" />)
    expect(await screen.findByText('Total')).toBeTruthy()
    expect(screen.getAllByText('$12.50')).toHaveLength(2)
    expect(screen.getByText('Prices checked 2 Aug 2026')).toBeTruthy()
  })
```

`review-checklist.test.ts` (append):

```ts
it('says when every part has a price', () => {
  const priced = { ...base, parts: [{ is_optional: false, price_cents: 600 }, { is_optional: false, price_cents: 0 }] }
  expect(reviewRows(priced as never).find((r) => r.title === 'Parts')).toEqual({ title: 'Parts', meta: '2 parts with prices', ok: true })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/lib/guides.test.ts tests/unit/components/edit-items-section-parts.test.tsx` → FAIL (`partsTotalCents` not exported; price dropped).
Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/guides/part-prices.test.ts` → FAIL (`column parts.price_cents does not exist`).
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/my-tutorials/items-section.test.tsx tests/unit/components/home/detail-screen.test.tsx tests/unit/lib/review-checklist.test.ts` → FAIL.

- [ ] **Step 3: Implement**

`supabase/migrations/086_part_prices.sql`:

```sql
-- 086 — what the parts cost (part-prices, decided 2026-09-30).
--
--   parts.price_cents           the line at its quantity, in cents. Null = no
--                               price yet; 0 = free (salvaged, already owned).
--   tutorials.prices_checked_on when the author last checked them. A date the
--                               author sets, so it is a PATCH field like any
--                               other and goes through the updated_at check.
--
-- The total is derived on read (partsTotalCents in @splat-connect/types) and
-- shows only when every required part has a price — never stored.
--
-- DOWN:
--   alter table public.tutorials drop column if exists prices_checked_on;
--   alter table public.parts drop column if exists price_cents;

alter table public.parts add column price_cents int check (price_cents >= 0);
alter table public.tutorials add column prices_checked_on date;
```

Apply: `supabase migration up`.

`guides.ts` (append):

```ts
/**
 * The parts total, or null when it must not show: a total that leaves out a
 * required part is a number a parent plans an evening around and is wrong.
 * Optional parts are never in it.
 */
export function partsTotalCents(parts: readonly { is_optional: boolean; price_cents?: number | null }[]): number | null {
  const required = parts.filter((p) => !p.is_optional)
  if (!required.length || required.some((p) => p.price_cents == null)) return null
  return required.reduce((sum, p) => sum + (p.price_cents as number), 0)
}

/** A `date` column ('2026-08-02') as the board writes it: "2 Aug 2026". UTC
 *  because the column has no time, and local midnight can fall the day before. */
export function checkedOn(date: string): string {
  return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))
}
```

`index.ts`: extend the re-export to `export { TOOL_GET_BY_LABEL, partsTotalCents, checkedOn } from './guides'`; `Part` gains `/** 086. The line at its quantity, in cents; null = not priced. */ price_cents?: number | null`; `Tutorial` gains `/** 086. When the author last checked the part prices. */ prices_checked_on?: string | null`.

`parts.ts`:

```ts
import { subResourceRoutes } from './sub-resource.js'

type PartInput = { name: string; quantity: number; is_optional: boolean; buy_links: unknown[]; price_cents?: number | null }

export function partsError(parts: PartInput[]): string | null {
  for (const [i, p] of parts.entries()) {
    if (p.price_cents != null && !(Number.isInteger(p.price_cents) && p.price_cents >= 0)) {
      return `Part ${i + 1}'s price must be a whole number of cents, 0 or more`
    }
  }
  return null
}

export default subResourceRoutes<PartInput>({
  path: 'parts',
  table: 'parts',
  bodyKey: 'parts',
  validate: partsError,
  mapRow: (p, tutorialId) => ({
    tutorial_id: tutorialId,
    name: p.name,
    quantity: p.quantity,
    is_optional: p.is_optional,
    buy_links: p.buy_links,
    price_cents: p.price_cents ?? null,
  }),
})
```

`tutorials.ts`: delete the `PENDING(part-prices)` comment line; add `'prices_checked_on'` to `EDITABLE`; add above `tutorials.patch`:

```ts
/**
 * The limits on the newer guide fields, as sentences (the CHECKs in 086+
 * repeat them). Only fields present in the body are checked.
 */
export function fieldError(body: Record<string, unknown>): string | null {
  const has = (k: string) => k in body && body[k] !== null
  if (has('prices_checked_on') && !(typeof body.prices_checked_on === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.prices_checked_on) && !Number.isNaN(Date.parse(body.prices_checked_on)))) {
    return 'Prices checked must be a date'
  }
  return null
}
```

and in `tutorials.patch`, right after the `updated_at is required` check:

```ts
  const invalid = fieldError(body)
  if (invalid) return c.json({ error: invalid }, 400)
```

Web `edit-items-section.tsx`:
- `EditableItem` / `ItemInput` gain `price_cents?: number | null`; import `dollarsToCents, formatCents` from `@splat-connect/types`.
- `toInput`'s quantity spread becomes `...(withQuantity ? { quantity: item.quantity ?? 1, price_cents: item.price_cents ?? null } : {}),`.
- `readAddForm`'s quantity spread becomes `...(withQuantity ? { quantity: Number(data.get('quantity') ?? 1), price_cents: dollarsToCents((data.get('price') as string) ?? '') } : {}),`.
- In the open-row editor, after the quantity input:

```tsx
                  {withQuantity && (
                    <input
                      aria-label="Price"
                      inputMode="decimal"
                      defaultValue={draft.price_cents == null ? '' : (draft.price_cents / 100).toFixed(2)}
                      onChange={(e) => setDraft((d) => (d ? { ...d, price_cents: dollarsToCents(e.target.value) } : d))}
                      className={inputCls}
                      placeholder="Price for the line, e.g. 6.50"
                    />
                  )}
```

  and in the add form after its quantity input: `<input name="price" aria-label="Price" inputMode="decimal" placeholder="Price for the line, e.g. 6.50" className={inputCls} />` (when `withQuantity`).
- In each row button, after the name span: `{withQuantity && i.price_cents != null && <span className="numeral text-sm text-muted">{formatCents(i.price_cents)}</span>}`.

`packages/web/components/prices-checked-field.tsx`:

```tsx
'use client'
/**
 * When the author last checked the part prices (086). Its own small form under
 * the parts list: it is a tutorials field, so it saves through PATCH with the
 * concurrency token, unlike the parts list it sits under.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/toast'

export function PricesCheckedField({ value, onSave }: { value: string | null; onSave: (date: string | null) => Promise<void> }) {
  const [date, setDate] = useState(value ?? '')
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const showToast = useToast()
  return (
    <div className="flex flex-wrap items-end gap-2 px-5 pb-5">
      <label className="flex flex-col gap-1 text-sm font-bold text-ink">
        Prices checked
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="field" />
      </label>
      <button
        type="button"
        disabled={saving || date === (value ?? '')}
        onClick={async () => {
          setSaving(true)
          try {
            await onSave(date || null)
            showToast('Prices checked date saved')
            router.refresh()
          } finally {
            setSaving(false)
          }
        }}
        className="btn btn-quiet btn-sm"
      >
        {saving ? 'Saving…' : 'Save date'}
      </button>
    </div>
  )
}
```

Web edit page: add

```ts
  async function savePricesChecked(date: string | null) {
    'use server'
    await patchTutorialFiles(id, { prices_checked_on: date })
    revalidatePath(`/tutorials/${id}/edit`)
  }
```

and under the parts `EditItemsSection` in the parts panel: `<PricesCheckedField value={tutorial.prices_checked_on ?? null} onSave={savePricesChecked} />` (import it). Update the parts step `hint` to `'Everything a family has to buy, with a rough price.'`.

Web `tutorial-view.tsx`:
- Import `partsTotalCents, checkedOn, formatCents`.
- `const total = partsTotalCents(tutorial.parts)` beside `steps`.
- Rail stats: replace `['parts', tutorial.parts.length]` with `total != null ? ['cost', formatCents(total)] : ['parts', tutorial.parts.length]`, and update the comment above `stats` (it no longer lacks prices).
- Parts table: add `<th>Approx.</th>` after `<th>Qty</th>`, the cell `<td className="font-mono text-sm">{p.price_cents != null ? formatCents(p.price_cents) : '—'}</td>` after the Qty cell, and after `</tbody>`:

```tsx
            {total != null && (
              <tfoot>
                <tr>
                  <td colSpan={2} className="font-extrabold">Total</td>
                  <td className="font-mono text-sm font-extrabold">{formatCents(total)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
```

  and after the table wrapper:

```tsx
          {tutorial.prices_checked_on && total != null && (
            <p className="m-0 mt-2 text-[13px] text-muted">
              Prices last checked {checkedOn(tutorial.prices_checked_on)} · Prices change. Treat these as a guide, not a quote — and look online for better before you buy.
            </p>
          )}
```

Mobile `use-tutorial-draft.tsx`: `ItemRow` gains `price_cents?: number | null`; the parts mapping becomes `parts: clean.map(({ name, quantity, is_optional, buy_links, price_cents }) => ({ name, quantity: quantity ?? 1, is_optional, buy_links: links({ buy_links } as ItemRow), price_cents: price_cents ?? null })),` (keeping Task 5's `links`).

Mobile `items-section.tsx`:
- Seed `price_cents: r.price_cents ?? null`; new rows `price_cents: null`.
- `LEAD.parts` → `'Everything a family has to buy, with a rough price.'`; delete `PENDING(part-prices)` and the leftover lead comment.
- Price text kept per row while typing (`'7.'` is not yet an amount): `const [priceText, setPriceText] = useState<Record<number, string>>({})`, and under each part's controls:

```tsx
            {withQuantity ? (
              <TextField
                accessibilityLabel={`Part ${i + 1} price`}
                placeholder="$6 — the line at its quantity"
                keyboardType="decimal-pad"
                value={priceText[i] ?? (row.price_cents == null ? '' : (row.price_cents / 100).toFixed(2))}
                onChangeText={(text) => {
                  setPriceText((p) => ({ ...p, [i]: text }))
                  update(i, { price_cents: text.trim() ? dollarsToCents(text) : null })
                }}
              />
            ) : null}
```

- Under the list for parts, the checked date:

```tsx
        {withQuantity ? (
          <DateTimeField
            label="Prices checked"
            mode="date"
            placeholder="Choose a date"
            value={tutorial.prices_checked_on ?? ''}
            onChange={(v) => save({ prices_checked_on: v || null })}
          />
        ) : null}
```

  (destructure `save` from `useDraft()`; import `DateTimeField` from `../../ui/DateTimeField` and `dollarsToCents` from `@splat-connect/types`). Removing a row must drop its `priceText` entry: in the remove handler use `setPriceText({})` before `commit(...)`.

Mobile `detail-screen.tsx` Parts section (replace the PENDING comment and the `Section`):

```tsx
      <Section title="Parts" hint="What you'll need to buy or salvage.">
        {tutorial.parts.length ? (
          tutorial.parts.map((item) => (
            <View key={item.id} style={styles.listRow}>
              <Ionicons name="cube-outline" size={17} color={theme.colors.primary} />
              <Text style={styles.listItem}>{`${item.name} ×${item.quantity}${item.is_optional ? ' (optional)' : ''}`}</Text>
              {item.price_cents != null ? <Text style={styles.cost}>{formatCents(item.price_cents)}</Text> : null}
            </View>
          ))
        ) : (
          <Text style={styles.listItem}>No parts listed.</Text>
        )}
        {total != null ? (
          <>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.cost}>{formatCents(total)}</Text>
            </View>
            {tutorial.prices_checked_on ? <Text style={styles.checked}>{`Prices checked ${checkedOn(tutorial.prices_checked_on)}`}</Text> : null}
          </>
        ) : null}
      </Section>
```

with `const total = partsTotalCents(tutorial.parts)` beside `fit`, imports `formatCents, partsTotalCents, checkedOn`, the now-unused `ListRow` helper deleted if nothing else uses it, and styles:

```ts
  cost: { fontFamily: theme.fonts.numeral, fontSize: theme.type.caption, color: theme.colors.ink },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', padding: theme.spacing(3), borderRadius: theme.radii.field, backgroundColor: theme.colors.accentLight, marginTop: theme.spacing(2) },
  totalLabel: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.ink },
  checked: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted, marginTop: theme.spacing(1) },
```


Mobile `tutorial-sections.ts` parts summary: `return t.parts.length ? \`${count(t.parts.length, 'part')}${total != null ? \`, ${formatCents(total)} total\` : ''}\` : 'None yet - at least one'` with `const total = partsTotalCents(t.parts)` in that case (import both from `@splat-connect/types`) — the board's "3 parts, $58 total".

Mobile `review-checklist.ts` Parts row:

```ts
    {
      title: 'Parts',
      meta: !t.parts.length
        ? 'No parts listed'
        : t.parts.every((p) => p.price_cents != null)
          ? `${count(t.parts.length, 'part')} with prices`
          : `${count(t.parts.length, 'part')}, ${t.parts.filter((p) => p.price_cents == null).length} without a price`,
      ok: t.parts.length > 0,
    },
```

(the earlier test's base parts have no `price_cents`, so update its expected Parts meta to `'3 parts, 3 without a price'`, and `review-detail-screen.test.tsx`'s `'2 parts'` to `'2 parts, 2 without a price'`.)

Grep: `grep -rn "parts" packages/mobile/components packages/mobile/lib | grep -v test | grep -n "map\|filter"` — confirm no other parts rebuild path.

- [ ] **Step 4: Run the tests to see them pass**

Run the Step 2 commands, then the e2e: `pnpm --filter @splat-connect/web exec playwright test tests/e2e/public/tutorial-detail.spec.ts`. Expected: PASS.

- [ ] **Step 5: Ship the item** — `shipped: true` on `'part-prices'`; `node scripts/pending.mjs`; no parity rule; drift test → `Tests  11 passed (11)`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/086_part_prices.sql packages/types/src packages/api/src/routes packages/api/tests/integration/guides/part-prices.test.ts packages/web packages/mobile docs/PENDING.md
git commit -m "feat(guides): a price per part, a prices-checked date and a total that shows only when complete (086)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 14: Photo captions and the thumbnail strip (`guide-photo-captions`, migration 087)

Captions are parallel to `photo_urls`. When a PATCH moves photos without naming captions (web's reorder and remove), the API carries each caption with its URL. Mobile merges a debounced caption edit into the same PATCH as a cover change, so it sends realigned captions itself.

**Files:**
- Create: `supabase/migrations/087_photo_captions.sql`
- Modify: `packages/types/src/guides.ts` (`realignCaptions`), `packages/types/src/index.ts` (re-export, `Tutorial.photo_captions`)
- Modify: `packages/api/src/routes/tutorials.ts` (`EDITABLE`, `fieldError`, PATCH realignment)
- Modify: `packages/mobile/components/ui/PhotoCarousel.tsx` (`index` prop), `packages/mobile/components/home/detail-screen.tsx` (chip + strip), `packages/mobile/components/my-tutorials/sections/files-section.tsx`
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/web/tests/unit/lib/guides.test.ts`, `packages/api/tests/integration/guides/photo-captions.test.ts` (new), mobile `detail-screen.test.tsx`, `files-section.test.tsx`

**Interfaces:**
- Produces: `realignCaptions(beforeUrls: readonly string[], beforeCaptions: readonly (string | null)[], afterUrls: readonly string[]): (string | null)[]`; `Tutorial.photo_captions?: (string | null)[]`; `PhotoCarousel` prop `index?: number`.

- [ ] **Step 1: Write the failing tests**

`guides.test.ts` (append):

```ts
describe('realignCaptions', () => {
  it('moves each caption with its photo', () => {
    expect(realignCaptions(['a', 'b', 'c'], ['A', null, 'C'], ['c', 'a', 'b'])).toEqual(['C', 'A'])
  })
  it('drops a removed photo’s caption and gives a new photo none', () => {
    expect(realignCaptions(['a', 'b'], ['A', 'B'], ['b', 'n'])).toEqual(['B'])
  })
  it('never returns more captions than photos', () => {
    expect(realignCaptions(['a'], ['A', 'stray'], [])).toEqual([])
  })
})
```

(add `realignCaptions` to the import.)

`packages/api/tests/integration/guides/photo-captions.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createProject } from '../../helpers/orgs.js'

let author: TestUser
let guide: string
const patch = async (fields: Record<string, unknown>) => {
  const { data } = await adminClient().from('tutorials').select('updated_at').eq('id', guide).single()
  return app.request(`/api/tutorials/${guide}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${author.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...fields, updated_at: data!.updated_at }),
  })
}
const row = async () => (await adminClient().from('tutorials').select('photo_urls, photo_captions').eq('id', guide).single()).data!

beforeAll(async () => {
  author = await createTestUser('contributor')
  guide = await createProject({ authorId: author.id, status: 'draft', title: 'Captions Fixture' })
  await adminClient().from('tutorials').update({ photo_urls: ['a', 'b', 'c'] }).eq('id', guide)
})
afterAll(async () => {
  await adminClient().from('tutorials').delete().eq('id', guide)
  await deleteTestUser(author.id)
})

describe('087 photo captions', () => {
  it('saves captions beside the photos', async () => {
    expect((await patch({ photo_captions: ['The finished drum', null, 'The jack'] })).status).toBe(200)
    expect((await row()).photo_captions).toEqual(['The finished drum', null, 'The jack'])
  })

  // Review Focus 2: web reorders and removes with photo_urls alone.
  it('carries each caption with its photo when only the photos are sent', async () => {
    expect((await patch({ photo_urls: ['c', 'a'] })).status).toBe(200)
    expect(await row()).toEqual({ photo_urls: ['c', 'a'], photo_captions: ['The jack', 'The finished drum'] })
  })

  it('refuses more captions than photos, or a long one', async () => {
    const more = await patch({ photo_captions: ['1', '2', '3'] })
    expect(more.status).toBe(400)
    expect(((await more.json()) as { error: string }).error).toBe('There are more captions than photos.')
    expect((await patch({ photo_captions: ['x'.repeat(61)] })).status).toBe(400)
  })

  it('is backed by a check in the database', async () => {
    const { error } = await adminClient().from('tutorials').update({ photo_captions: ['1', '2', '3'] }).eq('id', guide)
    expect(error?.code).toBe('23514')
  })
})
```

Mobile `detail-screen.test.tsx`:

```tsx
  it('captions the photo in view and offers a thumbnail strip', async () => {
    mockEndpoints({ detail: Promise.resolve({ ...DETAIL, photo_urls: ['https://x.test/a.jpg', 'https://x.test/b.jpg'], photo_captions: ['The finished drum'] }) })
    render(<DetailScreen id="1" />)
    expect(await screen.findByText('1/2 · The finished drum')).toBeTruthy()
    expect(screen.getByLabelText('Show photo 1: The finished drum')).toBeTruthy()
    expect(screen.getByLabelText('Show photo 2: Build a Robot Arm')).toBeTruthy()
  })
```

Mobile `files-section.test.tsx` (uses the file's existing `mockDraft`; set `tutorial.photo_urls = ['a', 'b']`, `photo_captions = []` in the test):

```tsx
it('captions a photo, and the caption follows it to the cover', async () => {
  mockDraft.tutorial = { ...mockDraft.tutorial, photo_urls: ['a', 'b'], photo_captions: [null, 'The jack'] }
  render(<FilesSection />)
  fireEvent.changeText(screen.getByLabelText('Caption for photo 1'), 'The drum')
  expect(mockDraft.save).toHaveBeenLastCalledWith({ photo_captions: ['The drum', 'The jack'] })
  fireEvent.press(screen.getByLabelText('Make photo 2 the cover'))
  await waitFor(() =>
    expect(mockDraft.saveNow).toHaveBeenLastCalledWith({ photo_urls: ['b', 'a'], photo_captions: ['The jack', 'The drum'] })
  )
})
```

(the test's `mockDraft.save` must update `mockDraft.tutorial` the way the real `save` does, or the second assertion reads stale captions: in this test add `mockDraft.save.mockImplementation((f) => { mockDraft.tutorial = { ...mockDraft.tutorial, ...f } })` before rendering.)

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/lib/guides.test.ts` → FAIL (`realignCaptions` not exported).
Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/guides/photo-captions.test.ts` → FAIL (`column photo_captions does not exist`).
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/home/detail-screen.test.tsx tests/unit/components/my-tutorials/files-section.test.tsx` → FAIL.

- [ ] **Step 3: Implement**

`supabase/migrations/087_photo_captions.sql`:

```sql
-- 087 — a caption per guide photo (guide-photo-captions).
--
-- Parallel to photo_urls (053): photo_captions[i] belongs to photo_urls[i],
-- null for none. Never longer than the photos — the API moves captions with
-- their photo on every reorder or removal, and this check is the backstop.
--
-- DOWN:
--   alter table public.tutorials drop constraint if exists tutorials_photo_captions_fit,
--     drop column if exists photo_captions;
--   drop function if exists public.captions_fit(text[]);

-- A CHECK cannot hold a subquery; a function that does can be called from one.
create or replace function public.captions_fit(c text[])
returns boolean
language sql immutable set search_path = ''
as $$
  select coalesce(bool_and(x is null or length(x) <= 60), true) from unnest(c) as x
$$;

alter table public.tutorials
  add column photo_captions text[] not null default '{}',
  add constraint tutorials_photo_captions_fit check (
    cardinality(photo_captions) <= 5
    and cardinality(photo_captions) <= cardinality(photo_urls)
    and public.captions_fit(photo_captions)
  );
```

Apply: `supabase migration up`.

`guides.ts` (append):

```ts
/**
 * Captions after the photos moved: each follows its URL, a new photo has
 * none, trailing nulls are trimmed so the list never outgrows the photos.
 */
export function realignCaptions(
  beforeUrls: readonly string[],
  beforeCaptions: readonly (string | null)[],
  afterUrls: readonly string[]
): (string | null)[] {
  const byUrl = new Map(beforeUrls.map((url, i) => [url, beforeCaptions[i] ?? null]))
  const out = afterUrls.map((url) => byUrl.get(url) ?? null)
  while (out.length && out[out.length - 1] == null) out.pop()
  return out
}
```

`index.ts`: add `realignCaptions` to the guides re-export; `Tutorial` gains `/** 087. Parallel to photo_urls; null = no caption. */ photo_captions?: (string | null)[]`.

`tutorials.ts`:
- import `realignCaptions` from `@splat-connect/types`; add `'photo_captions'` to `EDITABLE`.
- In `fieldError`, before `return null`:

```ts
  if ('photo_captions' in body) {
    const caps = body.photo_captions
    if (!Array.isArray(caps) || caps.some((c) => c !== null && typeof c !== 'string')) return 'Captions must be a list'
    if (caps.some((c) => typeof c === 'string' && c.trim().length > 60)) return 'A photo caption is over 60 characters'
  }
```

- Replace the `photosBefore` read with one that also reads captions, and realign/check right after `const update = pickEditable(body, EDITABLE)`:

```ts
  // Read before the write whenever photos or captions are part of this save:
  // the sweep below needs the old URLs, and captions follow their photo (087).
  const before =
    Array.isArray(body.photo_urls) || 'photo_captions' in body
      ? (
          await supabase
            .from('tutorials')
            .select('photo_urls, photo_captions')
            .eq('id', c.req.param('id'))
            .maybeSingle()
        ).data
      : null
  const photosBefore = Array.isArray(body.photo_urls) ? (before?.photo_urls ?? null) : null
```

  (move `const supabase = createUserClient(...)` above this if it is below), and after the "every guide keeps a photo" check:

```ts
  if (Array.isArray(body.photo_urls) && !('photo_captions' in body)) {
    update.photo_captions = realignCaptions(before?.photo_urls ?? [], before?.photo_captions ?? [], body.photo_urls as string[])
  }
  if ('photo_captions' in body) {
    const photos = (Array.isArray(body.photo_urls) ? body.photo_urls : before?.photo_urls) ?? []
    const caps = (body.photo_captions as (string | null)[]).map((c) => c?.trim() || null)
    if (caps.length > photos.length) return c.json({ error: 'There are more captions than photos.' }, 400)
    update.photo_captions = caps
  }
```

Mobile `PhotoCarousel.tsx`: add the prop `/** Scroll to this photo — the thumbnail strip's tap. */ index?: number`, then

```tsx
  const scroller = useRef<ScrollView>(null)
  useEffect(() => {
    if (index != null) scroller.current?.scrollTo({ x: index * width, animated: true })
  }, [index, width])
```

and `ref={scroller as never}` on `Animated.ScrollView` (import `useEffect, useRef` and `type ScrollView`).

Mobile `detail-screen.tsx`: delete the `PENDING(guide-photo-captions)` comment; add `const [pick, setPick] = useState<number | undefined>(undefined)`; pass `index={pick}` to `PhotoCarousel`; the chip text becomes

```tsx
              {`${Math.min(photo, tutorial.photo_urls.length - 1) + 1}/${tutorial.photo_urls.length} · ${captionAt(Math.min(photo, tutorial.photo_urls.length - 1))}`}
```

with `const captionAt = (i: number) => tutorial.photo_captions?.[i] || tutorial.title` above the return; and under the hero:

```tsx
      {tutorial.photo_urls.length > 1 ? (
        <View accessibilityRole="tablist" accessibilityLabel="Photos" style={styles.strip}>
          {tutorial.photo_urls.map((url, i) => (
            <Pressable
              key={url}
              accessibilityRole="tab"
              accessibilityState={{ selected: i === photo }}
              accessibilityLabel={`Show photo ${i + 1}: ${captionAt(i)}`}
              onPress={() => setPick(i)}
              style={[styles.thumb, i === photo && styles.thumbOn]}
            >
              <Image source={{ uri: url }} style={styles.thumbImage} />
            </Pressable>
          ))}
        </View>
      ) : null}
```

Styles: `strip: { flexDirection: 'row', gap: theme.spacing(2), marginBottom: theme.spacing(2) }, thumb: { width: 52, height: 52, borderRadius: theme.radii.field, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent' }, thumbOn: { borderColor: theme.colors.primaryDark }, thumbImage: { width: '100%', height: '100%' },` (import `Pressable`).

Mobile `files-section.tsx`: `const captions = tutorial.photo_captions ?? []` beside `currentPhotoUrls`; import `realignCaptions`; each photo save sends realigned captions:

```ts
      await saveNow({ photo_urls: next, photo_captions: realignCaptions(currentPhotoUrls, captions, next) })
```

for `pickPhoto` (`next = [...currentPhotoUrls, ...urls]`), `removePhoto` (`next = currentPhotoUrls.filter((u) => u !== url)`) and `makeCover` (`next = [url, ...currentPhotoUrls.filter((u) => u !== url)]`). Under each photo tile, a caption field:

```tsx
              <TextField
                accessibilityLabel={`Caption for photo ${i + 1}`}
                placeholder="Caption (optional)"
                maxLength={60}
                value={captions[i] ?? ''}
                onChangeText={(text) => {
                  const next = currentPhotoUrls.map((_, k) => (k === i ? text || null : (captions[k] ?? null)))
                  save({ photo_captions: realignCaptions(currentPhotoUrls, next, currentPhotoUrls) })
                }}
              />
```

(destructure `save` from `useDraft()`; import `TextField`.)

Grep: `grep -rn "photo_urls" packages/mobile/components packages/mobile/lib | grep -v test` — the toy editor writes `toys.photo_urls`, which has no captions; nothing else writes a guide's photos.

- [ ] **Step 4: Run the tests to see them pass**

Run the Step 2 commands. Expected: PASS. Also `pnpm --filter @splat-connect/api exec vitest run tests/unit/routes/tutorials.test.ts` (the PATCH unit mocks read `photo_urls` — extend the mocked select to tolerate `photo_urls, photo_captions` if one fails).

- [ ] **Step 5: Ship the item** — `shipped: true` on `'guide-photo-captions'`; `node scripts/pending.mjs`; no parity rule; drift test → `Tests  11 passed (11)`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/087_photo_captions.sql packages/types/src packages/api packages/web/tests/unit/lib/guides.test.ts packages/mobile docs/PENDING.md
git commit -m "feat(guides): captions per guide photo that follow their photo, and a thumbnail strip (087)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 15: Print settings per guide (`print-settings`, migration 088)

Four guide-level settings. The registry's needs line puts them on the detail, the print request and the incoming job, so the two printing screens holding `PENDING(print-settings)` are part of this task.

**Files:**
- Create: `supabase/migrations/088_print_settings.sql`
- Modify: `packages/types/src/guides.ts` (`PrintSettings`, `formatPrintMinutes`, `printSettingRows`, `printSettingsLine`), `packages/types/src/index.ts` (re-exports, `Tutorial` fields, `ToyTransactionSummary.tutorial_print_settings`)
- Modify: `packages/api/src/routes/tutorials.ts` (`EDITABLE`, `fieldError`, PENDING comment), `packages/api/src/routes/toy-transactions.ts` (two selects, two responses)
- Modify: `packages/web/components/edit-details-section.tsx` (fieldset), `packages/web/app/tutorials/[id]/edit/page.tsx` (`saveDetails` type), `packages/web/components/tutorial-view.tsx` (Files tab)
- Modify: `packages/mobile/components/home/detail-screen.tsx`, `packages/mobile/components/my-tutorials/sections/stl-section.tsx`, `packages/mobile/components/printing/request-screen.tsx`, `packages/mobile/components/printing/offer-screen.tsx`
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/web/tests/unit/lib/guides.test.ts`, `packages/api/tests/integration/guides/print-settings.test.ts` (new), `packages/web/tests/unit/components/tutorial-view.test.tsx`, mobile `detail-screen.test.tsx`

**Interfaces:**
- Produces: `type PrintSettings = { layer_height_mm?: number | null; infill_percent?: number | null; material?: string | null; print_minutes?: number | null }`; `formatPrintMinutes(m: number): string`; `printSettingRows(t: PrintSettings): { k: string; v: string }[]`; `printSettingsLine(t: PrintSettings): string`; `ToyTransactionSummary.tutorial_print_settings?: PrintSettings | null`.

- [ ] **Step 1: Write the failing tests**

`guides.test.ts` (append):

```ts
describe('printSettingRows', () => {
  it('lists the settings a guide has, in the board’s words', () => {
    expect(printSettingRows({ layer_height_mm: 0.2, infill_percent: 25, material: 'PETG', print_minutes: 190 })).toEqual([
      { k: 'Layer height', v: '0.2 mm' },
      { k: 'Infill', v: '25 %' },
      { k: 'Material', v: 'PETG' },
      { k: 'Print time', v: '3 h 10' },
    ])
    expect(printSettingRows({ infill_percent: 0 })).toEqual([{ k: 'Infill', v: '0 %' }])
    expect(printSettingRows({})).toEqual([])
  })
  it('joins the slicer settings into one line for a print job', () => {
    expect(printSettingsLine({ layer_height_mm: 0.2, infill_percent: 25, material: 'PETG', print_minutes: 40 })).toBe('0.2 mm · 25 % · PETG')
  })
  it('writes short and whole-hour times plainly', () => {
    expect(formatPrintMinutes(40)).toBe('40 min')
    expect(formatPrintMinutes(120)).toBe('2 h')
  })
})
```

`packages/api/tests/integration/guides/print-settings.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createProject } from '../../helpers/orgs.js'

let author: TestUser
let guide: string
const patch = async (fields: Record<string, unknown>) => {
  const { data } = await adminClient().from('tutorials').select('updated_at').eq('id', guide).single()
  return app.request(`/api/tutorials/${guide}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${author.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...fields, updated_at: data!.updated_at }),
  })
}

beforeAll(async () => {
  author = await createTestUser('contributor')
  guide = await createProject({ authorId: author.id, status: 'draft', title: 'Print Settings Fixture' })
})
afterAll(async () => {
  await adminClient().from('tutorials').delete().eq('id', guide)
  await deleteTestUser(author.id)
})

describe('088 print settings', () => {
  it('saves all four', async () => {
    expect((await patch({ layer_height_mm: 0.2, infill_percent: 25, material: 'PETG', print_minutes: 190 })).status).toBe(200)
    const { data } = await adminClient().from('tutorials').select('layer_height_mm, infill_percent, material, print_minutes').eq('id', guide).single()
    expect(data).toEqual({ layer_height_mm: 0.2, infill_percent: 25, material: 'PETG', print_minutes: 190 })
  })

  it('refuses each out of range with a sentence', async () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ layer_height_mm: 2 }, 'Layer height must be between 0.05 and 1 mm'],
      [{ infill_percent: 101 }, 'Infill must be a whole percent from 0 to 100'],
      [{ material: 'x'.repeat(41) }, 'Material is over 40 characters'],
      [{ print_minutes: 0 }, 'Print time must be 1 to 6000 minutes'],
    ]
    for (const [fields, message] of cases) {
      const res = await patch(fields)
      expect(res.status).toBe(400)
      expect(((await res.json()) as { error: string }).error).toBe(message)
    }
  })
})
```

`tutorial-view.test.tsx` (append; an assistive guide with one STL so the Files tab shows):

```tsx
  it('lists the guide’s print settings on the Files tab', () => {
    render(
      <TutorialView
        signedIn
        tutorial={tutorial({ kind: 'assistive_tech', stl_files: stl, layer_height_mm: 0.2, infill_percent: 25, material: 'PETG', print_minutes: 190 })}
      />
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Files & print settings' }))
    expect(screen.getByText('Layer height')).toBeInTheDocument()
    expect(screen.getByText('3 h 10')).toBeInTheDocument()
  })
```

(import `fireEvent` from `@testing-library/react`.)

Mobile `detail-screen.test.tsx`:

```tsx
  it('shows the print settings when the guide has any', async () => {
    mockEndpoints({ detail: Promise.resolve({ ...DETAIL, layer_height_mm: 0.2, infill_percent: 25, material: 'PETG', print_minutes: null }) })
    render(<DetailScreen id="1" />)
    expect(await screen.findByText('Files & print settings')).toBeTruthy()
    expect(screen.getByText('0.2 mm')).toBeTruthy()
    expect(screen.queryByText('Print time')).toBeNull()
  })
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/lib/guides.test.ts tests/unit/components/tutorial-view.test.tsx` → FAIL.
Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/guides/print-settings.test.ts` → FAIL (`column tutorials.layer_height_mm does not exist`).
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/home/detail-screen.test.tsx -t "print settings"` → FAIL.

- [ ] **Step 3: Implement**

`supabase/migrations/088_print_settings.sql`:

```sql
-- 088 — a guide's print settings (print-settings): what the author sliced at,
-- shown on the guide, the print request and the printer's incoming job.
-- Per-file time and grams stay on stl_files (068); these are the guide's own.
--
-- DOWN:
--   alter table public.tutorials drop column if exists print_minutes,
--     drop column if exists material, drop column if exists infill_percent,
--     drop column if exists layer_height_mm;

alter table public.tutorials
  add column layer_height_mm numeric(3,2) check (layer_height_mm between 0.05 and 1.00),
  add column infill_percent int check (infill_percent between 0 and 100),
  add column material text check (material is null or length(material) <= 40),
  add column print_minutes int check (print_minutes between 1 and 6000);
```

Apply: `supabase migration up`.

`guides.ts` (append):

```ts
/** 088. A guide's own print settings; every one optional. */
export type PrintSettings = {
  layer_height_mm?: number | null
  infill_percent?: number | null
  material?: string | null
  print_minutes?: number | null
}

/** "40 min", "2 h", "3 h 10" — the board's print times. */
export function formatPrintMinutes(m: number): string {
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h} h ${r}` : `${h} h`
}

export function printSettingRows(t: PrintSettings): { k: string; v: string }[] {
  const rows: { k: string; v: string }[] = []
  if (t.layer_height_mm != null) rows.push({ k: 'Layer height', v: `${Number(t.layer_height_mm)} mm` })
  if (t.infill_percent != null) rows.push({ k: 'Infill', v: `${t.infill_percent} %` })
  if (t.material) rows.push({ k: 'Material', v: t.material })
  if (t.print_minutes != null) rows.push({ k: 'Print time', v: formatPrintMinutes(t.print_minutes) })
  return rows
}

/** "0.2 mm · 25 % · PETG": what a printer sets, without the time. */
export const printSettingsLine = (t: PrintSettings) =>
  printSettingRows(t).filter((r) => r.k !== 'Print time').map((r) => r.v).join(' · ')
```

`index.ts`: add `formatPrintMinutes, printSettingRows, printSettingsLine` to the guides re-export and `export type { ToolGetBy, PrintSettings } from './guides'` (+ `import type { PrintSettings } from './guides'`); `Tutorial` gains

```ts
  /** 088. The guide's print settings, as the author sliced it. */
  layer_height_mm?: number | null
  infill_percent?: number | null
  material?: string | null
  print_minutes?: number | null
```

and `ToyTransactionSummary` (the interface holding `tutorial_title` near line 572) gains `/** 088. The guide's settings, for a print job. */ tutorial_print_settings?: PrintSettings | null`.

`tutorials.ts`: delete the `PENDING(print-settings)` comment; add `'layer_height_mm', 'infill_percent', 'material', 'print_minutes'` to `EDITABLE`; in `fieldError` before `return null`:

```ts
  const num = (k: string) => body[k] as number
  if (has('layer_height_mm') && !(typeof body.layer_height_mm === 'number' && num('layer_height_mm') >= 0.05 && num('layer_height_mm') <= 1)) return 'Layer height must be between 0.05 and 1 mm'
  if (has('infill_percent') && !(Number.isInteger(body.infill_percent) && num('infill_percent') >= 0 && num('infill_percent') <= 100)) return 'Infill must be a whole percent from 0 to 100'
  if (has('material') && !(typeof body.material === 'string' && body.material.trim().length <= 40)) return 'Material is over 40 characters'
  if (has('print_minutes') && !(Number.isInteger(body.print_minutes) && num('print_minutes') >= 1 && num('print_minutes') <= 6000)) return 'Print time must be 1 to 6000 minutes'
```

`toy-transactions.ts`: in both selects (lines ~267 and ~399) change `tutorial:tutorials(title)` to `tutorial:tutorials(title, layer_height_mm, infill_percent, material, print_minutes)`, and beside each `tutorial_title: …` line add

```ts
      tutorial_print_settings: r.tutorial
        ? { layer_height_mm: r.tutorial.layer_height_mm, infill_percent: r.tutorial.infill_percent, material: r.tutorial.material, print_minutes: r.tutorial.print_minutes }
        : null,
```

(`row.` instead of `r.` in the detail response.)

Web `edit-details-section.tsx`: the `onSave` patch type gains `layer_height_mm: number | null; infill_percent: number | null; material: string | null; print_minutes: number | null` (and the page's `saveDetails` parameter type the same four). In `handleSubmit`'s object:

```ts
        ...(tutorial.kind === 'assistive_tech'
          ? {
              layer_height_mm: formData.get('layer_height_mm') === '' ? null : Number(formData.get('layer_height_mm')),
              infill_percent: formData.get('infill_percent') === '' ? null : Number(formData.get('infill_percent')),
              material: ((formData.get('material') as string) ?? '').trim() || null,
              print_minutes: formData.get('print_minutes') === '' ? null : Number(formData.get('print_minutes')),
            }
          : {}),
```

(so make the four optional in the type: `layer_height_mm?: …` etc.) and before the safety fieldset:

```tsx
      {tutorial.kind === 'assistive_tech' && (
        <fieldset>
          <legend className="field-label">Print settings</legend>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm">Layer height (mm)<input name="layer_height_mm" type="number" step="0.01" min={0.05} max={1} defaultValue={tutorial.layer_height_mm ?? ''} className="field" /></label>
            <label className="text-sm">Infill (%)<input name="infill_percent" type="number" min={0} max={100} defaultValue={tutorial.infill_percent ?? ''} className="field" /></label>
            <label className="text-sm">Material<input name="material" maxLength={40} defaultValue={tutorial.material ?? ''} placeholder="PETG" className="field" /></label>
            <label className="text-sm">Print time (minutes)<input name="print_minutes" type="number" min={1} max={6000} defaultValue={tutorial.print_minutes ?? ''} className="field" /></label>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted">What you sliced it at. A printer copies these; they never set their own.</p>
        </fieldset>
      )}
```

Web `tutorial-view.tsx` `files` block, first child:

```tsx
      {printSettingRows(tutorial).length > 0 && (
        <dl className="m-0 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {printSettingRows(tutorial).map((r) => (
            <div key={r.k} className="rounded-[var(--radius-field)] bg-sunken p-2.5">
              <dt className="text-xs font-bold text-muted">{r.k}</dt>
              <dd className="m-0 font-mono text-sm font-extrabold text-ink">{r.v}</dd>
            </div>
          ))}
        </dl>
      )}
```

Mobile `detail-screen.tsx`: replace the `PENDING(print-settings)` comment with, above the print card:

```tsx
      {printSettingRows(tutorial).length ? (
        <Section title="Files & print settings">
          <View style={styles.settings}>
            {printSettingRows(tutorial).map((r) => (
              <View key={r.k} style={styles.setting}>
                <Text style={styles.settingKey}>{r.k}</Text>
                <Text style={styles.settingValue}>{r.v}</Text>
              </View>
            ))}
          </View>
        </Section>
      ) : null}
```

styles `settings: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) }, setting: { width: '48%', padding: theme.spacing(2), borderRadius: theme.radii.field, backgroundColor: theme.colors.surfaceSunken }, settingKey: { fontFamily: theme.fonts.bold, fontSize: 12, color: theme.colors.muted }, settingValue: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.ink },`.

Mobile `stl-section.tsx`: under its lead, four fields that write through `save` (destructure it from `useDraft()`):

```tsx
        <Text style={styles.label}>Print settings</Text>
        {([
          ['layer_height_mm', 'Layer height (mm)', 'decimal-pad'],
          ['infill_percent', 'Infill (%)', 'number-pad'],
          ['print_minutes', 'Print time (minutes)', 'number-pad'],
        ] as const).map(([field, label, keyboardType]) => (
          <TextField
            key={field}
            label={label}
            accessibilityLabel={label}
            keyboardType={keyboardType}
            value={tutorial[field] == null ? '' : String(tutorial[field])}
            onChangeText={(text) => save({ [field]: text.trim() === '' ? null : Number(text) })}
          />
        ))}
        <TextField
          label="Material"
          accessibilityLabel="Material"
          placeholder="PETG"
          maxLength={40}
          value={tutorial.material ?? ''}
          onChangeText={(text) => save({ material: text.trim() ? text : null })}
        />
```

(add a `label` style matching details-section's if stl-section has none.)

Mobile `request-screen.tsx`: replace its PENDING comment and put the line in the info text:

```tsx
            The printer gives the time and the machine; you cover the filament. Settings come from the guide
            {printSettingsLine(guide) ? ` (${printSettingsLine(guide)})` : ''}, so the printer cannot change them by mistake.
```

Mobile `offer-screen.tsx`: replace its PENDING comment with

```tsx
          {tx.tutorial_print_settings && printSettingsLine(tx.tutorial_print_settings) ? (
            <Text style={styles.meta}>{printSettingsLine(tx.tutorial_print_settings)}</Text>
          ) : null}
```

(import `printSettingsLine` in both; widen the request screen's local `Guide` type with `PrintSettings` if it is a narrow pick.)

- [ ] **Step 4: Run the tests to see them pass**

Run the Step 2 commands, then `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/printing` and `pnpm --filter @splat-connect/api exec vitest run tests/unit/routes/toy-transactions.test.ts`. Expected: PASS.

- [ ] **Step 5: Ship the item** — `shipped: true` on `'print-settings'`; `node scripts/pending.mjs`; confirm `git grep "print-settings" -- packages` finds only `pending.ts`; no parity rule; drift test → `Tests  11 passed (11)`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/088_print_settings.sql packages/types/src packages/api packages/web packages/mobile docs/PENDING.md
git commit -m "feat(guides): a guide's layer height, infill, material and print time, on the guide and its print jobs (088)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 16: Works with and the starting toy (`guide-works-with`, migration 089)

**Files:**
- Create: `supabase/migrations/089_works_with.sql`
- Modify: `packages/types/src/index.ts` (`Tutorial` fields)
- Modify: `packages/api/src/routes/tutorials.ts` (`EDITABLE`, `fieldError`)
- Modify: `packages/web/components/edit-details-section.tsx`, `packages/web/app/tutorials/[id]/edit/page.tsx` (`saveDetails` type), `packages/web/components/tutorial-view.tsx` (rail)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/api/tests/integration/guides/works-with.test.ts` (new), `packages/web/tests/e2e/public/tutorial-detail.spec.ts`, `packages/web/tests/unit/components/edit-details-section.test.tsx`

**Interfaces:**
- Produces: `Tutorial.toy_name?`, `toy_brand?`, `works_with?`, `no_build_note?: string | null`.

- [ ] **Step 1: Write the failing tests**

`packages/api/tests/integration/guides/works-with.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createProject } from '../../helpers/orgs.js'

let author: TestUser
let guide: string
const patch = async (fields: Record<string, unknown>) => {
  const { data } = await adminClient().from('tutorials').select('updated_at').eq('id', guide).single()
  return app.request(`/api/tutorials/${guide}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${author.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...fields, updated_at: data!.updated_at }),
  })
}

beforeAll(async () => {
  author = await createTestUser('contributor')
  guide = await createProject({ authorId: author.id, status: 'draft', title: 'Works With Fixture' })
})
afterAll(async () => {
  await adminClient().from('tutorials').delete().eq('id', guide)
  await deleteTestUser(author.id)
})

describe('089 works with', () => {
  it('saves the starting toy, what it works with and the no-build note', async () => {
    const fields = {
      toy_name: 'Plush barking dog',
      toy_brand: 'ZURU',
      works_with: 'Any 3.5mm switch — Jelly Bean, Big Red, or a printed lever switch.',
      no_build_note: 'Two adapted copies of this toy are in the library right now.',
    }
    expect((await patch(fields)).status).toBe(200)
    const { data } = await adminClient().from('tutorials').select('toy_name, toy_brand, works_with, no_build_note').eq('id', guide).single()
    expect(data).toEqual(fields)
  })

  it('refuses each over its limit', async () => {
    for (const [field, max, label] of [['toy_name', 80, 'The toy’s name'], ['toy_brand', 80, 'The toy’s maker'], ['works_with', 300, 'Works with'], ['no_build_note', 300, 'The note for people who would rather not build']] as const) {
      const res = await patch({ [field]: 'x'.repeat(max + 1) })
      expect(res.status).toBe(400)
      expect(((await res.json()) as { error: string }).error).toBe(`${label} is over ${max} characters`)
    }
  })
})
```

`tutorial-detail.spec.ts` (append):

```ts
test('the rail names the starting toy, what it works with and the no-build note', async ({ page }) => {
  const contributor = await createContributor()
  const id = await createTutorial(contributor.id, { title: uniqueTitle('E2E Works With'), status: 'approved' })
  await adminClient().from('tutorials').update({
    toy_name: 'Plush barking dog',
    toy_brand: 'ZURU',
    works_with: 'Any 3.5mm switch',
    no_build_note: 'Two adapted copies are in the library right now.',
  }).eq('id', id)

  await page.goto(`/tutorials/${id}`)
  await expect(page.getByText('The toy you start with')).toBeVisible()
  await expect(page.getByText('Plush barking dog')).toBeVisible()
  await expect(page.getByText('by ZURU')).toBeVisible()
  await expect(page.getByText('Works with', { exact: true })).toBeVisible()
  await expect(page.getByText('Any 3.5mm switch')).toBeVisible()
  await expect(page.getByText('Two adapted copies are in the library right now.')).toBeVisible()
})
```

`edit-details-section.test.tsx` (append; uses the file's tutorial fixture and `onSave` mock):

```tsx
  it('saves Works with, the starting toy and the no-build note', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<EditDetailsSection tutorial={tutorialFixture} onSave={onSave} />)
    fireEvent.change(screen.getByLabelText('Works with'), { target: { value: 'Any 3.5mm switch' } })
    fireEvent.change(screen.getByLabelText('Toy'), { target: { value: 'Plush barking dog' } })
    fireEvent.change(screen.getByLabelText(/Made by/), { target: { value: 'ZURU' } })
    fireEvent.change(screen.getByLabelText(/rather not build it/), { target: { value: 'Ask Northside' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }))
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ works_with: 'Any 3.5mm switch', toy_name: 'Plush barking dog', toy_brand: 'ZURU', no_build_note: 'Ask Northside' }))
    )
  })
```

(use whatever the file names its tutorial fixture in place of `tutorialFixture`.)

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/guides/works-with.test.ts` → FAIL (column missing).
Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/components/edit-details-section.test.tsx` → FAIL (no `Works with` field).

- [ ] **Step 3: Implement**

`supabase/migrations/089_works_with.sql`:

```sql
-- 089 — the guide detail rail's two cards and the help card's note
-- (guide-works-with): the toy you start with, what it works with, and a note
-- for someone who would rather not build it. All optional.
--
-- DOWN:
--   alter table public.tutorials drop column if exists no_build_note,
--     drop column if exists works_with, drop column if exists toy_brand,
--     drop column if exists toy_name;

alter table public.tutorials
  add column toy_name text check (toy_name is null or length(toy_name) <= 80),
  add column toy_brand text check (toy_brand is null or length(toy_brand) <= 80),
  add column works_with text check (works_with is null or length(works_with) <= 300),
  add column no_build_note text check (no_build_note is null or length(no_build_note) <= 300);
```

Apply: `supabase migration up`.

`index.ts` `Tutorial`:

```ts
  /** 089. The toy the guide starts from, what it works with, and a note for
   *  someone who would rather not build it. All optional. */
  toy_name?: string | null
  toy_brand?: string | null
  works_with?: string | null
  no_build_note?: string | null
```

`tutorials.ts`: add the four to `EDITABLE`; in `fieldError` before `return null`:

```ts
  const LONG: [string, number, string][] = [
    ['toy_name', 80, 'The toy’s name'],
    ['toy_brand', 80, 'The toy’s maker'],
    ['works_with', 300, 'Works with'],
    ['no_build_note', 300, 'The note for people who would rather not build'],
  ]
  for (const [k, max, label] of LONG) {
    if (has(k) && !(typeof body[k] === 'string' && (body[k] as string).trim().length <= max)) return `${label} is over ${max} characters`
  }
```

Web `edit-details-section.tsx`: patch type (and the page's `saveDetails`) gain `toy_name: string | null; toy_brand: string | null; works_with: string | null; no_build_note: string | null`; in `handleSubmit`:

```ts
        toy_name: ((formData.get('toy_name') as string) ?? '').trim() || null,
        toy_brand: ((formData.get('toy_brand') as string) ?? '').trim() || null,
        works_with: ((formData.get('works_with') as string) ?? '').trim() || null,
        no_build_note: ((formData.get('no_build_note') as string) ?? '').trim() || null,
```

and after the description field:

```tsx
      <fieldset>
        <legend className="field-label">The toy you start with</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <label htmlFor="edit-toy-name" className="text-sm">Toy</label>
            <input id="edit-toy-name" name="toy_name" maxLength={80} defaultValue={tutorial.toy_name ?? ''} className="field" />
          </div>
          <div>
            <label htmlFor="edit-toy-brand" className="text-sm">Made by (optional)</label>
            <input id="edit-toy-brand" name="toy_brand" maxLength={80} defaultValue={tutorial.toy_brand ?? ''} placeholder="e.g. ZURU" className="field" />
          </div>
        </div>
      </fieldset>
      <div>
        <label htmlFor="edit-works-with" className="field-label">Works with</label>
        <input id="edit-works-with" name="works_with" maxLength={300} defaultValue={tutorial.works_with ?? ''} placeholder="Any 3.5mm switch — Jelly Bean, Big Red, or a printed lever switch." className="field" />
        <p className="mt-1 text-xs leading-relaxed text-muted">The switches this build accepts. Shown as its own card in the guide sidebar — a parent checks it before they start.</p>
      </div>
      <div>
        <label htmlFor="edit-no-build" className="field-label">If someone would rather not build it (optional)</label>
        <input id="edit-no-build" name="no_build_note" maxLength={300} defaultValue={tutorial.no_build_note ?? ''} placeholder="e.g. Organisation 2 keeps printed mounts on the shelf if you would rather not print one." className="field" />
        <p className="mt-1 text-xs leading-relaxed text-muted">Sits next to &ldquo;Get help with this build&rdquo; in the sidebar, before the link to the toy library. Leave blank and we just show the link.</p>
      </div>
```

Web `tutorial-view.tsx`: delete the `PENDING(guide-works-with)` lines from the rail comment; replace the help card's last paragraph's first sentence with the note when set:

```tsx
            {tutorial.no_build_note ?? 'Or skip the build — somebody nearby may have already made one.'}{' '}
```

and after the help card, inside `<aside>`:

```tsx
        {tutorial.toy_name && (
          <div className="flex items-center gap-3 rounded-card border border-line bg-surface p-[18px] text-ink">
            <ShoppingBag size={28} weight="duotone" className="flex-none" aria-hidden="true" />
            <div>
              <p className="m-0 text-xs font-extrabold uppercase tracking-[.08em] text-muted">The toy you start with</p>
              <p className="m-0 font-extrabold leading-[1.3]">{tutorial.toy_name}</p>
              {tutorial.toy_brand && <p className="m-0 text-sm text-muted">by {tutorial.toy_brand}</p>}
            </div>
          </div>
        )}
        {tutorial.works_with && (
          <div className="flex items-start gap-3 rounded-card border border-line bg-mint-soft p-[18px] text-ink">
            <HandTap size={28} weight="duotone" className="flex-none" aria-hidden="true" />
            <div>
              <p className="m-0 font-extrabold">Works with</p>
              <p className="m-0 text-sm leading-[1.5]">{tutorial.works_with}</p>
            </div>
          </div>
        )}
```

(import `ShoppingBag` from `@phosphor-icons/react/dist/ssr`; `HandTap` is already imported.)

Mobile: `grep -rn "toy_name" packages/mobile` — `toy_name` already exists on toy transactions (`ToyTransactionSummary.toy_name`), unrelated to `tutorials.toy_name`; nothing on mobile reads a tutorial's `toy_name`. No mobile change (registry platforms: web, api).

- [ ] **Step 4: Run the tests to see them pass**

Run the Step 2 commands and `pnpm --filter @splat-connect/web exec playwright test tests/e2e/public/tutorial-detail.spec.ts`. Expected: PASS.

- [ ] **Step 5: Ship the item** — `shipped: true` on `'guide-works-with'`; `node scripts/pending.mjs`; no parity rule; drift test → `Tests  11 passed (11)`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/089_works_with.sql packages/types/src packages/api packages/web docs/PENDING.md
git commit -m "feat(web): the guide rail names the starting toy, what it works with and a no-build note (089)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 17: The author's safety notes (`editor-safety-notes`, migration 090)

**Files:**
- Create: `supabase/migrations/090_tutorial_safety_notes.sql`
- Create: `packages/api/src/routes/safety-notes.ts`; Modify: `packages/api/src/app.ts` (mount), `packages/api/src/routes/sub-resource.ts` (42501 → 403), `packages/api/src/routes/tutorials.ts` and `public.ts` (embed + order)
- Modify: `packages/types/src/index.ts` (`TutorialSafetyNote`, `TutorialWithDetails.safety_notes`)
- Modify: `packages/mobile/lib/use-tutorial-draft.tsx` (`replaceSafetyNotes`), `packages/mobile/components/my-tutorials/sections/safety-section.tsx`, `packages/mobile/components/home/detail-screen.tsx`, `packages/mobile/lib/review-checklist.ts`
- Create: `packages/web/components/edit-safety-notes-section.tsx`; Modify: `packages/web/app/tutorials/[id]/edit/page.tsx` (details panel + `saveSafetyNotes`), `packages/web/components/tutorial-view.tsx` (Safety tab)
- Modify: `scripts/parity/app-screen-map.json` (`ed_safety`: delete its only rule and the `explained` key), `scripts/check-schema-guards.sh` (one row)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/api/tests/integration/guides/safety-notes.test.ts` (new), `packages/web/tests/unit/components/edit-safety-notes-section.test.tsx` (new), `packages/web/tests/unit/components/tutorial-view.test.tsx`, mobile `safety-section.test.tsx`, `detail-screen.test.tsx`, `review-checklist.test.ts`

**Interfaces:**
- Produces: `interface TutorialSafetyNote { id: string; tutorial_id: string; position: number; title: string; detail: string | null }`; `TutorialWithDetails.safety_notes?: TutorialSafetyNote[]` (both detail reads embed it, ordered); `POST/DELETE /api/tutorials/:id/safety-notes` with body `{ safety_notes: { title: string; detail?: string | null }[] }`; mobile `useDraft().replaceSafetyNotes(rows: SafetyNoteRow[])`, `type SafetyNoteRow = { title: string; detail: string | null }`.

- [ ] **Step 1: Write the failing tests**

`packages/api/tests/integration/guides/safety-notes.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createProject } from '../../helpers/orgs.js'

let author: TestUser
let stranger: TestUser
let guide: string
const post = (token: string, safety_notes: unknown) =>
  app.request(`/api/tutorials/${guide}/safety-notes`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ safety_notes }),
  })

beforeAll(async () => {
  author = await createTestUser('contributor')
  stranger = await createTestUser('contributor')
  guide = await createProject({ authorId: author.id, status: 'approved', title: 'Safety Notes Fixture' })
})
afterAll(async () => {
  await adminClient().from('tutorials').delete().eq('id', guide)
  await deleteTestUser(author.id)
  await deleteTestUser(stranger.id)
})

describe('090 tutorial_safety_notes', () => {
  it('exists', async () => {
    expect((await adminClient().from('tutorial_safety_notes').select('id, position, title, detail').limit(1)).error).toBeNull()
  })

  it('saves the list in order and serves it in both detail reads', async () => {
    const res = await post(author.token, [
      { title: 'Fluid and electronics share the enclosure', detail: 'The relay must sit above the waterline.' },
      { title: 'Battery door must be screwed shut' },
    ])
    expect(res.status).toBe(201)
    const pub = (await (await app.request(`/api/public/tutorials/${guide}`)).json()) as { safety_notes: { position: number; title: string }[] }
    expect(pub.safety_notes.map((n) => [n.position, n.title])).toEqual([
      [1, 'Fluid and electronics share the enclosure'],
      [2, 'Battery door must be screwed shut'],
    ])
    const own = (await (await app.request(`/api/tutorials/${guide}`, { headers: { Authorization: `Bearer ${author.token}` } })).json()) as { safety_notes: unknown[] }
    expect(own.safety_notes).toHaveLength(2)
  })

  it('refuses a stranger, a blank or long title, and a 21st note — and changes nothing', async () => {
    expect((await post(stranger.token, [{ title: 'Mine now' }])).status).toBe(403)
    const blank = await post(author.token, [{ title: '  ' }])
    expect(((await blank.json()) as { error: string }).error).toBe('Safety note 1 needs a title')
    expect((await post(author.token, [{ title: 'x'.repeat(81) }])).status).toBe(400)
    expect((await post(author.token, [{ title: 'ok', detail: 'x'.repeat(501) }])).status).toBe(400)
    expect((await post(author.token, Array.from({ length: 21 }, () => ({ title: 'ok' })))).status).toBe(400)
    const { count } = await adminClient().from('tutorial_safety_notes').select('id', { count: 'exact', head: true }).eq('tutorial_id', guide)
    expect(count).toBe(2)
  })
})
```

`packages/web/tests/unit/components/edit-safety-notes-section.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EditSafetyNotesSection } from '@/components/edit-safety-notes-section'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

describe('EditSafetyNotesSection', () => {
  it('adds a note and saves the list', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<EditSafetyNotesSection notes={[]} onSave={onSave} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add a safety note' }))
    fireEvent.change(screen.getByLabelText('Safety note 1 title'), { target: { value: 'Battery door must be screwed shut' } })
    fireEvent.change(screen.getByLabelText('Safety note 1 detail'), { target: { value: 'The base clips by default. Add the screw.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save safety notes' }))
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith([{ title: 'Battery door must be screwed shut', detail: 'The base clips by default. Add the screw.' }])
    )
  })
})
```

`tutorial-view.test.tsx` (append):

```tsx
  it('lists the author’s safety notes under the checklist', () => {
    render(
      <TutorialView
        signedIn
        tutorial={tutorial({ safety_declared_at: '2026-09-01T00:00:00Z', safety_notes: [{ id: 'n', tutorial_id: 't1', position: 1, title: 'Battery door must be screwed shut', detail: 'Add the screw.' }] })}
      />
    )
    fireEvent.click(screen.getByRole('tab', { name: 'Safety' }))
    expect(screen.getByText('Battery door must be screwed shut')).toBeInTheDocument()
    expect(screen.getByText('Add the screw.')).toBeInTheDocument()
  })
```

Mobile `safety-section.test.tsx` (add `replaceSafetyNotes: jest.fn()` to the file's `mockDraft`):

```tsx
it('adds a safety note and saves the list', () => {
  render(<SafetySection />)
  fireEvent.press(screen.getByText('+ Add a safety note'))
  fireEvent.changeText(screen.getByLabelText('Safety note 1 title'), 'Battery door must be screwed shut')
  expect(mockDraft.replaceSafetyNotes).toHaveBeenLastCalledWith([{ title: 'Battery door must be screwed shut', detail: null }])
})
```

Mobile `detail-screen.test.tsx`:

```tsx
  it('lists the author’s safety notes', async () => {
    mockEndpoints({ detail: Promise.resolve({ ...DETAIL, safety_notes: [{ id: 'n', tutorial_id: '1', position: 1, title: 'Battery door must be screwed shut', detail: 'Add the screw.' }] }) })
    render(<DetailScreen id="1" />)
    expect(await screen.findByText('Safety notes')).toBeTruthy()
    expect(screen.getByText('Battery door must be screwed shut')).toBeTruthy()
  })
```

`review-checklist.test.ts`:

```ts
it('counts the author’s safety notes', () => {
  const noted = { ...base, safety_notes: [{ title: 'a' }, { title: 'b' }] }
  expect(reviewRows(noted as never).find((r) => r.title === 'Safety notes')).toEqual({ title: 'Safety notes', meta: '2 notes · checklist affirmed', ok: true })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/guides/safety-notes.test.ts` → FAIL (`relation tutorial_safety_notes does not exist`).
Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/components/edit-safety-notes-section.test.tsx tests/unit/components/tutorial-view.test.tsx` → FAIL.
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/my-tutorials/safety-section.test.tsx tests/unit/components/home/detail-screen.test.tsx tests/unit/lib/review-checklist.test.ts` → FAIL.

- [ ] **Step 3: Implement**

`supabase/migrations/090_tutorial_safety_notes.sql`:

```sql
-- 090 — the author's own safety notes (editor-safety-notes, decided
-- 2026-09-30): a title and a detail each, alongside SAFETY_CHECKLIST.
-- Replaced whole on save, like parts and tools (sub-resource.ts), and read
-- the way 080's steps are: anyone on an approved guide, contributors their
-- own, admins all.
--
-- DOWN:
--   drop table if exists public.tutorial_safety_notes;

create table public.tutorial_safety_notes (
  id uuid primary key default gen_random_uuid(),
  tutorial_id uuid not null references public.tutorials (id) on delete cascade,
  position smallint not null check (position between 1 and 20),
  title text not null check (length(btrim(title)) between 1 and 80),
  detail text check (detail is null or length(detail) <= 500),
  created_at timestamptz not null default now()
);
create index tutorial_safety_notes_tutorial_idx on public.tutorial_safety_notes (tutorial_id, position);

alter table public.tutorial_safety_notes enable row level security;

create policy tutorial_safety_notes_read_approved on public.tutorial_safety_notes for select
  using (exists (select 1 from public.tutorials t where t.id = tutorial_id and t.status = 'approved'));
create policy tutorial_safety_notes_contributors on public.tutorial_safety_notes for all to authenticated
  using (public.is_tutorial_contributor(tutorial_id))
  with check (public.is_tutorial_contributor(tutorial_id));
create policy tutorial_safety_notes_admin on public.tutorial_safety_notes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
```

Apply: `supabase migration up`.

`sub-resource.ts`: the insert error line becomes

```ts
    // 23514: a CHECK refused a value. 42501: RLS refused — not this guide's contributor.
    if (error) return c.json({ error: error.message }, error.code === '23514' ? 400 : error.code === '42501' ? 403 : 500)
```

`packages/api/src/routes/safety-notes.ts`:

```ts
import { subResourceRoutes } from './sub-resource.js'

type SafetyNoteInput = { title: string; detail?: string | null }

const MAX_NOTES = 20

export function safetyNotesError(notes: SafetyNoteInput[]): string | null {
  if (notes.length > MAX_NOTES) return `A guide can have up to ${MAX_NOTES} safety notes`
  for (const [i, n] of notes.entries()) {
    const k = i + 1
    if (typeof n?.title !== 'string' || !n.title.trim()) return `Safety note ${k} needs a title`
    if (n.title.trim().length > 80) return `Safety note ${k}'s title is over 80 characters`
    if (n.detail != null && (typeof n.detail !== 'string' || n.detail.trim().length > 500)) return `Safety note ${k}'s detail is over 500 characters`
  }
  return null
}

export default subResourceRoutes<SafetyNoteInput>({
  path: 'safety-notes',
  table: 'tutorial_safety_notes',
  bodyKey: 'safety_notes',
  validate: safetyNotesError,
  mapRow: (n, tutorialId, i) => ({
    tutorial_id: tutorialId,
    position: i + 1,
    title: n.title.trim(),
    detail: n.detail?.trim() || null,
  }),
})
```

`app.ts`: `import safetyNotes from './routes/safety-notes.js'` and `app.route('/api/tutorials', safetyNotes)` after `tools`.

`tutorials.ts` GET `/:id` select: add `, safety_notes:tutorial_safety_notes(*)` after `steps:tutorial_steps(*)`, and `.order('position', { referencedTable: 'safety_notes', ascending: true })` beside the steps order. Same two edits in `public.ts`'s detail route.

`index.ts`:

```ts
/** 090. One of the author's own safety notes, beside SAFETY_CHECKLIST. */
export interface TutorialSafetyNote {
  id: string
  tutorial_id: string
  position: number
  title: string
  detail: string | null
}
```

and `TutorialWithDetails` gains `/** 090. Both detail routes embed them, ordered by position. */ safety_notes?: TutorialSafetyNote[]`.

Mobile `use-tutorial-draft.tsx`:

```ts
/** One editable safety note (090). Blank-titled rows are never sent. */
export interface SafetyNoteRow {
  title: string
  detail: string | null
}
```

`TutorialDraft` gains `/** Debounced replace-set POST of the author's safety notes. */ replaceSafetyNotes: (rows: SafetyNoteRow[]) => void`. Add `const pendingSafety = useRef<SafetyNoteRow[] | null>(null)`, and

```ts
  async function postSafetyNotes(rows: SafetyNoteRow[]) {
    const safety_notes = rows.filter((r) => r.title.trim()).map((r) => ({ title: r.title, detail: r.detail }))
    const saved = await apiClient.post<TutorialSafetyNote[]>(`/api/tutorials/${id}/safety-notes`, { safety_notes })
    setTutorial((prev) => (prev ? { ...prev, safety_notes: saved } : prev))
  }

  function replaceSafetyNotes(rows: SafetyNoteRow[]) {
    pendingSafety.current = rows
    schedule()
  }
```

In `drain()`: read and clear `const safety = pendingSafety.current; pendingSafety.current = null`, include `!safety` in the early-return condition, and `if (safety) await postSafetyNotes(safety)` after `putSteps`. Return `replaceSafetyNotes` from the hook. (Import `TutorialSafetyNote`.)

Mobile `safety-section.tsx`: replace the PendingButton with an editor seeded once from the draft:

```tsx
  const { tutorial, save, saveError, replaceSafetyNotes } = useDraft()
  const [notes, setNotes] = useState<SafetyNoteRow[]>(() =>
    (tutorial?.safety_notes ?? []).map((n) => ({ title: n.title, detail: n.detail }))
  )
  const commit = (next: SafetyNoteRow[]) => {
    setNotes(next)
    replaceSafetyNotes(next)
  }
```

```tsx
        <Text style={styles.label}>Your safety notes</Text>
        {notes.map((n, i) => (
          <View key={i} style={styles.note}>
            <TextField
              accessibilityLabel={`Safety note ${i + 1} title`}
              placeholder="Battery door must be screwed shut"
              maxLength={80}
              value={n.title}
              onChangeText={(title) => commit(notes.map((x, k) => (k === i ? { ...x, title } : x)))}
            />
            <TextField
              accessibilityLabel={`Safety note ${i + 1} detail`}
              placeholder="The base clips by default. Add the screw."
              maxLength={500}
              multiline
              value={n.detail ?? ''}
              onChangeText={(detail) => commit(notes.map((x, k) => (k === i ? { ...x, detail: detail || null } : x)))}
            />
            <Button label="Remove" variant="ghost" onPress={() => commit(notes.filter((_, k) => k !== i))} />
          </View>
        ))}
        {notes.length < 20 ? (
          <Button label="+ Add a safety note" variant="ghost" onPress={() => commit([...notes, { title: '', detail: null }])} />
        ) : null}
```

(imports: `useState`, `View`, `TextField`, `Button`, `type SafetyNoteRow`; drop `PendingButton`. Styles: `label` like the lead but `theme.fonts.bold`/`theme.colors.ink` with `marginTop: theme.spacing(5)`, and `note: { marginBottom: theme.spacing(3) }`.)

Mobile `detail-screen.tsx`, after the Tools section:

```tsx
      {tutorial.safety_notes?.length ? (
        <Section title="Safety notes">
          {tutorial.safety_notes.map((n) => (
            <View key={n.id} style={styles.safetyNote}>
              <Text style={styles.safetyTitle}>{n.title}</Text>
              {n.detail ? <Text style={styles.description}>{n.detail}</Text> : null}
            </View>
          ))}
        </Section>
      ) : null}
```

(`TutorialDetail` gains `safety_notes?: TutorialSafetyNote[]`; styles `safetyNote: { paddingVertical: theme.spacing(2), gap: theme.spacing(1) }, safetyTitle: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.ink },`.)

Mobile `review-checklist.ts` Safety row:

```ts
    {
      title: 'Safety notes',
      meta: [t.safety_notes?.length ? count(t.safety_notes.length, 'note') : null, t.safety_declared_at ? 'checklist affirmed' : 'checklist not affirmed']
        .filter(Boolean)
        .join(' · ')
        .replace(/^c/, 'C'),
      ok: Boolean(t.safety_declared_at),
    },
```

(so the earlier expectations `'Checklist affirmed'` / `'Checklist not affirmed'` still hold.)

`packages/web/components/edit-safety-notes-section.tsx`:

```tsx
'use client'
/**
 * The author's own safety notes (090), under the details form: a title and a
 * detail each, saved as one list. Anything that could hurt a child, stated
 * plainly — the board's lead for this section.
 */
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Note = { title: string; detail: string | null }

export function EditSafetyNotesSection({ notes: initial, onSave }: { notes: Note[]; onSave: (notes: Note[]) => Promise<void> }) {
  const [notes, setNotes] = useState<Note[]>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const edit = (i: number, patch: Partial<Note>) => setNotes((ns) => ns.map((n, k) => (k === i ? { ...n, ...patch } : n)))

  return (
    <section className="flex flex-col gap-3 px-5 pb-5" aria-labelledby="safety-notes-h">
      <h3 id="safety-notes-h" className="field-label">Safety notes</h3>
      <p className="m-0 text-xs leading-relaxed text-muted">Anything that could hurt a child, stated plainly.</p>
      {notes.map((n, i) => (
        <div key={i} className="flex flex-col gap-2">
          <input aria-label={`Safety note ${i + 1} title`} maxLength={80} value={n.title} onChange={(e) => edit(i, { title: e.target.value })} className="field" placeholder="Battery door must be screwed shut" />
          <textarea aria-label={`Safety note ${i + 1} detail`} maxLength={500} rows={2} value={n.detail ?? ''} onChange={(e) => edit(i, { detail: e.target.value || null })} className="field" />
          <button type="button" onClick={() => setNotes((ns) => ns.filter((_, k) => k !== i))} className="btn btn-quiet btn-sm self-start">Remove</button>
        </div>
      ))}
      {notes.length < 20 && (
        <button type="button" onClick={() => setNotes((ns) => [...ns, { title: '', detail: null }])} className="btn btn-quiet btn-sm self-start">
          Add a safety note
        </button>
      )}
      {error && <p role="alert" className="alert alert-danger">{error}</p>}
      <button
        type="button"
        disabled={saving}
        onClick={async () => {
          setSaving(true)
          setError(null)
          try {
            await onSave(notes.filter((n) => n.title.trim()).map((n) => ({ title: n.title.trim(), detail: n.detail?.trim() || null })))
            router.refresh()
          } catch {
            setError('Could not save the safety notes. Please try again.')
          } finally {
            setSaving(false)
          }
        }}
        className="btn btn-primary btn-sm self-start"
      >
        {saving ? 'Saving…' : 'Save safety notes'}
      </button>
    </section>
  )
}
```

Web edit page: add

```ts
  async function saveSafetyNotes(notes: { title: string; detail: string | null }[]) {
    'use server'
    await apiClient.post(`/api/tutorials/${id}/safety-notes`, { safety_notes: notes })
    revalidatePath(`/tutorials/${id}/edit`)
  }
```

and in the details step's panel, after `EditDetailsSection`: `<EditSafetyNotesSection notes={(tutorial.safety_notes ?? []).map((n) => ({ title: n.title, detail: n.detail }))} onSave={saveSafetyNotes} />`.

Web `tutorial-view.tsx`: the `safety` block becomes a fragment with the checklist then

```tsx
      {(tutorial.safety_notes ?? []).length > 0 && (
        <ul className="m-0 mt-4 flex list-none flex-col gap-3 p-0">
          {tutorial.safety_notes!.map((n) => (
            <li key={n.id} className="rounded-[var(--radius-inset)] border border-line bg-surface p-4">
              <p className="m-0 font-extrabold text-ink">{n.title}</p>
              {n.detail && <p className="m-0 mt-1 text-sm leading-[1.55] text-ink">{n.detail}</p>}
            </li>
          ))}
        </ul>
      )}
```

and the Safety tab shows when `tutorial.safety_declared_at || (tutorial.safety_notes ?? []).length > 0`.

`check-schema-guards.sh`, before the closing `) as t(guard, ok)`:

```sql
  -- 090. Notes on unpublished drafts are the author's until approval.
  ('090 tutorial_safety_notes has RLS on',
   (select relrowsecurity from pg_class where oid = 'public.tutorial_safety_notes'::regclass)),
```

(and add a comma after the 084 row it now follows.)

- [ ] **Step 4: Run the tests to see them pass**

Run the Step 2 commands. Expected: PASS.

- [ ] **Step 5: Ship the item** — `shipped: true` on `'editor-safety-notes'`; `node scripts/pending.mjs`; in `scripts/parity/app-screen-map.json` delete `ed_safety`'s rule naming `editor-safety-notes` and its now-empty `explained` key; drift test → `Tests  11 passed (11)`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/090_tutorial_safety_notes.sql scripts/check-schema-guards.sh scripts/parity/app-screen-map.json packages/types/src packages/api packages/web packages/mobile docs/PENDING.md
git commit -m "feat(guides): the author's own safety notes, edited on both platforms and shown on the guide (090)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 18: Mark this build done, the builds count and the 100-builds badge (`guide-build-done`, migration 091)

**Files:**
- Create: `supabase/migrations/091_tutorial_builds.sql`
- Modify: `packages/api/src/routes/tutorials.ts` (`POST`/`DELETE /:id/build`), `packages/api/src/routes/me.ts` (`GET /builds`), `packages/api/src/routes/public.ts` (contributor profile: `builds_count`, `builds`, badges)
- Modify: `packages/types/src/contributor-badges.ts`, `packages/types/src/index.ts` (`ContributorProfile.builds`, `Tutorial.builds_count`)
- Create: `packages/web/components/mark-build-done-button.tsx`; Modify: `packages/web/app/tutorials/[id]/page.tsx`, `packages/web/app/contributors/[id]/page.tsx`, `packages/web/app/dashboard/page.tsx`
- Modify: `packages/mobile/components/home/detail-screen.tsx` (completion card), `packages/mobile/app/(tabs)/me.tsx`
- Modify: `scripts/check-schema-guards.sh`, `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/api/tests/integration/guides/builds.test.ts` (new), `packages/web/tests/unit/lib/contributor-badges.test.ts`, `packages/web/tests/unit/components/mark-build-done-button.test.tsx` (new), mobile `detail-screen.test.tsx`, `me.test.tsx`, `packages/mobile/tests/unit/components/ui/pending.test.tsx`

**Interfaces:**
- Produces: `POST /api/tutorials/:id/build` → `201 { built: true }` (idempotent; 404 unless approved); `DELETE /api/tutorials/:id/build` → 204; `GET /api/me/builds` → `{ builds: number }`; `builds_count(tutorials)` computed field; `ContributorBadgeInput = { guides: number; builds: number; orgBacked: boolean; since: string }`; `ContributorProfile.builds?: number`.

- [ ] **Step 1: Write the failing tests**

`packages/api/tests/integration/guides/builds.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createProject } from '../../helpers/orgs.js'

let author: TestUser
let parent: TestUser
let guide: string
let draft: string
const call = (method: string, path: string, token: string) => app.request(path, { method, headers: { Authorization: `Bearer ${token}` } })
const stamp = async () => (await adminClient().from('tutorials').select('updated_at').eq('id', guide).single()).data!.updated_at

beforeAll(async () => {
  author = await createTestUser('contributor')
  parent = await createTestUser('contributor')
  guide = await createProject({ authorId: author.id, status: 'approved', title: 'Builds Fixture' })
  draft = await createProject({ authorId: author.id, status: 'draft', title: 'Builds Draft Fixture' })
})
afterAll(async () => {
  await adminClient().from('tutorials').delete().in('id', [guide, draft])
  await deleteTestUser(author.id)
  await deleteTestUser(parent.id)
})

describe('091 tutorial_builds', () => {
  it('logs a build once, however many taps, and counts it without touching the guide', async () => {
    const before = await stamp()
    expect((await call('POST', `/api/tutorials/${guide}/build`, parent.token)).status).toBe(201)
    expect((await call('POST', `/api/tutorials/${guide}/build`, parent.token)).status).toBe(201)
    const { data } = await adminClient().from('tutorials').select('builds_count, updated_at').eq('id', guide).single()
    expect(data).toEqual({ builds_count: 1, updated_at: before })
  })

  it('tells the member their own count, and nobody else whose builds they are', async () => {
    const mine = await call('GET', '/api/me/builds', parent.token)
    expect(await mine.json()).toEqual({ builds: 1 })
    expect(await (await call('GET', '/api/me/builds', author.token)).json()).toEqual({ builds: 0 })
  })

  it('refuses a guide that is not published', async () => {
    expect((await call('POST', `/api/tutorials/${draft}/build`, parent.token)).status).toBe(404)
  })

  it('takes a build back', async () => {
    expect((await call('DELETE', `/api/tutorials/${guide}/build`, parent.token)).status).toBe(204)
    expect(await (await call('GET', '/api/me/builds', parent.token)).json()).toEqual({ builds: 0 })
  })
})
```

`contributor-badges.test.ts`: replace the `thanks: n` inputs with `builds: n` throughout and the stacking test with:

```ts
  it('stacks the guide tiers and awards 100 builds', () => {
    expect(ids({ guides: 25, builds: 100, orgBacked: false, since: '2026-09-01T00:00:00Z' })).toEqual([
      'first-guide', 'guides-10', 'guides-25', 'builds-100',
    ])
    expect(ids({ guides: 0, builds: 99, orgBacked: false, since: '2026-09-01T00:00:00Z' })).toEqual([])
  })
```

`packages/web/tests/unit/components/mark-build-done-button.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MarkBuildDoneButton } from '@/components/mark-build-done-button'

const mockPost = vi.fn().mockResolvedValue({ built: true })
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { post: (...a: unknown[]) => mockPost(...a) } }))
const mockToast = vi.fn()
vi.mock('@/components/toast', () => ({ useToast: () => mockToast }))

describe('MarkBuildDoneButton', () => {
  it('logs the build and says so', async () => {
    render(<MarkBuildDoneButton tutorialId="t1" />)
    fireEvent.click(screen.getByRole('button', { name: 'Mark this build done' }))
    await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/tutorials/t1/build', {}))
    expect(mockToast).toHaveBeenCalledWith('Build logged — nice work')
    expect(screen.getByRole('button', { name: 'Build logged' })).toBeDisabled()
  })
})
```

Mobile `detail-screen.test.tsx` — add `post: jest.fn()` to the api-client mock (`apiClient: { get: jest.fn(), post: jest.fn() }`) and:

```tsx
  it('logs the build once every step is ticked', async () => {
    ;(apiClient.post as jest.Mock).mockResolvedValue({ built: true })
    mockEndpoints({ detail: Promise.resolve({ ...DETAIL, steps: [{ id: 's1', tutorial_id: '1', position: 1, title: 'Open it', body: 'One screw.', photo_url: null }] }) })
    render(<DetailScreen id="1" />)
    fireEvent.press(await screen.findByLabelText('Mark step 1 done'))
    fireEvent.press(screen.getByText('Mark this build done'))
    await waitFor(() => expect(apiClient.post).toHaveBeenCalledWith('/api/tutorials/1/build', {}))
    expect(await screen.findByText('Build logged — nice work')).toBeTruthy()
  })
```

Mobile `me.test.tsx` (route `/api/me/builds` in its GET mock to `{ builds: 3 }`):

```tsx
  it('shows the builds you have logged', async () => {
    render(<MeTab />)
    expect(await screen.findByText('3 builds logged')).toBeTruthy()
  })
```

`pending.test.tsx`: change both `guide-build-done` strings to `print-answer-by` (an open item — a test of a pending control should not name a shipped one).

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/guides/builds.test.ts` → FAIL (404 route / missing relation).
Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/lib/contributor-badges.test.ts tests/unit/components/mark-build-done-button.test.tsx` → FAIL.
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/home/detail-screen.test.tsx tests/unit/app/me.test.tsx` → FAIL.

- [ ] **Step 3: Implement**

`supabase/migrations/091_tutorial_builds.sql`:

```sql
-- 091 — Mark this build done (guide-build-done, decided 2026-09-30).
--
--   tutorial_builds          one row per member per guide. Private: who built
--                            what says which accounts have a disabled child,
--                            the same reason 066 gives for tutorial_thanks.
--   builds_count(tutorials)  the public number, as a computed field — never a
--                            column on tutorials (014's trigger + PATCH 409).
--
-- DOWN:
--   drop function if exists public.builds_count(public.tutorials);
--   drop table if exists public.tutorial_builds;

create table public.tutorial_builds (
  tutorial_id uuid not null references public.tutorials (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  built_at    timestamptz not null default now(),
  primary key (tutorial_id, profile_id)
);
create index tutorial_builds_profile_idx on public.tutorial_builds (profile_id);

alter table public.tutorial_builds enable row level security;

create policy "Read your own builds" on public.tutorial_builds for select
  using (profile_id = auth.uid());
-- Only a published guide can be built from.
create policy "Log a build as yourself" on public.tutorial_builds for insert
  with check (
    profile_id = auth.uid()
    and exists (select 1 from public.tutorials t where t.id = tutorial_id and t.status = 'approved')
  );
create policy "Take back your own build" on public.tutorial_builds for delete
  using (profile_id = auth.uid());

create or replace function public.builds_count(t public.tutorials)
returns int
language sql stable security definer set search_path = ''
as $$
  select count(*)::int from public.tutorial_builds where tutorial_id = t.id
$$;
```

Apply: `supabase migration up`.

`tutorials.ts`, after the thanks routes:

```ts
/**
 * Mark this build done (091). Idempotent: a second tap is the same build.
 * RLS's insert check is what refuses a guide that is not published.
 */
tutorials.post('/:id/build', async (c) => {
  const { error } = await createUserClient(c.get('token'))
    .from('tutorial_builds')
    .upsert({ tutorial_id: c.req.param('id'), profile_id: c.get('userId') }, { onConflict: 'tutorial_id,profile_id', ignoreDuplicates: true })
  // 42501: RLS refused (not published); 22P02: not a uuid; 23503: no such guide.
  if (error && ['42501', '22P02', '23503'].includes(error.code)) return c.json({ error: 'Not found' }, 404)
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ built: true }, 201)
})

tutorials.delete('/:id/build', async (c) => {
  const { error } = await createUserClient(c.get('token'))
    .from('tutorial_builds')
    .delete()
    .eq('tutorial_id', c.req.param('id'))
    .eq('profile_id', c.get('userId'))
  if (error) return c.json({ error: error.message }, 500)
  return c.body(null, 204)
})
```

`me.ts` (import `createUserClient`):

```ts
/** "N builds logged" on My SPLAT (091). RLS shows a member only their own rows. */
me.get('/builds', async (c) => {
  const { count, error } = await createUserClient(c.get('token'))
    .from('tutorial_builds')
    .select('tutorial_id', { count: 'exact', head: true })
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ builds: count ?? 0 })
})
```

`contributor-badges.ts` — rewrite the header's second paragraph and the function:

```ts
/**
 * The badges on a public contributor profile, derived from counts the
 * profile endpoint already has — nothing is stored, so nothing can be
 * awarded by asking ("Earned by doing, not by asking", as the board puts it).
 *
 * The board's set is First guide / 10 guides / 25 guides / Org leader /
 * 100 builds / Clinic host. Builds are logged by families (091) and summed
 * over the person's published guides. Clinics are not in the data model.
 * "Org leader" is drawn from a guide backed by an organisation (tutorial_orgs
 * accepted), which is public; org_leaders is not. Only earned badges are
 * returned — a list of what somebody has NOT done is not a profile.
 */
export interface ContributorBadge {
  id: string
  label: string
}

export interface ContributorBadgeInput {
  guides: number
  /** Builds logged from this person's published guides (091). */
  builds: number
  orgBacked: boolean
  /** profiles.created_at */
  since: string
}

export function contributorBadges(input: ContributorBadgeInput, now: Date = new Date()): ContributorBadge[] {
  const out: ContributorBadge[] = []
  if (input.guides >= 1) out.push({ id: 'first-guide', label: 'First guide' })
  if (input.guides >= 10) out.push({ id: 'guides-10', label: '10 guides' })
  if (input.guides >= 25) out.push({ id: 'guides-25', label: '25 guides' })
  if (input.orgBacked) out.push({ id: 'org-backed', label: 'Org backed' })
  if (input.builds >= 100) out.push({ id: 'builds-100', label: '100 builds' })
  const years = Math.floor((now.getTime() - new Date(input.since).getTime()) / 31_557_600_000)
  if (years >= 1) out.push({ id: `years-${years}`, label: years === 1 ? '1 year on SPLAT' : `${years} years on SPLAT` })
  return out
}
```

(the badge order in the expected list follows this push order.)

`public.ts` contributor profile: select `tutorials!inner(*, thanks_count, builds_count)`; after `const thanks = …` add `const builds = guides.reduce((n, t) => n + (t.builds_count ?? 0), 0)`; set `builds,` in `result` and `badges: contributorBadges({ guides: guides.length, builds, orgBacked, since: profile.created_at })`. `grep -rn "contributorBadges(" packages` must show no other caller passing `thanks`.

`index.ts`: `Tutorial` gains `/** 091. Present only when a select names it. */ builds_count?: number`; `ContributorProfile` gains `/** 091. Builds logged over `tutorials`. */ builds?: number`.

`packages/web/components/mark-build-done-button.tsx`:

```tsx
'use client'
/**
 * Mark this build done (091): one tap logs it to My SPLAT. Idempotent on the
 * server, so a second tab's tap is harmless; the button settles on "Build logged".
 */
import { useState } from 'react'
import { CheckCircle } from '@phosphor-icons/react/dist/ssr'
import { browserApiClient } from '@/lib/browser-api-client'
import { useToast } from '@/components/toast'

export function MarkBuildDoneButton({ tutorialId }: { tutorialId: string }) {
  const [done, setDone] = useState(false)
  const [pending, setPending] = useState(false)
  const showToast = useToast()
  return (
    <button
      type="button"
      disabled={done || pending}
      onClick={async () => {
        setPending(true)
        try {
          await browserApiClient.post(`/api/tutorials/${tutorialId}/build`, {})
          setDone(true)
          showToast('Build logged — nice work')
        } catch {
          showToast('Could not log that. Try again.')
        } finally {
          setPending(false)
        }
      }}
      className="btn btn-quiet btn-sm gap-2"
    >
      <CheckCircle weight="bold" aria-hidden="true" />
      {done ? 'Build logged' : 'Mark this build done'}
    </button>
  )
}
```

`app/tutorials/[id]/page.tsx`: in the signed-in `actions` fragment, after `ThanksButton`: `<MarkBuildDoneButton tutorialId={tutorial.id} />` (import it).

`app/contributors/[id]/page.tsx`: `const builds = contributor.builds ?? 0`; show the thanks section when `thanks > 0 || builds > 0`, add the jump `{ to: 'ctb-thanks', label: 'Thanks', show: thanks > 0 || builds > 0 }`, and inside the section before the thanks paragraph: `{builds > 0 && <p className="m-0 font-display text-xl font-extrabold text-ink">{builds} builds logged</p>}`.

`app/dashboard/page.tsx`: add to the `Promise.all` `apiClient.get<{ builds: number }>('/api/me/builds').catch(() => ({ builds: 0 }))` (destructure as `logged`), and under the hero paragraph: `{logged.builds > 0 && <p className="mt-2 text-sm font-bold text-ink">{logged.builds} builds logged</p>}`.

Mobile `detail-screen.tsx`: add `const [built, setBuilt] = useState(false)` and `const [flash, setFlash] = useFlash()`; in the completion card replace the PendingButton with:

```tsx
              <Button
                label={built ? 'Build logged' : 'Mark this build done'}
                disabled={built}
                onPress={async () => {
                  try {
                    await apiClient.post(`/api/tutorials/${tutorial.id}/build`, {})
                    setBuilt(true)
                    setFlash('Build logged — nice work')
                  } catch {
                    setFlash('Could not log that. Try again.')
                  }
                }}
              />
              <FlashLine message={flash} />
```

(import `useFlash, FlashLine` from `../ui/Flash`.)

Mobile `me.tsx`: `const [builds, setBuilds] = useState(0)`, and in the effect `apiClient.get<{ builds: number }>('/api/me/builds').then((b) => { if (!ignore) setBuilds(b.builds) }).catch(() => {})`; under the standing line in the hero: `{builds > 0 ? <Text style={styles.meta}>{`${builds} builds logged`}</Text> : null}`.

`check-schema-guards.sh` (after the 090 row):

```sql
  -- 091. Who built which guide says which accounts have a disabled child.
  ('091 tutorial_builds has RLS on',
   (select relrowsecurity from pg_class where oid = 'public.tutorial_builds'::regclass)),
```

- [ ] **Step 4: Run the tests to see them pass**

Run the Step 2 commands plus `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/ui/pending.test.tsx` and `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/public/contributor-profile.test.ts`. Expected: PASS (update any `thanks-10` expectation in the contributor-profile integration test to the new badge set).

- [ ] **Step 5: Ship the item** — `shipped: true` on `'guide-build-done'`; `node scripts/pending.mjs`; no parity rule; drift test → `Tests  11 passed (11)`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/091_tutorial_builds.sql scripts/check-schema-guards.sh packages/types/src packages/api packages/web packages/mobile docs/PENDING.md
git commit -m "feat(guides): Mark this build done on web and mobile, builds logged on My SPLAT and the 100 builds badge (091)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 19: Views on My tutorials (`my-tutorials-views`, migration 092)

**Files:**
- Create: `supabase/migrations/092_tutorial_view_counts.sql`
- Modify: `packages/api/src/routes/public.ts` (detail route bumps), `packages/api/src/routes/tutorials.ts` (`/mine` selects `view_count`)
- Modify: `packages/types/src/index.ts` (`Tutorial.view_count`)
- Modify: `packages/mobile/components/my-tutorials/list-screen.tsx` (`tutorialMeta`, `formatViews`)
- Modify: `scripts/check-schema-guards.sh`, `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/api/tests/integration/guides/views.test.ts` (new), `packages/api/tests/unit/routes/public-views.test.ts` (new), mobile `list-screen.test.tsx`

**Interfaces:**
- Produces: `view_count(tutorials)` computed field (bigint → number in JSON); `bump_tutorial_view(p_tutorial_id uuid)` callable by service role only; `formatViews(n: number): string` exported from `list-screen.tsx`.

- [ ] **Step 1: Write the failing tests**

`packages/api/tests/integration/guides/views.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createProject } from '../../helpers/orgs.js'

let author: TestUser
let guide: string

beforeAll(async () => {
  author = await createTestUser('contributor')
  guide = await createProject({ authorId: author.id, status: 'approved', title: 'Views Fixture' })
})
afterAll(async () => {
  await adminClient().from('tutorials').delete().eq('id', guide)
  await deleteTestUser(author.id)
})

describe('092 tutorial_view_counts', () => {
  it('counts every public read without touching the guide', async () => {
    const before = (await adminClient().from('tutorials').select('updated_at').eq('id', guide).single()).data!.updated_at
    await app.request(`/api/public/tutorials/${guide}`)
    await app.request(`/api/public/tutorials/${guide}`)
    const { data } = await adminClient().from('tutorials').select('view_count, updated_at').eq('id', guide).single()
    expect(data).toEqual({ view_count: 2, updated_at: before })
  })

  it('shows the count on the author’s own list', async () => {
    const res = await app.request('/api/tutorials/mine', { headers: { Authorization: `Bearer ${author.token}` } })
    const row = ((await res.json()) as { id: string; view_count: number }[]).find((r) => r.id === guide)
    expect(row?.view_count).toBe(2)
  })

  it('cannot be bumped by a client', async () => {
    const anon = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!)
    const { error } = await anon.rpc('bump_tutorial_view', { p_tutorial_id: guide })
    expect(error).not.toBeNull()
  })
})
```

`packages/api/tests/unit/routes/public-views.test.ts` — Review Focus 5:

```ts
import { describe, it, expect, vi } from 'vitest'

const chain: Record<string, unknown> = {}
for (const m of ['from', 'select', 'eq', 'order']) chain[m] = () => chain
chain.single = async () => ({ data: { id: 'g1', title: 'Guide', tutorial_orgs: [], tutorial_recommendations: [], tutorial_contributors: [] }, error: null })
const mockRpc = vi.fn()
vi.mock('../../../src/supabase/client.js', () => ({
  createAnonClient: () => chain,
  createAdminClient: () => ({ rpc: (...a: unknown[]) => mockRpc(...a) }),
}))

const { default: publicRoutes } = await import('../../../src/routes/public.js')

describe('GET /tutorials/:id views', () => {
  it('still answers when the view cannot be counted', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'function bump_tutorial_view does not exist' } })
    const res = await publicRoutes.request('/tutorials/g1')
    expect(res.status).toBe(200)
    expect(mockRpc).toHaveBeenCalledWith('bump_tutorial_view', { p_tutorial_id: 'g1' })
  })

  it('still answers when the call throws', async () => {
    mockRpc.mockRejectedValue(new Error('fetch failed'))
    expect((await publicRoutes.request('/tutorials/g1')).status).toBe(200)
  })
})
```

Mobile `list-screen.test.tsx`:

```tsx
  it('shows a published guide’s views and who backs it', async () => {
    mockGet.mockResolvedValue([
      tutorial({ id: 'l', title: 'Light-up drum', status: 'approved', view_count: 2100, tutorial_orgs: [{ id: 'b', status: 'accepted', org_id: 'o', requested_at: '', organizations: { id: 'o', name: 'Northside Therapy' } }] }),
      tutorial({ id: 'r', title: 'Remote car', status: 'approved', view_count: 890, tutorial_orgs: [] }),
    ])
    render(<MyTutorialsListScreen />)
    expect(await screen.findByText('2.1k views · Northside Therapy')).toBeTruthy()
    expect(screen.getByText('890 views')).toBeTruthy()
  })
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/guides/views.test.ts` → FAIL (`column tutorials.view_count does not exist`).
Run: `pnpm --filter @splat-connect/api exec vitest run tests/unit/routes/public-views.test.ts` → FAIL (`mockRpc` never called).
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/my-tutorials/list-screen.test.tsx` → FAIL.

- [ ] **Step 3: Implement**

`supabase/migrations/092_tutorial_view_counts.sql`:

```sql
-- 092 — how many times a guide has been opened (my-tutorials-views, decided
-- 2026-09-30). Its own table: a column on tutorials would be stamped onto
-- updated_at by 014's trigger and 409 the author mid-edit.
--
--   tutorial_view_counts       one row per guide. No client policies: only the
--                              two functions below touch it.
--   bump_tutorial_view(uuid)   +1, called by the public guide read with the
--                              service role. Never by a client.
--   view_count(tutorials)      the number, as a computed field.
--
-- ponytail: raw reads, no bot or repeat filtering. Filter by user agent in
-- public.ts if the numbers ever start deciding something.
--
-- DOWN:
--   drop function if exists public.view_count(public.tutorials);
--   drop function if exists public.bump_tutorial_view(uuid);
--   drop table if exists public.tutorial_view_counts;

create table public.tutorial_view_counts (
  tutorial_id uuid primary key references public.tutorials (id) on delete cascade,
  views bigint not null default 0
);
alter table public.tutorial_view_counts enable row level security;

create or replace function public.bump_tutorial_view(p_tutorial_id uuid)
returns void
language sql volatile security definer set search_path = ''
as $$
  insert into public.tutorial_view_counts (tutorial_id, views) values (p_tutorial_id, 1)
  on conflict (tutorial_id) do update set views = public.tutorial_view_counts.views + 1
$$;
revoke all on function public.bump_tutorial_view(uuid) from public, anon, authenticated;
grant execute on function public.bump_tutorial_view(uuid) to service_role;

create or replace function public.view_count(t public.tutorials)
returns bigint
language sql stable security definer set search_path = ''
as $$
  select coalesce((select views from public.tutorial_view_counts where tutorial_id = t.id), 0)
$$;
```

Apply: `supabase migration up`.

`public.ts` detail route, after the `if (error) return …404` line:

```ts
  // 092. Counted, never awaited into a failure: a view that cannot be counted
  // is not a reason to refuse the guide.
  try {
    const { error: viewError } = await createAdminClient().rpc('bump_tutorial_view', { p_tutorial_id: c.req.param('id') })
    if (viewError) console.error('[public guide] view not counted:', viewError.message)
  } catch (err) {
    console.error('[public guide] view not counted:', err)
  }
```

`tutorials.ts` `/mine` select: `` `${LIST_SELECT}, view_count, parts(id), tools(id), stl_files(id), steps:tutorial_steps(id)` ``.

`index.ts` `Tutorial`: `/** 092. Present only on /api/tutorials/mine. */ view_count?: number`.

`list-screen.tsx`: delete the `PENDING(my-tutorials-views)` line, and add/replace:

```ts
/** "890", "2.1k" — the board's view counts. */
export function formatViews(n: number): string {
  return n < 1000 ? String(n) : `${Math.round(n / 100) / 10}k`
}
```

with the last line of `tutorialMeta` becoming:

```ts
  const backer = orgs.find((o) => o.status === 'accepted')?.organizations?.name
  if (t.status === 'approved') return [`${formatViews(t.view_count ?? 0)} views`, backer].filter(Boolean).join(' · ')
  return [`${KIND_LABEL[t.kind]} · ${t.difficulty}`, backer].filter(Boolean).join(' · ')
```

`check-schema-guards.sh` (after the 091 row):

```sql
  -- 092. Callable by a client, anyone could inflate any guide's views.
  ('092 bump_tutorial_view() is service-role only',
   (select count(*) = 1 from pg_proc p
      where p.proname = 'bump_tutorial_view' and p.pronamespace = 'public'::regnamespace
        and not has_function_privilege('authenticated', p.oid, 'execute')
        and not has_function_privilege('anon', p.oid, 'execute'))),
```

- [ ] **Step 4: Run the tests to see them pass**

Run the Step 2 commands. Expected: PASS.

- [ ] **Step 5: Ship the item** — `shipped: true` on `'my-tutorials-views'`; `node scripts/pending.mjs`; no parity rule; drift test → `Tests  11 passed (11)`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/092_tutorial_view_counts.sql scripts/check-schema-guards.sh packages/types/src packages/api packages/mobile docs/PENDING.md
git commit -m "feat(guides): count guide views in their own table and show them on My tutorials (092)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 20: Community notes, pinned revisions and the banner (`guide-community-notes`, migration 093)

A note is attached to a step **by position**, not by `tutorial_steps.id`: 080's steps PUT inserts new rows and deletes the old ones on every save, so a `step_id … on delete set null` would turn every note into "Missing step" the first time the author saved. `step_position` null — or past the guide's last step — is "Missing step"; a pinned one is drawn as an extra step at the end. Reads are public (`GET /api/public/tutorials/:id/notes`, so the signed-out web page can show pinned revisions); writes are authenticated under `/api/tutorials`.

**Files:**
- Create: `supabase/migrations/093_tutorial_notes.sql`
- Create: `packages/api/src/routes/tutorial-notes.ts`; Modify: `packages/api/src/app.ts` (mount), `packages/api/src/routes/public.ts` (GET notes), `packages/api/src/routes/upload.ts` (`POST /note-photo`)
- Modify: `packages/types/src/index.ts` (`GuideNote`, `NotificationType`, `NOTIFICATION_BUCKET`, `COPY`)
- Create: `packages/mobile/lib/guide-notes.ts` (+ test), `packages/mobile/components/guides/community-notes.tsx` (+ test)
- Modify: `packages/mobile/components/guides/guide-steps.tsx` (`noteLabels`, `extras`), `packages/mobile/components/home/detail-screen.tsx` (banner, scroll, notes), `packages/mobile/lib/notifications.ts`, `packages/mobile/components/inbox/inbox-screen.tsx`
- Modify: `packages/web/components/tutorial-view.tsx` (banner, Revisions), `packages/web/app/tutorials/[id]/page.tsx` (fetch notes), `packages/web/components/notifications-list.tsx`
- Modify: `scripts/parity/app-screen-map.json` (`guide_detail`: delete both `guide-community-notes` rules and the `explained` key), `scripts/check-schema-guards.sh`, `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/api/tests/integration/guides/notes.test.ts` (new), `packages/mobile/tests/unit/lib/guide-notes.test.ts` (new), `packages/mobile/tests/unit/components/guides/community-notes.test.tsx` (new), `guide-steps.test.tsx`, `packages/mobile/tests/unit/lib/notifications.test.ts`, `packages/web/tests/unit/components/tutorial-view.test.tsx`

**Interfaces:**
- Produces:
  - `interface GuideNote { id: string; step_position: number | null; author_id: string; author_name: string; body: string; photo_url: string | null; photo_caption: string | null; pinned_at: string | null; pinned_by: string | null; pinned_by_name: string | null; created_at: string }` (from `@splat-connect/types`)
  - `GET /api/public/tutorials/:id/notes` → `GuideNote[]` (oldest first); `POST /api/tutorials/:id/notes` `{ step_position: number | null; body: string; photo_url?: string | null; photo_caption?: string | null }` → 201; `DELETE /api/tutorials/:id/notes/:noteId` → 204; `POST …/:noteId/pin` / `…/unpin` → `{ pinned }`, 403 unless a contributor or admin; `POST /api/upload/note-photo` (form: `file`, `tutorialId`) → `{ url }`
  - mobile `useGuideNotes(tutorialId: string): { notes: GuideNote[]; reload: () => Promise<void> }`; `noteSummary(notes: GuideNote[], stepCount: number): { pinned: GuideNote[]; open: GuideNote[]; extras: { no: number; body: string; by: string; pinnedBy: string }[]; labels: Map<number, string> }`; `stepLabel(n: GuideNote, stepCount: number): string`; `pinCountLabel(n: number): string`
  - `GuideSteps` props `noteLabels?: Map<number, string>`, `extras?: ReturnType<typeof noteSummary>['extras']`
  - `CommunityNotes({ tutorialId, guideTitle, authorName, steps, notes, reload, canPin, viewerId })`
  - `TutorialView` prop `notes?: GuideNote[]`
  - notification type `'tutorial_noted'`

- [ ] **Step 1: Write the failing tests**

`packages/api/tests/integration/guides/notes.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createProject } from '../../helpers/orgs.js'

const GHOST = '00000000-0000-4000-8000-00000000dead'
let author: TestUser
let parent: TestUser
let leaving: TestUser
let guide: string
let draft: string
const send = (method: string, path: string, token: string, body?: unknown) =>
  app.request(path, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
const stamp = async () => (await adminClient().from('tutorials').select('updated_at').eq('id', guide).single()).data!.updated_at

beforeAll(async () => {
  author = await createTestUser('contributor')
  parent = await createTestUser('contributor')
  leaving = await createTestUser('contributor')
  await adminClient().from('profiles').update({ name: 'Priya' }).eq('id', parent.id)
  guide = await createProject({ authorId: author.id, status: 'approved', title: 'Notes Fixture' })
  draft = await createProject({ authorId: author.id, status: 'draft', title: 'Notes Draft Fixture' })
})
afterAll(async () => {
  await adminClient().from('tutorials').delete().in('id', [guide, draft])
  for (const u of [author, parent]) await deleteTestUser(u.id)
})

describe('093 tutorial_notes', () => {
  let noteId: string

  it('takes a note against a step, notifies the authors and leaves the guide’s token alone', async () => {
    const before = await stamp()
    const res = await send('POST', `/api/tutorials/${guide}/notes`, parent.token, { step_position: 2, body: 'Step 2 needs a second zip tie.' })
    expect(res.status).toBe(201)
    noteId = ((await res.json()) as { id: string }).id
    expect(await stamp()).toBe(before)
    const { data } = await adminClient().from('notifications').select('type, actor_name').eq('recipient_id', author.id).eq('tutorial_id', guide)
    expect(data).toEqual([{ type: 'tutorial_noted', actor_name: 'Priya' }])
  })

  it('serves notes publicly with names', async () => {
    const res = await app.request(`/api/public/tutorials/${guide}/notes`)
    const notes = (await res.json()) as { id: string; author_name: string; step_position: number; pinned_at: string | null }[]
    expect(notes).toEqual([expect.objectContaining({ id: noteId, author_name: 'Priya', step_position: 2, pinned_at: null })])
  })

  it('validates, and refuses a guide that is not published', async () => {
    expect((await send('POST', `/api/tutorials/${guide}/notes`, parent.token, { step_position: null, body: '   ' })).status).toBe(400)
    expect((await send('POST', `/api/tutorials/${guide}/notes`, parent.token, { step_position: 0, body: 'x' })).status).toBe(400)
    expect((await send('POST', `/api/tutorials/${guide}/notes`, parent.token, { step_position: null, body: 'x', photo_url: 'https://elsewhere.test/a.jpg' })).status).toBe(400)
    expect((await send('POST', `/api/tutorials/${draft}/notes`, parent.token, { step_position: null, body: 'x' })).status).toBe(404)
  })

  it('lets only a contributor pin, and pinning names who did it', async () => {
    expect((await send('POST', `/api/tutorials/${guide}/notes/${noteId}/pin`, parent.token)).status).toBe(403)
    expect((await send('POST', `/api/tutorials/${guide}/notes/${noteId}/pin`, author.token)).status).toBe(200)
    const notes = (await (await app.request(`/api/public/tutorials/${guide}/notes`)).json()) as { pinned_by: string; pinned_at: string | null }[]
    expect(notes[0].pinned_by).toBe(author.id)
    expect((await send('POST', `/api/tutorials/${guide}/notes/${noteId}/unpin`, author.token)).status).toBe(200)
  })

  it('lets only the note’s author delete it', async () => {
    expect((await send('DELETE', `/api/tutorials/${guide}/notes/${noteId}`, author.token)).status).toBe(404)
    expect((await send('DELETE', `/api/tutorials/${guide}/notes/${noteId}`, parent.token)).status).toBe(204)
  })

  it('moves a deleted member’s notes to the Deleted member placeholder', async () => {
    const res = await send('POST', `/api/tutorials/${guide}/notes`, leaving.token, { step_position: null, body: 'A missing step: test the switch first.' })
    const id = ((await res.json()) as { id: string }).id
    expect((await adminClient().rpc('delete_account', { uid: leaving.id, keep_credit: false })).error).toBeNull()
    const { data } = await adminClient().from('tutorial_notes').select('author_id').eq('id', id).single()
    expect(data!.author_id).toBe(GHOST)
  })
})
```

`packages/mobile/tests/unit/lib/guide-notes.test.ts`:

```ts
import { noteSummary, pinCountLabel, stepLabel } from '../../../lib/guide-notes'

const note = (over: object) => ({
  id: 'n', step_position: 1, author_id: 'a', author_name: 'Priya', body: 'b', photo_url: null, photo_caption: null,
  pinned_at: null, pinned_by: null, pinned_by_name: null, created_at: '2026-09-01T00:00:00Z', ...over,
})

describe('noteSummary', () => {
  const notes = [
    note({ id: '1', step_position: 1, pinned_at: 'x', pinned_by_name: 'Sam' }),
    note({ id: '2', step_position: 1 }),
    note({ id: '3', step_position: 1 }),
    note({ id: '4', step_position: null, pinned_at: 'x', pinned_by_name: 'Sam', body: 'Test the switch first.' }),
    note({ id: '5', step_position: 9, pinned_at: 'x', pinned_by_name: null, body: 'Past the end.' }),
  ]

  it('labels each step the board’s way', () => {
    expect(noteSummary(notes as never, 4).labels.get(1)).toBe('1 pinned revision · 2 notes')
  })

  it('adds pinned missing steps after the last step, past-the-end positions included', () => {
    expect(noteSummary(notes as never, 4).extras).toEqual([
      { no: 5, body: 'Test the switch first.', by: 'Priya', pinnedBy: 'Sam' },
      { no: 6, body: 'Past the end.', by: 'Priya', pinnedBy: 'Deleted member' },
    ])
  })

  it('splits pinned from discussion', () => {
    const s = noteSummary(notes as never, 4)
    expect([s.pinned.length, s.open.length]).toEqual([3, 2])
  })
})

it('names a note’s step, or Missing step', () => {
  expect(stepLabel(note({ step_position: 2 }) as never, 4)).toBe('Step 2')
  expect(stepLabel(note({ step_position: null }) as never, 4)).toBe('Missing step')
  expect(stepLabel(note({ step_position: 7 }) as never, 4)).toBe('Missing step')
})

it('counts revisions in words', () => {
  expect(pinCountLabel(1)).toBe('1 pinned revision')
  expect(pinCountLabel(2)).toBe('2 pinned revisions')
})
```

`packages/mobile/tests/unit/components/guides/community-notes.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { CommunityNotes } from '../../../../components/guides/community-notes'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('expo-image-picker', () => ({ requestMediaLibraryPermissionsAsync: jest.fn(), launchImageLibraryAsync: jest.fn() }))
jest.mock('../../../../lib/upload', () => ({ uploadFile: jest.fn() }))
const mockPost = jest.fn().mockResolvedValue({})
const mockDelete = jest.fn().mockResolvedValue(undefined)
jest.mock('../../../../lib/api-client', () => ({ apiClient: { post: (...a: unknown[]) => mockPost(...a), delete: (...a: unknown[]) => mockDelete(...a) } }))
jest.mock('../../../../components/reports/report-problem', () => ({ ReportProblem: () => null }))

const steps = [{ id: 's1', tutorial_id: 'g', position: 1, title: 'Open the battery bay', body: 'b', photo_url: null }]
const note = (over: object) => ({
  id: 'n1', step_position: 1, author_id: 'p', author_name: 'Priya', body: 'Needs a second zip tie.', photo_url: null, photo_caption: null,
  pinned_at: null, pinned_by: null, pinned_by_name: null, created_at: '2026-09-01T00:00:00Z', ...over,
})
const reload = jest.fn().mockResolvedValue(undefined)
const props = { tutorialId: 'g', guideTitle: 'Light-up drum', authorName: 'Sam', steps, reload, canPin: false, viewerId: 'me' }

beforeEach(() => jest.clearAllMocks())

it('lists revisions and discussion, and posts a note against a step', async () => {
  render(<CommunityNotes {...props} notes={[note({ id: 'a', pinned_at: 'x', pinned_by_name: 'Sam' }), note({ id: 'b' })] as never} />)
  expect(screen.getByText('Revisions · 1 pinned')).toBeTruthy()
  expect(screen.getByText('Discussion · 1')).toBeTruthy()
  expect(screen.getByText('Pinned by Sam')).toBeTruthy()
  fireEvent.press(screen.getByText('Step 1'))
  fireEvent.changeText(screen.getByLabelText('Your note'), 'Glue the jack too.')
  fireEvent.press(screen.getByRole('button', { name: 'Post' }))
  await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/tutorials/g/notes', { step_position: 1, body: 'Glue the jack too.', photo_url: null, photo_caption: null }))
  expect(reload).toHaveBeenCalled()
})

it('posts a missing step and says where it would land', async () => {
  render(<CommunityNotes {...props} notes={[]} />)
  fireEvent.press(screen.getByText('Missing step'))
  expect(screen.getByText('Not part of any step above. If pinned, it is added to the end as step 2.')).toBeTruthy()
  fireEvent.changeText(screen.getByLabelText('Your note'), 'Test the switch first.')
  fireEvent.press(screen.getByRole('button', { name: 'Post' }))
  await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/tutorials/g/notes', expect.objectContaining({ step_position: null })))
})

it('offers Pin to a contributor and Delete on your own note', async () => {
  render(<CommunityNotes {...props} canPin notes={[note({ id: 'mine', author_id: 'me' })] as never} />)
  fireEvent.press(screen.getByRole('button', { name: 'Pin as revision' }))
  await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/tutorials/g/notes/mine/pin', {}))
  fireEvent.press(screen.getByRole('button', { name: 'Delete' }))
  await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/api/tutorials/g/notes/mine'))
})
```

`guide-steps.test.tsx` (append):

```tsx
it('labels steps with their notes and adds pinned missing steps at the end', async () => {
  render(
    <GuideSteps
      tutorialId="g"
      steps={steps}
      completion={() => null}
      noteLabels={new Map([[1, '1 pinned revision · 2 notes']])}
      extras={[{ no: 3, body: 'Test the switch first.', by: 'Priya', pinnedBy: 'Sam' }]}
    />
  )
  expect(await screen.findByText('1 pinned revision · 2 notes')).toBeTruthy()
  expect(screen.getByText('Added by the community')).toBeTruthy()
  expect(screen.getByText('Pinned by Sam · suggested by Priya')).toBeTruthy()
})
```

`packages/mobile/tests/unit/lib/notifications.test.ts` (append, beside the thanks route test; use the file's notification builder):

```ts
it('sends a note on a guide to the published guide', () => {
  expect(notificationHref({ ...base, type: 'tutorial_noted', tutorial_id: 'g1' })).toBe('/guides/g1')
})
```

(use whatever the file names its route function and fixture in place of `notificationHref` / `base`.)

`tutorial-view.test.tsx` (append):

```tsx
  it('warns of pinned revisions and lists them, read only', () => {
    const pinned = { id: 'n', step_position: 2, author_id: 'p', author_name: 'Priya', body: 'Use two zip ties.', photo_url: null, photo_caption: null, pinned_at: '2026-09-02T00:00:00Z', pinned_by: 'a', pinned_by_name: 'Sam', created_at: '2026-09-01T00:00:00Z' }
    render(<TutorialView signedIn tutorial={tutorial()} notes={[pinned, { ...pinned, id: 'o', pinned_at: null }]} />)
    expect(screen.getByText(/1 pinned revision/)).toBeInTheDocument()
    expect(screen.getByText(/since this was written — read before you build\./)).toBeInTheDocument()
    expect(screen.getByText('Use two zip ties.')).toBeInTheDocument()
    expect(screen.getAllByText('Use two zip ties.')).toHaveLength(1)
  })
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/guides/notes.test.ts` → FAIL (route 404 / relation missing).
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/lib/guide-notes.test.ts tests/unit/components/guides tests/unit/lib/notifications.test.ts` → FAIL.
Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/components/tutorial-view.test.tsx` → FAIL.

- [ ] **Step 3: Implement the migration**

`supabase/migrations/093_tutorial_notes.sql`:

```sql
-- 093 — community notes on a guide (guide-community-notes).
--
-- A member who built a published guide adds a note against a step, or as a
-- "Missing step"; the guide's contributors pin one as a revision. Pinned
-- revisions show on the guide and in its banner — not in the PDF, which is a
-- file the author uploads.
--
--   step_position  which step, by number. Not a tutorial_steps id: 080's PUT
--                  replaces every step row on each save, so an id would be
--                  set null the first time the author edited. Null, or past
--                  the last step, is "Missing step".
--   author_id      defaults to the Deleted member placeholder (083) and is
--                  set to it when the author's profile goes: their notes stay,
--                  as other authored content does. Inserts always name the
--                  caller (RLS below), so the default is only ever reached
--                  through the delete.
--   pinned_by      set null when that contributor leaves; the API names them
--                  "Deleted member".
--
-- DOWN:
--   drop table if exists public.tutorial_notes;
--   (and restore 077's notifications_type_check)

create table public.tutorial_notes (
  id uuid primary key default gen_random_uuid(),
  tutorial_id uuid not null references public.tutorials (id) on delete cascade,
  step_position smallint check (step_position between 1 and 60),
  author_id uuid not null default '00000000-0000-4000-8000-00000000dead'
    references public.profiles (id) on delete set default,
  body text not null check (length(btrim(body)) between 1 and 1000),
  photo_url text,
  photo_caption text check (photo_caption is null or length(photo_caption) <= 60),
  pinned_at timestamptz,
  pinned_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index tutorial_notes_tutorial_idx on public.tutorial_notes (tutorial_id, created_at);
create index tutorial_notes_author_idx on public.tutorial_notes (author_id);

alter table public.tutorial_notes enable row level security;

create policy tutorial_notes_read on public.tutorial_notes for select
  using (exists (select 1 from public.tutorials t where t.id = tutorial_id and t.status = 'approved'));
-- As yourself, on a published guide, unpinned: pinning is the API's, after a
-- contributor check, through the service role.
create policy tutorial_notes_insert_own on public.tutorial_notes for insert to authenticated
  with check (
    author_id = auth.uid() and pinned_at is null and pinned_by is null
    and exists (select 1 from public.tutorials t where t.id = tutorial_id and t.status = 'approved')
  );
create policy tutorial_notes_delete_own on public.tutorial_notes for delete to authenticated
  using (author_id = auth.uid());
create policy tutorial_notes_admin on public.tutorial_notes for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

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
    -- new in 093
    'tutorial_noted'
  ));
```

Apply: `supabase migration up`. Before writing the constraint, confirm no migration after 077 redefined it: `grep -ln notifications_type_check supabase/migrations/*.sql | tail -1` must print `077_…`.

- [ ] **Step 4: Implement the API**

`packages/api/src/routes/tutorial-notes.ts`:

```ts
/**
 * Community notes (093). Reads are public (routes/public.ts); these are the
 * writes. A note goes in through the caller's client, so RLS stamps whose it
 * is and refuses an unpublished guide. Pinning goes through the service role
 * after an is_tutorial_contributor check — RLS gives contributors no update.
 */
import { Hono, type Context } from 'hono'
import { createUserClient, createAdminClient } from '../supabase/client.js'
import type { AuthVariables } from '../middleware/auth.js'

const notes = new Hono<{ Variables: AuthVariables }>()
type Ctx = Context<{ Variables: AuthVariables }>

const GHOST = '00000000-0000-4000-8000-00000000dead'
const NOTE_COLUMNS = 'id, tutorial_id, step_position, author_id, body, photo_url, photo_caption, pinned_at, pinned_by, created_at'
// A note's photo must be one /api/upload/note-photo stored for this guide.
const ownNotePhoto = (url: string, id: string) => url.includes(`/object/public/toy-photos/${id}/notes/`)

export function noteError(b: Record<string, unknown>, id: string): string | null {
  const body = typeof b.body === 'string' ? b.body.trim() : ''
  if (!body || body.length > 1000) return 'Say what you found, in 1000 characters or fewer.'
  const at = b.step_position
  if (at != null && !(Number.isInteger(at) && (at as number) >= 1 && (at as number) <= 60)) return 'Pick a step, or Missing step.'
  if (b.photo_url != null && (typeof b.photo_url !== 'string' || !ownNotePhoto(b.photo_url, id))) return 'That photo was not uploaded to this guide.'
  if (b.photo_caption != null && (typeof b.photo_caption !== 'string' || b.photo_caption.trim().length > 60)) return 'The photo caption is over 60 characters.'
  return null
}

/** Tell the guide's contributors. Logged, never thrown — the note is saved. */
async function notifyContributors(tutorialId: string, authorId: string) {
  const admin = createAdminClient()
  const [{ data: guide }, { data: who }] = await Promise.all([
    admin.from('tutorials').select('title, tutorial_contributors(profile_id)').eq('id', tutorialId).single(),
    admin.from('profiles').select('name').eq('id', authorId).single(),
  ])
  const recipients = ((guide?.tutorial_contributors ?? []) as { profile_id: string }[])
    .map((r) => r.profile_id)
    .filter((p) => p !== authorId && p !== GHOST)
  if (!recipients.length) return
  const { error } = await admin.from('notifications').insert(
    recipients.map((recipient_id) => ({
      recipient_id,
      type: 'tutorial_noted',
      tutorial_id: tutorialId,
      tutorial_title: guide?.title ?? null,
      actor_name: who?.name || 'A member',
    }))
  )
  if (error) console.error('[notes] notify failed:', error.message)
}

notes.post('/:id/notes', async (c) => {
  const id = c.req.param('id')
  const b = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
  const invalid = noteError(b, id)
  if (invalid) return c.json({ error: invalid }, 400)
  const { data, error } = await createUserClient(c.get('token'))
    .from('tutorial_notes')
    .insert({
      tutorial_id: id,
      author_id: c.get('userId'),
      step_position: (b.step_position as number | null) ?? null,
      body: (b.body as string).trim(),
      photo_url: (b.photo_url as string | null) ?? null,
      photo_caption: (b.photo_caption as string | null)?.trim() || null,
    })
    .select(NOTE_COLUMNS)
    .single()
  // 42501: RLS refused — the guide is not published. 22P02: not a uuid.
  if (error && ['42501', '22P02'].includes(error.code)) return c.json({ error: 'Not found' }, 404)
  if (error) return c.json({ error: error.message }, 500)
  await notifyContributors(id, c.get('userId'))
  return c.json(data, 201)
})

notes.delete('/:id/notes/:noteId', async (c) => {
  // RLS admits the note's author and admins; anyone else matches zero rows.
  const { data, error } = await createUserClient(c.get('token'))
    .from('tutorial_notes')
    .delete()
    .eq('id', c.req.param('noteId'))
    .eq('tutorial_id', c.req.param('id'))
    .select('id')
  if (error && error.code !== '22P02') return c.json({ error: error.message }, 500)
  if (!data?.length) return c.json({ error: 'Not found' }, 404)
  return c.body(null, 204)
})

async function setPin(c: Ctx, pinned: boolean) {
  const id = c.req.param('id')
  const { data: own } = await createUserClient(c.get('token')).rpc('is_tutorial_contributor', { p_tutorial_id: id })
  if (!own && c.get('role') !== 'admin') return c.json({ error: "Only the guide's authors can pin a note" }, 403)
  const { data, error } = await createAdminClient()
    .from('tutorial_notes')
    .update(pinned ? { pinned_at: new Date().toISOString(), pinned_by: c.get('userId') } : { pinned_at: null, pinned_by: null })
    .eq('id', c.req.param('noteId'))
    .eq('tutorial_id', id)
    .select('id')
  if (error && error.code !== '22P02') return c.json({ error: error.message }, 500)
  if (!data?.length) return c.json({ error: 'Not found' }, 404)
  return c.json({ pinned })
}

notes.post('/:id/notes/:noteId/pin', (c) => setPin(c, true))
notes.post('/:id/notes/:noteId/unpin', (c) => setPin(c, false))

export default notes
```

`app.ts`: `import tutorialNotes from './routes/tutorial-notes.js'` and `app.route('/api/tutorials', tutorialNotes)` beside the other `/api/tutorials` routes.

`public.ts`, after the detail route:

```ts
/**
 * A published guide's community notes (093), oldest first, with names. The
 * anon client reads (RLS: approved guides only); names come from the admin
 * client, never a profiles embed (033/045 grants). A pinner who has since left
 * is named the way 083's placeholder is.
 */
publicRoutes.get('/tutorials/:id/notes', async (c) => {
  const { data, error } = await createAnonClient()
    .from('tutorial_notes')
    .select('id, step_position, author_id, body, photo_url, photo_caption, pinned_at, pinned_by, created_at')
    .eq('tutorial_id', c.req.param('id'))
    .order('created_at', { ascending: true })
  if (error?.code === INVALID_TEXT_REPRESENTATION) return c.json({ error: 'Not found' }, 404)
  if (error) return c.json({ error: error.message }, 500)
  const ids = [...new Set(data.flatMap((n) => [n.author_id, n.pinned_by]).filter((x): x is string => !!x))]
  const { data: people } = ids.length
    ? await createAdminClient().from('profiles').select('id, name').in('id', ids)
    : { data: [] as { id: string; name: string }[] }
  const name = new Map((people ?? []).map((p) => [p.id, p.name as string]))
  return c.json(
    data.map((n) => ({
      ...n,
      author_name: name.get(n.author_id) || 'A member',
      pinned_by_name: n.pinned_at ? (n.pinned_by && name.get(n.pinned_by)) || 'Deleted member' : null,
    }))
  )
})
```

`upload.ts`:

```ts
/**
 * A photo on a community note (093). Anyone signed in may note a published
 * guide, and toy-photos' storage policy (032) admits only its contributors,
 * so the object is written with the service role after the guide is checked
 * to be published — under <id>/notes/, which the notes route requires.
 * ponytail: deleting a note leaves its photo; sweep <id>/notes/ against
 * tutorial_notes if storage ever matters.
 */
upload.post('/note-photo', async (c) => {
  const read = await readUpload(c, 'tutorialId')
  if (read instanceof Response) return read
  const [file, id] = read
  if (!PHOTO_MIME.includes(file.type)) return c.json({ error: 'Photos need to be a JPEG, PNG, WebP, AVIF or HEIC image.' }, 400)
  if (file.size > PHOTO_MAX_BYTES) return c.json({ error: 'Photos need to be under 10 MB.' }, 400)
  const admin = createAdminClient()
  const { data: guide } = await admin.from('tutorials').select('status').eq('id', id).maybeSingle()
  if (guide?.status !== 'approved') return c.json({ error: 'Not found' }, 404)
  const ext = file.name.split('.').pop() ?? 'jpg'
  const { data, error } = await admin.storage.from('toy-photos').upload(`${id}/notes/${crypto.randomUUID()}.${ext}`, file, { upsert: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ url: admin.storage.from('toy-photos').getPublicUrl(data.path).data.publicUrl })
})
```

`check-schema-guards.sh` (after the 092 row):

```sql
  -- 093. Without RLS any client could pin, edit or delete anyone's note.
  ('093 tutorial_notes has RLS on',
   (select relrowsecurity from pg_class where oid = 'public.tutorial_notes'::regclass)),

  -- 093. The 046 shape: a narrower constraint drops every note notification silently.
  ('093 notifications_type_check permits tutorial_noted',
   (select count(*) = 1 from pg_constraint
      where conname = 'notifications_type_check'
        and pg_get_constraintdef(oid) like '%tutorial_noted%')),
```

`packages/types/src/index.ts`:
- `NotificationType` gains `| 'tutorial_noted'`; `NOTIFICATION_BUCKET` gains `tutorial_noted: 'tutorials',`; `COPY` gains `tutorial_noted: (n) => \`${n.actor_name} added a note to "${n.tutorial_title}"\`,`.
- Add:

```ts
/** 093. A community note on a published guide, as GET /api/public/tutorials/:id/notes serves it. */
export interface GuideNote {
  id: string
  /** Null, or past the guide's last step, is "Missing step". */
  step_position: number | null
  author_id: string
  author_name: string
  body: string
  photo_url: string | null
  photo_caption: string | null
  pinned_at: string | null
  pinned_by: string | null
  pinned_by_name: string | null
  created_at: string
}
```

- [ ] **Step 5: Implement mobile**

`packages/mobile/lib/guide-notes.ts`:

```ts
// packages/mobile/lib/guide-notes.ts
//
// Community notes on a guide (093): the fetch, and the board's derived
// labels — revisions vs discussion, per-step counts, pinned missing steps.
import { useCallback, useEffect, useState } from 'react'
import type { GuideNote } from '@splat-connect/types'
import { apiClient } from './api-client'

export function useGuideNotes(tutorialId: string) {
  const [notes, setNotes] = useState<GuideNote[]>([])
  const reload = useCallback(
    () =>
      apiClient
        .get<GuideNote[]>(`/api/public/tutorials/${tutorialId}/notes`)
        .then(setNotes)
        .catch((err) => console.error('[useGuideNotes] fetch failed:', err)),
    [tutorialId]
  )
  useEffect(() => {
    void reload()
  }, [reload])
  return { notes, reload }
}

const isMissing = (n: GuideNote, stepCount: number) => n.step_position == null || n.step_position > stepCount

export const stepLabel = (n: GuideNote, stepCount: number) =>
  isMissing(n, stepCount) ? 'Missing step' : `Step ${n.step_position}`

export const pinCountLabel = (n: number) => `${n} pinned revision${n === 1 ? '' : 's'}`

export function noteSummary(notes: GuideNote[], stepCount: number) {
  const pinned = notes.filter((n) => n.pinned_at)
  const open = notes.filter((n) => !n.pinned_at)
  const extras = pinned
    .filter((n) => isMissing(n, stepCount))
    .map((n, i) => ({ no: stepCount + 1 + i, body: n.body, by: n.author_name, pinnedBy: n.pinned_by_name ?? 'Deleted member' }))
  const labels = new Map<number, string>()
  for (let p = 1; p <= stepCount; p++) {
    const all = notes.filter((n) => n.step_position === p).length
    if (!all) continue
    const pins = pinned.filter((n) => n.step_position === p).length
    const rest = all - pins
    labels.set(p, [pins ? pinCountLabel(pins) : '', rest ? `${rest} note${rest === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · '))
  }
  return { pinned, open, extras, labels }
}
```

`guide-steps.tsx`: add props

```ts
  /** "1 pinned revision · 2 notes", by step position (lib/guide-notes.ts). */
  noteLabels?: Map<number, string>
  /** Pinned "Missing step" notes, drawn as steps after the last. */
  extras?: { no: number; body: string; by: string; pinnedBy: string }[]
```

inside each step's `stepText` after the photo: `{noteLabels?.get(st.position) ? <Text style={styles.noteLabel}>{noteLabels.get(st.position)}</Text> : null}`; and after the steps map, before the completion:

```tsx
      {(extras ?? []).map((x) => (
        <View key={x.no} style={styles.extra}>
          <View style={styles.extraHead}>
            <View style={styles.stepNum}>
              <Text style={styles.stepNumText}>{x.no}</Text>
            </View>
            <Text style={styles.stepTitle}>Added by the community</Text>
          </View>
          <Text style={styles.stepBody}>{x.body}</Text>
          <Text style={styles.noteLabel}>{`Pinned by ${x.pinnedBy} · suggested by ${x.by}`}</Text>
        </View>
      ))}
```

styles `noteLabel: { fontFamily: theme.fonts.bold, fontSize: 12, color: theme.colors.primaryDark }, extra: { padding: theme.spacing(3), gap: theme.spacing(1), borderRadius: theme.radii.field, backgroundColor: theme.colors.honeySoft, marginVertical: theme.spacing(1) }, extraHead: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) },`.

`packages/mobile/components/guides/community-notes.tsx`:

```tsx
// packages/mobile/components/guides/community-notes.tsx
//
// The board's Community notes: Revisions (pinned) and Discussion, and Add a
// note against a step or as a Missing step, with an optional photo. Pin and
// Unpin for the guide's contributors, Delete on your own note, Report a
// problem on anyone else's.
import { useState } from 'react'
import { View, Text, Image, StyleSheet } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import type { GuideNote, TutorialStep } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { uploadFile } from '../../lib/upload'
import { relativeTime } from '../../lib/notifications'
import { stepLabel } from '../../lib/guide-notes'
import { theme } from '../../lib/theme'
import { Section } from '../ui/Section'
import { Chip } from '../ui/Chip'
import { TextField } from '../ui/TextField'
import { Button } from '../ui/Button'
import { ErrorRow } from '../ui/ErrorRow'
import { FlashLine, useFlash } from '../ui/Flash'
import { ReportProblem } from '../reports/report-problem'

type Props = {
  tutorialId: string
  guideTitle: string
  authorName: string
  steps: TutorialStep[]
  notes: GuideNote[]
  reload: () => Promise<unknown>
  canPin: boolean
  viewerId: string | null
}

export function CommunityNotes({ tutorialId, guideTitle, authorName, steps, notes, reload, canPin, viewerId }: Props) {
  const [at, setAt] = useState<number | null | undefined>(undefined)
  const [body, setBody] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [flash, setFlash] = useFlash()
  const pinned = notes.filter((n) => n.pinned_at)
  const open = notes.filter((n) => !n.pinned_at)

  async function addPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) return setError('Photo library access is needed to choose a photo.')
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'] })
    const asset = result.canceled ? null : result.assets?.[0]
    if (!asset) return
    try {
      const { url } = await uploadFile('/api/upload/note-photo', tutorialId, { uri: asset.uri, name: asset.fileName ?? 'photo.jpg', mimeType: asset.mimeType ?? 'image/jpeg' })
      setPhoto(url)
    } catch {
      setError('Could not upload the photo. Please try again.')
    }
  }

  async function post() {
    setBusy(true)
    setError(null)
    try {
      await apiClient.post(`/api/tutorials/${tutorialId}/notes`, { step_position: at ?? null, body: body.trim(), photo_url: photo, photo_caption: caption.trim() || null })
      setBody('')
      setPhoto(null)
      setCaption('')
      setAt(undefined)
      await reload()
    } catch (err) {
      const detail = err instanceof Error ? /status \d+: (.+)$/.exec(err.message)?.[1] : null
      setError(detail ?? 'Could not post that. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function act(path: string, done: string, method: 'post' | 'delete' = 'post') {
    try {
      if (method === 'post') await apiClient.post(path, {})
      else await apiClient.delete(path)
      setFlash(done)
      await reload()
    } catch {
      setFlash('That did not work. Try again.')
    }
  }

  const noteRow = (n: GuideNote) => (
    <View key={n.id} style={[styles.note, n.pinned_at && styles.pinnedNote]}>
      <Text style={styles.meta}>{`${stepLabel(n, steps.length)} · ${n.author_name} · ${relativeTime(n.created_at)}`}</Text>
      <Text style={styles.body}>{n.body}</Text>
      {n.photo_url ? <Image source={{ uri: n.photo_url }} style={styles.photo} accessibilityLabel={n.photo_caption ?? 'Photo with the note'} /> : null}
      {n.photo_caption ? <Text style={styles.meta}>{n.photo_caption}</Text> : null}
      <View style={styles.actions}>
        {n.pinned_at ? <Text style={styles.pinnedBy}>{`Pinned by ${n.pinned_by_name ?? 'Deleted member'}`}</Text> : null}
        {canPin ? (
          <Button
            label={n.pinned_at ? 'Unpin' : 'Pin as revision'}
            variant="ghost"
            onPress={() =>
              void act(`/api/tutorials/${tutorialId}/notes/${n.id}/${n.pinned_at ? 'unpin' : 'pin'}`, n.pinned_at ? 'Unpinned' : 'Pinned as a revision — shows above Steps')
            }
          />
        ) : null}
        {viewerId === n.author_id ? (
          <Button label="Delete" variant="ghost" onPress={() => void act(`/api/tutorials/${tutorialId}/notes/${n.id}`, 'Note deleted', 'delete')} />
        ) : (
          <ReportProblem subjectKind="guide" subjectId={tutorialId} subjectLabel={`A note on ${guideTitle}`} />
        )}
      </View>
    </View>
  )

  return (
    <Section title={`Community notes ${notes.length}`}>
      <Text style={styles.lead}>
        Built this and found a step missing? Add a note against the step. {authorName} can pin it as a revision so everyone sees it.
      </Text>
      <FlashLine message={flash} />
      {pinned.length ? <Text style={styles.eyebrow}>{`Revisions · ${pinned.length} pinned`}</Text> : null}
      {pinned.map(noteRow)}
      <Text style={styles.eyebrow}>{`Discussion · ${open.length}`}</Text>
      {open.map(noteRow)}

      <View style={styles.form}>
        <Text style={styles.formTitle}>Add a note</Text>
        <View accessibilityLabel="Which step is it about?" style={styles.chips}>
          {steps.map((s) => (
            <Chip key={s.id} label={`Step ${s.position}`} active={at === s.position} onPress={() => setAt(s.position)} />
          ))}
          <Chip label="Missing step" active={at === null} onPress={() => setAt(null)} />
        </View>
        {at === null ? (
          <Text style={styles.meta}>{`Not part of any step above. If pinned, it is added to the end as step ${steps.length + 1}.`}</Text>
        ) : null}
        <TextField
          accessibilityLabel="Your note"
          placeholder="What was missing, or what you did differently…"
          multiline
          maxLength={1000}
          value={body}
          onChangeText={setBody}
        />
        {photo ? (
          <TextField accessibilityLabel="Photo caption" placeholder="Caption (optional)" maxLength={60} value={caption} onChangeText={setCaption} />
        ) : (
          <Button label="Add a photo" variant="ghost" onPress={() => void addPhoto()} />
        )}
        <ErrorRow message={error} />
        <Button label="Post" variant="primary" disabled={at === undefined || !body.trim()} loading={busy} onPress={() => void post()} />
      </View>
    </Section>
  )
}

const styles = StyleSheet.create({
  lead: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted, lineHeight: 19, marginBottom: theme.spacing(3) },
  eyebrow: { fontFamily: theme.fonts.black, fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: theme.colors.muted, marginVertical: theme.spacing(2) },
  note: { padding: theme.spacing(3), gap: theme.spacing(1), borderRadius: theme.radii.field, borderWidth: theme.border.hairline, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, marginBottom: theme.spacing(2) },
  pinnedNote: { backgroundColor: theme.colors.honeySoft },
  meta: { fontFamily: theme.fonts.semiBold, fontSize: 12, color: theme.colors.muted },
  body: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.text, lineHeight: 20 },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: theme.radii.field, backgroundColor: theme.colors.surfaceSunken },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: theme.spacing(2) },
  pinnedBy: { fontFamily: theme.fonts.black, fontSize: 12, color: theme.colors.ink },
  form: { marginTop: theme.spacing(3), padding: theme.spacing(3), gap: theme.spacing(2), borderRadius: theme.radii.panel, borderWidth: theme.border.hairline, borderColor: theme.colors.border, backgroundColor: theme.colors.surface },
  formTitle: { fontFamily: theme.fonts.display, fontSize: 15, color: theme.colors.ink },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
})
```

`detail-screen.tsx`:
- `const { notes, reload } = useGuideNotes(id)` and `const { caps } = useCapabilities()` at the top of `DetailScreen` (hooks before any early return); `const scroller = useRef<ScrollView>(null)` and `const [notesY, setNotesY] = useState(0)`.
- `const summary = noteSummary(notes, steps.length)` beside `steps`.
- `<ScrollView ref={scroller} …>`.
- Above `GuideSteps` (and above the Steps section's position in the board — after the report row):

```tsx
      {summary.pinned.length ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => scroller.current?.scrollTo({ y: notesY, animated: true })}
          style={styles.banner}
        >
          <Ionicons name="pin" size={20} color={theme.colors.ink} />
          <Text style={styles.bannerText}>
            <Text style={styles.bannerStrong}>{pinCountLabel(summary.pinned.length)}</Text> since this was written — read before you build.
          </Text>
          <Ionicons name="arrow-down" size={16} color={theme.colors.ink} />
        </Pressable>
      ) : null}
```

- Pass `noteLabels={summary.labels} extras={summary.extras}` to `GuideSteps`.
- Replace `{steps.length > 0 ? <PendingButton pending="guide-community-notes" … /> : null}` with:

```tsx
      <View onLayout={(e) => setNotesY(e.nativeEvent.layout.y)}>
        <CommunityNotes
          tutorialId={tutorial.id}
          guideTitle={tutorial.title}
          authorName={primary?.profiles.name ?? 'The author'}
          steps={steps}
          notes={notes}
          reload={reload}
          canPin={!!thanks?.own}
          viewerId={caps?.profile.id ?? null}
        />
      </View>
```

- Drop the `../ui/pending` import (no pending controls are left on this screen). Imports: `useRef`, `Pressable`, `ScrollView` (already), `useCapabilities` from `../../lib/capabilities`, `useGuideNotes, noteSummary, pinCountLabel` from `../../lib/guide-notes`, `CommunityNotes` from `../guides/community-notes`.
- Styles: `banner: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2), padding: theme.spacing(3), borderRadius: theme.radii.field, backgroundColor: theme.colors.honeySoft, marginBottom: theme.spacing(3) }, bannerText: { flex: 1, fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.ink }, bannerStrong: { fontFamily: theme.fonts.black },`.
- `detail-screen.test.tsx`: its GET mock routes by path — add `p.endsWith('/notes') ? Promise.resolve([])` to `mockEndpoints`, and mock `../../../../lib/capabilities` with `useCapabilities: () => ({ caps: { profile: { id: 'me' } } })`.

`lib/notifications.ts`, beside the thanks branch: `if (n.type === 'tutorial_noted' && n.tutorial_id) return \`/guides/${n.tutorial_id}\``. `inbox-screen.tsx` `TYPE_TILE`: `tutorial_noted: { icon: 'chatbubbles-outline', tint: theme.colors.honeySoft },`.

- [ ] **Step 6: Implement web**

`app/tutorials/[id]/page.tsx`: after the tutorial fetch,

```ts
  // 093. Public, like the guide; a failed read shows no revisions rather than no guide.
  const notes = await fetch(`${process.env.API_URL}/api/public/tutorials/${id}/notes`, { cache: 'no-store' })
    .then((r) => (r.ok ? (r.json() as Promise<GuideNote[]>) : []))
    .catch(() => [] as GuideNote[])
```

and pass `notes={notes}` to `TutorialView` (import `type GuideNote`).

`tutorial-view.tsx`: prop `/** 093. Pinned revisions show here; posting is on the app. */ notes?: GuideNote[]`; `const pinned = (notes ?? []).filter((n) => n.pinned_at)`; above `<SectionTabs …>`:

```tsx
        {pinned.length > 0 && (
          <a href="#tut-revisions" className="flex items-center gap-2.5 rounded-[var(--radius-inset)] bg-honey-soft px-4 py-3 text-sm font-bold text-ink no-underline">
            <PushPin size={20} weight="fill" aria-hidden="true" />
            <span className="flex-1">
              <strong>{pinned.length} pinned revision{pinned.length === 1 ? '' : 's'}</strong> since this was written — read before you build.
            </span>
          </a>
        )}
```

and after `<SectionTabs …/>`:

```tsx
        {pinned.length > 0 && (
          <section id="tut-revisions" aria-labelledby="tut-revisions-h" className="flex flex-col gap-3">
            <h2 id="tut-revisions-h" className="m-0 font-display text-[22px] font-extrabold text-ink">
              Revisions <span className="text-muted">{pinned.length} pinned</span>
            </h2>
            <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
              {pinned.map((n) => (
                <li key={n.id} className="rounded-[var(--radius-inset)] border border-line bg-surface p-4">
                  <p className="m-0 text-xs font-bold text-muted">
                    {n.step_position && n.step_position <= steps.length ? `Step ${n.step_position}` : 'Missing step'} · {n.author_name}
                  </p>
                  <p className="m-0 mt-1 text-[15px] leading-[1.55] text-ink">{n.body}</p>
                  <p className="m-0 mt-2 text-xs font-bold text-ink">Pinned by {n.pinned_by_name ?? 'Deleted member'}</p>
                </li>
              ))}
            </ol>
          </section>
        )}
```

(import `PushPin` from `@phosphor-icons/react/dist/ssr` and `type GuideNote`; update the header comment's "Community notes has no table" sentence to say pinned revisions show here and notes are posted from the app.)

`notifications-list.tsx`: `ICON` gains `tutorial_noted: [BookOpen, 'var(--tamber)'],`; the href function gains, beside the thanks branch, `if (n.type === 'tutorial_noted' && n.tutorial_id) return \`/tutorials/${n.tutorial_id}\``.

- [ ] **Step 7: Run the tests to see them pass**

Run the Step 2 commands, then `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/home/detail-screen.test.tsx tests/unit/components/inbox` and `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/account-deletion/delete.test.ts tests/integration/notifications`. Expected: PASS.

- [ ] **Step 8: Ship the item** — `shipped: true` on `'guide-community-notes'`; `node scripts/pending.mjs`; delete both `guide_detail` rules naming `guide-community-notes` and the emptied `explained` key in `scripts/parity/app-screen-map.json`; drift test → `Tests  11 passed (11)`.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/093_tutorial_notes.sql scripts/check-schema-guards.sh scripts/parity/app-screen-map.json packages/types/src packages/api packages/web packages/mobile docs/PENDING.md
git commit -m "feat(guides): community notes per step, pinned revisions and the banner (093)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 21: Full verification and graph update

No new code. Every check the spec names, in an order where a failure points at one thing.

**Files:**
- Modify (generated only): `graphify-out/*`, `scripts/parity/parity-report.json`, `scripts/parity/app-parity-report.json`

- [ ] **Step 1: Registry and drift**

Run: `node scripts/pending.mjs --check`
Expected: `docs/PENDING.md is up to date`
Run: `git grep -nE 'PENDING\((guides-loading-caption|clear-filters-empty|guides-search-parts|new-guide-fields|editor-part-buy-links|editor-backing|my-tutorials-meta|guide-ask-a-maker|guide-step-tracking|guide-tools-checklist|review-checklist|tool-notes|part-prices|guide-photo-captions|print-settings|guide-works-with|editor-safety-notes|guide-build-done|my-tutorials-views|guide-community-notes)\)|pending="(guide-[a-z-]+|editor-[a-z-]+|my-tutorials-[a-z]+|review-checklist|clear-filters-empty)"' -- . ':!docs/**' ':!**/tests/**' ':!packages/types/src/pending.ts'`
Expected: no output.
Run the drift test. Expected: `Tests  11 passed (11)`.

- [ ] **Step 2: Types and unit suites**

Run: `pnpm typecheck` → exit 0.
Run: `pnpm --filter @splat-connect/api test:unit` → all pass.
Run: `pnpm --filter @splat-connect/web test:unit` → all pass.
Run: `pnpm --filter @splat-connect/mobile test:unit` → all pass.

- [ ] **Step 3: API integration against a clean local database**

Run: `supabase db reset` (applies 001–093 from scratch — proves each migration runs on its own, not only on top of this machine's history), then `pnpm --filter @splat-connect/api test:integration`.
Expected: all pass, including `tests/integration/guides/*`.

- [ ] **Step 4: Web e2e** (not at the same time as any mobile e2e)

Run: `lsof -i :3000 -i :3100` first — a days-old server on the e2e port makes Playwright test a stale build; kill it if present. Then `pnpm --filter @splat-connect/web test:e2e`.
Expected: all pass (the three new detail specs among them).

- [ ] **Step 5: Parity re-run**

Run: `./scripts/parity/stack.sh up`, then from `packages/web`: `node ../../scripts/parity/run.js` and `node ../../scripts/parity/app.js --id guide_detail,guide_new,ed_safety,org_review,guides`.
Expected: web stays at its prior count (118/118 measured, no new findings on `/tutorials/[id]` and the editor); the five app screens report no `pending` exemption errors, and any new finding is a real divergence to fix or explain with `why: "intended"` and a reason — never `why: "pending"` naming a shipped id (the drift test refuses that). Run `node scripts/parity/mobile.js --id guide_detail` for the 390px width check.

- [ ] **Step 6: iOS simulator — tick storage under Hermes**

The jest runtime is not Hermes, and react-native-web stores in localStorage; only the simulator exercises SecureStore. The Expo dev bundle talks to the **hosted** Supabase, which does not have 085–093, so use a Release simulator build against local data (memory: expo-dev-bundle-hosted-env). If `ios/` predates any native module change, run `npx expo prebuild --platform ios` first.

1. `mcp__XcodeBuildMCP__session_show_defaults`, then `build_run_sim` (Release configuration, local env).
2. Open an approved guide with steps (seed one with `supabase` local + `createProject` data, or the demo cast).
3. Tick steps 1 and 2; confirm `2 of N steps done` and `Pick up at step 3 — …`.
4. Terminate and relaunch the app (`stop_app_sim`, `launch_app_sim`); reopen the guide; confirm the two ticks and the % survived.
5. Tick a tool; relaunch; confirm `1 of N already yours` survived.
6. Tap Reset; confirm `Step progress cleared` and 0%.
7. `screenshot` the restored state for the record.

Expected: ticks persist across relaunch; no red box; device logs (`mobile_get_device_logs` or the sim log) show no `[useDeviceTicks]` errors.

- [ ] **Step 7: Graph update**

Run: `graphify update .`
Expected: completes without error; `graphify-out/` updated.

- [ ] **Step 8: Commit the generated reports**

```bash
git add graphify-out scripts/parity/parity-report.json scripts/parity/app-parity-report.json scripts/parity/mobile-report.json
git commit -m "chore(guides): parity reports and graph after the guides batch

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

Hosted database: migrations 085–093 are **not** pushed by this plan. Pushing to the live "development" project is a separate step Byron approves (`supabase db push`, then `pnpm db:guards`, which now checks the 090–093 rows).
