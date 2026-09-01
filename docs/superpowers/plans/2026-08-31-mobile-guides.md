# Mobile Guides (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Guides tab reaches parity with web — kind filter, backing line and save on the list; byline, backing chip, creator's picks and the 3D-print placeholder on the detail; contributor and organisation public pages; and authoring: Add a guide plus the tutorial editor behind My tutorials.

**Architecture:** Everything reads routes web already uses; no schema change, and exactly one sanctioned API line-change (Task 3: the public detail embed gains `profile_id` so bylines can link). New shared primitives (`Badge`, `SaveButton`, `StepPills`) mirror web's (`badge.tsx` status map, save island, editor step pills) on the Pixel theme tokens from Phase 1. Authoring follows web's contract exactly: client-generated tutorial id, `PATCH` allowlist, replace-set sub-resources, multipart uploads to `/api/upload/*`, submit = `PATCH {status:'pending'}`.

**Tech Stack:** Expo SDK 57, expo-router 57, reanimated 4; new Expo deps this phase: `expo-crypto` (uuid for POST /api/tutorials), `expo-image-picker` (camera/library), `expo-document-picker` (PDF/STL). jest-expo unit tests; Playwright over `expo export -p web` e2e.

**Spec:** `docs/superpowers/specs/2026-08-30-mobile-catch-up-design.md` — sections "Guides tab", the editor entry under "MY SPLAT modal stack", "Shared components", decisions 5/9. The mockup linked there stays the visual authority.

## Global Constraints

- Package `packages/mobile`; gates are `pnpm typecheck`, `pnpm test:unit`, `pnpm test:e2e` (e2e only where a task says so). Read https://docs.expo.dev/versions/v57.0.0/ before Expo-specific code.
- Pixel tokens only: borders `theme.border.thin/thick` in `theme.colors.ink`, shadows `theme.shadow(3|4|5|6)`, radii `theme.radii`, `theme.fonts.numeral` for numerals only, badge colours from `theme.colors.tone`.
- API contract, verbatim: list `GET /api/public/tutorials` rows embed `tutorial_orgs(status, organizations(id,name))` already filtered to `accepted`; detail `GET /api/public/tutorials/:id` embeds `parts, tools, stl_files, tutorial_contributors(role, profiles(name)), tutorial_orgs, tutorial_recommendations(position, tutorials(id,title,kind,difficulty,toy_photo_url,status))` (recs pre-filtered to approved), `reviewer:reviewed_by(name)`, `reviewed_for:reviewed_for_org_id(name)`. Saves: `GET /api/saves/ids` → `SavedIds`; save = `POST /api/saves {entity_type: SAVE_SLUGS[slug], entity_id}`; unsave = `DELETE /api/saves/<slug>/<id>`. Create = `POST /api/tutorials {id, title, difficulty, kind}` (403 `{error:'You must accept the contributor terms before contributing'}` without terms; replays of the same id return 200). Edit = `PATCH /api/tutorials/:id` allowlist `title, description, difficulty, kind, tutorial_pdf_url, toy_photo_url, status` (status only `draft`|`pending`). Parts/tools = replace-set `POST /api/tutorials/:id/parts {parts:[…]}` / `…/tools {tools:[…]}`. Uploads = multipart `file` + `tutorialId` to `POST /api/upload/photo|pdf|stl`, response `{url}` (photo returns a public URL; pdf/stl return the object path). Delete = `DELETE /api/tutorials/:id`. Mine = `GET /api/tutorials/mine`. Public profiles = `GET /api/public/contributors/:id` → `ContributorProfile`, `GET /api/public/organizations/:id` → `OrganizationProfile` (both types in `@splat-connect/types` — their fields are the contract).
- PDFs stay paths, not URLs; preview signs via `supabase.storage.from('tutorial-pdfs').createSignedUrl(path, 60)` exactly as `detail-screen.tsx` already does.
- Copy rules: no "sign in to…"; kind labels from `KIND_LABEL` in types ("Toy adaptation"/"Assistive tech"); "Reviewed by SPLAT" only when approved with no accepted org backing.
- Collaborators and recommendations are **read-only on mobile** ("edit on the web") — decision 5.
- Commit per logical change on the work branch with the two trailers used in Phase 1 (`Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` / `Claude-Session: https://claude.ai/code/session_01J5d67ytpk3EnBSXuqK7Z7P`); never push. The controller re-splits the branch per file before merge, as in Phase 1.
- Test output pristine; every test in a file self-contained (Phase 1's `beforeEach` mock lesson).

---

## File map

**Create:** `lib/saves.ts`, `components/ui/SaveButton.tsx`, `components/ui/Badge.tsx`, `components/ui/StepPills.tsx`, `lib/upload.ts`, `components/guides/provenance.tsx`, `components/guides/picks-row.tsx`, `components/guides/showcase-screen.tsx`, `app/(tabs)/guides/contributor/[id].tsx`, `app/(tabs)/guides/organisation/[id].tsx`, `app/(tabs)/guides/new.tsx`, `components/my-tutorials/list-screen.tsx`, `components/my-tutorials/editor.tsx`, `app/(my)/tutorials/[id].tsx`, tests per task.
**Modify:** `components/home/library-screen.tsx`, `components/home/detail-screen.tsx`, `app/(tabs)/guides/_layout.tsx`, `app/(my)/tutorials/index.tsx` (stub → list), `app/(my)/_layout.tsx` (editor title), `lib/api-client.ts` (nothing — uploads live in `lib/upload.ts`), `package.json` (+3 expo deps), e2e specs.

---

### Task 1: Saves — the hook, the bookmark, and the Badge primitive

**Files:**
- Create: `packages/mobile/lib/saves.ts`, `packages/mobile/components/ui/SaveButton.tsx`, `packages/mobile/components/ui/Badge.tsx`
- Test: `tests/unit/lib/saves.test.tsx`, `tests/unit/components/ui/SaveButton.test.tsx`, `tests/unit/components/ui/Badge.test.tsx`

**Interfaces:**
- Produces: `useSaves(): { savedIds: SavedIds; toggle: (slug: SaveSlug, id: string) => Promise<void>; isSaved: (slug: SaveSlug, id: string) => boolean }` — optimistic toggle, reverts on API failure; `SaveButton({ slug, id, saves, size? })` — 40×40 bookmark island, filled apricot when saved, `accessibilityRole="button"`, label "Save"/"Saved"; `Badge({ status, label? })` — web's `STATUS_TONE` keys mapped onto `theme.colors.tone` (draft/withdrawn/toy_adaptation/assistive_tech → sunken; pending/requested/medium/challenge → honey — challenge renders brand like web; approved/published/completed/graduated/easy/mint → mint; rejected/hard → apricot; accepted → brand), uppercase 9px label, thin ink border, radius 4.

- [ ] **Step 1: Failing tests**

```tsx
// tests/unit/lib/saves.test.tsx
import { renderHook, act, waitFor } from '@testing-library/react-native'
import { useSaves } from '../../../lib/saves'

const mockGet = jest.fn(); const mockPost = jest.fn(); const mockDelete = jest.fn()
jest.mock('../../../lib/api-client', () => ({ apiClient: {
  get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a), delete: (...a: unknown[]) => mockDelete(...a),
}}))

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockResolvedValue({ tutorials: ['t1'], toys: [], challenges: [] })
  mockPost.mockResolvedValue({}); mockDelete.mockResolvedValue({})
})

it('loads ids and toggles optimistically', async () => {
  const { result } = renderHook(() => useSaves())
  await waitFor(() => expect(result.current.isSaved('tutorials', 't1')).toBe(true))
  await act(async () => { await result.current.toggle('tutorials', 't2') })
  expect(result.current.isSaved('tutorials', 't2')).toBe(true)
  expect(mockPost).toHaveBeenCalledWith('/api/saves', { entity_type: 'tutorial', entity_id: 't2' })
  await act(async () => { await result.current.toggle('tutorials', 't1') })
  expect(result.current.isSaved('tutorials', 't1')).toBe(false)
  expect(mockDelete).toHaveBeenCalledWith('/api/saves/tutorials/t1')
})

it('reverts the optimistic flip when the API fails', async () => {
  mockPost.mockRejectedValue(new Error('down'))
  const { result } = renderHook(() => useSaves())
  await waitFor(() => expect(result.current.isSaved('tutorials', 't1')).toBe(true))
  await act(async () => { await result.current.toggle('tutorials', 't9') })
  expect(result.current.isSaved('tutorials', 't9')).toBe(false)
})
```

```tsx
// tests/unit/components/ui/Badge.test.tsx
import { render, screen } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { Badge } from '../../../../components/ui/Badge'
import { theme } from '../../../../lib/theme'

it('maps a status to its tone and upcases the label', () => {
  render(<Badge status="approved" />)
  const t = screen.getByText('APPROVED')
  expect(StyleSheet.flatten(t.props.style).color).toBe(theme.colors.tone.mint.fg)
})

it('takes an explicit label for kinds', () => {
  render(<Badge status="assistive_tech" label="Assistive tech" />)
  expect(screen.getByText('ASSISTIVE TECH')).toBeTruthy()
})
```

```tsx
// tests/unit/components/ui/SaveButton.test.tsx
import { render, screen, fireEvent } from '@testing-library/react-native'
import { SaveButton } from '../../../../components/ui/SaveButton'

it('reflects saved state and calls toggle', () => {
  const toggle = jest.fn()
  const saves: any = { isSaved: () => true, toggle, savedIds: { tutorials: [], toys: [], challenges: [] } }
  render(<SaveButton slug="tutorials" id="t1" saves={saves} />)
  const b = screen.getByLabelText('Saved')
  fireEvent.press(b)
  expect(toggle).toHaveBeenCalledWith('tutorials', 't1')
})
```

- [ ] **Step 2: Run to verify all three fail** — `pnpm exec jest tests/unit/lib/saves.test.tsx tests/unit/components/ui/Badge.test.tsx tests/unit/components/ui/SaveButton.test.tsx` → module not found ×3.

- [ ] **Step 3: Implement**

```ts
// packages/mobile/lib/saves.ts
// Mirrors web's save-button contract: ids from /api/saves/ids, one POST/DELETE
// per flip, optimistic with revert. One hook instance per screen is fine for
// this phase — the list and detail each own their state, like web.
import { useCallback, useEffect, useState } from 'react'
import { SAVE_SLUGS, type SavedIds, type SaveSlug } from '@splat-connect/types'
import { apiClient } from './api-client'

const NONE: SavedIds = { tutorials: [], toys: [], challenges: [] }

export type Saves = {
  savedIds: SavedIds
  isSaved: (slug: SaveSlug, id: string) => boolean
  toggle: (slug: SaveSlug, id: string) => Promise<void>
}

export function useSaves(): Saves {
  const [savedIds, setSavedIds] = useState<SavedIds>(NONE)

  useEffect(() => {
    let ignore = false
    apiClient.get<SavedIds>('/api/saves/ids').then((ids) => { if (!ignore) setSavedIds(ids) }).catch(() => {})
    return () => { ignore = true }
  }, [])

  const isSaved = useCallback((slug: SaveSlug, id: string) => savedIds[slug].includes(id), [savedIds])

  const toggle = useCallback(async (slug: SaveSlug, id: string) => {
    const was = savedIds[slug].includes(id)
    const flip = (ids: SavedIds, on: boolean): SavedIds => ({
      ...ids, [slug]: on ? [...ids[slug], id] : ids[slug].filter((x) => x !== id),
    })
    setSavedIds((ids) => flip(ids, !was))
    try {
      if (was) await apiClient.delete(`/api/saves/${slug}/${id}`)
      else await apiClient.post('/api/saves', { entity_type: SAVE_SLUGS[slug], entity_id: id })
    } catch {
      setSavedIds((ids) => flip(ids, was)) // revert — the server didn't take it
    }
  }, [savedIds])

  return { savedIds, isSaved, toggle }
}
```

`apiClient` has no `delete` — add it beside `get/post/patch` in `lib/api-client.ts` (`delete: <T>(path: string) => request<T>('DELETE', path)`).

```tsx
// packages/mobile/components/ui/Badge.tsx
// Web's badge.tsx status map on the mobile tone tokens. One place, like web.
import { Text, View, StyleSheet } from 'react-native'
import { theme } from '../../lib/theme'

type ToneKey = keyof typeof theme.colors.tone
const TONE: Record<string, ToneKey> = {
  draft: 'sunken', withdrawn: 'sunken', toy_adaptation: 'sunken', assistive_tech: 'sunken',
  pending: 'honey', requested: 'honey', medium: 'honey',
  approved: 'mint', published: 'mint', completed: 'mint', graduated: 'mint', easy: 'mint',
  rejected: 'apricot', hard: 'apricot',
  accepted: 'brand', challenge: 'brand',
}

export function Badge({ status, label }: { status: string; label?: string }) {
  const tone = theme.colors.tone[TONE[status] ?? 'sunken']
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }]}>
      <Text style={[styles.text, { color: tone.fg }]}>{(label ?? status).toUpperCase()}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: theme.border.thin, borderColor: theme.colors.ink, borderRadius: 4,
    paddingHorizontal: 5, paddingVertical: 1, alignSelf: 'flex-start',
  },
  text: { fontFamily: theme.fonts.bold, fontSize: 9, letterSpacing: 0.6 },
})
```

```tsx
// packages/mobile/components/ui/SaveButton.tsx
// The bookmark island: a sibling of the card's link, never inside it — same
// rule as web's save-host. Filled apricot when saved.
import { Pressable, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { SaveSlug } from '@splat-connect/types'
import { theme } from '../../lib/theme'
import type { Saves } from '../../lib/saves'

export function SaveButton({ slug, id, saves, size = 20 }: { slug: SaveSlug; id: string; saves: Saves; size?: number }) {
  const on = saves.isSaved(slug, id)
  return (
    <Pressable
      onPress={() => saves.toggle(slug, id)}
      accessibilityRole="button"
      accessibilityLabel={on ? 'Saved' : 'Save'}
      hitSlop={10}
      style={styles.button}
    >
      <Ionicons name={on ? 'bookmark' : 'bookmark-outline'} size={size} color={on ? theme.colors.apricot : theme.colors.ink} />
    </Pressable>
  )
}

const styles = StyleSheet.create({ button: { minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' } })
```

- [ ] **Step 4: Run** — the three test files pass; then `pnpm typecheck && pnpm test:unit` green.
- [ ] **Step 5: Ready to commit** — `feat(mobile): saves hook, bookmark island and the Badge primitive`.

---

### Task 2: Guides list — kind chips, backing line, save

**Files:**
- Modify: `packages/mobile/components/home/library-screen.tsx`
- Test: modify `tests/unit/components/home/library-screen.test.tsx` if present, else create it

**Interfaces:**
- Consumes: `useSaves`, `SaveButton`, `Badge` (Task 1); list rows are `Tutorial & { tutorial_orgs?: TutorialOrg[] }` (the public list embeds accepted backings).

- [ ] **Step 1: Failing test**

```tsx
// tests/unit/components/home/library-screen.test.tsx (add or extend — every case self-contained)
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { LibraryScreen } from '../../../../components/home/library-screen'

const mockGet = jest.fn(); const mockPost = jest.fn(); const mockDelete = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: {
  get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a), delete: (...a: unknown[]) => mockDelete(...a),
}}))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))

const row = (over: object) => ({
  id: 't1', title: 'Bubble machine', description: null, difficulty: 'easy', kind: 'toy_adaptation',
  status: 'approved', tutorial_pdf_url: null, toy_photo_url: null, rejection_note: null,
  created_at: '', updated_at: '', reviewed_at: null, tutorial_orgs: [], ...over,
})

beforeEach(() => {
  jest.clearAllMocks()
  mockGet.mockImplementation((p: string) => p === '/api/saves/ids'
    ? Promise.resolve({ tutorials: [], toys: [], challenges: [] })
    : Promise.resolve([
        row({ id: 't1', tutorial_orgs: [{ status: 'accepted', organizations: { id: 'o1', name: 'TAD Australia' } }] }),
        row({ id: 't2', title: 'Head switch arm', kind: 'assistive_tech' }),
      ]))
})

it('shows the backing line, the kind badge and a save bookmark per card', async () => {
  render(<LibraryScreen />)
  await waitFor(() => expect(screen.getByText('Backed by TAD Australia')).toBeTruthy())
  expect(screen.getByText('Reviewed by SPLAT')).toBeTruthy()
  expect(screen.getAllByText('TOY ADAPTATION').length).toBe(1)
  expect(screen.getAllByLabelText('Save').length).toBe(2)
})

it('filters by kind client-side', async () => {
  render(<LibraryScreen />)
  await waitFor(() => expect(screen.getByText('Bubble machine')).toBeTruthy())
  fireEvent.press(screen.getByLabelText('Assistive tech'))
  expect(screen.queryByText('Bubble machine')).toBeNull()
  expect(screen.getByText('Head switch arm')).toBeTruthy()
})
```

- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Implement in `library-screen.tsx`**
  - Type the rows `Tutorial & { tutorial_orgs?: TutorialOrg[] }`.
  - Filter row: keep the difficulty `Chip`s, then a 2px `theme.colors.line`-coloured divider `View`, then two kind `Chip`s (labels from `KIND_LABEL`, state `kind: TutorialKind | null` toggling null on re-press). Kind filtering is client-side (`visible` gains `&& (!kind || t.kind === kind)`).
  - Card body: under the title, one line `backing(t)`: accepted org → `Backed by {organizations.name}` (first accepted); else `Reviewed by SPLAT`; 11px, `theme.colors.muted`. Under it, badge row: `<Badge status={t.difficulty} />` (replaces `DifficultyBadge` here) + `<Badge status={t.kind} label={KIND_LABEL[t.kind]} />`.
  - Save: wrap each row in a `save-host` view — `<View style={{ position: 'relative' }}>` with the existing `AnimatedPressable` card and an absolutely-positioned `<SaveButton slug="tutorials" id={item.id} saves={saves} />` at top-right (`top: 2, right: 2`), a **sibling** of the pressable, never a child. `const saves = useSaves()` once in `LibraryScreen`, passed down.
  - The row's `accessibilityHint` keeps working; the badges stay inside the `accessibilityElementsHidden` wrapper like `DifficultyBadge` did.
- [ ] **Step 4: Run** — the file's tests, then `pnpm typecheck && pnpm test:unit`.
- [ ] **Step 5: Ready to commit** — `feat(mobile): the guides list gains kind chips, the backing line and save`.

---

### Task 3: Guide detail — byline, backing chip, picks, 3D-print placeholder

**Files:**
- Create: `packages/mobile/components/guides/provenance.tsx`, `packages/mobile/components/guides/picks-row.tsx`
- Modify: `packages/mobile/components/home/detail-screen.tsx`
- Test: `tests/unit/components/guides/provenance.test.tsx`, `tests/unit/components/guides/picks-row.test.tsx`, extend `tests/unit/components/home/detail-screen.test.tsx`

**Interfaces:**
- Produces: `Provenance({ contributors, orgs, reviewedFor, onPerson, onOrg })` — byline "By A" / "By A and B" / "By A + n" (primary first; each name a link calling `onPerson(profileId)`), then one chip: accepted org → mint "✓ Backed by <name>" calling `onOrg(orgId)`; else grey inert "✓ Reviewed by SPLAT". `PicksRow({ recommendations, firstName, onOpen })` — eyebrow `ALSO WORTH A LOOK · <FIRSTNAME>'S PICKS`, horizontal `ScrollView` of ≤3 124px cards (photo, 2-line title, difficulty Badge), container padded past the 4px shadow (the Phase-1 clipping rule).
- Consumes: detail payload `tutorial_contributors: {profile_id, role, profiles: {name} }[]`, `tutorial_orgs`, `tutorial_recommendations`, `reviewed_for: {name} | null`. **One sanctioned API line-change (controller ruling):** the public detail select in `packages/api/src/routes/public.ts` (the /tutorials/:id route) currently embeds `tutorial_contributors(role, profiles(name))` — widen it to `tutorial_contributors(profile_id, role, profiles(name))` so the byline can link to `/guides/contributor/[id]`. Extend the existing public-tutorial integration test (`packages/api/tests/integration/tutorials/public.test.ts`) to assert `profile_id` comes back on the embed, and run `pnpm --filter @splat-connect/api exec vitest run tests/integration/tutorials/public.test.ts` (local Supabase must be up). No other API change is authorised.

- [ ] **Step 1: Failing tests** — `provenance.test.tsx`: renders "By Sam T. + 2" for three contributors with primary first; accepted org renders "Backed by TAD Australia" and fires `onOrg('o1')` on press; no org renders "Reviewed by SPLAT" with no press handler. `picks-row.test.tsx`: renders up to three titles and fires `onOpen(id)`. Extend `detail-screen.test.tsx`: an `assistive_tech` payload shows "Request this 3D print" with a SOON badge and no press handler; a `toy_adaptation` payload does not.

```tsx
// tests/unit/components/guides/provenance.test.tsx — the shape; write the three cases
import { render, screen, fireEvent } from '@testing-library/react-native'
import { Provenance } from '../../../../components/guides/provenance'

const person = (name: string, role = 'collaborator') => ({ role, profiles: { name }, profile_id: name })

it('orders the byline primary-first and truncates at two names', () => {
  const onPerson = jest.fn()
  render(<Provenance contributors={[person('Priya K.'), person('Sam T.', 'primary'), person('Mei W.')]} orgs={[]} reviewedFor={null} onPerson={onPerson} onOrg={jest.fn()} />)
  expect(screen.getByText(/^By/)).toBeTruthy()
  fireEvent.press(screen.getByText('Sam T.'))
  expect(onPerson).toHaveBeenCalledWith('Sam T.')
  expect(screen.getByText('+ 2')).toBeTruthy()
})
```

- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement**
  - `provenance.tsx`: byline as one `Text` with nested pressable `Text` spans (dotted-underline style: `textDecorationLine: 'underline'`, colour `theme.colors.primaryDeep`, `fontFamily: theme.fonts.bold`); chip as a `Pressable` pill (mint tone bg/fg, thin ink border, radius 20, checkmark Ionicon) or an inert `View` in sunken tone for "Reviewed by SPLAT".
  - `picks-row.tsx`: horizontal `ScrollView` `contentContainerStyle={{ gap: 10, paddingRight: 6, paddingBottom: 8, paddingLeft: 2 }}`, cards with thin ink border + `theme.shadow(4)`.
  - `detail-screen.tsx`: widen the payload type; title row gains `<SaveButton slug="tutorials" id={tutorial.id} saves={saves} />` (`useSaves()` here); after description render `<Provenance …\ onPerson={(pid) => router.push(\`/guides/contributor/${pid}\`)} onOrg={(oid) => router.push(\`/guides/organisation/${oid}\`)} />`; after the Preview button, assistive-tech only: a dimmed card (`opacity 0.62`) "Request this 3D print" / "Ask a contributor or organisation with a printer" with `<Badge status="pending" label="Soon" />` and no `onPress`; last, `<PicksRow recommendations={tutorial.tutorial_recommendations} firstName={primary?.profiles.name.split(' ')[0] ?? 'Creator'} onOpen={(rid) => router.push(\`/guides/${rid}\`)} />` only when recommendations exist.
- [ ] **Step 4: Run** — the touched test files, then `pnpm typecheck && pnpm test:unit`.
- [ ] **Step 5: Ready to commit** — `feat(mobile): guide detail carries its provenance, picks and the 3D-print placeholder`.

---

### Task 4: Contributor and organisation pages

**Files:**
- Create: `packages/mobile/components/guides/showcase-screen.tsx`, `app/(tabs)/guides/contributor/[id].tsx`, `app/(tabs)/guides/organisation/[id].tsx`
- Modify: `app/(tabs)/guides/_layout.tsx` (two `Stack.Screen` entries: titles `Contributor`, `Organisation`)
- Test: `tests/unit/components/guides/showcase-screen.test.tsx`

**Interfaces:**
- Produces: `ShowcaseScreen({ kind, id })` with `kind: 'person' | 'org'` — fetches `/api/public/contributors/:id` (`ContributorProfile`) or `/api/public/organizations/:id` (`OrganizationProfile`); both types in `@splat-connect/types` are the field contract. Renders: header card (avatar disc with the initial — square for orgs — name, `<N> guides · <M> toys shared` meta line), then sections as guide cards (same card markup as the library list, tappable to `/guides/[id]`): person → "Guides by <first name>" from `tutorials`; org → "Guides they back" from its backed-tutorials field, then "Toys on their shelf" (name + `<Badge status="published" label={\`${quantity} available\`} />` per the toy rows) — use exactly the fields the two types declare; toys tap nowhere this phase (Toy Library detail is Phase 3). Loading = three `SkeletonRow`s; error = the `EmptyState` retry pattern from `library-screen.tsx`.

- [ ] **Step 1: Failing test** — mock apiClient; person fixture renders name + one guide card + no toys section; org fixture renders backed guides and the shelf with quantities; fetch failure renders the EmptyState.
- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Implement** the component and the two 5-line route files (`useLocalSearchParams` id → `<ShowcaseScreen kind="person" id={id} />`).
- [ ] **Step 4: Run** — file tests, then `pnpm typecheck && pnpm test:unit`.
- [ ] **Step 5: Ready to commit** — `feat(mobile): contributor and organisation showcase pages behind the guide detail`.

---

### Task 5: Add a guide

**Files:**
- Create: `app/(tabs)/guides/new.tsx`
- Modify: `components/home/library-screen.tsx` (header pill), `app/(tabs)/guides/_layout.tsx` (screen `new`, title `Add a guide`, `presentation: 'modal'`), `packages/mobile/package.json` (`pnpm exec expo install expo-crypto`)
- Test: `tests/unit/app/guides-new.test.tsx`

**Interfaces:**
- Produces: the create form — title `TextField`, kind chips (default Toy adaptation), difficulty chips (default Easy), one primary Button **Create draft**. Submit: `randomUUID()` from `expo-crypto` → `POST /api/tutorials { id, title, difficulty, kind }` → `router.replace('/tutorials/' + id)` (the Task 6 editor route). A 403 reveals the terms gate inline: the sentence + `TermsCheckbox`-style checkbox + **Accept and continue** calling `acceptContributorTerms()` from `useAuth()`, then retries the same create (same id — the API replays it as 200). Button disabled until title is non-blank.
- Consumes: `library-screen.tsx` header — the `ScreenHeader` row gains a right-aligned accent pill: `Button variant="accent"` sized small (`paddingVertical: spacing(2)`) labelled `+ Add a guide` → `router.push('/guides/new')`.

- [ ] **Step 1: Failing test** — mock apiClient + `expo-crypto` (`randomUUID: () => 'uuid-1'`) + auth-context (with `acceptContributorTerms`); typing a title and pressing Create posts `{ id: 'uuid-1', title, difficulty: 'easy', kind: 'toy_adaptation' }`; a 403 first response shows "contributor terms" copy and, after ticking + accepting, retries with the same id.
- [ ] **Step 2: Run to verify it fails.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — file test, `pnpm typecheck && pnpm test:unit`.
- [ ] **Step 5: Ready to commit** — `feat(mobile): add a guide — three fields, the terms gate, straight into the editor`.

---

### Task 6: My tutorials list, StepPills, uploads helper, editor scaffold + Details step

**Files:**
- Create: `components/ui/StepPills.tsx`, `lib/upload.ts`, `components/my-tutorials/list-screen.tsx`, `components/my-tutorials/editor.tsx`, `app/(my)/tutorials/[id].tsx`
- Modify: `app/(my)/tutorials/index.tsx` (stub → `<MyTutorialsListScreen />`), `app/(my)/_layout.tsx` (`tutorials/[id]` title `Edit guide`)
- Test: `tests/unit/components/ui/StepPills.test.tsx`, `tests/unit/lib/upload.test.ts`, `tests/unit/components/my-tutorials/list-screen.test.tsx`, `tests/unit/components/my-tutorials/editor.test.tsx`

**Interfaces:**
- Produces:
  - `StepPills({ steps, active, onSelect })` with `steps: { id: string; label: string; status: 'done' | 'attention' | 'neutral' }[]` — the one pill row toy/child editors adopt later. Active pill ink-filled; `done` prefixes ✓ in mint; `attention` prefixes a 7px apricot dot; `neutral` bare. Each pill `accessibilityRole="tab"`, `accessibilityState={{ selected }}`.
  - `uploadFile(path: '/api/upload/photo' | '/api/upload/pdf' | '/api/upload/stl', tutorialId: string, file: { uri: string; name: string; mimeType?: string }): Promise<{ url: string; filename?: string }>` — `FormData` with the RN file object `{ uri, name, type }` and `tutorialId`; auth header from the supabase session exactly like `lib/api-client.ts` (reuse its `getToken` by exporting it); **no Content-Type header** (fetch sets the multipart boundary).
  - `MyTutorialsListScreen` — `GET /api/tutorials/mine`; rows: 44px photo, title, `KIND_LABEL[kind]` · difficulty line, `<Badge status={t.status} />`; rejected rows show `rejection_note` in an apricot note box under the row; tap → `/tutorials/[id]`; header accent pill `+ Add a guide` → `/guides/new`; footnote "Collaborators and recommendations are edited on the web for now."; empty state invites the first guide.
  - `Editor({ id })` — fetches `GET /api/tutorials/:id` (`TutorialWithDetails`), computes gaps exactly as web's `getMissingFields` (port the 8-line function into the editor file — title, difficulty, pdf, photo, ≥1 part, ≥1 tool, STL when assistive), steps `Details · Parts · Tools · Files` + `STL` (assistive only) + `Review`; status header `<Badge status>`; rejected note box; pending banner "With <reviewed_for.name ?? 'SPLAT'> for review. Saving any change pulls it back to draft." **Details step this task**: title, description, kind (chips), difficulty (chips) → **Save details** → `PATCH /api/tutorials/:id` with exactly those four keys, updating local state from the response. Footer `Delete guide` (danger ghost) → `Alert.alert` confirm → `DELETE /api/tutorials/:id` → `router.back()`.

- [ ] **Step 1: Failing tests** — `StepPills`: renders ✓/dot/active states and fires `onSelect`. `upload`: mocks global `fetch` + the exported `getToken`; asserts URL, Authorization header, FormData fields `file`/`tutorialId`, and that no `Content-Type` was set. `list-screen`: statuses render, rejected note shows, tap pushes `/tutorials/t1`. `editor`: a draft with no pdf/photo marks Files `attention` and Details `done`; Save details PATCHes the four keys.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.** (`app/(my)/tutorials/[id].tsx` is `useLocalSearchParams` → `<Editor id={id} />`.)
- [ ] **Step 4: Run** — the four files, then `pnpm typecheck && pnpm test:unit`.
- [ ] **Step 5: Ready to commit** — two commits: `feat(mobile): step pills, the uploads helper and the my-tutorials list`, `feat(mobile): the guide editor opens on Details`.

---

### Task 7: Editor steps — Parts, Tools, Files, STL, Review

**Files:**
- Modify: `components/my-tutorials/editor.tsx`
- Modify: `packages/mobile/package.json` — `pnpm exec expo install expo-image-picker expo-document-picker`
- Test: extend `tests/unit/components/my-tutorials/editor.test.tsx`

**Interfaces (consumes Task 6's editor, `uploadFile`, web's replace-set contract):**
- **Parts / Tools**: editable rows (name `TextField`, parts add a numeric quantity stepper − n +, an "optional" checkbox toggle, a remove ✕) + `+ Add a part/tool` row + **Save parts/tools** → `POST /api/tutorials/:id/parts { parts: rows.map(({name, quantity, is_optional, buy_links}) => …) }` (tools same with `tools`; preserve existing `buy_links` untouched — mobile doesn't edit them).
- **Files**: toy photo tile (current photo or add tile) with two actions — **Take a photo** (`expo-image-picker` `launchCameraAsync`, quality 0.7) and **Choose from library** (`launchImageLibraryAsync`) → `uploadFile('/api/upload/photo', …)` → the returned `url` goes into a `PATCH { toy_photo_url }`; PDF row (`filename or "No PDF yet"`) + **Choose PDF from Files** (`expo-document-picker`, `type: 'application/pdf'`) → `uploadFile('/api/upload/pdf', …)` → `PATCH { tutorial_pdf_url: url }` (the path, per the constraint) + a **Preview** ghost button reusing the signed-URL flow when a pdf exists.
- **STL** (assistive only): list of `stl_files` rows (filename) + **Choose STL from Files** (`type: '*/*'`, filter `.stl` by name; reject others with an inline error) → `uploadFile('/api/upload/stl', …)`; refetch the tutorial after upload (the API inserts the `stl_files` row server-side — verify while implementing; if it does not, `POST /api/tutorials/:id/stl-files` is the stl-files sub-resource with body key `stl_files` — check `api/src/routes/stl-files.ts` and use whichever the web editor uses, stating which in the report).
- **Review**: read-only rows — Backed by (accepted org name + status, or "Not requested — ask on the web"), Collaborators (names joined, "edit on the web"), Recommendations ("n of 3 · edit on the web"); the gap list ("Still needed: A photo, The guide PDF…") when gaps exist; primary **Submit for review** (disabled while gaps exist) → `PATCH { status: 'pending' }`; pending shows "Submitted · waiting for review" quiet row; approved shows "✓ Approved · in Guides" in mint.
- Permission denials from camera/library and every upload failure surface as an inline error row (the `ErrorRow` pattern from `auth-screen.tsx`), never a silent no-op.

- [ ] **Step 1: Failing tests** — parts step: adding a row and saving POSTs the replace-set with the typed name and quantity; files step: mock `expo-image-picker`/`expo-document-picker` + `uploadFile`; choosing a PDF calls uploadFile then PATCHes `tutorial_pdf_url` with the returned path; review step: gaps disable Submit, a gapless draft's Submit PATCHes `{status:'pending'}`.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — the editor tests, then `pnpm typecheck && pnpm test:unit`.
- [ ] **Step 5: Ready to commit** — `feat(mobile): the editor's parts, tools, files, STL and review steps`.

---

### Task 8: E2E sweep and full verification

**Files:**
- Modify: `tests/e2e/guides-library.spec.ts`, `tests/e2e/guides-detail.spec.ts`, `tests/e2e/helpers.ts` (fixture gains contributors/backing where needed)
- Create: `tests/e2e/guides-authoring.spec.ts`, `tests/e2e/guides-showcase.spec.ts`

**Interfaces:** builds on `createContributor`, `createTutorial`, `signInAsNewContributor` in helpers; local Supabase seeded per-spec as those already do.

- [ ] **Step 1: Extend helpers** — `createTutorial` gains optional `contributorName` (inserts the `tutorial_contributors` primary row via the admin client — check the table's columns first) and optional `backedByOrg: string` (creates an organization + accepted `tutorial_orgs` row). Both default off so existing specs stand.
- [ ] **Step 2: List spec adds:** kind chips filter the list; the backing line shows for a backed fixture; tapping Save flips the bookmark (assert `getByLabelText('Saved')`).
- [ ] **Step 3: Detail spec adds:** byline renders and navigates to the contributor page; a backed fixture's chip navigates to the organisation page; an assistive-tech fixture shows the SOON placeholder; a fixture with a recommendation shows the picks row and taps through.
- [ ] **Step 4: `guides-showcase.spec.ts`:** contributor page lists the fixture's guides; organisation page lists backed guides.
- [ ] **Step 5: `guides-authoring.spec.ts`:** the full happy path — sign up (helpers already accept terms on signup) → `+ Add a guide` → create → Details save → Parts + Tools save → Review shows the Files gap and Submit disabled → (upload steps are skipped on web export only if the pickers can't run headless; if `expo-document-picker` works on web via an `<input type=file>` use Playwright's `setInputFiles` with a tiny PDF; otherwise PATCH the pdf/photo fields via the API in the spec and reload) → Submit → the list shows PENDING. State which upload path the spec took.
- [ ] **Step 6: Full run** — `pnpm typecheck && pnpm test:unit && pnpm test:e2e` all green (kill any dev server squatting on the API port first, as Phase 1 learned).
- [ ] **Step 7: Ready to commit** — `test(mobile): e2e covers the guides list, detail, showcases and authoring path`.

---

## Self-review notes (done at write time)

- Spec coverage: decision 5 (printing placeholder), decision 9 (provenance/picks), Guides-tab screens, Add a guide + editor, contributor/org pages — all mapped to tasks. The editor's collaborators/recommendations stay read-only (decision 5). Learn strip: not in this phase (Explore owns Learn — Phase 4).
- Type consistency: `Saves` type produced in T1 consumed in T2/T3; `uploadFile` produced in T6 consumed in T7; `StepPills` status union matches web's `StepStatus` ('done'|'attention'|'neutral').
- Known discovery points, named in-task rather than guessed: how STL rows are registered after upload (T7), whether pickers run under the web export (T8). Each instructs the implementer to verify and report which path reality took.
