# 3D Printing Build (Sub-project 4, Batch 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the 13 printing items in `packages/types/src/pending.ts` (quantity, message, rates, cost, answer-by, fit feedback, stats, customization, bed fit, parts catalogue, saved parts, verified printers, distance) and ship each one out of the registry.

**Architecture:** One task per registry item in the spec's Order, except `locations-and-distance`, which is three tasks (data + SQL, API, apps) that ship in the third. Six slices add a migration (094–099). The API checks every limit with a hand-written validator that answers 400 with a plain sentence (the API has no zod), and the database repeats the limit as a CHECK. Shared pure logic goes in a new `packages/types/src/printing.ts` (cost, answer-by, stats lines, bed fit, customization questions); mobile-only wording stays in `packages/mobile/lib/printing.ts`. Counts are SECURITY DEFINER computed fields, never stored.

**Tech Stack:** Hono + supabase-js + vitest (api), Next.js App Router + vitest + Playwright (web), Expo Router / React Native + jest + RNTL (mobile), Postgres migrations via the Supabase CLI, Node 22 `fetch` for the one data script.

**Spec:** `docs/superpowers/specs/2026-10-01-printing-build-design.md` (inherits "Rules every slice keeps" from `docs/superpowers/specs/2026-10-01-guides-build-design.md`).

## Global Constraints

- **One migration per slice, numbered from 094** (batch 1 owns 085–093): 094 print fit, 095 printer stats, 096 customization notes, 097 part sizes, 098 test prints, 099 postcodes and distance. Each has a `-- DOWN:` block like 068/074. Each migration's test selects its new objects through the admin client, so a repaired-not-run migration fails loudly; a security-relevant object also gets a row in `scripts/check-schema-guards.sh`.
- **Limits are checked twice:** the API returns 400 with a plain sentence; a CHECK in the database backs it.
- **No counter columns.** Jobs, median days, fit counts and "verified" are `stable`, `security definer`, `set search_path = ''` computed fields (066's `thanks_count` shape). A print job's extra stages stay timestamps, never new `status` members (memory: toy_transactions is polymorphic).
- **Shipping an item:** delete every `PENDING(<id>)` / `pending="<id>"` reference, set `shipped: true` on the entry (never delete it — `pending-registry.test.ts` counts the entries), run `node scripts/pending.mjs`, delete any `explained` rule in `scripts/parity/screen-map.json` / `app-screen-map.json` whose `pending` is the id (drop the `explained` key if it empties), and run the drift test. The commit that flips `shipped` contains that item only.
- **Mobile is a second consumer of every column.** On each column change, `grep -rn "<column>" packages/mobile`. The STL replace-set POST (`/api/tutorials/:id/stl-files`) deletes and re-inserts every row, and the STL PATCH writes every setting it is sent, so every editor must carry new STL columns through.
- **Copy is quoted from the boards** (`Splat Connect frontend overhaul/SPLAT Connect - Mobile.dc.html`, `SPLAT Connect - Web.dc.html`). Where neither board draws the thing, the spec's own words are used and nothing else: "Get verified", "Waiting" / "Passed" / "Failed", "Test prints", "Add your postcode", "Expired", "This request expired on {date}; ask again.", "They have until {date} to answer. You can add a printer or withdraw at any time.", "Answer by".
- **Names come from the admin client**, never a PostgREST `profiles(...)` / `organizations(...)` embed in a new user/anon select (033/045 column grants fail the whole query silently).
- **`packages/types/src/printing.ts` has no runtime import from `./index`** — `index.ts` re-exports it and imports `printRequestExpired` from it, so a value import back would be a cycle. Mobile dates use `toLocaleDateString('en-AU', …)` like `job-screen.tsx`'s `askedWhen`, not `shortDate` (Hermes; memory: mobile Hermes runtime parity).
- **Web e2e specs import only from `tests/e2e/helpers.ts` / `lib/`,** never a component. Never run web and mobile e2e at the same time.
- **Batch 1 is being built at the same time.** Before editing any file, re-read it; anchor every edit on the code quoted in the step, never on a line number. Files both batches touch: `packages/types/src/index.ts`, `packages/types/src/pending.ts`, `docs/PENDING.md`, `packages/api/src/routes/toy-transactions.ts` (batch 1 widens the two `tutorial:tutorials(...)` embeds), `packages/mobile/components/printing/request-screen.tsx` and `offer-screen.tsx` (batch 1 replaces their `PENDING(print-settings)` lines), `packages/mobile/components/my-tutorials/sections/stl-section.tsx` (batch 1 adds guide-level print fields under the lead), `packages/mobile/tests/unit/components/ui/pending.test.tsx`, `scripts/check-schema-guards.sh`. In `pending.ts` flip only this batch's entries.
- **Stage only this task's files.** The tree holds unrelated changes (`CLAUDE.md` modified; `packages/web/zz3_57656.mjs` and `selfIdentity.plist` untracked) plus batch 1's work in progress: list files by name in every `git add`, run `git status --short` first, and `git restore --staged` anything that is not the task's.
- Commit messages end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV
  ```

## Review Focus

1. **An expired request still asks to be answered.** After 7 days a `requested` print job must stop counting on the Exchanges badge (`needsAction`), leave the printer's Requests tab, read "Expired" on both sides, and refuse accept with 409 — with no scheduled job. Pinned by Task 5's `needsAction`, accept, `jobState` and `printStages` tests.
2. **An editor that predates part sizes erases them.** The mobile STL upload rebuilds every row through the replace-set POST and the web settings form PATCHes every field; sizes typed on one platform must survive a save on the other. Pinned by Task 9's stl-section and stl-settings-form tests.
3. **Distance with a missing end.** A viewer with no profile postcode, a printer/toy/org/build with none, a postcode not in the ABS set, or a malformed `near` (400) — rows with no distance get `km: null`, sort last, and are dropped only when `within` is set. Pinned by Task 14's unit and integration tests.
4. **The cost line lies when it cannot know.** A printer with no rate (null is "free, parts only", 070), any part without grams, several printers with different rates, and quantities above one. The line falls back to today's words rather than "$0.00". Pinned by Task 4's tests.
5. **Old clients and odd quantities on POST /print.** `stl_file_ids` still means one of each; `files` quantities outside 1–20, non-integers and a part named twice are 400s, not a 500 from the primary key. Pinned by Task 3's integration test.

## Files

New:
- `packages/types/src/printing.ts` — `printCostCents`, `costRange`, `PRINT_ANSWER_DAYS`, `answerBy`, `printRequestExpired`, `PrinterStats`, `statsLine`, `machineStatsLines`, `orgPrintFacts`, `PRINT_FIT_QUESTIONS`, `PrintFitNotes`, `fitNotesProblem`, `fitNotesLines`, `bedFits`, `CataloguePart`, `CataloguePage`, `VERIFIED_MIN_JOBS`, `TestPrint`, `testPrintLabel`.
- `packages/web/tests/unit/lib/printing.test.ts` — its tests (types tests live in web, like `contributor-badges.test.ts`).
- `packages/api/src/distance.ts` (+ `tests/unit/distance.test.ts`) — `readNear`, `byDistance`.
- `scripts/postcode-centroids.mjs` (+ `packages/api/tests/unit/postcode-centroids.test.ts`), `supabase/data/abs-poa-2021-centroids.csv`.
- `supabase/migrations/094_print_fit.sql` … `099_postcodes_and_distance.sql`.
- `packages/api/tests/integration/printers/{print-quantity,answer-by,print-fit,printer-stats,fit-notes,part-sizes,verified}.test.ts`, `packages/api/tests/unit/distance.test.ts`, `packages/api/tests/integration/public/{printable-parts,near}.test.ts`, `packages/api/tests/integration/postcodes.test.ts`.
- `packages/web/app/admin/test-prints/page.tsx`, `packages/web/components/admin-test-prints.tsx`.
- `packages/web/tests/unit/lib/print-stages.test.ts`, `packages/web/tests/unit/app/printing-parts.test.tsx`, `packages/web/tests/unit/components/{admin-test-prints,stl-settings-form,printer-form}.test.tsx`, `packages/web/tests/e2e/printing/answer-by.spec.ts`, `packages/web/tests/e2e/public/printing-parts.spec.ts`.
- `packages/mobile/tests/unit/components/printing/{job-screen-message,add-printer-screen,request-screen}.test.tsx`, `packages/mobile/tests/unit/components/builds/makers-wanted-screen.test.tsx`.

Deleted: `packages/web/app/dashboard/saved/parts/page.tsx` (the static page that shadows `[type]`).

## Commands used throughout

- Apply new migrations locally (needs `supabase start`): `supabase migration up`
- API integration: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts <file>`
- API unit: `pnpm --filter @splat-connect/api exec vitest run <file>`
- Drift test: `pnpm --filter @splat-connect/api exec vitest run tests/unit/pending-features.test.ts tests/unit/pending-registry.test.ts` → `Tests  11 passed (11)`
- Regenerate the registry doc: `node scripts/pending.mjs` → `wrote docs/PENDING.md (N items)`
- Web unit: `pnpm --filter @splat-connect/web exec vitest run <file>`
- Web e2e: `pnpm --filter @splat-connect/web exec playwright test <file>`
- Mobile unit: `pnpm --filter @splat-connect/mobile exec jest <file>`
- Typecheck: `pnpm typecheck`

---

### Task 1: Message the printer (`message-printer`)

**Files:**
- Modify: `packages/mobile/components/ui/TextField.tsx` (accept a `ref`)
- Modify: `packages/mobile/components/printing/job-screen.tsx` (refs, `openThread`, `StateCard`'s `onMessage`)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/mobile/tests/unit/components/printing/job-screen-message.test.tsx` (new — its own file, because it mocks `TextField` and the existing job-screen tests query the real one)

**Interfaces:**
- Consumes: nothing new.
- Produces: `TextField` accepts `ref?: React.Ref<TextInput>` (React 19 passes it as a prop; it reaches the inner `TextInput` through the existing `...input` spread). Task 8 and Task 15 rely on nothing here.

- [ ] **Step 1: Write the failing test**

`packages/mobile/tests/unit/components/printing/job-screen-message.test.tsx`:

```tsx
// The printer card's Message button goes to the thread that is already on the
// page: no new screen, no new data.
import { render, screen, fireEvent } from '@testing-library/react-native'
import { PrintJobScreen } from '../../../../components/printing/job-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/auth-context', () => ({ useAuth: jest.fn() }))
jest.mock('../../../../lib/supabase', () => ({
  supabase: { storage: { from: () => ({ createSignedUrl: () => Promise.resolve({ data: null }) }) } },
}))
jest.mock('expo-image-picker', () => ({}))

const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => mockGet(...a), post: jest.fn() },
}))
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return { useFocusEffect: (effect: () => void) => useEffect(effect, []), useRouter: () => ({ push: jest.fn() }) }
})
jest.mock('../../../../lib/capabilities', () => ({
  useCapabilities: () => ({ caps: { profile: { id: 'family' }, ledOrgs: [] } }),
}))

const mockFocus = jest.fn()
jest.mock('../../../../components/ui/TextField', () => {
  const React = jest.requireActual('react')
  const { TextInput } = jest.requireActual('react-native')
  return {
    TextField: ({ ref, ...props }: { ref?: unknown }) => {
      React.useImperativeHandle(ref, () => ({ focus: mockFocus }))
      return React.createElement(TextInput, props)
    },
  }
})

it('takes the family to the thread input from the printer card', async () => {
  mockGet.mockImplementation((path: string) =>
    path === '/api/toy-transactions/j1'
      ? Promise.resolve({
          id: 'j1', type: 'print', status: 'accepted', requester_id: 'family', owner_id: 'maker', owner_org_id: null,
          requester_name: 'Family', owner_name: 'Tom B.', tutorial_title: 'Switch mount', printer_id: null, printer: null,
          print_files: [{ id: 's1', filename: 'mount.stl', quantity: 1 }], print_group_id: 'g', print_group_size: 1,
          printing_started_at: null, ready_at: null, ready_photo_url: null, owner_code: null, requester_code: '222222',
          owner_confirmed_at: null, requester_confirmed_at: null, created_at: new Date().toISOString(), messages: [],
        })
      : Promise.reject(new Error('n/a'))
  )
  render(<PrintJobScreen id="j1" />)
  fireEvent.press(await screen.findByText('Message'))
  expect(mockFocus).toHaveBeenCalled()
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/printing/job-screen-message.test.tsx`
Expected: FAIL — `expect(jest.fn()).toHaveBeenCalled()` (the pending button routes to Not built yet instead).

- [ ] **Step 3: Implement**

`TextField.tsx` — import `TextInput` is already there; widen the props type (the destructure is unchanged, `ref` rides in `...input`):

```tsx
}: TextInputProps & {
  /** React 19 passes a ref as a prop; it reaches the TextInput via `...input`. */
  ref?: React.Ref<TextInput>
  label?: string
```

`job-screen.tsx`:
- Add `type TextInput` to the `react-native` import.
- In `PrintJobScreen`, beside `generation`:

```tsx
  const scrollRef = useRef<ScrollView>(null)
  const inputRef = useRef<TextInput>(null)

  // The board's Message button. The thread is already on this page, so it
  // goes there rather than opening anything new.
  function openThread() {
    scrollRef.current?.scrollToEnd?.({ animated: true })
    inputRef.current?.focus()
  }
```

- `<ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>` → add `ref={scrollRef}`.
- The composer's `<TextField accessibilityLabel={`Message ${other}`} …>` → add `ref={inputRef}`.
- Pass `onMessage={openThread}` to `<StateCard … />`, add `onMessage: () => void` to its props type and destructure, and replace

```tsx
        {!isPrinter ? <PendingButton pending="message-printer" label="Message" variant="ghost" /> : null}
```

with

```tsx
        {!isPrinter ? <Button label="Message" variant="ghost" onPress={onMessage} /> : null}
```

(`PendingButton` stays imported — the collected card still uses it.)

- [ ] **Step 4: Run the tests to see them pass**

Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/printing`
Expected: PASS (all printing tests, including the existing `job-screen.test.tsx`)

- [ ] **Step 5: Ship the item** — `shipped: true,` on `'message-printer'`; `node scripts/pending.mjs`; no parity rule names this id; run the drift test → `Tests  11 passed (11)`.

- [ ] **Step 6: Commit**

```bash
git add packages/mobile/components/ui/TextField.tsx packages/mobile/components/printing/job-screen.tsx packages/mobile/tests/unit/components/printing/job-screen-message.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(mobile): Message on a print job's printer card goes to the thread

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 2: Your standard rates on Add a printer (`add-printer-rates`)

**Files:**
- Modify: `packages/mobile/components/printing/add-printer-screen.tsx`
- Modify: `scripts/parity/app-screen-map.json` (the three `print_add` rules naming `add-printer-rates`)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/mobile/tests/unit/components/printing/add-printer-screen.test.tsx` (new)

**Interfaces:**
- Consumes: `dollarsToCents(input: string): number | null` from `@splat-connect/types` (exists); `POST /api/printers` already accepts `filament_cents_per_g` (int ≥ 0 ≤ 100000 or null) and `rate_note` (≤ 500).
- Produces: nothing other tasks use.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/mobile/tests/unit/components/printing/add-printer-screen.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { AddPrinterScreen } from '../../../../components/printing/add-printer-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { post: (...a: unknown[]) => mockPost(...a) } }))
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }))
jest.mock('../../../../lib/capabilities', () => ({
  useCapabilities: () => ({ caps: { profile: { id: 'me', pickup_suburb: 'Newtown', pickup_state: 'NSW' }, ledOrgs: [] } }),
}))

beforeEach(() => mockPost.mockReset())

it('sends the standard rates with the printer', async () => {
  mockPost.mockResolvedValue({})
  render(<AddPrinterScreen />)
  expect(screen.getByText('Nothing listed — your card will say you cover everything yourself.')).toBeTruthy()
  fireEvent.changeText(screen.getByLabelText('Make and model'), 'Bambu P1S')
  fireEvent.changeText(screen.getByLabelText('Dollars per gram'), '0.12')
  fireEvent.changeText(screen.getByLabelText('Why these costs'), 'At what the spool cost me.')
  fireEvent.press(screen.getByText('Add printer'))
  await waitFor(() =>
    expect(mockPost).toHaveBeenCalledWith(
      '/api/printers',
      expect.objectContaining({ filament_cents_per_g: 12, rate_note: 'At what the spool cost me.' })
    )
  )
})

it('says no rate is free and sends null', async () => {
  mockPost.mockResolvedValue({})
  render(<AddPrinterScreen />)
  fireEvent.changeText(screen.getByLabelText('Make and model'), 'Ender')
  fireEvent.press(screen.getByText('Add printer'))
  await waitFor(() =>
    expect(mockPost).toHaveBeenCalledWith('/api/printers', expect.objectContaining({ filament_cents_per_g: null, rate_note: null }))
  )
})

it('refuses a rate that is not dollars, and sends nothing', () => {
  render(<AddPrinterScreen />)
  fireEvent.changeText(screen.getByLabelText('Make and model'), 'Ender')
  fireEvent.changeText(screen.getByLabelText('Dollars per gram'), '12c')
  fireEvent.press(screen.getByText('Add printer'))
  expect(screen.getByText('Filament cost is dollars per gram, like 0.12.')).toBeTruthy()
  expect(mockPost).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/printing/add-printer-screen.test.tsx`
Expected: FAIL — `Unable to find an element with text: Nothing listed — …`

- [ ] **Step 3: Implement** (`add-printer-screen.tsx`)

- Imports: drop `PendingRow`; change `import { apiMessage } from '@splat-connect/types'` to `import { apiMessage, dollarsToCents } from '@splat-connect/types'`.
- State, beside `ownerOrgId`:

```tsx
  const [rate, setRate] = useState('')
  const [rateNote, setRateNote] = useState('')
```

- `save()` — before `setBusy(true)`:

```tsx
    // Parsed from text, never multiplied (dollarsToCents explains the cent that
    // 12.10 * 100 loses). Empty is the off state: free, parts only (070).
    const cents = rate.trim() ? dollarsToCents(rate) : null
    if (rate.trim() && cents === null) {
      setError('Filament cost is dollars per gram, like 0.12.')
      return
    }
```

  and in the POST body after `notes: …`:

```tsx
        filament_cents_per_g: cents,
        rate_note: rateNote.trim() || null,
```

- Replace `<PendingRow pending="add-printer-rates" label="Your standard rates" icon="pricetag-outline" />` with web's panel, in the board's words:

```tsx
        <View style={styles.rates}>
          <Text style={styles.eyebrow}>Your standard rates</Text>
          <Text style={styles.meta}>
            What a family is asked to cover, shown on your card before they request. Your time and your machine stay free.
          </Text>
          <TextField
            label="Dollars per gram"
            accessibilityLabel="Dollars per gram"
            placeholder="0.12"
            inputMode="decimal"
            value={rate}
            onChangeText={setRate}
          />
          {rate.trim() ? null : (
            <Text style={styles.meta}>Nothing listed — your card will say you cover everything yourself.</Text>
          )}
          <TextField
            label="Why these costs"
            accessibilityLabel="Why these costs"
            placeholder="e.g. filament at what the spool cost me, nothing for time."
            maxLength={500}
            multiline
            value={rateNote}
            onChangeText={setRateNote}
          />
        </View>
```

- Style:

```tsx
  rates: {
    gap: theme.spacing(2),
    padding: theme.spacing(4),
    borderRadius: theme.radii.card,
    backgroundColor: theme.colors.honeySoft,
  },
```

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/printing/add-printer-screen.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Ship the item** — `shipped: true,` on `'add-printer-rates'`; delete the three `print_add` `explained` rules whose `pending` is `add-printer-rates` in `scripts/parity/app-screen-map.json` (drop the `explained` key if it empties); `node scripts/pending.mjs`; drift test → `Tests  11 passed (11)`.

- [ ] **Step 6: Commit**

```bash
git add packages/mobile/components/printing/add-printer-screen.tsx packages/mobile/tests/unit/components/printing/add-printer-screen.test.tsx scripts/parity/app-screen-map.json packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(mobile): Add a printer takes your standard rates

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 3: How many of each part (`print-part-quantity`)

**Files:**
- Modify: `packages/api/src/routes/toy-transactions.ts` (`POST /print` — the `fileIds` block, the `print_job_files` insert, the system message count)
- Modify: `packages/mobile/components/printing/request-screen.tsx` (stepper, payload)
- Modify: `packages/web/components/request-print-form.tsx` (stepper, payload, header comment's "per-part quantity … not drawn" sentence)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/api/tests/integration/printers/print-quantity.test.ts` (new), `packages/mobile/tests/unit/components/printing/request-screen.test.tsx` (new), `packages/web/tests/unit/components/request-print-form.test.tsx`

**Interfaces:**
- Consumes: `print_job_files.quantity` (058, 1–20).
- Produces: `POST /api/toy-transactions/print` accepts `files: Array<{ stl_file_id: string; quantity?: number }>` (quantity defaults to 1) in place of `stl_file_ids: string[]` (still accepted). Task 4 and Task 8 extend the mobile request screen's `send()` and rely on its `qty: Record<string, number>` state and `ticked` list.

- [ ] **Step 1: Write the failing tests**

`packages/api/tests/integration/printers/print-quantity.test.ts`:

```ts
/**
 * A quantity per part (058's print_job_files.quantity, 1–20). `files` carries
 * it; the old `stl_file_ids` still means one of each.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let family: TestUser
let owner: TestUser
let tutorialId: string
let printerId: string
let a: string
let b: string

const post = (body: unknown) =>
  app.request('/api/toy-transactions/print', {
    method: 'POST',
    headers: { Authorization: `Bearer ${family.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
const clear = () => adminClient().from('toy_transactions').delete().eq('tutorial_id', tutorialId)

beforeAll(async () => {
  family = await createTestUser('contributor')
  owner = await createTestUser('contributor')
  const admin = adminClient()
  const { data: t } = await admin
    .from('tutorials')
    .insert({ title: 'Quantity fixture', description: 'x', difficulty: 'easy', status: 'approved' })
    .select('id')
    .single()
  tutorialId = t!.id
  const { data: files } = await admin
    .from('stl_files')
    .insert([
      { tutorial_id: tutorialId, filename: 'a.stl', file_url: `${tutorialId}/a.stl` },
      { tutorial_id: tutorialId, filename: 'b.stl', file_url: `${tutorialId}/b.stl` },
    ])
    .select('id, filename')
  a = files!.find((f) => f.filename === 'a.stl')!.id
  b = files!.find((f) => f.filename === 'b.stl')!.id
  const { data: p } = await admin
    .from('printers')
    .insert({ owner_id: owner.id, name: 'Qty printer', materials: ['PLA'], bed_x: 200, bed_y: 200, bed_z: 200, capacity: 3 })
    .select('id')
    .single()
  printerId = p!.id
})

afterAll(async () => {
  await clear()
  await adminClient().from('printers').delete().eq('id', printerId)
  await adminClient().from('tutorials').delete().eq('id', tutorialId)
  await deleteTestUser(family.id)
  await deleteTestUser(owner.id)
})

describe('POST /print quantities', () => {
  it('stores a quantity per part', async () => {
    const res = await post({
      printer_ids: [printerId],
      tutorial_id: tutorialId,
      files: [{ stl_file_id: a, quantity: 3 }, { stl_file_id: b }],
    })
    expect(res.status).toBe(201)
    const { id } = (await res.json()) as { id: string }
    const { data } = await adminClient().from('print_job_files').select('stl_file_id, quantity').eq('transaction_id', id)
    expect(Object.fromEntries(data!.map((r) => [r.stl_file_id, r.quantity]))).toEqual({ [a]: 3, [b]: 1 })
    await clear()
  })

  it('still takes stl_file_ids as one of each', async () => {
    const res = await post({ printer_ids: [printerId], tutorial_id: tutorialId, stl_file_ids: [a] })
    expect(res.status).toBe(201)
    const { id } = (await res.json()) as { id: string }
    const { data } = await adminClient().from('print_job_files').select('quantity').eq('transaction_id', id)
    expect(data).toEqual([{ quantity: 1 }])
    await clear()
  })

  it.each([
    [[{ stl_file_id: 'x', quantity: 0 }], 'Ask for between 1 and 20 of each part.'],
    [[{ stl_file_id: 'x', quantity: 21 }], 'Ask for between 1 and 20 of each part.'],
    [[{ stl_file_id: 'x', quantity: 1.5 }], 'Ask for between 1 and 20 of each part.'],
  ])('refuses %j', async (files, message) => {
    const res = await post({ printer_ids: [printerId], tutorial_id: tutorialId, files })
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: string }).error).toBe(message)
  })

  it('refuses a part named twice', async () => {
    const res = await post({
      printer_ids: [printerId],
      tutorial_id: tutorialId,
      files: [{ stl_file_id: a }, { stl_file_id: a, quantity: 2 }],
    })
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: string }).error).toBe('Name each part once.')
  })
})
```

`packages/mobile/tests/unit/components/printing/request-screen.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { RequestPrintScreen } from '../../../../components/printing/request-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => mockGet(...a), post: (...a: unknown[]) => mockPost(...a) },
}))
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: jest.fn(), push: jest.fn() }) }))

const GUIDE = {
  id: 'g1',
  title: 'Switch mount',
  stl_files: [
    { id: 's1', filename: 'mount.stl', print_minutes: 60, filament_grams: 10, material: 'PETG' },
    { id: 's2', filename: 'clip.stl', print_minutes: 20, filament_grams: 4, material: 'PETG' },
  ],
}
const PRINTER = { id: 'p1', owner_name: 'Tom B.', org_name: null, filament_cents_per_g: null }

beforeEach(() => {
  mockGet.mockReset()
  mockPost.mockReset()
  mockGet.mockImplementation((path: string) => Promise.resolve(path === '/api/printers' ? [PRINTER] : GUIDE))
})

it('sends a quantity per part', async () => {
  mockPost.mockResolvedValue({ id: 'j1' })
  render(<RequestPrintScreen guideId="g1" printerIds={['p1']} />)
  fireEvent.press(await screen.findByLabelText('More mount.stl'))
  fireEvent.press(screen.getByLabelText('More mount.stl'))
  expect(screen.getByText('×3')).toBeTruthy()
  fireEvent.press(screen.getByLabelText('Fewer mount.stl'))
  fireEvent.press(screen.getByRole('checkbox', { name: /I understand/ }))
  fireEvent.press(screen.getByText('Send request'))
  await waitFor(() =>
    expect(mockPost).toHaveBeenCalledWith(
      '/api/toy-transactions/print',
      expect.objectContaining({
        files: [
          { stl_file_id: 's1', quantity: 2 },
          { stl_file_id: 's2', quantity: 1 },
        ],
      })
    )
  )
})
```

`request-print-form.test.tsx` — in the existing test, change the expected POST body's `stl_file_ids: ['f1'],` to `files: [{ stl_file_id: 'f1', quantity: 1 }],`, and add:

```tsx
  it('sends a quantity per part', async () => {
    const post = vi.mocked(browserApiClient.post).mockResolvedValue({ id: 'tx-2' })
    render(
      <RequestPrintForm
        tutorialId="t1"
        tutorialTitle="Switch mount"
        parts={[{ id: 'f1', filename: 'mount.stl', print_minutes: null, filament_grams: null, material: 'PETG' }]}
        printers={[printer('a', 'Ann')]}
        header={<h1>Request a print</h1>}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'More mount.stl' }))
    fireEvent.click(screen.getByRole('checkbox', { name: /I understand/ }))
    fireEvent.click(screen.getByRole('button', { name: /Send request/ }))
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/api/toy-transactions/print', expect.objectContaining({ files: [{ stl_file_id: 'f1', quantity: 2 }] }))
    )
  })
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/printers/print-quantity.test.ts` → FAIL (`files` ignored: 400 "Tick at least one part to print.").
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/printing/request-screen.test.tsx` → FAIL (no `More mount.stl`).
Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/components/request-print-form.test.tsx` → FAIL.

- [ ] **Step 3: Implement**

`toy-transactions.ts`, `POST /print` — replace

```ts
  const fileIds = Array.isArray(body.stl_file_ids) ? body.stl_file_ids : []
  if (fileIds.length === 0 || !fileIds.every((id: unknown) => typeof id === 'string')) {
    return c.json({ error: 'Tick at least one part to print.' }, 400)
  }
```

with

```ts
  // `files` carries a quantity per part (058's print_job_files.quantity,
  // 1–20). `stl_file_ids` is the form every client sent before, and still
  // means one of each.
  const wanted: Array<{ id: unknown; quantity: unknown }> = Array.isArray(body.files)
    ? body.files.map((f: { stl_file_id?: unknown; quantity?: unknown } | null) => ({
        id: f?.stl_file_id,
        quantity: f?.quantity ?? 1,
      }))
    : (Array.isArray(body.stl_file_ids) ? body.stl_file_ids : []).map((id: unknown) => ({ id, quantity: 1 }))
  if (wanted.length === 0 || !wanted.every((f) => typeof f.id === 'string')) {
    return c.json({ error: 'Tick at least one part to print.' }, 400)
  }
  if (!wanted.every((f) => Number.isInteger(f.quantity) && (f.quantity as number) >= 1 && (f.quantity as number) <= 20)) {
    return c.json({ error: 'Ask for between 1 and 20 of each part.' }, 400)
  }
  const quantityOf = new Map(wanted.map((f) => [f.id as string, f.quantity as number]))
  // print_job_files' primary key is (transaction, file): a part named twice
  // would be a 500 from the insert, so it is a sentence here.
  if (quantityOf.size !== wanted.length) return c.json({ error: 'Name each part once.' }, 400)
  const fileIds = [...quantityOf.keys()]
```

The link insert inside the per-printer loop:

```ts
      .insert(rows.map((f) => ({ transaction_id: tx.id, stl_file_id: f.id, quantity: quantityOf.get(f.id) ?? 1 })))
```

and the message count:

```ts
  const count = rows.reduce((n, f) => n + (quantityOf.get(f.id) ?? 1), 0)
  const parts = `${count} part${count === 1 ? '' : 's'}`
```

`request-screen.tsx`:
- State beside `parts`: `const [qty, setQty] = useState<Record<string, number>>({})`, and a helper inside the component:

```tsx
  const qtyOf = (id: string) => qty[id] ?? 1
  const bump = (id: string, by: number) =>
    setQty((cur) => ({ ...cur, [id]: Math.min(20, Math.max(1, (cur[id] ?? 1) + by)) }))
```

- `const ticked = guide.stl_files.filter((f) => parts.includes(f.id))` → 

```tsx
  const ticked = guide.stl_files.filter((f) => parts.includes(f.id)).map((f) => ({ ...f, quantity: qtyOf(f.id) }))
```

- In `send()`, replace `stl_file_ids: parts,` with `files: ticked.map((f) => ({ stl_file_id: f.id, quantity: f.quantity })),`.
- Replace the comment and `<Text style={styles.meta}>×1</Text>` with a stepper (a sibling of the checkbox row's content, inside the same `Pressable` row is wrong — nested pressables swallow taps — so wrap the row: change the part's outer `Pressable` to a `View style={[styles.part, on && styles.partOn]}` containing the existing `Pressable` (checkbox + name, `style={styles.partTick}`) and this stepper):

```tsx
                <View accessibilityRole="adjustable" style={styles.stepper}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Fewer ${f.filename}`}
                    disabled={!on || qtyOf(f.id) <= 1}
                    onPress={() => bump(f.id, -1)}
                    hitSlop={8}
                  >
                    <Ionicons name="remove-circle-outline" size={24} color={theme.colors.primaryDark} />
                  </Pressable>
                  <Text style={styles.meta}>×{qtyOf(f.id)}</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`More ${f.filename}`}
                    disabled={!on || qtyOf(f.id) >= 20}
                    onPress={() => bump(f.id, 1)}
                    hitSlop={8}
                  >
                    <Ionicons name="add-circle-outline" size={24} color={theme.colors.primaryDark} />
                  </Pressable>
                </View>
```

  Styles: `partTick: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3) }`, `stepper: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) }`.

`request-print-form.tsx`:
- State: `const [qty, setQty] = useState<Record<string, number>>({})` and `const qtyOf = (id: string) => qty[id] ?? 1`.
- `const ticked = parts.filter((p) => picked.includes(p.id))` → `.map((p) => ({ ...p, quantity: qtyOf(p.id) }))` (the summary tiles already multiply by `quantity`, `lib/print-settings.ts`).
- Payload: `stl_file_ids: picked,` → `files: ticked.map((p) => ({ stl_file_id: p.id, quantity: p.quantity })),`.
- In each part `<li>`, after the filename `<span>`, the board's stepper (`role="group" aria-label="Quantity"`, Fewer / More):

```tsx
                  <span role="group" aria-label="Quantity" className="inline-flex items-center gap-0.5 rounded-full border border-line bg-surface p-[3px]">
                    <button
                      type="button"
                      aria-label={`Fewer ${part.filename}`}
                      disabled={!on || qtyOf(part.id) <= 1}
                      onClick={() => setQty((q) => ({ ...q, [part.id]: Math.max(1, qtyOf(part.id) - 1) }))}
                      className="h-9 w-9 rounded-full text-lg text-ink"
                    >
                      −
                    </button>
                    <output aria-live="polite" className="min-w-8 text-center font-mono text-sm font-bold">
                      ×{qtyOf(part.id)}
                    </output>
                    <button
                      type="button"
                      aria-label={`More ${part.filename}`}
                      disabled={!on || qtyOf(part.id) >= 20}
                      onClick={() => setQty((q) => ({ ...q, [part.id]: Math.min(20, qtyOf(part.id) + 1) }))}
                      className="h-9 w-9 rounded-full text-lg text-ink"
                    >
                      +
                    </button>
                  </span>
```

- Header comment: replace "The board's per-part quantity and deadline have no field on the request yet, so they are not drawn — a stepper that sends nothing would be a promise the job page breaks." with "Each part carries a quantity (058's `print_job_files.quantity`); the board's deadline has no field yet, so it is not drawn."

- [ ] **Step 4: Run the tests to see them pass**

Run the three commands from Step 2. Expected: PASS.

- [ ] **Step 5: Ship the item** — `shipped: true,` on `'print-part-quantity'`; the `PENDING(print-part-quantity)` comment went with the `×1`; `node scripts/pending.mjs`; drift test → `Tests  11 passed (11)`.

- [ ] **Step 6: Commit**

```bash
git add packages/api/src/routes/toy-transactions.ts packages/api/tests/integration/printers/print-quantity.test.ts packages/mobile/components/printing/request-screen.tsx packages/mobile/tests/unit/components/printing/request-screen.test.tsx packages/web/components/request-print-form.tsx packages/web/tests/unit/components/request-print-form.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(printing): a print request asks for a quantity of each part

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 4: Cost estimate in the agree line (`print-cost-estimate`)

**Files:**
- Create: `packages/types/src/printing.ts`
- Modify: `packages/types/src/index.ts` (add `export * from './printing'` beside `export * from './pending'`)
- Modify: `packages/mobile/components/printing/request-screen.tsx` (agree line)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/web/tests/unit/lib/printing.test.ts` (new), `packages/mobile/tests/unit/components/printing/request-screen.test.tsx`

**Interfaces:**
- Consumes: Task 3's `ticked` (parts with `quantity`) and `printers: PrinterWithOwner[]` on the request screen; `formatCents` from `@splat-connect/types`.
- Produces: `printCostCents(files: Array<{ filament_grams?: number | null; quantity?: number }>, centsPerGram: number | null): number | null`; `costRange(estimates: Array<number | null>): [number, number] | null`. Every later task appends to `printing.ts`.

- [ ] **Step 1: Write the failing tests**

`packages/web/tests/unit/lib/printing.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { printCostCents, costRange } from '@splat-connect/types'

describe('printCostCents', () => {
  it('sums grams × quantity × rate', () => {
    expect(printCostCents([{ filament_grams: 10, quantity: 2 }, { filament_grams: 5 }], 12)).toBe(300)
  })
  it('is null with no rate — null is free, parts only (070)', () => {
    expect(printCostCents([{ filament_grams: 10 }], null)).toBeNull()
  })
  it('is null when any part lacks grams, rather than a confident undercount', () => {
    expect(printCostCents([{ filament_grams: 10 }, { filament_grams: null }], 12)).toBeNull()
  })
  it('is null with nothing ticked', () => {
    expect(printCostCents([], 12)).toBeNull()
  })
})

describe('costRange', () => {
  it('spans the printers that have an estimate', () => {
    expect(costRange([300, null, 120])).toEqual([120, 300])
  })
  it('is null when none has one', () => {
    expect(costRange([null, null])).toBeNull()
  })
})
```

Append to `request-screen.test.tsx`:

```tsx
it('names the estimate in the agree line, and falls back without a rate', async () => {
  mockGet.mockImplementation((path: string) =>
    Promise.resolve(
      path === '/api/printers'
        ? [{ ...PRINTER, filament_cents_per_g: 10 }, { id: 'p2', owner_name: 'Ann', org_name: null, filament_cents_per_g: 20 }]
        : GUIDE
    )
  )
  render(<RequestPrintScreen guideId="g1" printerIds={['p1', 'p2']} />)
  // 14 g at 10c and 20c a gram.
  expect(
    await screen.findByText(
      'I understand I cover the filament — about $1.40–$2.80 at the printer’s declared rate — and that I settle it with them, not through SPLAT.'
    )
  ).toBeTruthy()
})

it('keeps today’s line when no printer declared a rate', async () => {
  render(<RequestPrintScreen guideId="g1" printerIds={['p1']} />)
  expect(
    await screen.findByText('I understand I cover the filament, and that I settle it with the printer, not through SPLAT.')
  ).toBeTruthy()
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/lib/printing.test.ts` → FAIL (`printCostCents` is not exported).
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/printing/request-screen.test.tsx` → FAIL.

- [ ] **Step 3: Implement**

`packages/types/src/printing.ts`:

```ts
/**
 * The print rules the API, web and the phone share — cost, expiry, stats,
 * bed fit, customization, the parts catalogue, verification.
 *
 * No runtime import from ./index: index re-exports this file and imports from
 * it, so a value import back would be a cycle. Type-only imports are fine.
 */

type Grams = { filament_grams?: number | null; quantity?: number }

/**
 * What a family is asked to cover for these parts at one printer's declared
 * rate, in cents: Σ grams × quantity × rate. Null when the rate is null (070:
 * the toggle's off state, "free, parts only"), when any part has no grams, or
 * when nothing is ticked — a line that undercounts is worse than none.
 */
export function printCostCents(files: Grams[], centsPerGram: number | null): number | null {
  if (centsPerGram === null || files.length === 0) return null
  if (files.some((f) => f.filament_grams == null)) return null
  return files.reduce((n, f) => n + f.filament_grams! * (f.quantity ?? 1) * centsPerGram, 0)
}

/** Lowest and highest estimate across the printers picked; null when none has one. */
export function costRange(estimates: Array<number | null>): [number, number] | null {
  const known = estimates.filter((e): e is number => e !== null)
  return known.length ? [Math.min(...known), Math.max(...known)] : null
}
```

`index.ts`: add `export * from './printing'` on the line after `export * from './pending'`.

`request-screen.tsx`:
- Import `costRange, formatCents, printCostCents` from `@splat-connect/types` (beside `apiMessage, PRINT_COLOURS`).
- After `const ticked = …`:

```tsx
  // The board's agree line names the figure when every picked printer's rate
  // and every part's grams are known; a range when the printers differ.
  const range = costRange(printers.map((p) => printCostCents(ticked, p.filament_cents_per_g)))
  const about = range && (range[0] === range[1] ? formatCents(range[0]) : `${formatCents(range[0])}–${formatCents(range[1])}`)
  const agreeLine = about
    ? `I understand I cover the filament — about ${about} at the printer’s declared rate — and that I settle it with them, not through SPLAT.`
    : 'I understand I cover the filament, and that I settle it with the printer, not through SPLAT.'
```

- Delete the `PENDING(print-cost-estimate)` comment; the agree `Pressable` gains `accessibilityLabel={agreeLine}` and its `<Text>` renders `{agreeLine}`.

- [ ] **Step 4: Run the tests to see them pass**

Run both commands from Step 2. Expected: PASS.

- [ ] **Step 5: Ship the item** — `shipped: true,` on `'print-cost-estimate'`; `node scripts/pending.mjs`; drift test → `Tests  11 passed (11)`.

- [ ] **Step 6: Commit**

```bash
git add packages/types/src/printing.ts packages/types/src/index.ts packages/web/tests/unit/lib/printing.test.ts packages/mobile/components/printing/request-screen.tsx packages/mobile/tests/unit/components/printing/request-screen.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(mobile): the print request's agree line names the filament estimate

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---
### Task 5: Answer by, and expiry (`print-answer-by`)

**Files:**
- Modify: `packages/types/src/printing.ts` (append), `packages/types/src/index.ts` (import `printRequestExpired`; `needsAction`)
- Modify: `packages/api/src/routes/toy-transactions.ts` (`POST /:id/accept`; `GET /action-count` select gains `created_at`)
- Modify: `packages/web/lib/print-stages.ts`, `packages/web/components/print-next-step.tsx`
- Modify: `packages/mobile/lib/printing.ts` (`JobState`, `jobState`, `JOB_LABEL`, `JOB_TONE`, `answerByLabel`), `packages/mobile/components/printing/job-screen.tsx` (`StateCard`), `packages/mobile/components/printing/offer-screen.tsx` (`waiting` / `done`)
- Modify: `packages/mobile/tests/unit/components/ui/pending.test.tsx` (if it names `print-answer-by`), `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/web/tests/unit/lib/printing.test.ts`, `packages/web/tests/unit/lib/print-stages.test.ts` (new), `packages/api/tests/integration/printers/answer-by.test.ts` (new), `packages/mobile/tests/unit/lib/printing.test.ts`, `packages/mobile/tests/unit/components/printing/job-screen.test.tsx`, `packages/mobile/tests/unit/components/printing/offer-screen.test.tsx`, `packages/web/tests/e2e/printing/answer-by.spec.ts` (new)

**Interfaces:**
- Consumes: `shortDate(iso: string): string` (`'8 Oct'`) from `@splat-connect/types`.
- Produces: `PRINT_ANSWER_DAYS = 7`; `answerBy(createdAt: string): string` (ISO); `printRequestExpired(tx: { status: string; created_at?: string | null }, now?: number): boolean`; mobile `JobState` gains `'expired'`, `answerByLabel(createdAt: string): string`. `needsAction`'s first argument may carry `created_at?: string`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/web/tests/unit/lib/printing.test.ts` (merge the import):

```ts
import { answerBy, needsAction, printRequestExpired } from '@splat-connect/types'

const ago = (days: number) => new Date(Date.now() - days * 864e5).toISOString()

describe('answer by', () => {
  it('is seven days after the request', () => {
    expect(answerBy('2026-10-01T00:00:00.000Z')).toBe('2026-10-08T00:00:00.000Z')
  })
  it('expires only a request still waiting, only after the seven days', () => {
    expect(printRequestExpired({ status: 'requested', created_at: ago(6) })).toBe(false)
    expect(printRequestExpired({ status: 'requested', created_at: ago(8) })).toBe(true)
    expect(printRequestExpired({ status: 'accepted', created_at: ago(30) })).toBe(false)
    expect(printRequestExpired({ status: 'requested' })).toBe(false)
  })
  it('stops an expired print request counting as waiting on the printer', () => {
    const tx = {
      status: 'requested', type: 'print', owner_id: 'p', owner_org_id: null, owner_confirmed_at: null,
      requester_confirmed_at: null, working_photo_url: null, work_approved_at: null, printing_started_at: null, ready_at: null,
    } as const
    expect(needsAction({ ...tx, created_at: ago(1) }, 'p')).toBe(true)
    expect(needsAction({ ...tx, created_at: ago(8) }, 'p')).toBe(false)
  })
})
```

`packages/web/tests/unit/lib/print-stages.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { ToyTransactionDetail } from '@splat-connect/types'
import { answerBy, shortDate } from '@splat-connect/types'
import { printStages, printStageFacts } from '@/lib/print-stages'

const ago = (days: number) => new Date(Date.now() - days * 864e5).toISOString()
const tx = (over: Partial<ToyTransactionDetail>) =>
  ({
    status: 'requested', owner_confirmed_at: null, requester_confirmed_at: null, printing_started_at: null, ready_at: null,
    decline_reason: null, created_at: ago(1), updated_at: ago(1), print_files: [], tutorial_title: 'Mount', printer: null,
    ...over,
  }) as ToyTransactionDetail

describe('a waiting print request', () => {
  it('says when the printer has to answer by', () => {
    const t = tx({})
    expect(printStageFacts(t, false).facts).toContainEqual({ label: 'Answer by', value: shortDate(answerBy(t.created_at)) })
    expect(printStages(t)[0].state).toBe('now')
  })
  it('reads Expired after seven days, on the rail and in the facts', () => {
    const t = tx({ created_at: ago(8) })
    expect(printStages(t)[1]).toEqual({ key: 'accepted', label: 'Accepted', caption: 'Expired', state: 'stop' })
    expect(printStageFacts(t, true).facts).toContainEqual({ label: 'Answer by', value: `Expired ${shortDate(answerBy(t.created_at))}` })
  })
})
```

`packages/api/tests/integration/printers/answer-by.test.ts`:

```ts
/**
 * Answer by: a print request waits seven days. After that accept refuses it
 * and the badge stops counting it — computed on read, no scheduled job.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let family: TestUser
let owner: TestUser
let tutorialId: string
let printerId: string
let staleId: string

const as = (u: TestUser, method = 'GET', body?: unknown) => ({
  method,
  headers: { Authorization: `Bearer ${u.token}`, 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
})
const pickup = { pickup_line1: '1 Test St', pickup_suburb: 'Newtown', pickup_state: 'NSW', pickup_postcode: '2042' }

beforeAll(async () => {
  family = await createTestUser('contributor')
  owner = await createTestUser('contributor')
  const admin = adminClient()
  const { data: t } = await admin
    .from('tutorials')
    .insert({ title: 'Answer-by fixture', description: 'x', difficulty: 'easy', status: 'approved' })
    .select('id')
    .single()
  tutorialId = t!.id
  const { data: p } = await admin
    .from('printers')
    .insert({ owner_id: owner.id, name: 'Slow printer', materials: ['PLA'], bed_x: 200, bed_y: 200, bed_z: 200 })
    .select('id')
    .single()
  printerId = p!.id
  const { data: stale } = await admin
    .from('toy_transactions')
    .insert({
      type: 'print', status: 'requested', tutorial_id: tutorialId, printer_id: printerId, requester_id: family.id,
      owner_id: owner.id, print_group_id: crypto.randomUUID(), created_at: new Date(Date.now() - 8 * 864e5).toISOString(),
    })
    .select('id')
    .single()
  staleId = stale!.id
})

afterAll(async () => {
  await adminClient().from('toy_transactions').delete().eq('tutorial_id', tutorialId)
  await adminClient().from('printers').delete().eq('id', printerId)
  await adminClient().from('tutorials').delete().eq('id', tutorialId)
  await deleteTestUser(family.id)
  await deleteTestUser(owner.id)
})

describe('an unanswered print request after seven days', () => {
  it('cannot be accepted, and says when it expired', async () => {
    const res = await app.request(`/api/toy-transactions/${staleId}/accept`, as(owner, 'POST', pickup))
    expect(res.status).toBe(409)
    expect(((await res.json()) as { error: string }).error).toMatch(/^This request expired on \d{1,2} \w{3}; ask again\.$/)
  })

  it('no longer counts on the printer’s badge', async () => {
    const res = await app.request('/api/toy-transactions/action-count', as(owner))
    expect(await res.json()).toEqual({ count: 0 })
  })
})
```

Append to `packages/mobile/tests/unit/lib/printing.test.ts`:

```ts
describe('expiry', () => {
  const ago = (days: number) => new Date(Date.now() - days * 864e5).toISOString()
  it('calls an unanswered request expired after seven days', () => {
    expect(jobState({ status: 'requested', printing_started_at: null, ready_at: null, created_at: ago(8) })).toBe('expired')
    expect(jobState({ status: 'requested', printing_started_at: null, ready_at: null, created_at: ago(2) })).toBe('asked')
  })
})
```

Append to `job-screen.test.tsx`:

```tsx
it('tells the family when the printer has to answer by, and says Expired after it', async () => {
  serve(job({ created_at: new Date(Date.now() - 8 * 864e5).toISOString() }))
  render(<PrintJobScreen id="j1" />)
  expect(await screen.findByText(/^This request expired on .+; ask again\.$/)).toBeTruthy()
  expect(screen.getAllByText('Expired').length).toBeGreaterThan(0)
})
```

Append to `offer-screen.test.tsx`:

```tsx
it('leaves an expired request off the Requests tab', async () => {
  mockGet.mockImplementation((path: string) =>
    Promise.resolve(
      path === '/api/printers/mine'
        ? [machine('Bambu P1S', { bed_x: 256 })]
        : [{ ...REQUEST, created_at: new Date(Date.now() - 8 * 864e5).toISOString() }]
    )
  )
  render(<PrintForOthersScreen />)
  expect(await screen.findByText('Nothing waiting')).toBeTruthy()
})
```

`packages/web/tests/e2e/printing/answer-by.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { acceptTerms, adminClient, createContributor, createTutorial, deleteUser, signIn, uniqueTitle } from '../helpers'

test('a family waiting on a printer is told when it has to answer by', async ({ page }) => {
  const family = await createContributor()
  const maker = await createContributor()
  await acceptTerms(family.id)
  const tutorialId = await createTutorial(maker.id, { title: uniqueTitle('E2E Answer by'), status: 'approved' })
  const admin = adminClient()
  const { data: printer } = await admin
    .from('printers')
    .insert({ owner_id: maker.id, name: 'E2E printer', materials: ['PLA'], bed_x: 200, bed_y: 200, bed_z: 200 })
    .select('id')
    .single()
  const { data: job } = await admin
    .from('toy_transactions')
    .insert({
      type: 'print', status: 'requested', tutorial_id: tutorialId, printer_id: printer!.id,
      requester_id: family.id, owner_id: maker.id, print_group_id: crypto.randomUUID(),
    })
    .select('id')
    .single()
  try {
    await signIn(page, family.email, family.password)
    await page.goto(`/dashboard/print-requests/${job!.id}`)
    await expect(
      page.getByText(/They have until \d{1,2} \w{3} to answer\. You can add a printer or withdraw at any time\./)
    ).toBeVisible()
    await expect(page.getByText('Answer by', { exact: true })).toBeVisible()
  } finally {
    await admin.from('toy_transactions').delete().eq('id', job!.id)
    await admin.from('printers').delete().eq('id', printer!.id)
    await admin.from('tutorials').delete().eq('id', tutorialId)
    await deleteUser(family.id)
    await deleteUser(maker.id)
  }
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/lib/printing.test.ts tests/unit/lib/print-stages.test.ts` → FAIL (`answerBy` not exported).
Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/printers/answer-by.test.ts` → FAIL (accept answers 200; count 1).
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/lib/printing.test.ts tests/unit/components/printing` → FAIL.

- [ ] **Step 3: Implement**

Append to `packages/types/src/printing.ts`:

```ts
/** Days a printer has to answer a print request (the board's "7 days from today"). */
export const PRINT_ANSWER_DAYS = 7

/** When a request sent at `createdAt` stops waiting for an answer, as an ISO instant. */
export const answerBy = (createdAt: string): string =>
  new Date(Date.parse(createdAt) + PRINT_ANSWER_DAYS * 86_400_000).toISOString()

/**
 * A request nobody answered in time. Computed on read — no scheduled job flips
 * a status, and `status` keeps its members (058) — so every reader asks this.
 */
export function printRequestExpired(
  tx: { status: string; created_at?: string | null },
  now: number = Date.now()
): boolean {
  return tx.status === 'requested' && !!tx.created_at && now > Date.parse(answerBy(tx.created_at))
}
```

`index.ts` — add near the top, after the existing `export … from` lines: `import { printRequestExpired } from './printing'`. In `needsAction`, widen the first parameter's intersection to `& { blocked_by_rival_accept?: boolean; created_at?: string }` and change the requested line to:

```ts
  // An expired print request waits on nobody (printing.ts): it reads Expired
  // to both sides, and accept refuses it.
  if (tx.status === 'requested') {
    return isOwner && !tx.blocked_by_rival_accept && !(tx.type === 'print' && printRequestExpired(tx))
  }
```

`toy-transactions.ts`:
- Import `answerBy, printRequestExpired, shortDate` from `@splat-connect/types` (beside `needsAction, isOwnerSide`).
- `GET /action-count` select string: add `created_at` after `ready_at`.
- `POST /:id/accept`, right after `if (tx.status !== 'requested') return c.json({ error: 'This request is no longer open' }, 409)`:

```ts
  if (tx.type === 'print' && printRequestExpired(tx)) {
    return c.json({ error: `This request expired on ${shortDate(answerBy(tx.created_at))}; ask again.` }, 409)
  }
```

`packages/web/lib/print-stages.ts`:
- Import `answerBy, printRequestExpired, shortDate` from `@splat-connect/types` (`shortDate` is already imported).
- `case 'requested':` becomes:

```ts
    case 'requested':
      // Nobody answered in seven days. Read off created_at, so no job has to
      // run for it to happen.
      if (printRequestExpired(tx)) {
        return [
          asked,
          { key: 'accepted', label: 'Accepted', caption: 'Expired', state: 'stop' },
          { key: 'printing', label: 'Printing', caption: 'Never got here', state: 'todo' },
          { key: 'ready', label: 'Ready', caption: 'Never got here', state: 'todo' },
          { key: 'collected', label: 'Collected', caption: 'Never got here', state: 'todo' },
        ]
      }
      return [
```

  (the existing five stages follow unchanged).
- In `printStageFacts`'s requested branch delete the two `PENDING(print-answer-by)` comment lines and replace `{ label: 'Sent', value: new Date(tx.created_at).toLocaleDateString('en-AU') },` with:

```ts
        {
          label: 'Answer by',
          value: printRequestExpired(tx)
            ? `Expired ${shortDate(answerBy(tx.created_at))}`
            : shortDate(answerBy(tx.created_at)),
        },
```

`print-next-step.tsx` — import `answerBy, printRequestExpired, shortDate` from `@splat-connect/types`; the requested branch becomes:

```tsx
    if (tx.status === 'requested') {
      const until = shortDate(answerBy(tx.created_at))
      if (printRequestExpired(tx)) {
        return {
          tone: 'bg-sunken',
          Icon: HourglassMedium,
          kicker: 'Expired',
          title: 'Expired',
          body: `This request expired on ${until}; ask again.`,
        }
      }
      return viewerIsPrinter
        ? {
            tone: 'bg-honey-soft',
            Icon: PrinterIcon,
            kicker: 'Waiting on you',
            title: 'Take the job, or decline',
            body: 'Check the parts fit the bed and the material is loaded. Declining needs a reason — the family sees it on their own screen.',
          }
        : {
            tone: 'bg-mint-soft',
            Icon: HourglassMedium,
            kicker: 'Next step',
            title: 'Waiting on the printers',
            body: `They have until ${until} to answer. You can add a printer or withdraw at any time.`,
          }
    }
```

`packages/mobile/lib/printing.ts`:
- Import `answerBy, printRequestExpired` from `@splat-connect/types` (merge into the existing value import).
- `export type JobState = 'asked' | 'accepted' | 'printing' | 'ready' | 'collected' | 'declined' | 'withdrawn' | 'expired'`
- `jobState`'s parameter: `tx: Pick<ToyTransaction, 'status' | 'printing_started_at' | 'ready_at'> & { created_at?: string }`, and first line of its body: `if (printRequestExpired(tx)) return 'expired'`.
- `JOB_LABEL` gains `expired: 'Expired',`; `JOB_TONE` gains `expired: 'withdrawn',`.
- Add:

```ts
/** "8 Oct" — the day an unanswered request expires, in the job page's date form. */
export const answerByLabel = (createdAt: string) =>
  new Date(answerBy(createdAt)).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
```

`job-screen.tsx` (`StateCard`; import `answerByLabel` from `../../lib/printing`):
- The printer's asked card: after its body `<Text>`, add `<Text style={styles.meta}>Answer by — {answerByLabel(tx.created_at)}</Text>`.
- The family's asked card text becomes:

```tsx
        <Text style={[styles.body, styles.flex, styles.ink]}>
          <Text style={styles.strong}>{askedLabel(tx.print_group_size ?? 1)}</Text> The first to accept takes it. They have
          until {answerByLabel(tx.created_at)} to answer. You can add a printer or withdraw at any time.
        </Text>
```

- Before the final (declined / withdrawn) return:

```tsx
  if (state === 'expired') {
    return (
      <Card style={[styles.block, styles.sunken]}>
        <Text style={styles.strong}>Expired</Text>
        <Text style={styles.body}>This request expired on {answerByLabel(tx.created_at)}; ask again.</Text>
      </Card>
    )
  }
```

`offer-screen.tsx`:

```tsx
  // Expired requests leave Requests for Done: accept refuses them (printing.ts).
  const waiting = jobs.filter((t) => t.status === 'requested' && jobState(t) !== 'expired')
  const onTheBed = jobs.filter((t) => t.status === 'accepted')
  const done = jobs.filter((t) => !waiting.includes(t) && t.status !== 'accepted')
```

`pending.test.tsx`: if it names `print-answer-by` (batch 1's Task 18 may have put it there), replace both strings with `org-visit-map` — a test of a pending control should not name a shipped item.

- [ ] **Step 4: Run the tests to see them pass**

Run the three commands from Step 2, then `pnpm --filter @splat-connect/web exec playwright test tests/e2e/printing/answer-by.spec.ts`. Expected: PASS (e2e: `1 passed`).

- [ ] **Step 5: Ship the item** — `shipped: true,` on `'print-answer-by'`; `node scripts/pending.mjs`; no parity rule names it; drift test → `Tests  11 passed (11)`.

- [ ] **Step 6: Commit**

```bash
git add packages/types/src/printing.ts packages/types/src/index.ts packages/api/src/routes/toy-transactions.ts packages/api/tests/integration/printers/answer-by.test.ts packages/web/lib/print-stages.ts packages/web/components/print-next-step.tsx packages/web/tests/unit/lib/printing.test.ts packages/web/tests/unit/lib/print-stages.test.ts packages/web/tests/e2e/printing/answer-by.spec.ts packages/mobile/lib/printing.ts packages/mobile/components/printing/job-screen.tsx packages/mobile/components/printing/offer-screen.tsx packages/mobile/tests/unit/lib/printing.test.ts packages/mobile/tests/unit/components/printing/job-screen.test.tsx packages/mobile/tests/unit/components/printing/offer-screen.test.tsx packages/mobile/tests/unit/components/ui/pending.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(printing): a print request has seven days to be answered, then reads Expired

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 6: Did it fit? (`print-fit-feedback`, migration 094)

**Files:**
- Create: `supabase/migrations/094_print_fit.sql`
- Modify: `packages/api/src/routes/toy-transactions.ts` (`POST /:id/print-fit`)
- Modify: `packages/types/src/index.ts` (`ToyTransaction.print_fit`, `print_fit_at`)
- Modify: `packages/mobile/components/printing/job-screen.tsx` (collected card)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/api/tests/integration/printers/print-fit.test.ts` (new), `packages/mobile/tests/unit/components/printing/job-screen.test.tsx`

**Interfaces:**
- Consumes: `notifyOwnerSide`, `profileName`, `loadForParty`, `sanitizeCodes` in `toy-transactions.ts`.
- Produces: `POST /api/toy-transactions/:id/print-fit` with `{ fit: 'fitted' | 'reprint' }` → 200 job row; 400 bad body; 403 not the requester; 409 not completed or already answered. Columns `toy_transactions.print_fit text`, `print_fit_at timestamptz`. Task 7 counts them.

- [ ] **Step 1: Write the failing tests**

`packages/api/tests/integration/printers/print-fit.test.ts`:

```ts
/**
 * Did it fit? — the family who asked says so once the parts are collected.
 * "Needs a reprint" tells the printer, in the thread and the inbox.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let family: TestUser
let owner: TestUser
let tutorialId: string
let printerId: string

const fit = (u: TestUser, id: string, body: unknown) =>
  app.request(`/api/toy-transactions/${id}/print-fit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${u.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
const job = async (status: 'requested' | 'completed') =>
  (
    await adminClient()
      .from('toy_transactions')
      .insert({
        type: 'print', status, tutorial_id: tutorialId, printer_id: printerId, requester_id: family.id,
        owner_id: owner.id, print_group_id: crypto.randomUUID(),
      })
      .select('id')
      .single()
  ).data!.id as string

beforeAll(async () => {
  family = await createTestUser('contributor')
  owner = await createTestUser('contributor')
  const admin = adminClient()
  const { data: t } = await admin
    .from('tutorials')
    .insert({ title: 'Fit fixture', description: 'x', difficulty: 'easy', status: 'approved' })
    .select('id')
    .single()
  tutorialId = t!.id
  const { data: p } = await admin
    .from('printers')
    .insert({ owner_id: owner.id, name: 'Fit printer', materials: ['PLA'], bed_x: 200, bed_y: 200, bed_z: 200 })
    .select('id')
    .single()
  printerId = p!.id
})

afterAll(async () => {
  await adminClient().from('toy_transactions').delete().eq('tutorial_id', tutorialId)
  await adminClient().from('printers').delete().eq('id', printerId)
  await adminClient().from('tutorials').delete().eq('id', tutorialId)
  await deleteTestUser(family.id)
  await deleteTestUser(owner.id)
})

describe('094 print fit', () => {
  it('has the columns', async () => {
    const { error } = await adminClient().from('toy_transactions').select('print_fit, print_fit_at').limit(1)
    expect(error).toBeNull()
  })

  it('refuses anything but fitted or reprint', async () => {
    expect((await fit(family, await job('completed'), { fit: 'maybe' })).status).toBe(400)
  })

  it('is the family’s to say, not the printer’s', async () => {
    expect((await fit(owner, await job('completed'), { fit: 'fitted' })).status).toBe(403)
  })

  it('waits until the parts are collected', async () => {
    expect((await fit(family, await job('requested'), { fit: 'fitted' })).status).toBe(409)
  })

  it('records a reprint once, and tells the printer', async () => {
    const id = await job('completed')
    const res = await fit(family, id, { fit: 'reprint' })
    expect(res.status).toBe(200)
    expect(((await res.json()) as { print_fit: string }).print_fit).toBe('reprint')
    const admin = adminClient()
    const { data: told } = await admin.from('notifications').select('type').eq('recipient_id', owner.id).eq('toy_transaction_id', id)
    expect(told!.map((n) => n.type)).toContain('toy_message')
    const { data: said } = await admin.from('toy_transaction_messages').select('body').eq('transaction_id', id)
    expect(said!.map((m) => m.body)).toContain('Needs a reprint.')
    expect((await fit(family, id, { fit: 'fitted' })).status).toBe(409)
  })
})
```

Append to `job-screen.test.tsx`:

```tsx
it('asks the family whether it fitted once collected', async () => {
  serve(job({ status: 'completed' }))
  mockPost.mockResolvedValue(job({ status: 'completed', print_fit: 'fitted' }))
  render(<PrintJobScreen id="j1" />)
  expect(
    await screen.findByText('One tap. It goes back to the printer and to the guide author so the next print is better.')
  ).toBeTruthy()
  fireEvent.press(screen.getByText('Fitted'))
  await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/toy-transactions/j1/print-fit', { fit: 'fitted' }))
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `supabase migration up` (nothing to apply yet), then `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/printers/print-fit.test.ts` → FAIL (column `print_fit` does not exist).
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/printing/job-screen.test.tsx` → FAIL.

- [ ] **Step 3: Implement**

`supabase/migrations/094_print_fit.sql`:

```sql
-- 094 — Did it fit? The family says, once, after the parts are collected.
--
-- The board's collected card: "One tap. It goes back to the printer and to the
-- guide author so the next print is better." Two answers, and a timestamp —
-- a print job's stages are timestamps, never status members (058).
--
--   toy_transactions.print_fit     'fitted' or 'reprint'. Null until the family answers.
--   toy_transactions.print_fit_at  when they did. Set with print_fit, never without.
--
-- Counted by 095's print_job_stats as "fitted first time".
--
-- DOWN:
--   alter table public.toy_transactions drop constraint if exists toy_transactions_print_fit_fields;
--   alter table public.toy_transactions drop column if exists print_fit_at;
--   alter table public.toy_transactions drop column if exists print_fit;

alter table public.toy_transactions
  add column print_fit text check (print_fit in ('fitted', 'reprint')),
  add column print_fit_at timestamptz;

alter table public.toy_transactions
  add constraint toy_transactions_print_fit_fields check (
    (type = 'print' or print_fit is null) and ((print_fit is null) = (print_fit_at is null))
  );
```

`toy-transactions.ts`, after `POST /:id/print-ready`:

```ts
/**
 * POST /api/toy-transactions/:id/print-fit
 *
 * "Did it fit?" — the family who asked answers once, after collecting. A
 * reprint tells the printer in the thread and the inbox; a fit needs no
 * message. updated_at is left alone: the job page reads it as the day the
 * parts were collected.
 */
toyTransactions.post('/:id/print-fit', async (c) => {
  const body = (await c.req.json().catch(() => null)) as { fit?: unknown } | null
  const fit = body?.fit
  if (fit !== 'fitted' && fit !== 'reprint') return c.json({ error: 'Say fitted or reprint.' }, 400)

  const loaded = await loadForParty(c)
  if ('status' in loaded) return c.json({ error: 'message' in loaded ? loaded.message : 'Not found' }, loaded.status)
  const tx = loaded.data
  const userId = c.get('userId')
  if (tx.type !== 'print') return c.json({ error: 'Only a print job is asked whether it fitted' }, 400)
  if (userId !== tx.requester_id) return c.json({ error: 'Only the family who asked says whether it fitted' }, 403)
  if (tx.status !== 'completed') return c.json({ error: 'Say whether it fitted once you have collected it' }, 409)
  if (tx.print_fit) return c.json({ error: 'You already said how it fitted.' }, 409)

  const admin = createAdminClient()
  const { data: updated, error } = await admin
    .from('toy_transactions')
    .update({ print_fit: fit, print_fit_at: new Date().toISOString() })
    .eq('id', tx.id)
    .is('print_fit', null)
    .select()
    .maybeSingle()
  if (error) return c.json({ error: error.message }, 500)
  if (!updated) return c.json({ error: 'You already said how it fitted.' }, 409)

  if (fit === 'reprint') {
    await admin.from('toy_transaction_messages').insert({
      transaction_id: tx.id,
      sender_id: userId,
      kind: 'system',
      body: 'Needs a reprint.',
    })
    // The guide's title by hand: subjectName() reads a print job's null toy_id
    // as "a toy".
    const { data: guide } = await admin.from('tutorials').select('title').eq('id', tx.tutorial_id).maybeSingle()
    await notifyOwnerSide(admin, tx as any, {
      type: 'toy_message',
      toy_transaction_id: tx.id,
      toy_name: (guide as { title: string } | null)?.title ?? 'a print job',
      actor_name: await profileName(admin, userId, 'The family'),
    })
  }

  return c.json(sanitizeCodes(updated, userId, await ledOrgIds(admin, userId)))
})
```

`index.ts`, in `ToyTransaction` after `decline_reason`:

```ts
  /** 094. The family's answer to "Did it fit?", once the parts are collected.
   *  Optional: fixtures predate it. */
  print_fit?: 'fitted' | 'reprint' | null
  print_fit_at?: string | null
```

`job-screen.tsx`:
- `PrintJobScreen` passes `onFit={(fit) => run(() => apiClient.post<ToyTransaction>(`/api/toy-transactions/${id}/print-fit`, { fit }))}` to `StateCard`; add `onFit: (fit: 'fitted' | 'reprint') => void` to its props.
- The collected card: replace `<PendingButton pending="print-fit-feedback" label="Did it fit?" />` with:

```tsx
        {!isPrinter ? (
          <View style={styles.fit}>
            <Text style={styles.strong}>Did it fit?</Text>
            <Text style={[styles.body, styles.ink]}>
              One tap. It goes back to the printer and to the guide author so the next print is better.
            </Text>
            <View style={styles.fitRow}>
              <Button
                label="Fitted"
                variant={tx.print_fit === 'fitted' ? 'primary' : 'secondary'}
                disabled={busy || !!tx.print_fit}
                onPress={() => onFit('fitted')}
                style={styles.flex}
              />
              <Button
                label="Needs a reprint"
                variant={tx.print_fit === 'reprint' ? 'primary' : 'secondary'}
                disabled={busy || !!tx.print_fit}
                onPress={() => onFit('reprint')}
                style={styles.flex}
              />
            </View>
          </View>
        ) : null}
```

- Styles: `fit: { gap: theme.spacing(2) }`, `fitRow: { flexDirection: 'row', gap: theme.spacing(2) }`.
- Header comment: delete "The board's "Did it fit?" after collection and" from the sentence about what is not drawn.

- [ ] **Step 4: Apply and run**

Run: `supabase migration up` → applies `094_print_fit.sql`.
Run both commands from Step 2. Expected: PASS.

- [ ] **Step 5: Ship the item** — `grep -rn "print_fit" packages/mobile` shows only this task's uses. `shipped: true,` on `'print-fit-feedback'`; `node scripts/pending.mjs`; drift test → `Tests  11 passed (11)`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/094_print_fit.sql packages/api/src/routes/toy-transactions.ts packages/api/tests/integration/printers/print-fit.test.ts packages/types/src/index.ts packages/mobile/components/printing/job-screen.tsx packages/mobile/tests/unit/components/printing/job-screen.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(printing): the family says whether the parts fitted; a reprint tells the printer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 7: Printer track record (`printer-stats`, migration 095)

**Files:**
- Create: `supabase/migrations/095_printer_stats.sql`
- Modify: `packages/types/src/printing.ts` (append), `packages/types/src/index.ts` (`PrinterWithOwner.printer_stats`, `OrgPublicProfile.print_stats`; `import type { PrinterStats } from './printing'`)
- Modify: `packages/api/src/routes/printers.ts` (`SELECT`, `Row`, delete the `PENDING(printer-stats)` line), `packages/api/src/routes/public.ts` (`orgProfileExtras`)
- Modify: `packages/mobile/components/printing/find-screen.tsx`, `job-screen.tsx`, `offer-screen.tsx`, `packages/mobile/components/organisation/org-profile-screen.tsx`
- Modify: `packages/web/app/organizations/[id]/public/page.tsx`
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/api/tests/integration/printers/printer-stats.test.ts` (new), `packages/web/tests/unit/lib/printing.test.ts`, mobile `find-screen.test.tsx`, `offer-screen.test.tsx`, `job-screen.test.tsx`

**Interfaces:**
- Consumes: 094's `print_fit`; `toy_transactions.print_colour` (074).
- Produces: SQL `public.print_job_stats(p_printer_ids uuid[]) returns jsonb` (service role only) and computed field `printer_stats(printers)`; TS `PrinterStats = { jobs: number; median_days: number | null; fitted: number; fit_answers: number; colours: string[] }`, `statsLine(s?): string | null`, `machineStatsLines(s?): string[]`, `orgPrintFacts(s?): Array<{ k: string; v: string }>`. Every `/api/printers` row carries `printer_stats`; `GET /api/public/organizations/:id` carries `print_stats: PrinterStats | null`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/web/tests/unit/lib/printing.test.ts`:

```ts
import { machineStatsLines, orgPrintFacts, statsLine } from '@splat-connect/types'

const stats = { jobs: 21, median_days: 3, fitted: 20, fit_answers: 21, colours: ['Black', 'White', 'Blue'] }

describe('printer stats', () => {
  it('reads as the find card says it', () => {
    expect(statsLine(stats)).toBe('21 jobs · ~3 days')
    expect(statsLine({ ...stats, jobs: 1, median_days: 1 })).toBe('1 job · ~1 day')
  })
  it('is hidden below one completed job', () => {
    expect(statsLine({ ...stats, jobs: 0, median_days: null })).toBeNull()
    expect(machineStatsLines({ ...stats, jobs: 0 })).toEqual([])
    expect(orgPrintFacts(undefined)).toEqual([])
  })
  it('gives the machine picker its three lines', () => {
    expect(machineStatsLines(stats)).toEqual([
      '21 completed · median 3 days',
      '20 of 21 fitted first time',
      'Colours: Black, White, Blue',
    ])
    expect(machineStatsLines({ ...stats, fit_answers: 0, colours: [] })).toEqual(['21 completed · median 3 days'])
  })
  it('gives an organisation Turnaround and Fit', () => {
    expect(orgPrintFacts(stats)).toEqual([
      { k: 'Turnaround', v: 'Median 3 days' },
      { k: 'Fit', v: '20 of 21 first time' },
    ])
  })
})
```

`packages/api/tests/integration/printers/printer-stats.test.ts`:

```ts
/**
 * 095. Jobs, median days, first-time fit and colours per printer, computed on
 * read over completed print jobs — never stored.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, addLeader } from '../../helpers/orgs.js'

let family: TestUser
let owner: TestUser
let leader: TestUser
let tutorialId: string
let printerId: string
let freshId: string
let orgPrinterId: string
let orgId: string

const ago = (days: number) => new Date(Date.now() - days * 864e5).toISOString()
const authed = (u: TestUser) => ({ headers: { Authorization: `Bearer ${u.token}` } })

beforeAll(async () => {
  family = await createTestUser('contributor')
  owner = await createTestUser('contributor')
  leader = await createTestUser('contributor')
  const admin = adminClient()
  const { data: t } = await admin
    .from('tutorials')
    .insert({ title: 'Stats fixture', description: 'x', difficulty: 'easy', status: 'approved' })
    .select('id')
    .single()
  tutorialId = t!.id
  orgId = await createOrg({ createdBy: leader.id })
  await addLeader(orgId, leader.id)
  const machine = async (row: Record<string, unknown>) =>
    (
      await admin
        .from('printers')
        .insert({ name: 'Stats printer', materials: ['PLA'], bed_x: 200, bed_y: 200, bed_z: 200, ...row })
        .select('id')
        .single()
    ).data!.id as string
  printerId = await machine({ owner_id: owner.id })
  freshId = await machine({ owner_id: owner.id })
  orgPrinterId = await machine({ owner_org_id: orgId })

  const done = (printer: string, side: Record<string, unknown>, created: number, a: number, b: number, extra: Record<string, unknown> = {}) => ({
    type: 'print', status: 'completed', tutorial_id: tutorialId, printer_id: printer, requester_id: family.id,
    print_group_id: crypto.randomUUID(), created_at: ago(created), owner_confirmed_at: ago(a), requester_confirmed_at: ago(b),
    ...side, ...extra,
  })
  const mine = { owner_id: owner.id }
  const { error } = await admin.from('toy_transactions').insert([
    // 4, 2 and 7 days to the later confirmation: median 4.
    done(printerId, mine, 10, 7, 6, { print_fit: 'fitted', print_fit_at: ago(5), print_colour: 'Blue' }),
    done(printerId, mine, 5, 3, 3, { print_fit: 'reprint', print_fit_at: ago(2), print_colour: 'Blue' }),
    done(printerId, mine, 9, 3, 2, { print_colour: 'Black' }),
    done(orgPrinterId, { owner_org_id: orgId }, 4, 2, 2),
    { type: 'print', status: 'requested', tutorial_id: tutorialId, printer_id: printerId, requester_id: family.id, owner_id: owner.id, print_group_id: crypto.randomUUID() },
  ])
  if (error) throw new Error(error.message)
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('toy_transactions').delete().eq('tutorial_id', tutorialId)
  await admin.from('printers').delete().in('id', [printerId, freshId, orgPrinterId])
  await admin.from('tutorials').delete().eq('id', tutorialId)
  await admin.from('organizations').delete().eq('id', orgId)
  await Promise.all([family, owner, leader].map((u) => deleteTestUser(u.id)))
})

describe('095 printer stats', () => {
  it('counts completed jobs, the median days, first-time fit and the colours most used', async () => {
    const res = await app.request(`/api/printers/${printerId}`, authed(family))
    expect(((await res.json()) as { printer_stats: unknown }).printer_stats).toEqual({
      jobs: 3, median_days: 4, fitted: 1, fit_answers: 2, colours: ['Blue', 'Black'],
    })
  })

  it('reads zero for a machine with no completed jobs', async () => {
    const res = await app.request('/api/printers', authed(family))
    const row = ((await res.json()) as Array<{ id: string; printer_stats: unknown }>).find((p) => p.id === freshId)
    expect(row!.printer_stats).toEqual({ jobs: 0, median_days: null, fitted: 0, fit_answers: 0, colours: [] })
  })

  it('gives an organisation its own turnaround', async () => {
    const res = await app.request(`/api/public/organizations/${orgId}`)
    expect(((await res.json()) as { print_stats: { jobs: number; median_days: number } }).print_stats).toMatchObject({
      jobs: 1, median_days: 2,
    })
  })

  it('keeps the raw aggregate off the anon key', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const anon = createClient(process.env.SUPABASE_URL ?? 'http://localhost:54321', process.env.SUPABASE_ANON_KEY ?? '')
    const { error } = await anon.rpc('print_job_stats', { p_printer_ids: [printerId] })
    expect(error).not.toBeNull()
  })
})
```

Mobile — append to `find-screen.test.tsx`:

```tsx
it('shows a printer’s jobs and turnaround under its name', async () => {
  mockGet.mockImplementation((path: string) =>
    Promise.resolve(
      path === '/api/printers'
        ? [printer('a', { printer_stats: { jobs: 21, median_days: 3, fitted: 20, fit_answers: 21, colours: [] } })]
        : GUIDE
    )
  )
  render(<FindPrinterScreen guideId="g1" />)
  expect(await screen.findByText(/21 jobs · ~3 days/)).toBeTruthy()
})
```

Append to `offer-screen.test.tsx`:

```tsx
it('shows each machine’s record in the picker', async () => {
  const stats = { jobs: 21, median_days: 3, fitted: 20, fit_answers: 21, colours: ['Black', 'White'] }
  mockGet.mockImplementation((path: string) =>
    Promise.resolve(
      path === '/api/printers/mine'
        ? [machine('Ender PLA', { materials: ['PLA'] }), machine('Bambu P1S', { bed_x: 256, printer_stats: stats })]
        : [REQUEST]
    )
  )
  render(<PrintForOthersScreen />)
  expect(await screen.findByText('21 completed · median 3 days')).toBeTruthy()
  expect(screen.getByText('20 of 21 fitted first time')).toBeTruthy()
  expect(screen.getByText('Colours: Black, White')).toBeTruthy()
})
```

Append to `job-screen.test.tsx`:

```tsx
it('shows the family the printer’s record on the printer card', async () => {
  mockGet.mockImplementation((path: string) =>
    path === '/api/toy-transactions/j1'
      ? Promise.resolve(job({ status: 'accepted', printer_id: 'p1' }))
      : path === '/api/printers/p1'
        ? Promise.resolve({ id: 'p1', filament_cents_per_g: null, rate_note: null, printer_stats: { jobs: 4, median_days: 6, fitted: 0, fit_answers: 0, colours: [] } })
        : Promise.reject(new Error('n/a'))
  )
  render(<PrintJobScreen id="j1" />)
  expect(await screen.findByText('4 jobs · ~6 days')).toBeTruthy()
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/lib/printing.test.ts` → FAIL.
Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/printers/printer-stats.test.ts` → FAIL (`printer_stats` absent).
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/printing` → FAIL.

- [ ] **Step 3: Implement**

`supabase/migrations/095_printer_stats.sql`:

```sql
-- 095 — a printer's track record: jobs done, median turnaround, first-time
-- fit, colours. The board's "21 jobs · ~3 days" on the find card, "21
-- completed · median 3 days / 20 of 21 fitted first time" on the machine
-- picker, and Turnaround / Fit on an organisation's profile.
--
-- Computed on read over completed print jobs, never a counter column. One
-- aggregate over a set of printers, so a machine and an organisation (all its
-- machines) are the same question:
--
--   print_job_stats(uuid[])  jsonb { jobs, median_days, fitted, fit_answers, colours }
--                            service role only; the API calls it for an org.
--   printer_stats(printers)  PostgREST computed field — `select=printer_stats`.
--
-- jobs         completed print jobs.
-- median_days  median of (the later handover confirmation − created_at), whole days.
-- fitted / fit_answers  from 094's print_fit.
-- colours      distinct print_colour, most used first, max 3. "Any colour" is
--              not a colour.
--
-- SECURITY DEFINER for the reason 067 gives: an invoker function runs the
-- caller's RLS on every row, and nobody but the two parties can read a job.
--
-- DOWN:
--   drop function if exists public.printer_stats(public.printers);
--   drop function if exists public.print_job_stats(uuid[]);

create function public.print_job_stats(p_printer_ids uuid[])
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with done as (
    select
      t.created_at,
      greatest(t.owner_confirmed_at, t.requester_confirmed_at) as collected_at,
      t.print_fit,
      t.print_colour
    from public.toy_transactions t
    where t.printer_id = any (p_printer_ids)
      and t.type = 'print'
      and t.status = 'completed'
  )
  select jsonb_build_object(
    'jobs', (select count(*) from done),
    'median_days', (
      select round(percentile_cont(0.5) within group (
        order by extract(epoch from collected_at - created_at) / 86400
      ))::int
      from done
      where collected_at is not null
    ),
    'fitted', (select count(*) from done where print_fit = 'fitted'),
    'fit_answers', (select count(*) from done where print_fit is not null),
    'colours', coalesce((
      select jsonb_agg(print_colour order by n desc, print_colour)
      from (
        select print_colour, count(*) as n
        from done
        where print_colour is not null and print_colour <> 'Any colour'
        group by print_colour
        order by n desc, print_colour
        limit 3
      ) c
    ), '[]'::jsonb)
  )
$$;

revoke execute on function public.print_job_stats(uuid[]) from public, anon, authenticated;

create function public.printer_stats(p public.printers)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select public.print_job_stats(array[p.id])
$$;
```

Append to `packages/types/src/printing.ts`:

```ts
/** 095's printer_stats / print_job_stats. */
export interface PrinterStats {
  jobs: number
  median_days: number | null
  fitted: number
  fit_answers: number
  colours: string[]
}

const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** The find and job cards' "21 jobs · ~3 days". Null below one completed job. */
export function statsLine(s?: PrinterStats | null): string | null {
  if (!s || s.jobs < 1) return null
  return s.median_days === null ? count(s.jobs, 'job') : `${count(s.jobs, 'job')} · ~${count(s.median_days, 'day')}`
}

/** The offer machine picker's lines, in the board's words. */
export function machineStatsLines(s?: PrinterStats | null): string[] {
  if (!s || s.jobs < 1) return []
  return [
    s.median_days === null ? `${s.jobs} completed` : `${s.jobs} completed · median ${count(s.median_days, 'day')}`,
    s.fit_answers ? `${s.fitted} of ${s.fit_answers} fitted first time` : null,
    s.colours.length ? `Colours: ${s.colours.join(', ')}` : null,
  ].filter((l): l is string => l !== null)
}

/** Turnaround and Fit on an organisation's profile ("Median 3 days", "29 of 30 first time"). */
export function orgPrintFacts(s?: PrinterStats | null): Array<{ k: string; v: string }> {
  if (!s || s.jobs < 1) return []
  return [
    s.median_days === null ? null : { k: 'Turnaround', v: `Median ${count(s.median_days, 'day')}` },
    s.fit_answers ? { k: 'Fit', v: `${s.fitted} of ${s.fit_answers} first time` } : null,
  ].filter((f): f is { k: string; v: string } => f !== null)
}
```

`index.ts`: `import type { PrinterStats } from './printing'` at the top; `PrinterWithOwner` gains `/** 095. Optional: fixtures predate it. */ printer_stats?: PrinterStats`; `OrgPublicProfile` gains `/** 095, over every machine the organisation owns. */ print_stats?: PrinterStats | null`.

`printers.ts`: append `, printer_stats` to `SELECT`; `Row` gains `printer_stats: PrinterStats` (import the type from `@splat-connect/types`); delete the `// PENDING(printer-stats): …` line above `printers.get('/')`.

`public.ts`, in `orgProfileExtras` after the `failed` check:

```ts
  // Turnaround and Fit (095), over every machine the organisation owns — the
  // accepting filter above is for the "They print" card, not for its record.
  const { data: machines } = await admin.from('printers').select('id').eq('owner_org_id', id)
  const machineIds = (machines ?? []).map((m) => m.id as string)
  const { data: printStats } = machineIds.length
    ? await admin.rpc('print_job_stats', { p_printer_ids: machineIds })
    : { data: null }
```

and in the returned object, after `printers: …`: `print_stats: (printStats as PrinterStats | null) ?? null,` (import the type).

Mobile:
- `find-screen.tsx`: import `statsLine` from `@splat-connect/types`; the meta join becomes `[p.owner_org_id ? 'Organisation' : 'Contributor', [p.suburb, p.state].filter(Boolean).join(' ') || null, p.name, statsLine(p.printer_stats)]`; delete the `PENDING(printer-stats)` comment.
- `job-screen.tsx`: pass `printerStats={printer?.printer_stats}` to `StateCard` (prop `printerStats?: PrinterStats`, type imported from `@splat-connect/types`); in the accepted/printing card replace the `PENDING(printer-stats)` comment with:

```tsx
        {!isPrinter && statsLine(printerStats) ? <Text style={styles.meta}>{statsLine(printerStats)}</Text> : null}
```

  (`Printer` in `useState<Printer | null>` becomes `PrinterWithOwner`, the type that carries `printer_stats`.)
- `offer-screen.tsx`: import `machineStatsLines`; in the picker, after `<Text style={styles.meta}>{f.why}</Text>`:

```tsx
                  {machineStatsLines(m.printer_stats).map((line) => (
                    <Text key={line} style={styles.meta}>
                      {line}
                    </Text>
                  ))}
```

- `org-profile-screen.tsx`: import `orgPrintFacts`; replace the `PENDING(printer-stats)` comment with `{orgPrintFacts(org.print_stats).map((f) => <Fact key={f.k} k={f.k} v={f.v} />)}` placed after the Materials `Fact`.

Web `organizations/[id]/public/page.tsx`: import `orgPrintFacts`; inside the `<dl>`, after the Materials pair:

```tsx
                  {orgPrintFacts(org.print_stats).map((f) => (
                    <div key={f.k} className="contents">
                      <dt className="font-semibold opacity-80">{f.k}</dt>
                      <dd className="m-0 font-extrabold">{f.v}</dd>
                    </div>
                  ))}
```

- [ ] **Step 4: Apply and run**

Run: `supabase migration up` → applies `095_printer_stats.sql`. Run the three commands from Step 2, plus `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/organisation/org-profile-screen.test.tsx` and `pnpm --filter @splat-connect/web exec vitest run tests/unit/pages/organization-detail.test.tsx`. Expected: PASS.

- [ ] **Step 5: Ship the item** — `shipped: true,` on `'printer-stats'`; `node scripts/pending.mjs`; drift test → `Tests  11 passed (11)`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/095_printer_stats.sql packages/types/src/printing.ts packages/types/src/index.ts packages/api/src/routes/printers.ts packages/api/src/routes/public.ts packages/api/tests/integration/printers/printer-stats.test.ts packages/web/tests/unit/lib/printing.test.ts "packages/web/app/organizations/[id]/public/page.tsx" packages/mobile/components/printing/find-screen.tsx packages/mobile/components/printing/job-screen.tsx packages/mobile/components/printing/offer-screen.tsx packages/mobile/components/organisation/org-profile-screen.tsx packages/mobile/tests/unit/components/printing/find-screen.test.tsx packages/mobile/tests/unit/components/printing/offer-screen.test.tsx packages/mobile/tests/unit/components/printing/job-screen.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(printing): every printer shows its jobs, turnaround, first-time fit and colours

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 8: Customization on the print request (`customization-metrics`, migration 096)

**Files:**
- Create: `supabase/migrations/096_print_fit_notes.sql`
- Modify: `packages/types/src/printing.ts` (append), `packages/types/src/index.ts` (`ToyTransaction.print_fit_notes`)
- Modify: `packages/api/src/routes/toy-transactions.ts` (`POST /print`)
- Modify: `packages/mobile/components/printing/request-screen.tsx`, `offer-screen.tsx` (`IncomingCard`), `job-screen.tsx`
- Modify: `packages/mobile/components/profile-screen.tsx` (delete the PendingRow), `packages/mobile/tests/unit/components/ui/pending.test.tsx` (`customization-metrics` → `org-visit-map`)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/api/tests/integration/printers/fit-notes.test.ts` (new), `packages/web/tests/unit/lib/printing.test.ts`, mobile `request-screen.test.tsx`, `offer-screen.test.tsx`

**Interfaces:**
- Consumes: Task 3's `send()` body on the request screen.
- Produces: `PRINT_FIT_QUESTIONS` (keys `reach`, `switch_size`, `mount`, `tray`), `PrintFitKey`, `PrintFitNotes = Partial<Record<PrintFitKey, string>>`, `fitNotesProblem(v: unknown): string | null`, `fitNotesLines(notes?: PrintFitNotes | null): string[]`. `POST /print` accepts `fit_notes: PrintFitNotes`; every job row carries `print_fit_notes`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/web/tests/unit/lib/printing.test.ts`:

```ts
import { fitNotesLines, fitNotesProblem } from '@splat-connect/types'

describe('customization', () => {
  it('accepts the board’s options only', () => {
    expect(fitNotesProblem({ reach: '20–40 cm', tray: 'Not sure' })).toBeNull()
    expect(fitNotesProblem({ reach: '35 cm' })).toBe('Customization answers must be one of the options offered.')
    expect(fitNotesProblem({ shoe_size: '4' })).toBe('Customization answers must be one of the options offered.')
    expect(fitNotesProblem(['reach'])).toBe('Customization answers must be one of the options offered.')
  })
  it('reads back to the printer in the board’s order', () => {
    expect(fitNotesLines({ tray: '15 mm', reach: 'Under 20 cm' })).toEqual(['Reach from seated: Under 20 cm', 'Tray thickness: 15 mm'])
    expect(fitNotesLines(null)).toEqual([])
  })
})
```

`packages/api/tests/integration/printers/fit-notes.test.ts`:

```ts
/** 096. Customization answers ride on the print request, per job. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let family: TestUser
let owner: TestUser
let tutorialId: string
let printerId: string
let stlId: string

const post = (body: Record<string, unknown>) =>
  app.request('/api/toy-transactions/print', {
    method: 'POST',
    headers: { Authorization: `Bearer ${family.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ printer_ids: [printerId], tutorial_id: tutorialId, stl_file_ids: [stlId], ...body }),
  })

beforeAll(async () => {
  family = await createTestUser('contributor')
  owner = await createTestUser('contributor')
  const admin = adminClient()
  const { data: t } = await admin
    .from('tutorials')
    .insert({ title: 'Fit notes fixture', description: 'x', difficulty: 'easy', status: 'approved' })
    .select('id')
    .single()
  tutorialId = t!.id
  const { data: f } = await admin
    .from('stl_files')
    .insert({ tutorial_id: tutorialId, filename: 'mount.stl', file_url: `${tutorialId}/mount.stl` })
    .select('id')
    .single()
  stlId = f!.id
  const { data: p } = await admin
    .from('printers')
    .insert({ owner_id: owner.id, name: 'Notes printer', materials: ['PLA'], bed_x: 200, bed_y: 200, bed_z: 200, capacity: 3 })
    .select('id')
    .single()
  printerId = p!.id
})

afterAll(async () => {
  await adminClient().from('toy_transactions').delete().eq('tutorial_id', tutorialId)
  await adminClient().from('printers').delete().eq('id', printerId)
  await adminClient().from('tutorials').delete().eq('id', tutorialId)
  await deleteTestUser(family.id)
  await deleteTestUser(owner.id)
})

describe('096 print_fit_notes', () => {
  it('stores the answers on the job', async () => {
    const res = await post({ fit_notes: { reach: '20–40 cm', mount: 'Floor stand' } })
    expect(res.status).toBe(201)
    const { id } = (await res.json()) as { id: string }
    const { data } = await adminClient().from('toy_transactions').select('print_fit_notes').eq('id', id).single()
    expect(data!.print_fit_notes).toEqual({ reach: '20–40 cm', mount: 'Floor stand' })
    await adminClient().from('toy_transactions').delete().eq('id', id)
  })

  it('refuses an answer the board does not offer', async () => {
    const res = await post({ fit_notes: { reach: '35 cm' } })
    expect(res.status).toBe(400)
  })

  it('is backed by the database: an unknown key is a CHECK violation', async () => {
    const { error } = await adminClient()
      .from('toy_transactions')
      .insert({
        type: 'print', status: 'requested', tutorial_id: tutorialId, printer_id: printerId, requester_id: family.id,
        owner_id: owner.id, print_group_id: crypto.randomUUID(), print_fit_notes: { shoe_size: '4' },
      })
    expect(error?.code).toBe('23514')
  })
})
```

Append to `request-screen.test.tsx`:

```tsx
it('sends the customization answers that were picked', async () => {
  mockPost.mockResolvedValue({ id: 'j1' })
  render(<RequestPrintScreen guideId="g1" printerIds={['p1']} />)
  expect(
    await screen.findByText('Physical dimensions we use to size printed mounts and brackets. Nothing here is required.')
  ).toBeTruthy()
  fireEvent.press(screen.getByText('20–40 cm'))
  fireEvent.press(screen.getByText('Floor stand'))
  fireEvent.press(screen.getByRole('checkbox', { name: /I understand/ }))
  fireEvent.press(screen.getByText('Send request'))
  await waitFor(() =>
    expect(mockPost).toHaveBeenCalledWith(
      '/api/toy-transactions/print',
      expect.objectContaining({ fit_notes: { reach: '20–40 cm', mount: 'Floor stand' } })
    )
  )
})
```

Append to `offer-screen.test.tsx`:

```tsx
it('shows the printer the family’s customization answers', async () => {
  mockGet.mockImplementation((path: string) =>
    Promise.resolve(
      path === '/api/printers/mine'
        ? [machine('Bambu P1S', { bed_x: 256 })]
        : [{ ...REQUEST, print_fit_notes: { reach: '20–40 cm' } }]
    )
  )
  render(<PrintForOthersScreen />)
  expect(await screen.findByText('Reach from seated: 20–40 cm')).toBeTruthy()
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/lib/printing.test.ts` → FAIL.
Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/printers/fit-notes.test.ts` → FAIL (column missing).
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/printing` → FAIL.

- [ ] **Step 3: Implement**

`supabase/migrations/096_print_fit_notes.sql`:

```sql
-- 096 — Customization on the print request, per job.
--
-- Decided 2026-09-30: reach, switch size, mount and tray thickness are asked
-- on the print request, not on the account — the board's profile placement is
-- overridden. The board's questions and options, all optional: "Physical
-- dimensions we use to size printed mounts and brackets. Nothing here is
-- required." The printer reads them on the offer and job screens.
--
--   toy_transactions.print_fit_notes  jsonb object, keys reach / switch_size /
--                                     mount / tray. The options are checked in
--                                     the API (packages/types printing.ts); the
--                                     keys and the shape are checked here.
--
-- DOWN:
--   alter table public.toy_transactions drop constraint if exists toy_transactions_print_fit_notes;
--   alter table public.toy_transactions drop column if exists print_fit_notes;

alter table public.toy_transactions add column print_fit_notes jsonb;

alter table public.toy_transactions
  add constraint toy_transactions_print_fit_notes check (
    print_fit_notes is null or (
      type = 'print'
      and jsonb_typeof(print_fit_notes) = 'object'
      and print_fit_notes - array['reach', 'switch_size', 'mount', 'tray'] = '{}'::jsonb
    )
  );
```

Append to `packages/types/src/printing.ts` (option text verbatim from the mobile board's `customization` block):

```ts
/** The board's Customization questions and options, asked per print request (096). */
export const PRINT_FIT_QUESTIONS = [
  { key: 'reach', label: 'Reach from seated', options: ['Under 20 cm', '20–40 cm', 'Over 40 cm'] },
  { key: 'switch_size', label: 'Preferred switch size', options: ['Small (50 mm)', 'Large (100 mm)', 'Extra large'] },
  { key: 'mount', label: 'Mount needed', options: ['Tray clamp', 'Floor stand', 'None'] },
  { key: 'tray', label: 'Tray thickness', options: ['10 mm', '15 mm', '20 mm', 'Not sure'] },
] as const

export type PrintFitKey = (typeof PRINT_FIT_QUESTIONS)[number]['key']
export type PrintFitNotes = Partial<Record<PrintFitKey, string>>

/** Null when every answer is an option its question offers; otherwise the 400's sentence. */
export function fitNotesProblem(v: unknown): string | null {
  const bad = 'Customization answers must be one of the options offered.'
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return bad
  for (const [key, answer] of Object.entries(v)) {
    const q = PRINT_FIT_QUESTIONS.find((x) => x.key === key)
    if (!q || !(q.options as readonly string[]).includes(answer as string)) return bad
  }
  return null
}

/** "Reach from seated: 20–40 cm", in the board's order, for the printer. */
export function fitNotesLines(notes?: PrintFitNotes | null): string[] {
  if (!notes) return []
  return PRINT_FIT_QUESTIONS.filter((q) => notes[q.key]).map((q) => `${q.label}: ${notes[q.key]}`)
}
```

`index.ts`: extend the type import to `import type { PrinterStats, PrintFitNotes } from './printing'`; `ToyTransaction` gains `/** 096. The family's Customization answers. Optional: fixtures predate it. */ print_fit_notes?: PrintFitNotes | null`.

`toy-transactions.ts`, `POST /print`: import `fitNotesProblem` from `@splat-connect/types`; after the `delivery` check:

```ts
  // 096. Optional, and only the board's options (printing.ts).
  const fitNotes = (body.fit_notes ?? null) as Record<string, string> | null
  const fitProblem = fitNotes === null ? null : fitNotesProblem(fitNotes)
  if (fitProblem) return c.json({ error: fitProblem }, 400)
```

and in the per-printer insert, after `print_delivery: delivery,`: `print_fit_notes: fitNotes && Object.keys(fitNotes).length ? fitNotes : null,`.

`request-screen.tsx`:
- Import `PRINT_FIT_QUESTIONS, type PrintFitNotes` from `@splat-connect/types`.
- State: `const [fitNotes, setFitNotes] = useState<PrintFitNotes>({})`.
- In `send()`'s body, after `delivery,`: `...(Object.keys(fitNotes).length ? { fit_notes: fitNotes } : {}),`.
- After the Pickup group:

```tsx
        <View style={styles.group}>
          <Eyebrow>Customization</Eyebrow>
          <Text style={styles.meta}>
            Physical dimensions we use to size printed mounts and brackets. Nothing here is required.
          </Text>
          {PRINT_FIT_QUESTIONS.map((q) => (
            <View key={q.key} style={styles.group}>
              <Text style={styles.partName}>{q.label}</Text>
              <View accessibilityRole="radiogroup" accessibilityLabel={q.label} style={styles.row}>
                {q.options.map((o) => (
                  <Chip
                    key={o}
                    label={o}
                    role="radio"
                    variant="filter"
                    active={fitNotes[q.key] === o}
                    // A second tap clears it: every question is optional.
                    onPress={() =>
                      setFitNotes((cur) => {
                        const next = { ...cur }
                        if (next[q.key] === o) delete next[q.key]
                        else next[q.key] = o
                        return next
                      })
                    }
                  />
                ))}
              </View>
            </View>
          ))}
        </View>
```

`offer-screen.tsx` (`IncomingCard`): import `fitNotesLines`; after the `print_note` quote:

```tsx
      {fitNotesLines(tx.print_fit_notes).map((line) => (
        <Text key={line} style={styles.meta}>
          {line}
        </Text>
      ))}
```

`job-screen.tsx`: import `fitNotesLines`; after `<StateCard … />`:

```tsx
          {isPrinter && fitNotesLines(tx.print_fit_notes).length ? (
            <Card style={styles.block}>
              <Text style={styles.eyebrow}>Customization</Text>
              {fitNotesLines(tx.print_fit_notes).map((line) => (
                <Text key={line} style={styles.body}>
                  {line}
                </Text>
              ))}
            </Card>
          ) : null}
```

`profile-screen.tsx`: delete `<PendingRow pending="customization-metrics" label="Customization" icon="resize-outline" />` and, if nothing else in the file uses it, the `PendingRow` import.

`pending.test.tsx`: in "a pending row does the same", replace `customization-metrics` (both places) with `org-visit-map`, and the label `Customization` with `Map and address`.

- [ ] **Step 4: Apply and run**

Run: `supabase migration up` → applies `096_print_fit_notes.sql`. Run the three commands from Step 2 plus `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/profile-screen.test.tsx tests/unit/components/ui/pending.test.tsx`. Expected: PASS.

- [ ] **Step 5: Ship the item** — `grep -rn "print_fit_notes" packages/mobile` shows only this task's reads. `shipped: true,` on `'customization-metrics'`; `node scripts/pending.mjs`. The `app-screen-map.json` `skip` that mentions `customization-metrics` is a whole-screen skip ("no account screen will exist"), not an `explained` rule, and stays true — leave it. Drift test → `Tests  11 passed (11)`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/096_print_fit_notes.sql packages/types/src/printing.ts packages/types/src/index.ts packages/api/src/routes/toy-transactions.ts packages/api/tests/integration/printers/fit-notes.test.ts packages/web/tests/unit/lib/printing.test.ts packages/mobile/components/printing/request-screen.tsx packages/mobile/components/printing/offer-screen.tsx packages/mobile/components/printing/job-screen.tsx packages/mobile/components/profile-screen.tsx packages/mobile/tests/unit/components/printing/request-screen.test.tsx packages/mobile/tests/unit/components/printing/offer-screen.test.tsx packages/mobile/tests/unit/components/ui/pending.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(printing): the print request asks reach, switch size, mount and tray

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---
### Task 9: Fits your parts (`bed-fit-filter`, migration 097)

**Files:**
- Create: `supabase/migrations/097_stl_part_sizes.sql`
- Modify: `packages/types/src/printing.ts` (append `bedFits`), `packages/types/src/index.ts` (`StlFile.size_x_mm/size_y_mm/size_z_mm`)
- Modify: `packages/api/src/routes/stl-files.ts` (`settings`, PATCH validation)
- Modify: `packages/web/components/stl-settings-form.tsx`, `packages/web/components/request-print-form.tsx` (`PrintablePart` picks the sizes), `packages/web/app/printing/requests/page.tsx` (filter)
- Modify: `packages/mobile/components/printing/find-screen.tsx` (filter), `packages/mobile/components/my-tutorials/sections/stl-section.tsx` (sizes per file; carry them through the replace-set), `packages/mobile/components/printing/basics-screen.tsx` (delete the `PENDING(bed-fit-filter)` comment; the copy "the printer checks the parts fit before they accept" stays)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/web/tests/unit/lib/printing.test.ts`, `packages/web/tests/unit/components/stl-settings-form.test.tsx` (new), `packages/api/tests/unit/routes/stl-files.test.ts`, `packages/api/tests/integration/printers/part-sizes.test.ts` (new), `packages/mobile/tests/unit/components/printing/find-screen.test.tsx`, `packages/mobile/tests/unit/components/my-tutorials/files-section.test.tsx`

**Interfaces:**
- Consumes: `printers.bed_x/bed_y/bed_z` (058).
- Produces: `bedFits(bed: { bed_x: number; bed_y: number; bed_z: number }, parts: Array<{ size_x_mm?: number | null; size_y_mm?: number | null; size_z_mm?: number | null }>): boolean` — true unless every part is sized and one cannot sit on the bed with x/y either way round and z upright. `PATCH /api/tutorials/:id/stl-files/:fileId` writes the three sizes alongside the three settings (every field it is sent; absent = null, as today).

- [ ] **Step 1: Write the failing tests**

Append to `packages/web/tests/unit/lib/printing.test.ts`:

```ts
import { bedFits } from '@splat-connect/types'

describe('bedFits', () => {
  const bed = { bed_x: 220, bed_y: 180, bed_z: 250 }
  it('fits a part either way round on x/y', () => {
    expect(bedFits(bed, [{ size_x_mm: 170, size_y_mm: 210, size_z_mm: 40 }])).toBe(true)
  })
  it('does not tip a part over to fit z', () => {
    expect(bedFits(bed, [{ size_x_mm: 100, size_y_mm: 100, size_z_mm: 260 }])).toBe(false)
  })
  it('is decided by the largest part', () => {
    expect(bedFits(bed, [{ size_x_mm: 10, size_y_mm: 10, size_z_mm: 10 }, { size_x_mm: 230, size_y_mm: 190, size_z_mm: 10 }])).toBe(false)
  })
  it('hides nothing unless every part has its sizes', () => {
    expect(bedFits(bed, [{ size_x_mm: 900, size_y_mm: 900, size_z_mm: 900 }, { size_x_mm: null, size_y_mm: 5, size_z_mm: 5 }])).toBe(true)
    expect(bedFits(bed, [])).toBe(true)
  })
})
```

`packages/web/tests/unit/components/stl-settings-form.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { StlFile } from '@splat-connect/types'
import { StlSettingsForm } from '@/components/stl-settings-form'
import { ToastProvider } from '@/components/toast'

const file: StlFile = {
  id: 'f1', tutorial_id: 't1', filename: 'mount.stl', file_url: 't1/mount.stl',
  print_minutes: 60, filament_grams: 10, material: 'PETG', size_x_mm: 40, size_y_mm: 30, size_z_mm: 20,
}

describe('StlSettingsForm', () => {
  it('saves the sizes with the settings, so neither erases the other', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <ToastProvider>
        <StlSettingsForm files={[file]} onSave={onSave} />
      </ToastProvider>
    )
    fireEvent.change(screen.getByLabelText('Width (mm)'), { target: { value: '45' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save print settings' }))
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith('f1', {
        print_minutes: 60, filament_grams: 10, material: 'PETG', size_x_mm: 45, size_y_mm: 30, size_z_mm: 20,
      })
    )
  })
})
```

`stl-files.test.ts` — in "coerces the settings and returns the row" change the expected update to `{ print_minutes: null, filament_grams: 41, material: null, size_x_mm: null, size_y_mm: null, size_z_mm: null }`, and add inside the PATCH `describe`:

```ts
  // Tests: a part size outside 1–2000 mm is refused with a sentence before the database sees it
  it('refuses a size outside 1 to 2000 mm', async () => {
    const res = await makeApp().request('/tutorial-1/stl-files/f1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ size_x_mm: 0 }),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Part sizes are whole millimetres, 1 to 2000.' })
    expect(mockUpdateStl).not.toHaveBeenCalled()
  })
```

`packages/api/tests/integration/printers/part-sizes.test.ts`:

```ts
/** 097. Part sizes per STL file, backed by a CHECK. */
import { describe, it, expect } from 'vitest'
import { adminClient } from '../../helpers/auth.js'

describe('097 stl part sizes', () => {
  it('has the columns', async () => {
    const { error } = await adminClient().from('stl_files').select('size_x_mm, size_y_mm, size_z_mm').limit(1)
    expect(error).toBeNull()
  })
  it('refuses a size past 2000 mm in the database too', async () => {
    const { data: t } = await adminClient()
      .from('tutorials')
      .insert({ title: 'Sizes fixture', description: 'x', difficulty: 'easy', status: 'draft' })
      .select('id')
      .single()
    const { error: tooBig } = await adminClient()
      .from('stl_files')
      .insert({ tutorial_id: t!.id, filename: 'big.stl', file_url: `${t!.id}/big.stl`, size_x_mm: 2001 })
    expect(tooBig?.code).toBe('23514')
    await adminClient().from('tutorials').delete().eq('id', t!.id)
  })
})
```

Append to mobile `find-screen.test.tsx`:

```tsx
it('hides a printer whose bed cannot hold the guide’s parts', async () => {
  mockGet.mockImplementation((path: string) =>
    Promise.resolve(
      path === '/api/printers'
        ? [printer('a', { bed_x: 180, bed_y: 180, bed_z: 180 }), printer('b', { bed_x: 256, bed_y: 256, bed_z: 256 })]
        : { ...GUIDE, stl_files: [{ ...GUIDE.stl_files[0], size_x_mm: 200, size_y_mm: 100, size_z_mm: 50 }] }
    )
  )
  render(<FindPrinterScreen guideId="g1" />)
  expect(await screen.findByText('Maker B')).toBeTruthy()
  expect(screen.queryByText('Maker A')).toBeNull()
})
```

Append to `files-section.test.tsx` (import the mocked client: `import { apiClient } from '../../../../lib/api-client'`):

```tsx
it('carries part sizes through the replace-set, and saves them per file', async () => {
  const sized = { id: 's1', filename: 'old.stl', file_url: 'stl/old.stl', print_minutes: 60, filament_grams: 10, material: 'PETG', size_x_mm: 40, size_y_mm: 30, size_z_mm: 20 }
  mockDraft.tutorial = { ...mockDraft.tutorial, stl_files: [sized] }
  ;(apiClient.patch as jest.Mock).mockResolvedValue({ ...sized, size_x_mm: 45 })
  render(<StlSection />)
  fireEvent.changeText(screen.getByLabelText('Width (mm) for old.stl'), '45')
  fireEvent.press(screen.getByText('Save sizes'))
  await waitFor(() =>
    expect(apiClient.patch).toHaveBeenCalledWith('/api/tutorials/t1/stl-files/s1', {
      print_minutes: 60, filament_grams: 10, material: 'PETG', size_x_mm: 45, size_y_mm: 30, size_z_mm: 20,
    })
  )

  mockGetDocument.mockResolvedValue({ canceled: false, assets: [{ uri: 'file://n.stl', name: 'n.stl' }] })
  mockUploadFile.mockResolvedValue({ url: 'stl/n.stl', filename: 'n.stl' })
  mockPost.mockResolvedValue([])
  fireEvent.press(screen.getByText('Choose STL from Files'))
  await waitFor(() =>
    expect(mockPost).toHaveBeenCalledWith('/api/tutorials/t1/stl-files', {
      stl_files: [
        { filename: 'old.stl', file_url: 'stl/old.stl', print_minutes: 60, filament_grams: 10, material: 'PETG', size_x_mm: 45, size_y_mm: 30, size_z_mm: 20 },
        { filename: 'n.stl', file_url: 'stl/n.stl' },
      ],
    })
  )
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/lib/printing.test.ts tests/unit/components/stl-settings-form.test.tsx` → FAIL.
Run: `pnpm --filter @splat-connect/api exec vitest run tests/unit/routes/stl-files.test.ts` → FAIL.
Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/printers/part-sizes.test.ts` → FAIL (columns missing).
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/printing/find-screen.test.tsx tests/unit/components/my-tutorials/files-section.test.tsx` → FAIL.

- [ ] **Step 3: Implement**

`supabase/migrations/097_stl_part_sizes.sql`:

```sql
-- 097 — how big each printed part is, so the pick list can hide a printer
-- whose bed cannot hold it.
--
-- Decided 2026-09-30: authors enter part dimensions per file; printers whose
-- bed does not fit are hidden, with no chip. Millimetres, the bounding box as
-- the author sliced it. All optional — a request hides nothing unless every
-- part it asks for has all three, and the printer still checks the fit before
-- they accept. Same 1–2000 bound as the bed (058).
--
-- DOWN:
--   alter table public.stl_files
--     drop column if exists size_z_mm,
--     drop column if exists size_y_mm,
--     drop column if exists size_x_mm;

alter table public.stl_files
  add column size_x_mm int check (size_x_mm between 1 and 2000),
  add column size_y_mm int check (size_y_mm between 1 and 2000),
  add column size_z_mm int check (size_z_mm between 1 and 2000);
```

Append to `packages/types/src/printing.ts`:

```ts
type Sized = { size_x_mm?: number | null; size_y_mm?: number | null; size_z_mm?: number | null }

/**
 * Whether every part sits on this bed: x/y either way round, z upright (a part
 * is printed the way its author sliced it). True unless every part has all
 * three sizes (097) — the printer still checks before they accept.
 */
export function bedFits(bed: { bed_x: number; bed_y: number; bed_z: number }, parts: Sized[]): boolean {
  if (parts.length === 0 || parts.some((p) => p.size_x_mm == null || p.size_y_mm == null || p.size_z_mm == null)) {
    return true
  }
  return parts.every(
    (p) =>
      p.size_z_mm! <= bed.bed_z &&
      ((p.size_x_mm! <= bed.bed_x && p.size_y_mm! <= bed.bed_y) ||
        (p.size_x_mm! <= bed.bed_y && p.size_y_mm! <= bed.bed_x))
  )
}
```

`index.ts`, `StlFile` after `material?`:

```ts
  /** 097. The part's bounding box in mm, as sliced. Optional, like the settings. */
  size_x_mm?: number | null
  size_y_mm?: number | null
  size_z_mm?: number | null
```

`stl-files.ts`:

```ts
type PrintSettings = Pick<StlFile, 'print_minutes' | 'filament_grams' | 'material' | 'size_x_mm' | 'size_y_mm' | 'size_z_mm'>
```

`settings` gains `size_x_mm: int(f.size_x_mm), size_y_mm: int(f.size_y_mm), size_z_mm: int(f.size_z_mm),`; and in the PATCH handler after the body check:

```ts
  // 097. Checked here as well as by the column, so the answer is a sentence.
  const sizes = [body.size_x_mm, body.size_y_mm, body.size_z_mm]
  if (sizes.some((v) => v != null && !(Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 2000))) {
    return c.json({ error: 'Part sizes are whole millimetres, 1 to 2000.' }, 400)
  }
```

`stl-settings-form.tsx`:
- `export type StlSettings = Pick<StlFile, 'print_minutes' | 'filament_grams' | 'material' | 'size_x_mm' | 'size_y_mm' | 'size_z_mm'>`
- `settingsOf` adds `size_x_mm: f.size_x_mm ?? null, size_y_mm: f.size_y_mm ?? null, size_z_mm: f.size_z_mm ?? null,`; `same` compares all six (`(Object.keys(a) as (keyof StlSettings)[]).every((k) => a[k] === b[k])`).
- After the three-column grid, a second grid (labels match the printer form's bed axes):

```tsx
            <div className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  ['size_x_mm', 'Width (mm)'],
                  ['size_y_mm', 'Depth (mm)'],
                  ['size_z_mm', 'Height (mm)'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex flex-col gap-1 text-xs font-bold text-muted">
                  {label}
                  <input
                    type="number"
                    min={1}
                    max={2000}
                    className={field}
                    value={s[key] ?? ''}
                    onChange={(e) => set(f.id, { [key]: num(e.target.value) })}
                  />
                </label>
              ))}
            </div>
```

- Header comment: "minutes on the bed, grams of filament and the material" → "minutes on the bed, grams of filament, the material and the part's size (097)".

`request-print-form.tsx`: `PrintablePart` picks `'id' | 'filename' | 'print_minutes' | 'filament_grams' | 'material' | 'size_x_mm' | 'size_y_mm' | 'size_z_mm'`.

`app/printing/requests/page.tsx` — import `bedFits` from `@splat-connect/types`; after `tutorial` is loaded, pass `printers={theirs.filter((p) => bedFits(p, tutorial.stl_files ?? []))}` to `RequestPrintForm`.

Mobile `find-screen.tsx` — import `bedFits`; `theirs` gains the bed check, so a hidden printer is not counted either:

```tsx
  // 097: a printer whose bed cannot hold the guide's parts is not offered. No
  // chip — the board's rule — and nothing is hidden unless every part is sized.
  const theirs = printers.filter(
    (p) =>
      p.owner_id !== caps?.profile.id &&
      !(p.owner_org_id && ledOrgIds.has(p.owner_org_id)) &&
      bedFits(p, guide?.stl_files ?? [])
  )
```

Mobile `stl-section.tsx`:
- Destructure nothing new from `useDraft`; import `TextField` from `../../ui/TextField` and `Pressable`-free `Button` is already imported.
- The replace-set mapping gains `size_x_mm: f.size_x_mm, size_y_mm: f.size_y_mm, size_z_mm: f.size_z_mm,`.
- State: `const [sizes, setSizes] = useState<Record<string, { x: string; y: string; z: string }>>({})` and

```tsx
  const sizeOf = (f: StlFile) =>
    sizes[f.id] ?? { x: String(f.size_x_mm ?? ''), y: String(f.size_y_mm ?? ''), z: String(f.size_z_mm ?? '') }
  const mm = (v: string) => (v.trim() === '' ? null : Number(v))

  // One PATCH per file with every setting it has: the route writes what it is
  // sent, and the replace-set POST is refused once a job names the file.
  async function saveSizes(f: StlFile) {
    const s = sizeOf(f)
    setLocalError(null)
    try {
      const updated = await apiClient.patch<StlFile>(`/api/tutorials/${id}/stl-files/${f.id}`, {
        print_minutes: f.print_minutes ?? null,
        filament_grams: f.filament_grams ?? null,
        material: f.material ?? null,
        size_x_mm: mm(s.x),
        size_y_mm: mm(s.y),
        size_z_mm: mm(s.z),
      })
      setFiles((cur) => cur.map((x) => (x.id === f.id ? { ...x, ...updated } : x)))
    } catch (err) {
      setLocalError(apiMessage(err, 'Could not save the sizes. Please try again.'))
    }
  }
```

  (import `apiMessage` and `type StlFile` from `@splat-connect/types`). Each file row becomes:

```tsx
            <View key={f.id} style={styles.fileBlock}>
              <View style={styles.row}>
                <Ionicons name="cube-outline" size={18} color={theme.colors.primary} />
                <Text style={styles.filename}>{f.filename}</Text>
              </View>
              <View style={styles.sizes}>
                {(
                  [
                    ['x', 'Width (mm)'],
                    ['y', 'Depth (mm)'],
                    ['z', 'Height (mm)'],
                  ] as const
                ).map(([axis, label]) => (
                  <View key={axis} style={styles.size}>
                    <TextField
                      label={label}
                      accessibilityLabel={`${label} for ${f.filename}`}
                      inputMode="numeric"
                      value={sizeOf(f)[axis]}
                      onChangeText={(v) => setSizes((cur) => ({ ...cur, [f.id]: { ...sizeOf(f), [axis]: v } }))}
                    />
                  </View>
                ))}
              </View>
              <Button label="Save sizes" variant="secondary" onPress={() => void saveSizes(f)} />
            </View>
```

  Styles: `fileBlock: { marginBottom: theme.spacing(4), gap: theme.spacing(2) }`, `sizes: { flexDirection: 'row', gap: theme.spacing(2) }`, `size: { flex: 1 }`.
- `grep -rn "size_x_mm" packages/mobile` afterwards shows only stl-section and the find screen's `bedFits` input.

`basics-screen.tsx`: delete the two `PENDING(bed-fit-filter)` comment lines.

- [ ] **Step 4: Apply and run**

Run: `supabase migration up` → applies `097_stl_part_sizes.sql`. Run the five commands from Step 2. Expected: PASS.

- [ ] **Step 5: Ship the item** — `shipped: true,` on `'bed-fit-filter'`; `node scripts/pending.mjs`; drift test → `Tests  11 passed (11)`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/097_stl_part_sizes.sql packages/types/src/printing.ts packages/types/src/index.ts packages/api/src/routes/stl-files.ts packages/api/tests/unit/routes/stl-files.test.ts packages/api/tests/integration/printers/part-sizes.test.ts packages/web/components/stl-settings-form.tsx packages/web/components/request-print-form.tsx packages/web/app/printing/requests/page.tsx packages/web/tests/unit/lib/printing.test.ts packages/web/tests/unit/components/stl-settings-form.test.tsx packages/mobile/components/printing/find-screen.tsx packages/mobile/components/printing/basics-screen.tsx packages/mobile/components/my-tutorials/sections/stl-section.tsx packages/mobile/tests/unit/components/printing/find-screen.test.tsx packages/mobile/tests/unit/components/my-tutorials/files-section.test.tsx packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(printing): parts carry their size, and a printer whose bed cannot hold them is not offered

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 10: The printable parts catalogue (`printing-parts`)

**Files:**
- Modify: `packages/types/src/printing.ts` (append `CataloguePart`, `CataloguePage`)
- Modify: `packages/api/src/routes/public.ts` (`GET /printable-parts`; drop `'printing-parts'` from `NOTIFY_FEATURE_KEYS`)
- Modify: `packages/web/app/printing/parts/page.tsx` (replaces `ComingSoon`), `packages/web/lib/public-nav.ts` (the `/printing/parts` child goes `live`, no `featureKey`), `packages/web/lib/pending-icons.ts` (drop `'printing-parts'`)
- Modify: `packages/web/tests/unit/app/scaffold-pages.test.tsx` (drop the printing-parts row and import), `packages/web/tests/e2e/public/navigation.spec.ts` (the scaffold test goes to `/impact/map`)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/api/tests/integration/public/printable-parts.test.ts` (new), `packages/web/tests/unit/app/printing-parts.test.tsx` (new), `packages/web/tests/e2e/public/printing-parts.spec.ts` (new)

**Interfaces:**
- Consumes: 068's settings; `formatPrintMinutes` (`packages/web/lib/print-settings.ts`); `Pager` (`components/pager.tsx`).
- Produces: `GET /api/public/printable-parts?q=&page=` → `CataloguePage = { items: CataloguePart[]; page: number; pages: number; total: number }`, 24 a page; `CataloguePart = { id: string; filename: string; material: string | null; filament_grams: number | null; print_minutes: number | null; tutorial_id: string; tutorials: { id: string; title: string; status: string } }`. Task 11 saves `CataloguePart.id` and reuses the type.

- [ ] **Step 1: Write the failing tests**

`packages/api/tests/integration/public/printable-parts.test.ts`:

```ts
/** The parts catalogue: STL files from approved guides only, searched by filename and guide title. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { adminClient } from '../../helpers/auth.js'

const stamp = crypto.randomUUID().slice(0, 8)
let approved: string
let draft: string

beforeAll(async () => {
  const admin = adminClient()
  const guide = async (title: string, status: string) =>
    (await admin.from('tutorials').insert({ title, description: 'x', difficulty: 'easy', status }).select('id').single()).data!.id as string
  approved = await guide(`Catalogue guide ${stamp}`, 'approved')
  draft = await guide(`Catalogue draft ${stamp}`, 'draft')
  await admin.from('stl_files').insert([
    { tutorial_id: approved, filename: `cradle-${stamp}.stl`, file_url: `${approved}/c.stl`, filament_grams: 12, material: 'PETG', print_minutes: 45 },
    { tutorial_id: draft, filename: `secret-${stamp}.stl`, file_url: `${draft}/s.stl` },
  ])
})

afterAll(async () => {
  await adminClient().from('tutorials').delete().in('id', [approved, draft])
})

const get = async (q: string) =>
  (await (await app.request(`/api/public/printable-parts?q=${encodeURIComponent(q)}`)).json()) as {
    items: Array<{ filename: string; tutorials: { title: string } }>
    total: number
    pages: number
  }

describe('GET /api/public/printable-parts', () => {
  it('finds a part by its filename, with its guide', async () => {
    const body = await get(`cradle-${stamp}`)
    expect(body.items.map((p) => [p.filename, p.tutorials.title])).toEqual([[`cradle-${stamp}.stl`, `Catalogue guide ${stamp}`]])
  })
  it('finds it by the guide’s title too', async () => {
    expect((await get(`Catalogue guide ${stamp}`)).total).toBe(1)
  })
  it('never lists a part from a guide that is not approved', async () => {
    expect((await get(`secret-${stamp}`)).total).toBe(0)
  })
  it('pages', async () => {
    const res = await app.request('/api/public/printable-parts?page=999')
    const body = (await res.json()) as { page: number; pages: number }
    expect(body.page).toBe(body.pages)
  })
})
```

`packages/web/tests/unit/app/printing-parts.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import PrintingPartsPage from '@/app/printing/parts/page'

const get = vi.hoisted(() => vi.fn())
const saved = vi.hoisted(() => ({ current: null as unknown }))
vi.mock('@/lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => get(...a) } }))
vi.mock('@/lib/saves', () => ({ getSavedIds: async () => saved.current }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), usePathname: () => '/printing/parts' }))
vi.mock('@/components/toast', () => ({ useToast: () => vi.fn() }))

describe('/printing/parts', () => {
  it('lists parts with their guide, material, grams and time, and keeps the board’s steps', async () => {
    get.mockResolvedValue({
      items: [{ id: 'f1', filename: 'cradle-65mm.stl', material: 'PETG', filament_grams: 12, print_minutes: 45, tutorial_id: 'g1', tutorials: { id: 'g1', title: 'Switch mount', status: 'approved' } }],
      page: 1, pages: 1, total: 1,
    })
    render(await PrintingPartsPage({ searchParams: Promise.resolve({ q: 'cradle' }) }))
    expect(get).toHaveBeenCalledWith('/api/public/printable-parts?q=cradle')
    expect(screen.getByText('cradle-65mm.stl')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Switch mount' })).toHaveAttribute('href', '/tutorials/g1')
    expect(screen.getByText('PETG · 12 g · 45 min')).toBeInTheDocument()
    expect(screen.getByText('Check the tested filament and settings before you print')).toBeInTheDocument()
  })

  it('says so when nothing matches', async () => {
    get.mockResolvedValue({ items: [], page: 1, pages: 1, total: 0 })
    render(await PrintingPartsPage({ searchParams: Promise.resolve({ q: 'zzz' }) }))
    expect(screen.getByText('Nothing matches "zzz". Try a different word, or clear the search.')).toBeInTheDocument()
  })
})
```

`packages/web/tests/e2e/public/printing-parts.spec.ts`:

```ts
import { test, expect } from '@playwright/test'
import { adminClient, createContributor, createTutorial, deleteUser, uniqueTitle } from '../helpers'

test('the parts catalogue finds a guide’s STL by the guide’s title', async ({ page }) => {
  const contributor = await createContributor()
  const title = uniqueTitle('E2E Catalogue')
  const tutorialId = await createTutorial(contributor.id, { title, status: 'approved' })
  try {
    await page.goto(`/printing/parts?q=${encodeURIComponent(title)}`)
    await expect(page.getByText('e2e-mount.stl')).toBeVisible()
    await expect(page.getByRole('link', { name: title })).toHaveAttribute('href', `/tutorials/${tutorialId}`)
  } finally {
    await adminClient().from('tutorials').delete().eq('id', tutorialId)
    await deleteUser(contributor.id)
  }
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/public/printable-parts.test.ts` → FAIL (404).
Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/app/printing-parts.test.tsx` → FAIL (ComingSoon renders).

- [ ] **Step 3: Implement**

Append to `packages/types/src/printing.ts`:

```ts
/** One row of the printable parts catalogue (GET /api/public/printable-parts) and of Saved parts. */
export interface CataloguePart {
  id: string
  filename: string
  material: string | null
  filament_grams: number | null
  print_minutes: number | null
  tutorial_id: string
  tutorials: { id: string; title: string; status: string }
}

export interface CataloguePage {
  items: CataloguePart[]
  page: number
  pages: number
  total: number
}
```

`public.ts` — import `type CataloguePart` from `@splat-connect/types`; delete `'printing-parts',` from `NOTIFY_FEATURE_KEYS`; before the notify block:

```ts
const PARTS_PAGE = 24

/**
 * GET /api/public/printable-parts?q=&page=
 *
 * The parts catalogue: every STL file of an approved guide, searched by
 * filename and by the guide's title, 24 a page. Anon client — 001's "Anyone
 * can read stl_files of approved tutorials" admits the rows, and the explicit
 * filter repeats it.
 */
publicRoutes.get('/printable-parts', async (c) => {
  const q = (c.req.query('q') ?? '').trim().toLowerCase()
  const asked = Number.parseInt(c.req.query('page') ?? '', 10)
  const { data, error } = await createAnonClient()
    .from('stl_files')
    .select('id, filename, material, filament_grams, print_minutes, tutorial_id, tutorials!inner(id, title, status)')
    .eq('tutorials.status', 'approved')
    .order('filename')
  if (error) return c.json({ error: error.message }, 500)
  // ponytail: searches and pages after reading every approved STL row; move into SQL when the catalogue reaches thousands.
  const rows = ((data ?? []) as unknown as CataloguePart[]).filter(
    (p) => !q || p.filename.toLowerCase().includes(q) || p.tutorials.title.toLowerCase().includes(q)
  )
  const pages = Math.max(1, Math.ceil(rows.length / PARTS_PAGE))
  const page = Number.isFinite(asked) ? Math.min(Math.max(asked, 1), pages) : 1
  return c.json({ items: rows.slice((page - 1) * PARTS_PAGE, page * PARTS_PAGE), page, pages, total: rows.length })
})
```

`packages/web/app/printing/parts/page.tsx` (whole file):

```tsx
/**
 * Printable parts — every STL file from an approved guide, searchable by
 * filename and guide title, each row linking to the guide it belongs to.
 *
 * The board draws this screen only as a "Not built yet" with three steps;
 * those steps stay, as the intro. Settings are the author's (068), so a row
 * shows what they tested rather than anything to choose.
 */
import Link from 'next/link'
import type { Route } from 'next'
import { Cube, MagnifyingGlass } from '@phosphor-icons/react/dist/ssr'
import type { CataloguePage } from '@splat-connect/types'
import { apiClient } from '@/lib/api-client'
import { formatPrintMinutes } from '@/lib/print-settings'
import { Pager } from '@/components/pager'

export const metadata = { title: 'Printable parts — SPLAT Connect' }

const STEPS = [
  'Search by what the part has to do, not by filename',
  'Check the tested filament and settings before you print',
  'Print it yourself, or send it to an association that will',
]

const EMPTY: CataloguePage = { items: [], page: 1, pages: 1, total: 0 }

export default async function PrintingPartsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const { q = '', page } = await searchParams
  const query = new URLSearchParams({ ...(q ? { q } : {}), ...(page ? { page } : {}) }).toString()
  const list = await apiClient
    .get<CataloguePage>(`/api/public/printable-parts${query ? `?${query}` : ''}`)
    .catch(() => EMPTY)

  return (
    <div className="mx-auto flex max-w-[980px] flex-col gap-6">
      <header>
        <p className="eyebrow text-muted">3D Printing</p>
        <h1 className="mb-2 mt-1 font-display text-[40px] font-extrabold leading-[1.1] text-ink">Printable parts</h1>
        <p className="max-w-[60ch] text-base leading-[1.55] text-muted">
          A catalogue of STL files for switch mounts, cases and interrupter housings — each one sized and print-tested
          rather than guessed at.
        </p>
        <ol className="mt-4 flex list-decimal flex-col gap-1 pl-5 text-sm text-muted">
          {STEPS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </header>

      <form role="search" action="/printing/parts" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={q}
          aria-label="Search parts"
          className="field min-h-12 flex-1 font-semibold"
        />
        <button type="submit" className="btn btn-primary">
          <MagnifyingGlass size={18} weight="bold" aria-hidden="true" />
          Search
        </button>
      </form>

      {list.items.length === 0 ? (
        <p className="text-muted">
          {q ? `Nothing matches "${q}". Try a different word, or clear the search.` : 'No printable parts yet.'}
        </p>
      ) : (
        <ul className="flex list-none flex-col gap-2.5 p-0">
          {list.items.map((p) => (
            <li key={p.id} className="print-part">
              <span
                aria-hidden="true"
                className="grid h-11 w-11 flex-none place-items-center rounded-field bg-violet-soft text-[var(--tink)]"
              >
                <Cube size={24} weight="duotone" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-mono text-sm font-bold text-ink [overflow-wrap:anywhere]">{p.filename}</span>
                <Link href={`/tutorials/${p.tutorials.id}` as Route} className="text-sm font-bold text-brand-dark hover:underline">
                  {p.tutorials.title}
                </Link>
                <span className="text-[13px] text-muted">
                  {[
                    p.material,
                    p.filament_grams != null ? `${p.filament_grams} g` : null,
                    p.print_minutes != null ? formatPrintMinutes(p.print_minutes) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      <Pager page={list.page} pages={list.pages} params={{ q: q || undefined }} />
    </div>
  )
}
```

(The empty catalogue's "No printable parts yet." is the one line no board or spec words; it mirrors the admin queues' "No print jobs yet.")

`public-nav.ts` — the `/printing/parts` child: `state: 'live',` and delete `featureKey: 'printing-parts',`.
`pending-icons.ts` (web) — delete `'printing-parts': Cube,` (keep the `Cube` import while `'saved-parts'` uses it).
`scaffold-pages.test.tsx` — delete the `PrintingPartsPage` import and its `['printing-parts', PrintingPartsPage],` row; change the comment's last line "Printable parts likewise." to "Printable parts shipped on 2026-10-01."
`navigation.spec.ts` — in "a scaffold page explains itself and offers to notify", `page.goto('/printing/parts')` → `page.goto('/impact/map')`.

- [ ] **Step 4: Run the tests to see them pass**

Run the two commands from Step 2, then `pnpm --filter @splat-connect/web exec vitest run tests/unit/app/scaffold-pages.test.tsx tests/unit/lib/public-nav.test.ts` and `pnpm --filter @splat-connect/web exec playwright test tests/e2e/public/printing-parts.spec.ts tests/e2e/public/navigation.spec.ts`. Expected: PASS.

- [ ] **Step 5: Ship the item** — `shipped: true,` on `'printing-parts'` (its `pending="printing-parts"` went with the ComingSoon); `node scripts/pending.mjs`; drift test → `Tests  11 passed (11)`.

- [ ] **Step 6: Commit**

```bash
git add packages/types/src/printing.ts packages/api/src/routes/public.ts packages/api/tests/integration/public/printable-parts.test.ts packages/web/app/printing/parts/page.tsx packages/web/lib/public-nav.ts packages/web/lib/pending-icons.ts packages/web/tests/unit/app/printing-parts.test.tsx packages/web/tests/unit/app/scaffold-pages.test.tsx packages/web/tests/e2e/public/printing-parts.spec.ts packages/web/tests/e2e/public/navigation.spec.ts packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(web): /printing/parts is a searchable catalogue of every approved guide's STL files

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 11: Saved printable parts (`saved-parts`)

**Files:**
- Modify: `packages/types/src/index.ts` (`SAVE_SLUGS.parts`, and the `SaveEntityType` note "Only the three in SAVE_SLUGS are live" → "Every member is live")
- Modify: `packages/api/src/routes/saves.ts` (`SOURCE.parts`, the comment that calls `printable_part` absent)
- Delete: `packages/web/app/dashboard/saved/parts/page.tsx`
- Modify: `packages/web/app/dashboard/saved/[type]/page.tsx` (`VIEW.parts`, `shown`), `packages/web/app/dashboard/saved/page.tsx` (`CARDS`), `packages/web/app/printing/parts/page.tsx` (Save button per row), `packages/web/lib/pending-icons.ts` (drop `'saved-parts'` and, now unused, `Cube`)
- Modify: `packages/mobile/lib/saves.ts`, `packages/mobile/components/saved/saved-screen.tsx`, `saved-list-screen.tsx`, `packages/mobile/lib/pending-icons.ts` (drop `'saved-parts'`)
- Modify: `scripts/parity/app-screen-map.json` (the `saved` rule naming `saved-parts`)
- Modify: `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/api/tests/integration/saves/saves.test.ts`, `packages/web/tests/unit/pages/saved-list.test.tsx`, `packages/web/tests/unit/pages/saved-hub.test.tsx`, `packages/web/tests/unit/app/printing-parts.test.tsx`, `packages/mobile/tests/unit/components/saved/saved-screen.test.tsx`, `saved-list-screen.test.tsx`

**Interfaces:**
- Consumes: 044's `save_entity_type` already has `printable_part`; Task 10's `CataloguePart`.
- Produces: `SAVE_SLUGS.parts = 'printable_part'`; `GET /api/saves/parts` → `CataloguePart[]` (approved guides only); `SavedIds.parts: string[]`.

- [ ] **Step 1: Write the failing tests**

`saves.test.ts` — replace the test "404s a slug that is in the enum but has no source" (every enum member is live now) with:

```ts
  it('serves saved parts, and only from approved guides', async () => {
    const admin = adminClient()
    const { data: g } = await admin
      .from('tutorials')
      .insert([
        { title: 'Saved part guide', description: 'x', difficulty: 'easy', status: 'approved' },
        { title: 'Saved part draft', description: 'x', difficulty: 'easy', status: 'draft' },
      ])
      .select('id, status')
    const live = g!.find((t) => t.status === 'approved')!.id
    const hidden = g!.find((t) => t.status === 'draft')!.id
    const { data: f } = await admin
      .from('stl_files')
      .insert([
        { tutorial_id: live, filename: 'kept.stl', file_url: `${live}/kept.stl` },
        { tutorial_id: hidden, filename: 'hidden.stl', file_url: `${hidden}/hidden.stl` },
      ])
      .select('id, filename')
    for (const file of f!) {
      await app.request('/api/saves', {
        method: 'POST',
        headers: { ...as(owner).headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_type: 'printable_part', entity_id: file.id }),
      })
    }
    const res = await app.request('/api/saves/parts', as(owner))
    expect(res.status).toBe(200)
    expect(((await res.json()) as Array<{ filename: string }>).map((p) => p.filename)).toEqual(['kept.stl'])
    await admin.from('tutorials').delete().in('id', [live, hidden])
  })
```

(use the file's own auth helper in place of `as(owner)` if it is named differently.)

`saved-list.test.tsx` — replace "404s a slug that is in the enum but not live" with:

```tsx
  it('renders saved parts, linking to their guide', async () => {
    listed.current = [{ id: 'f1', filename: 'cradle-65mm.stl', material: 'PETG', filament_grams: 12, print_minutes: null, tutorial_id: 'g1', tutorials: { id: 'g1', title: 'Switch mount', status: 'approved' } }]
    render(await SavedList({ params: Promise.resolve({ type: 'parts' }) }))
    expect(screen.getByText('cradle-65mm.stl')).toBeInTheDocument()
    expect(screen.getByText('Switch mount')).toBeInTheDocument()
  })
```

`saved-hub.test.tsx` — the `getSavedIds` mock gains `parts: []`; add `expect(screen.getByText('Printable parts')).toBeInTheDocument()` to its first test.

`printing-parts.test.tsx` — add `saved.current = null` to a `beforeEach`, and a new test (the mock reads the hoisted `saved` declared in Task 10):

```tsx
  it('puts a filled save control on a part already saved', async () => {
    get.mockResolvedValue({
      items: [{ id: 'f1', filename: 'cradle-65mm.stl', material: null, filament_grams: null, print_minutes: null, tutorial_id: 'g1', tutorials: { id: 'g1', title: 'Switch mount', status: 'approved' } }],
      page: 1, pages: 1, total: 1,
    })
    saved.current = { tutorials: [], toys: [], challenges: [], organisations: [], parts: ['f1'] }
    render(await PrintingPartsPage({ searchParams: Promise.resolve({}) }))
    // SaveButton draws aria-pressed and the label Saved when on.
    expect(screen.getByRole('button', { name: 'Saved' })).toHaveAttribute('aria-pressed', 'true')
  })
```

Mobile `saved-screen.test.tsx` — the ids fixture gains `parts: ['f1']`; assert `expect(await screen.findByText('1 part you kept')).toBeTruthy()` and `expect(screen.queryByText('Not built yet')).toBeNull()`.
Mobile `saved-list-screen.test.tsx` — the `useSaves` mock's `savedIds` gains `organisations: [], parts: []`; add:

```tsx
  it('lists saved parts and opens their guide', async () => {
    mockGet.mockResolvedValue([{ id: 'f1', filename: 'cradle-65mm.stl', tutorial_id: 'g1', tutorials: { id: 'g1', title: 'Switch mount' } }])
    render(<SavedListScreen slug="parts" />)
    fireEvent.press(await screen.findByText('cradle-65mm.stl'))
    expect(mockPush).toHaveBeenCalledWith('/guides/g1')
    expect(screen.getByText('Switch mount')).toBeTruthy()
  })
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/saves/saves.test.ts` → FAIL (404).
Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/pages/saved-list.test.tsx tests/unit/pages/saved-hub.test.tsx tests/unit/app/printing-parts.test.tsx` → FAIL.
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/saved` → FAIL.

- [ ] **Step 3: Implement**

`index.ts`, `SAVE_SLUGS`:

```ts
  organisations: 'organisation',
  // Switched on 2026-10-01 with the parts catalogue (/printing/parts). The
  // entity is an stl_files row; only an approved guide's parts are returned.
  parts: 'printable_part',
```

`saves.ts` — in `SOURCE`, after `organisations`:

```ts
  parts: {
    table: 'stl_files',
    // The catalogue's shape (GET /public/printable-parts). The inner join is
    // what drops a part whose guide went back to draft.
    select: 'id, filename, material, filament_grams, print_minutes, tutorial_id, tutorials!inner(id, title, status)',
    filter: (q: EntityQuery) => q.eq('tutorials.status', 'approved'),
  },
```

and rewrite the `SOURCE` doc comment's sentence "'printable_part' is in the enum and deliberately absent here, so its route 404s until someone adds a line — placeholder-ness lives in one place rather than five conditionals." as "Every enum member has a line here now; a new member 404s until it gets one."

Delete `packages/web/app/dashboard/saved/parts/page.tsx` (`git rm`) — the static segment would otherwise win the route and keep showing ComingSoon.

`saved/[type]/page.tsx`:
- Import `Cube` from Phosphor and `type CataloguePart` from `@splat-connect/types`.
- `VIEW` gains (copy from the deleted page):

```tsx
  parts: {
    title: 'Saved parts',
    lead: 'Printable parts you want to make or ask someone to print for you.',
    browse: '/printing/parts',
    browseLabel: 'Browse printable parts',
  },
```

- `shown`, before the challenge fallthrough:

```tsx
  if (slug === 'parts') {
    const p = item as CataloguePart
    return {
      href: `/tutorials/${p.tutorial_id}`,
      title: p.filename,
      photo: null,
      Icon: Cube,
      tag: 'Part',
      note: [p.material, p.filament_grams != null ? `${p.filament_grams} g` : null].filter(Boolean).join(' · ') || null,
      by: p.tutorials.title,
    }
  }
```

`saved/page.tsx` — import `Cube`; `CARDS` gains `{ slug: 'parts', label: 'Printable parts', blurb: 'Printable parts you want to make or ask someone to print for you.', tint: 'var(--tviolet)', Icon: Cube },`.

`printing/parts/page.tsx` — import `getSavedIds` from `@/lib/saves` and `SaveButton` from `@/components/save-button`; fetch `const saved = await getSavedIds()` beside `list` (in a `Promise.all`); each `<li>` gets `className="print-part save-host relative"` and, after the text column:

```tsx
              <SaveButton slug="parts" id={p.id} saved={saved?.parts.includes(p.id) ?? false} signedIn={saved !== null} />
```

Web `pending-icons.ts` — delete `'saved-parts': Cube,` and the `Cube` import.

Mobile `lib/saves.ts` and `saved-screen.tsx` — `NONE` gains `parts: []`. `saved-screen.tsx`: `TILES` gains `{ slug: 'parts', label: 'Printable parts', noun: ['part', 'parts'], icon: 'cube-outline' },`; delete the `PendingRow` line and its import.

`saved-list-screen.tsx`:
- `SavedEntity` gains `filename?: string; tutorial_id?: string; tutorials?: { title: string } | null`.
- `KIND`'s `route` becomes `(item: SavedEntity) => string`; existing entries change `(id) => …${id}` to `(item) => …${item.id}`; add:

```tsx
  parts: {
    noun: 'parts',
    lead: 'Printable parts you want to make or ask someone to print for you.',
    icon: 'cube-outline',
    // The phone has no catalogue: a part opens the guide it belongs to.
    route: (item) => `/guides/${item.tutorial_id}`,
    browseLabel: 'Browse the guides',
    browse: '/guides',
  },
```

- In the row: `const label = item.title ?? item.name ?? item.filename ?? ''`, `const line = item.summary ?? item.description ?? item.tutorials?.title ?? null`, and `onPress={() => router.push(kind.route(item))}`.

Mobile `pending-icons.ts` — delete `'saved-parts': 'cube-outline',`.

`app-screen-map.json` — delete the `saved` screen's `explained` rule whose `pending` is `saved-parts` (drop `explained` if it empties).

- [ ] **Step 4: Run the tests to see them pass**

Run the three commands from Step 2, then `pnpm typecheck` (every `Record<SaveSlug, …>` must now name `parts`). Expected: PASS, typecheck clean.

- [ ] **Step 5: Ship the item** — `shipped: true,` on `'saved-parts'`; `node scripts/pending.mjs`; drift test → `Tests  11 passed (11)`.

- [ ] **Step 6: Commit**

```bash
git rm packages/web/app/dashboard/saved/parts/page.tsx
git add packages/types/src/index.ts packages/api/src/routes/saves.ts packages/api/tests/integration/saves/saves.test.ts "packages/web/app/dashboard/saved/[type]/page.tsx" packages/web/app/dashboard/saved/page.tsx packages/web/app/printing/parts/page.tsx packages/web/lib/pending-icons.ts packages/web/tests/unit/pages/saved-list.test.tsx packages/web/tests/unit/pages/saved-hub.test.tsx packages/web/tests/unit/app/printing-parts.test.tsx packages/mobile/lib/saves.ts packages/mobile/lib/pending-icons.ts packages/mobile/components/saved/saved-screen.tsx packages/mobile/components/saved/saved-list-screen.tsx packages/mobile/tests/unit/components/saved/saved-screen.test.tsx packages/mobile/tests/unit/components/saved/saved-list-screen.test.tsx scripts/parity/app-screen-map.json packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(saves): printable parts can be saved from the catalogue and found on Saved

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 12: Verified printers (`printer-verified`, migration 098)

**Files:**
- Create: `supabase/migrations/098_printer_test_prints.sql`
- Modify: `packages/types/src/printing.ts` (append `VERIFIED_MIN_JOBS`, `TestPrint`, `testPrintLabel`), `packages/types/src/index.ts` (`PrinterWithOwner.verified`, `test_print`)
- Modify: `packages/api/src/routes/printers.ts` (`SELECT` + `verified`; `/mine` attaches `test_print`; `POST /:id/test-prints`), `packages/api/src/routes/admin.ts` (`GET /test-prints`, `PATCH /test-prints/:id`)
- Create: `packages/web/app/admin/test-prints/page.tsx`, `packages/web/components/admin-test-prints.tsx`
- Modify: `packages/web/app/admin/page.tsx` (a Test prints card), `packages/web/lib/trail.ts` (`'/admin/test-prints'`)
- Modify: `packages/mobile/lib/upload.ts` (`UploadPath`), `packages/mobile/components/printing/actions.ts` (`submitTestPrint`), `find-screen.tsx` (Verified chip, seal on cards, header comment), `offer-screen.tsx` (Get verified on My printers)
- Modify: `scripts/check-schema-guards.sh`, `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/api/tests/integration/printers/verified.test.ts` (new), `packages/web/tests/unit/components/admin-test-prints.test.tsx` (new), mobile `find-screen.test.tsx`, `offer-screen.test.tsx`

**Interfaces:**
- Consumes: Task 7's completed-job definition.
- Produces: table `printer_test_prints`, private bucket `printer-test-prints`, computed field `verified(printers) boolean`. `POST /api/printers/:id/test-prints` (multipart `file`) → 201 `{ id, printer_id, verdict, note, submitted_at }`, 404 not yours, 409 one still waiting, 400 no file. `GET /api/admin/test-prints` → `AdminTestPrint[]`; `PATCH /api/admin/test-prints/:id` `{ verdict: 'pass' | 'fail', note?: string }`. `/api/printers/mine` rows carry `test_print: TestPrint | null`; every printer row carries `verified: boolean`. `VERIFIED_MIN_JOBS = 3`.

- [ ] **Step 1: Write the failing tests**

`packages/api/tests/integration/printers/verified.test.ts`:

```ts
/**
 * 098. Verified is earned: the latest reviewed test print passed AND the
 * printer has VERIFIED_MIN_JOBS completed jobs. The owner submits a photo;
 * only an admin passes or fails it.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { VERIFIED_MIN_JOBS } from '@splat-connect/types'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let owner: TestUser
let outsider: TestUser
let staff: TestUser
let family: TestUser
let tutorialId: string
let printerId: string

const authed = (u: TestUser) => ({ headers: { Authorization: `Bearer ${u.token}` } })
const photo = (u: TestUser) => {
  const form = new FormData()
  form.append('file', new File([new Uint8Array([1, 2, 3])], 'test-print.png', { type: 'image/png' }))
  return { method: 'POST', headers: { Authorization: `Bearer ${u.token}` }, body: form }
}
const verified = async () =>
  ((await (await app.request(`/api/printers/${printerId}`, authed(family))).json()) as { verified: boolean }).verified
const completeJobs = (n: number) =>
  adminClient()
    .from('toy_transactions')
    .insert(
      Array.from({ length: n }, () => ({
        type: 'print', status: 'completed', tutorial_id: tutorialId, printer_id: printerId, requester_id: family.id,
        owner_id: owner.id, print_group_id: crypto.randomUUID(),
      }))
    )

beforeAll(async () => {
  owner = await createTestUser('contributor')
  outsider = await createTestUser('contributor')
  staff = await createTestUser('admin')
  family = await createTestUser('contributor')
  const admin = adminClient()
  const { data: t } = await admin
    .from('tutorials')
    .insert({ title: 'Verified fixture', description: 'x', difficulty: 'easy', status: 'approved' })
    .select('id')
    .single()
  tutorialId = t!.id
  const { data: p } = await admin
    .from('printers')
    .insert({ owner_id: owner.id, name: 'To verify', materials: ['PLA'], bed_x: 200, bed_y: 200, bed_z: 200 })
    .select('id')
    .single()
  printerId = p!.id
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('toy_transactions').delete().eq('tutorial_id', tutorialId)
  await admin.from('printers').delete().eq('id', printerId)
  await admin.from('tutorials').delete().eq('id', tutorialId)
  await Promise.all([owner, outsider, staff, family].map((u) => deleteTestUser(u.id)))
})

describe('098 verified printers', () => {
  it('lets only the owner submit a test print, one at a time', async () => {
    expect((await app.request(`/api/printers/${printerId}/test-prints`, photo(outsider))).status).toBe(404)
    expect((await app.request(`/api/printers/${printerId}/test-prints`, photo(owner))).status).toBe(201)
    expect((await app.request(`/api/printers/${printerId}/test-prints`, photo(owner))).status).toBe(409)
    const mine = (await (await app.request('/api/printers/mine', authed(owner))).json()) as Array<{ id: string; test_print: { verdict: null } }>
    expect(mine.find((p) => p.id === printerId)!.test_print.verdict).toBeNull()
  })

  it('lets only an admin pass it, with a note', async () => {
    const queue = (await (await app.request('/api/admin/test-prints', authed(staff))).json()) as Array<{ id: string; printer_id: string; photo: string | null }>
    const mineInQueue = queue.find((t) => t.printer_id === printerId)!
    expect(mineInQueue.photo).toMatch(/^http/)
    const patch = (u: TestUser, body: unknown) =>
      app.request(`/api/admin/test-prints/${mineInQueue.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${u.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    expect((await patch(owner, { verdict: 'pass' })).status).toBe(403)
    expect((await patch(staff, { verdict: 'maybe' })).status).toBe(400)
    expect((await patch(staff, { verdict: 'pass', note: 'Clean layers.' })).status).toBe(200)
  })

  it(`is verified only once ${VERIFIED_MIN_JOBS} jobs are completed too`, async () => {
    await completeJobs(VERIFIED_MIN_JOBS - 1)
    expect(await verified()).toBe(false)
    await completeJobs(1)
    expect(await verified()).toBe(true)
  })

  it('keeps the table shut to the anon and user keys', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const anon = createClient(process.env.SUPABASE_URL ?? 'http://localhost:54321', process.env.SUPABASE_ANON_KEY ?? '')
    const { data } = await anon.from('printer_test_prints').select('id')
    expect(data ?? []).toEqual([])
  })
})
```

`packages/web/tests/unit/components/admin-test-prints.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AdminTestPrints } from '@/components/admin-test-prints'
import { browserApiClient } from '@/lib/browser-api-client'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { patch: vi.fn() } }))

const waiting = { id: 't1', printer_name: 'Bambu P1S', owner_name: 'Tom B.', photo: 'https://x/p.jpg', submitted_at: '2026-10-01T00:00:00Z', verdict: null, note: null }

describe('AdminTestPrints', () => {
  it('passes a waiting test print with a note', async () => {
    const patch = vi.mocked(browserApiClient.patch).mockResolvedValue({})
    render(<AdminTestPrints prints={[waiting]} />)
    fireEvent.change(screen.getByLabelText('Note for Bambu P1S'), { target: { value: 'Clean layers.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Pass' }))
    await waitFor(() => expect(patch).toHaveBeenCalledWith('/api/admin/test-prints/t1', { verdict: 'pass', note: 'Clean layers.' }))
  })

  it('shows a decided one with its verdict and note', () => {
    render(<AdminTestPrints prints={[{ ...waiting, verdict: 'fail', note: 'Stringing.' }]} />)
    expect(screen.getByText('Failed — Stringing.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pass' })).toBeNull()
  })
})
```

Append to mobile `find-screen.test.tsx`:

```tsx
it('filters to verified printers and marks them', async () => {
  mockGet.mockImplementation((path: string) =>
    Promise.resolve(path === '/api/printers' ? [printer('a', { verified: true }), printer('b')] : GUIDE)
  )
  render(<FindPrinterScreen guideId="g1" />)
  await screen.findByText('Maker B')
  // The seal, not the chip: Ionicons is mocked to a host element, so its props are queryable.
  expect(screen.UNSAFE_getAllByProps({ name: 'shield-checkmark', accessibilityLabel: 'Verified' })).toHaveLength(1)
  fireEvent.press(screen.getByText('Verified'))
  expect(screen.queryByText('Maker B')).toBeNull()
  expect(screen.getByText('Maker A')).toBeTruthy()
})
```

Append to mobile `offer-screen.test.tsx` (add `jest.mock('../../../../components/printing/actions', () => ({ ...jest.requireActual('../../../../components/printing/actions'), submitTestPrint: (...a: unknown[]) => mockSubmit(...a) }))` with `const mockSubmit = jest.fn()` near the other mocks):

```tsx
it('offers Get verified on a printer, and shows a failed test print’s note', async () => {
  mockSubmit.mockResolvedValue({})
  mockGet.mockImplementation((path: string) =>
    Promise.resolve(
      path === '/api/printers/mine'
        ? [machine('Bambu P1S', { test_print: { verdict: 'fail', note: 'Stringing on the arch.', submitted_at: '' } }), machine('Prusa', { test_print: { verdict: null, note: null, submitted_at: '' } })]
        : []
    )
  )
  render(<PrintForOthersScreen />)
  fireEvent.press(await screen.findByText('My printers'))
  expect(screen.getByText('Failed')).toBeTruthy()
  expect(screen.getByText('“Stringing on the arch.”')).toBeTruthy()
  expect(screen.getByText('Waiting')).toBeTruthy()
  fireEvent.press(screen.getByText('Get verified'))
  await waitFor(() => expect(mockSubmit).toHaveBeenCalledWith('Bambu P1S'))
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/printers/verified.test.ts` → FAIL.
Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/components/admin-test-prints.test.tsx` → FAIL (module missing).
Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/printing` → FAIL.

- [ ] **Step 3: Implement**

`supabase/migrations/098_printer_test_prints.sql`:

```sql
-- 098 — Verified printers, earned rather than granted.
--
-- Decided 2026-09-30: the printer uploads a photo of the SPLAT test print, an
-- admin marks it pass or fail, and 3 completed jobs (VERIFIED_MIN_JOBS in
-- packages/types printing.ts — the integration test holds the two together)
-- follow.
--
--   printer_test_prints  one row per submitted photo. The API reads and writes
--                        it with the service role: an owner submits through
--                        POST /api/printers/:id/test-prints, an admin decides
--                        through /api/admin/test-prints. RLS is on with no
--                        policy, so neither key reaches it directly.
--   printer-test-prints  private bucket, <printer_id>/<file>. Signed URLs only.
--   verified(printers)   computed field: the latest REVIEWED test print passed
--                        and the printer has 3 completed print jobs. A new
--                        submission waiting for a look does not unverify a
--                        printer that already passed.
--
-- DOWN:
--   drop function if exists public.verified(public.printers);
--   drop table if exists public.printer_test_prints;
--   delete from storage.buckets where id = 'printer-test-prints';

create table public.printer_test_prints (
  id uuid primary key default gen_random_uuid(),
  printer_id uuid not null references public.printers (id) on delete cascade,
  -- A storage path in the private bucket, never a URL.
  photo_url text not null,
  submitted_at timestamptz not null default now(),
  verdict text check (verdict in ('pass', 'fail')),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  note text check (note is null or length(btrim(note)) <= 500),
  constraint printer_test_prints_reviewed check ((verdict is null) = (reviewed_at is null))
);

create index printer_test_prints_printer_idx on public.printer_test_prints (printer_id, submitted_at desc);

alter table public.printer_test_prints enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'printer-test-prints', 'printer-test-prints', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

create function public.verified(p public.printers)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
      select t.verdict = 'pass'
      from public.printer_test_prints t
      where t.printer_id = p.id and t.verdict is not null
      order by t.reviewed_at desc
      limit 1
    ), false)
    and (
      select count(*)
      from public.toy_transactions x
      where x.printer_id = p.id and x.type = 'print' and x.status = 'completed'
    ) >= 3
$$;
```

Append to `packages/types/src/printing.ts`:

```ts
/** Completed print jobs a printer needs, beside a passed test print, to be verified (098). */
export const VERIFIED_MIN_JOBS = 3

/** The latest test print on one of the caller's machines (GET /api/printers/mine). */
export interface TestPrint {
  verdict: 'pass' | 'fail' | null
  note: string | null
  submitted_at: string
}

/** Waiting / Passed / Failed — the owner's status line. */
export const testPrintLabel = (t: TestPrint) =>
  t.verdict === 'pass' ? 'Passed' : t.verdict === 'fail' ? 'Failed' : 'Waiting'
```

`index.ts`: extend the type import with `TestPrint`; `PrinterWithOwner` gains `/** 098. */ verified?: boolean` and `/** 098, on /api/printers/mine only. */ test_print?: TestPrint | null`.

`printers.ts`:
- Add `import { randomUUID } from 'node:crypto'`; `SELECT` gains `, verified`; `Row` gains `verified: boolean`.
- `/mine`, before `return c.json(…)`:

```ts
  // The latest test print per machine (098), for the owner's Get verified line.
  const { data: prints } = rows.length
    ? await admin
        .from('printer_test_prints')
        .select('printer_id, verdict, note, submitted_at')
        .in('printer_id', rows.map((r) => r.id))
        .order('submitted_at', { ascending: false })
    : { data: [] as Array<{ printer_id: string; verdict: 'pass' | 'fail' | null; note: string | null; submitted_at: string }> }
  const latest = new Map<string, { verdict: 'pass' | 'fail' | null; note: string | null; submitted_at: string }>()
  for (const t of prints ?? []) {
    if (!latest.has(t.printer_id)) latest.set(t.printer_id, { verdict: t.verdict, note: t.note, submitted_at: t.submitted_at })
  }
```

  and each mapped row gains `test_print: latest.get(r.id) ?? null,`.
- After `printers.get('/:id', …)`:

```ts
/**
 * POST /api/printers/:id/test-prints
 *
 * The owner's photo of the SPLAT test print (098), for an admin to pass or
 * fail. One waiting at a time. Written with the service role: the table has
 * no policy, and this is the one door an owner has to it.
 */
printers.post('/:id/test-prints', async (c) => {
  const userId = c.get('userId')
  const admin = createAdminClient()
  const { data: printer, error } = await admin
    .from('printers')
    .select('id, owner_id, owner_org_id')
    .eq('id', c.req.param('id'))
    .maybeSingle()
  if (error && error.code !== INVALID_TEXT_REPRESENTATION) return c.json({ error: error.message }, 500)
  const mine =
    !!printer &&
    (printer.owner_id === userId ||
      (!!printer.owner_org_id && (await ledOrgIds(admin, userId)).includes(printer.owner_org_id)))
  if (!mine) return c.json({ error: 'No such printer of yours.' }, 404)

  const { data: waiting } = await admin
    .from('printer_test_prints')
    .select('id')
    .eq('printer_id', printer.id)
    .is('verdict', null)
    .limit(1)
  if (waiting?.length) return c.json({ error: 'Your last test print is still waiting for a look.' }, 409)

  const form = await c.req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return c.json({ error: 'A photo of the SPLAT test print is required' }, 400)

  const path = `${printer.id}/${randomUUID()}-${file.name}`
  const { error: uploadError } = await admin.storage.from('printer-test-prints').upload(path, file)
  if (uploadError) return c.json({ error: uploadError.message }, 500)

  const { data: row, error: insertError } = await admin
    .from('printer_test_prints')
    .insert({ printer_id: printer.id, photo_url: path })
    .select('id, printer_id, verdict, note, submitted_at')
    .single()
  if (insertError) return c.json({ error: insertError.message }, 500)
  return c.json(row, 201)
})
```

`admin.ts`, after `GET /print-jobs`:

```ts
/**
 * GET /api/admin/test-prints
 *
 * The verification queue (098): every submitted test print, waiting first,
 * with a signed photo and whose machine it is. Names via the admin client.
 */
admin.get('/test-prints', async (c) => {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('printer_test_prints')
    .select('id, printer_id, photo_url, submitted_at, verdict, note')
    .order('submitted_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  const rows = data ?? []

  const { data: machines } = await supabase
    .from('printers')
    .select('id, name, owner_id, owner_org_id')
    .in('id', [...new Set(rows.map((r) => r.printer_id as string))])
  const machine = new Map((machines ?? []).map((m) => [m.id as string, m]))
  const personIds = (machines ?? []).map((m) => m.owner_id).filter((id): id is string => !!id)
  const orgIds = (machines ?? []).map((m) => m.owner_org_id).filter((id): id is string => !!id)
  const [{ data: people }, { data: orgs }] = await Promise.all([
    personIds.length ? supabase.from('profiles').select('id, name').in('id', personIds) : Promise.resolve({ data: [] }),
    orgIds.length ? supabase.from('organizations').select('id, name').in('id', orgIds) : Promise.resolve({ data: [] }),
  ])
  const nameOf = new Map(
    [...(people ?? []), ...(orgs ?? [])].map((x) => [(x as { id: string }).id, (x as { name: string }).name])
  )
  const photos = await Promise.all(
    rows.map((r) => supabase.storage.from('printer-test-prints').createSignedUrl(r.photo_url as string, 600))
  )

  const out = rows.map((r, i) => {
    const m = machine.get(r.printer_id as string)
    return {
      id: r.id,
      printer_id: r.printer_id,
      printer_name: m?.name ?? null,
      owner_name: m ? nameOf.get((m.owner_org_id ?? m.owner_id) as string) ?? null : null,
      photo: photos[i]?.data?.signedUrl ?? null,
      submitted_at: r.submitted_at,
      verdict: r.verdict,
      note: r.note,
    }
  })
  out.sort((a, b) => Number(a.verdict !== null) - Number(b.verdict !== null))
  return c.json(out)
})

admin.patch('/test-prints/:id', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { verdict?: unknown; note?: unknown }
  if (body.verdict !== 'pass' && body.verdict !== 'fail') return c.json({ error: 'A test print passes or fails.' }, 400)
  const note = typeof body.note === 'string' ? body.note.trim() : ''
  if (note.length > 500) return c.json({ error: 'The note is 500 characters or fewer.' }, 400)
  const { data, error } = await createAdminClient()
    .from('printer_test_prints')
    .update({ verdict: body.verdict, note: note || null, reviewed_by: c.get('userId'), reviewed_at: new Date().toISOString() })
    .eq('id', c.req.param('id'))
    .select('id, verdict, note')
    .maybeSingle()
  if (error) return c.json({ error: error.message }, 500)
  if (!data) return c.json({ error: 'No such test print' }, 404)
  return c.json(data)
})
```

`packages/web/components/admin-test-prints.tsx`:

```tsx
'use client'
/**
 * The verification queue (098): a photo of each printer's SPLAT test print,
 * waiting ones first. Pass or fail, with a note the owner reads.
 */
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { browserApiClient } from '@/lib/browser-api-client'

export type AdminTestPrint = {
  id: string
  printer_name: string | null
  owner_name: string | null
  photo: string | null
  submitted_at: string
  verdict: 'pass' | 'fail' | null
  note: string | null
}

export function AdminTestPrints({ prints }: { prints: AdminTestPrint[] }) {
  const router = useRouter()
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  async function judge(id: string, verdict: 'pass' | 'fail') {
    setError(null)
    setBusy(id)
    try {
      await browserApiClient.patch(`/api/admin/test-prints/${id}`, { verdict, note: notes[id] ?? '' })
      startTransition(() => router.refresh())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That did not save. Try once more.')
    } finally {
      setBusy(null)
    }
  }

  if (prints.length === 0) {
    return (
      <p className="rounded-card border-[length:var(--bw)] border-dashed border-line bg-surface p-9 text-center text-muted">
        No test prints yet.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}
      <ul className="flex list-none flex-col gap-4 p-0">
        {prints.map((p) => {
          const name = p.printer_name ?? 'A printer'
          return (
            <li key={p.id} className="card flex flex-col gap-3 p-5 sm:flex-row">
              {p.photo && (
                <img src={p.photo} alt={`Test print from ${name}`} className="h-40 w-40 flex-none rounded-field object-cover" />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <p className="font-extrabold text-ink">{name}</p>
                <p className="text-sm text-muted">{p.owner_name ?? 'Unknown owner'}</p>
                {p.verdict === null ? (
                  <>
                    <label className="flex flex-col gap-1 text-sm font-bold text-ink">
                      Note
                      <textarea
                        aria-label={`Note for ${name}`}
                        className="field rounded-[var(--radius-inset)]"
                        rows={2}
                        maxLength={500}
                        value={notes[p.id] ?? ''}
                        onChange={(e) => setNotes((n) => ({ ...n, [p.id]: e.target.value }))}
                      />
                    </label>
                    <div className="flex gap-2">
                      <button type="button" className="btn btn-primary btn-sm" disabled={busy === p.id} onClick={() => judge(p.id, 'pass')}>
                        Pass
                      </button>
                      <button type="button" className="btn btn-quiet btn-sm" disabled={busy === p.id} onClick={() => judge(p.id, 'fail')}>
                        Fail
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm font-bold text-ink">
                    {p.verdict === 'pass' ? 'Passed' : 'Failed'}
                    {p.note ? ` — ${p.note}` : ''}
                  </p>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
```

`packages/web/app/admin/test-prints/page.tsx`:

```tsx
/**
 * Test prints — the queue that makes a printer verified (098). Passing one is
 * half of it; the other half is three completed jobs, which nobody here sets.
 */
import { apiClient } from '@/lib/api-client'
import { AdminTestPrints, type AdminTestPrint } from '@/components/admin-test-prints'

export const metadata = { title: 'Test prints — SPLAT Connect' }

export default async function AdminTestPrintsPage() {
  const prints = await apiClient.get<AdminTestPrint[]>('/api/admin/test-prints').catch(() => [] as AdminTestPrint[])
  return (
    <div className="max-w-[980px]">
      <h1 className="title-hub">Test prints</h1>
      <p className="mt-2 mb-[22px] max-w-[60ch] text-[15px] text-muted">
        A photo of the SPLAT test print from each printer that asked to be verified. Pass or fail it; the owner reads
        your note.
      </p>
      <AdminTestPrints prints={prints} />
    </div>
  )
}
```

`admin/page.tsx` — add `apiClient.get<Counted>('/api/admin/test-prints').catch(() => [] as Counted)` as a fifth entry of the 065 `Promise.all` (destructured as `testPrints`), and a card after "Print jobs stalled":

```tsx
    {
      label: 'Test prints',
      count: testPrints.filter((t) => t.verdict === null).length,
      href: '/admin/test-prints' as const,
      icon: Printer,
      tint: 'var(--tmint)',
      hint: 'Pass or fail a printer’s SPLAT test print',
    },
```

`trail.ts` — after `'/admin/print-jobs'`: `'/admin/test-prints': { label: 'Test prints', parent: '/admin' },`.

Mobile `lib/upload.ts` — `UploadPath` gains:

```ts
  // 098: a printer's SPLAT test print. The printer id is in the path; sent
  // with idField null, and answers with the test-print row.
  | `/api/printers/${string}/test-prints`
```

`actions.ts`:

```ts
/**
 * The owner's photo of the SPLAT test print (098), for an admin to pass or
 * fail. Null when they back out of the picker.
 */
export async function submitTestPrint(printerId: string): Promise<unknown> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!permission.granted) {
    throw new Error('failed with status 400: Photo library access is needed to post the photo.')
  }
  const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ['images'] })
  if (result.canceled || !result.assets?.length) return null
  const asset = result.assets[0]!
  return uploadFile(
    `/api/printers/${printerId}/test-prints`,
    printerId,
    { uri: asset.uri, name: asset.fileName ?? 'test-print.jpg', mimeType: asset.mimeType ?? 'image/jpeg' },
    null
  )
}
```

`offer-screen.tsx` — import `submitTestPrint` from `./actions` and `testPrintLabel` from `@splat-connect/types`; in the My printers card, after the Materials line:

```tsx
                  {p.verified ? (
                    <View style={styles.row}>
                      <Ionicons name="shield-checkmark" size={16} color={theme.colors.success} accessibilityLabel="Verified" />
                      <Text style={styles.strong}>Verified</Text>
                    </View>
                  ) : (
                    <>
                      {p.test_print ? <Text style={styles.strong}>{testPrintLabel(p.test_print)}</Text> : null}
                      {p.test_print?.note ? <Text style={styles.meta}>“{p.test_print.note}”</Text> : null}
                      {!p.test_print || p.test_print.verdict === 'fail' ? (
                        <Button
                          label="Get verified"
                          variant="secondary"
                          loading={busy === `verify-${p.id}`}
                          onPress={() => act(`verify-${p.id}`, () => submitTestPrint(p.id))}
                        />
                      ) : null}
                    </>
                  )}
```

`find-screen.tsx`:
- State `const [verifiedOnly, setVerifiedOnly] = useState(false)`; `shown` adds `&& (!verifiedOnly || !!p.verified)`; Clear filters also calls `setVerifiedOnly(false)`.
- Replace the `PENDING(printer-verified)` comment and its chip with `<Chip label="Verified" icon="shield-checkmark-outline" active={verifiedOnly} onPress={() => setVerifiedOnly((v) => !v)} />`.
- The name line becomes:

```tsx
                    <View style={styles.nameRow}>
                      <Text style={styles.printerName}>{who}</Text>
                      {p.verified ? (
                        // Ionicons has no seal-check; the shield is its nearest.
                        <Ionicons name="shield-checkmark" size={16} color={theme.colors.success} accessibilityLabel="Verified" />
                      ) : null}
                    </View>
```

  with style `nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }`.
- Header comment: "The board's "Within 10 km" and "Verified" filters are not drawn: a printer row stores a suburb, not a location, and has no verified flag." → "The board's "Within 10 km" filter is not drawn: a printer row stores a suburb, not a location."

`check-schema-guards.sh` — after the last row (add a comma to the row before it):

```sql
  -- 098. Test prints decide who is Verified; with RLS off, any key could pass its own.
  ('098 printer_test_prints has RLS on',
   (select relrowsecurity from pg_class where oid = 'public.printer_test_prints'::regclass))
```

- [ ] **Step 4: Apply and run**

Run: `supabase migration up` → applies `098_printer_test_prints.sql`. Run the three commands from Step 2 plus `pnpm --filter @splat-connect/web exec vitest run tests/unit/pages/admin-dashboard.test.tsx tests/unit/lib/trail.test.ts` (give the dashboard test's API mock a `/api/admin/test-prints` answer of `[]` if it routes by path). Expected: PASS.

- [ ] **Step 5: Ship the item** — `shipped: true,` on `'printer-verified'`; `node scripts/pending.mjs`; drift test → `Tests  11 passed (11)`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/098_printer_test_prints.sql packages/types/src/printing.ts packages/types/src/index.ts packages/api/src/routes/printers.ts packages/api/src/routes/admin.ts packages/api/tests/integration/printers/verified.test.ts packages/web/app/admin/test-prints/page.tsx packages/web/components/admin-test-prints.tsx packages/web/app/admin/page.tsx packages/web/lib/trail.ts packages/web/tests/unit/components/admin-test-prints.test.tsx packages/mobile/lib/upload.ts packages/mobile/components/printing/actions.ts packages/mobile/components/printing/find-screen.tsx packages/mobile/components/printing/offer-screen.tsx packages/mobile/tests/unit/components/printing/find-screen.test.tsx packages/mobile/tests/unit/components/printing/offer-screen.test.tsx scripts/check-schema-guards.sh packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(printing): printers earn Verified with a passed test print and three completed jobs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---
### Task 13: Postcode centre points and the distance SQL (`locations-and-distance`, part 1 of 3, migration 099)

Ships nothing on its own. Parts 2 and 3 (Tasks 14 and 15–16) build on it; Task 16 flips the registry entry.

**Files:**
- Create: `scripts/postcode-centroids.mjs`, `supabase/data/abs-poa-2021-centroids.csv` (generated by the script, checked in), `supabase/migrations/099_postcodes_and_distance.sql` (hand-written head + generated INSERT)
- Test: `packages/api/tests/unit/postcode-centroids.test.ts` (new), `packages/api/tests/integration/postcodes.test.ts` (new)

**Interfaces:**
- Consumes: nothing in the repo. The data source is the ABS's own ArcGIS service for **ASGS Edition 3 Postal Areas (POA) 2021** — `https://geo.abs.gov.au/arcgis/rest/services/ASGS2021/POA/MapServer/0/query` — published under **CC BY 4.0** (© Commonwealth of Australia, Australian Bureau of Statistics). 2,644 features; 2,641 are four-digit postcodes (the rest are non-postal codes, skipped).
- Produces: table `postcode_centroids(postcode text pk, lat double precision, lng double precision)`; columns `printers.postcode`, `toy_transactions.requester_postcode` (both `^\d{4}$` or null); `postcode_km(a text, b text) returns int` (haversine between centroids, whole km, null when either is unknown); `postcode_kms(origin text, postcodes text[]) returns table(postcode text, km int)` — one call for a whole list. Task 14 calls `postcode_kms`.

- [ ] **Step 1: Write the failing tests**

`packages/api/tests/unit/postcode-centroids.test.ts`:

```ts
// The two pure halves of scripts/postcode-centroids.mjs: a polygon's centroid
// (ESRI rings: outer clockwise, holes counter-clockwise, points [lng, lat]),
// and the INSERT 099 ends with.
import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const { centroid, toSql } = (await import(path.join(root, 'scripts/postcode-centroids.mjs'))) as {
  centroid: (rings: number[][][]) => [number, number] | null
  toSql: (csv: string) => string
}

describe('centroid', () => {
  it('finds the middle of a square, as [lat, lng]', () => {
    expect(centroid([[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]])).toEqual([0.5, 0.5])
  })
  it('lets a hole pull the centre away from it', () => {
    const outer = [[0, 0], [0, 4], [4, 4], [4, 0], [0, 0]]
    const hole = [[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]
    const [lat, lng] = centroid([outer, hole])!
    expect(lat).toBeCloseTo(28 / 12, 6)
    expect(lng).toBeCloseTo(28 / 12, 6)
  })
  it('is null for a ring with no area', () => {
    expect(centroid([[[0, 0], [1, 1], [0, 0]]])).toBeNull()
  })
})

describe('toSql', () => {
  it('writes an idempotent insert', () => {
    const sql = toSql('postcode,lat,lng\n2000,-33.8684,151.2082\n2042,-33.8989,151.1775\n')
    expect(sql).toContain("('2000', -33.8684, 151.2082)")
    expect(sql).toContain('on conflict (postcode) do update set lat = excluded.lat, lng = excluded.lng;')
  })
  it('refuses a row that is not a postcode and two numbers', () => {
    expect(() => toSql("postcode,lat,lng\n20x0,-33,151\n")).toThrow()
    expect(() => toSql("postcode,lat,lng\n2000,-33,'); drop table x; --\n")).toThrow()
  })
})
```

`packages/api/tests/integration/postcodes.test.ts`:

```ts
/** 099. ABS postcode centres, and distance in whole km between two postcodes. */
import { describe, it, expect } from 'vitest'
import { adminClient } from '../helpers/auth.js'

describe('099 postcodes and distance', () => {
  it('loaded every ABS postal area', async () => {
    const { count } = await adminClient().from('postcode_centroids').select('postcode', { count: 'exact', head: true })
    expect(count).toBeGreaterThan(2500)
  })
  it('measures Sydney to Melbourne in whole km', async () => {
    const { data } = await adminClient().rpc('postcode_km', { a: '2000', b: '3000' })
    expect(data).toBeGreaterThan(705)
    expect(data).toBeLessThan(720)
  })
  it('is null when either end is unknown', async () => {
    const { data } = await adminClient().rpc('postcode_km', { a: '2000', b: '0000' })
    expect(data).toBeNull()
  })
  it('answers a list in one call', async () => {
    const { data } = await adminClient().rpc('postcode_kms', { origin: '2000', postcodes: ['2042', '0000'] })
    const byPostcode = Object.fromEntries((data as Array<{ postcode: string; km: number | null }>).map((r) => [r.postcode, r.km]))
    expect(byPostcode['2042']).toBeGreaterThanOrEqual(2)
    expect(byPostcode['2042']).toBeLessThanOrEqual(6)
    expect(byPostcode['0000']).toBeNull()
  })
  it('has the two postcode columns', async () => {
    expect((await adminClient().from('printers').select('postcode').limit(1)).error).toBeNull()
    expect((await adminClient().from('toy_transactions').select('requester_postcode').limit(1)).error).toBeNull()
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/api exec vitest run tests/unit/postcode-centroids.test.ts` → FAIL (script missing).
Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/postcodes.test.ts` → FAIL (relation `postcode_centroids` does not exist).

- [ ] **Step 3: Write the script**

`scripts/postcode-centroids.mjs`:

```js
#!/usr/bin/env node
// Postcode centre points for distance (migration 099), from the ABS's own
// boundaries.
//
// Source: Australian Bureau of Statistics, ASGS Edition 3, Postal Areas (POA)
// 2021, served at geo.abs.gov.au. © Commonwealth of Australia, CC BY 4.0 —
// credited on /about. The ABS publishes polygons, not points, so each postal
// area's centre is its area-weighted centroid: the shoelace sum over every
// ring, where ESRI's clockwise outer rings and counter-clockwise holes carry
// opposite signs, so a hole pulls the centre away from itself.
//
//   node scripts/postcode-centroids.mjs > supabase/data/abs-poa-2021-centroids.csv
//   node scripts/postcode-centroids.mjs --sql supabase/data/abs-poa-2021-centroids.csv
//
// The second form prints the INSERT that 099 ends with. Hosted Supabase cannot
// COPY from a file, so the data travels inside the migration.
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const SERVICE = 'https://geo.abs.gov.au/arcgis/rest/services/ASGS2021/POA/MapServer/0/query'

/** [lat, lng] of a polygon given as ESRI rings of [lng, lat] points, or null when it has no area. */
export function centroid(rings) {
  let a = 0
  let cx = 0
  let cy = 0
  for (const ring of rings) {
    for (let i = 0; i + 1 < ring.length; i++) {
      const [x0, y0] = ring[i]
      const [x1, y1] = ring[i + 1]
      const c = x0 * y1 - x1 * y0
      a += c
      cx += (x0 + x1) * c
      cy += (y0 + y1) * c
    }
  }
  return a === 0 ? null : [cy / (3 * a), cx / (3 * a)]
}

/** The idempotent INSERT for `postcode,lat,lng` CSV text, 500 rows a statement. */
export function toSql(csv) {
  const rows = csv.trim().split('\n').slice(1).map((line) => line.split(','))
  for (const [postcode, lat, lng] of rows) {
    if (!/^\d{4}$/.test(postcode) || !/^-?\d+(\.\d+)?$/.test(lat) || !/^-?\d+(\.\d+)?$/.test(lng)) {
      throw new Error(`Not a postcode and two numbers: ${[postcode, lat, lng].join(',')}`)
    }
  }
  const statements = []
  for (let i = 0; i < rows.length; i += 500) {
    const values = rows
      .slice(i, i + 500)
      .map(([postcode, lat, lng]) => `  ('${postcode}', ${lat}, ${lng})`)
      .join(',\n')
    statements.push(
      `insert into public.postcode_centroids (postcode, lat, lng) values\n${values}\n` +
        'on conflict (postcode) do update set lat = excluded.lat, lng = excluded.lng;'
    )
  }
  return `${statements.join('\n\n')}\n`
}

async function fetchCsv() {
  const rows = []
  for (let offset = 0; ; ) {
    const query = new URLSearchParams({
      where: '1=1',
      outFields: 'poa_code_2021',
      returnGeometry: 'true',
      outSR: '4326',
      // ~100 m generalisation: a centroid moves by metres, the download by megabytes.
      maxAllowableOffset: '0.001',
      geometryPrecision: '5',
      orderByFields: 'poa_code_2021',
      resultOffset: String(offset),
      resultRecordCount: '500',
      f: 'json',
    })
    const res = await fetch(`${SERVICE}?${query}`)
    if (!res.ok) throw new Error(`The ABS service answered ${res.status}`)
    const body = await res.json()
    if (body.error) throw new Error(`The ABS service answered ${JSON.stringify(body.error)}`)
    if (!body.features?.length) break
    for (const f of body.features) {
      const code = f.attributes.poa_code_2021
      const c = /^\d{4}$/.test(code) && f.geometry ? centroid(f.geometry.rings) : null
      if (c) rows.push(`${code},${c[0].toFixed(4)},${c[1].toFixed(4)}`)
    }
    offset += body.features.length
  }
  if (rows.length < 2500) throw new Error(`Only ${rows.length} postal areas came back; expected about 2,640.`)
  return `${['postcode,lat,lng', ...rows].join('\n')}\n`
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const at = process.argv.indexOf('--sql')
  process.stdout.write(at === -1 ? await fetchCsv() : toSql(readFileSync(process.argv[at + 1], 'utf8')))
}
```

Run: `pnpm --filter @splat-connect/api exec vitest run tests/unit/postcode-centroids.test.ts` → PASS (5 tests).

- [ ] **Step 4: Fetch the data — or stop**

Run: `mkdir -p supabase/data && node scripts/postcode-centroids.mjs > supabase/data/abs-poa-2021-centroids.csv`
Expected: exit 0 in under a minute; `wc -l supabase/data/abs-poa-2021-centroids.csv` → `2642` (header + 2,641); `grep -E '^(2000|3000),' supabase/data/abs-poa-2021-centroids.csv` → `2000,-33.8684,151.2082` and `3000,-37.8132,144.9624` (±0.001).

**If the fetch fails, or returns fewer than 2,500 rows, or those two lines are far off: STOP and report BLOCKED with the error.** Do not write coordinates by hand, take them from another source, or carry on to Tasks 14–16 without this file. (The ABS also publishes the same boundaries as a download — `https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs-edition-3/jul2021-jun2026/access-and-downloads/digital-boundary-files` — if the service moves; adapting the script to it is a decision to bring back, not to make here.)

- [ ] **Step 5: Write the migration**

`supabase/migrations/099_postcodes_and_distance.sql` — the hand-written part:

```sql
-- 099 — Near you: distance in whole kilometres between postcodes.
--
-- Decided 2026-09-30: postcode centre points (ABS data, CC BY) with a SQL
-- distance in rounded km; postcode on printers and build requests; sort and
-- filter in the four list APIs. No address or point is stored about anyone —
-- a postcode is already on every pickup address, and the points are the ABS's
-- public centres of whole postal areas.
--
--   postcode_centroids         ABS ASGS Edition 3 Postal Areas 2021, one
--                              area-weighted centroid each (scripts/
--                              postcode-centroids.mjs; the CSV it wrote is
--                              supabase/data/abs-poa-2021-centroids.csv). ©
--                              Commonwealth of Australia, CC BY 4.0, credited
--                              on /about. Loaded by the INSERT at the end of
--                              this file: hosted Supabase cannot COPY a file.
--   printers.postcode          the machine's postcode, beside its suburb.
--   toy_transactions.requester_postcode
--                              a build request's, copied from the family's
--                              profile when they ask (POST /build). The board
--                              shows makers the km, never the postcode.
--   postcode_km(a, b)          haversine between the two centres, whole km;
--                              null when either is not in the table.
--   postcode_kms(origin, [])   the same for a list, in one call.
--
-- Toys and organisations use the existing pickup_postcode of their owner or
-- organisation (025/033); a viewer uses their profile's.
--
-- DOWN:
--   drop function if exists public.postcode_kms(text, text[]);
--   drop function if exists public.postcode_km(text, text);
--   alter table public.toy_transactions drop column if exists requester_postcode;
--   alter table public.printers drop column if exists postcode;
--   drop table if exists public.postcode_centroids;

create table public.postcode_centroids (
  postcode text primary key check (postcode ~ '^\d{4}$'),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180)
);

alter table public.postcode_centroids enable row level security;

-- Public data (ABS), so anyone may read it; nobody but a migration writes it.
create policy "Anyone can read postcode centres"
  on public.postcode_centroids for select to anon, authenticated
  using (true);

alter table public.printers
  add column postcode text check (postcode is null or postcode ~ '^\d{4}$');

alter table public.toy_transactions
  add column requester_postcode text check (requester_postcode is null or requester_postcode ~ '^\d{4}$');

create function public.postcode_km(a text, b text)
returns int
language sql
stable
set search_path = ''
as $$
  select round(6371 * 2 * asin(least(1, sqrt(
    power(sin(radians(q.lat - p.lat) / 2), 2)
    + cos(radians(p.lat)) * cos(radians(q.lat)) * power(sin(radians(q.lng - p.lng) / 2), 2)
  ))))::int
  from public.postcode_centroids p, public.postcode_centroids q
  where p.postcode = a and q.postcode = b
$$;

create function public.postcode_kms(origin text, postcodes text[])
returns table (postcode text, km int)
language sql
stable
set search_path = ''
as $$
  select x, public.postcode_km(origin, x) from unnest(postcodes) as x
$$;

-- Generated: node scripts/postcode-centroids.mjs --sql supabase/data/abs-poa-2021-centroids.csv
```

Then append the generated data:

Run: `node scripts/postcode-centroids.mjs --sql supabase/data/abs-poa-2021-centroids.csv >> supabase/migrations/099_postcodes_and_distance.sql`
Expected: the file ends with six `insert into public.postcode_centroids … on conflict …;` statements; `grep -c "^  ('" supabase/migrations/099_postcodes_and_distance.sql` → `2641`.

- [ ] **Step 6: Apply and run**

Run: `supabase migration up` → applies `099_postcodes_and_distance.sql`.
Run both commands from Step 2. Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/postcode-centroids.mjs supabase/data/abs-poa-2021-centroids.csv supabase/migrations/099_postcodes_and_distance.sql packages/api/tests/unit/postcode-centroids.test.ts packages/api/tests/integration/postcodes.test.ts
git commit -m "feat(db): ABS postcode centres and a whole-km distance between postcodes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 14: Distance in the four list APIs (`locations-and-distance`, part 2 of 3)

**Files:**
- Create: `packages/api/src/distance.ts`
- Modify: `packages/api/src/routes/printers.ts` (`GET /` near/within; `postcode` in `SELECT`, `Row`, `invalid`, POST, PATCH; delete the `PENDING(locations-and-distance)` line)
- Modify: `packages/api/src/routes/toy-transactions.ts` (`GET /open-builds` near/within; `POST /build` copies the family's postcode)
- Modify: `packages/api/src/routes/public.ts` (`GET /toys`, `GET /organizations` near/within; `pickupPostcodes` helper)
- Modify: `packages/types/src/index.ts` (`Printer.postcode?`, `PrinterWithOwner.km?`)
- Test: `packages/api/tests/unit/distance.test.ts` (new), `packages/api/tests/integration/public/near.test.ts` (new)

**Interfaces:**
- Consumes: Task 13's `postcode_kms`, `printers.postcode`, `toy_transactions.requester_postcode`; `chunk` (`packages/api/src/chunk.ts`).
- Produces: `readNear(query: (key: string) => string | undefined): { near: string | null; within: number | null } | string` (a string is the 400's sentence); `byDistance<T>(rows: T[], postcodeOf: (r: T) => string | null | undefined, near): Promise<Array<T & { km: number | null }>>`. `GET /api/printers`, `/api/toy-transactions/open-builds`, `/api/public/toys`, `/api/public/organizations` take `near=<4 digits>` and `within=<1–5000>`, return `km` on every row (null without `near`), sort nearest first when `near` is set, and never return an owner's, organisation's or family's postcode. `POST/PATCH /api/printers` take `postcode` (four digits, or empty for none).

- [ ] **Step 1: Write the failing tests**

`packages/api/tests/unit/distance.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { readNear, byDistance } from '../../src/distance.js'

const q = (o: Record<string, string>) => (key: string) => o[key]

describe('readNear', () => {
  it('reads a postcode and a radius', () => {
    expect(readNear(q({ near: '2042', within: '10' }))).toEqual({ near: '2042', within: 10 })
    expect(readNear(q({}))).toEqual({ near: null, within: null })
  })
  it('refuses a postcode that is not four digits', () => {
    expect(readNear(q({ near: '20420' }))).toBe('near is a four-digit postcode.')
    expect(readNear(q({ near: 'NSW' }))).toBe('near is a four-digit postcode.')
  })
  it('refuses a radius that is not whole km from 1 to 5000', () => {
    for (const within of ['0', '2.5', '5001', 'ten']) {
      expect(readNear(q({ near: '2042', within }))).toBe('within is whole kilometres, 1 to 5000.')
    }
  })
})

describe('byDistance without near', () => {
  it('keeps the order and says nothing about distance', async () => {
    expect(await byDistance([{ id: 1 }, { id: 2 }], () => '2000', { near: null, within: null })).toEqual([
      { id: 1, km: null },
      { id: 2, km: null },
    ])
  })
})
```

`packages/api/tests/integration/public/near.test.ts`:

```ts
/**
 * near=<postcode> and within=<km> on the four lists (099): km on every row,
 * nearest first, unknown last, and nobody's postcode in the answer.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg } from '../../helpers/orgs.js'

let viewer: TestUser
let near: TestUser
let far: TestUser
let family: TestUser
let tutorialId: string
let orgId: string
const printerIds: Record<string, string> = {}
let toyId: string

const authed = (u: TestUser) => ({ headers: { Authorization: `Bearer ${u.token}` } })

beforeAll(async () => {
  ;[viewer, near, far, family] = await Promise.all([1, 2, 3, 4].map(() => createTestUser('contributor')))
  const admin = adminClient()
  await admin.from('profiles').update({ pickup_postcode: '2042' }).eq('id', near.id)
  await admin.from('profiles').update({ pickup_postcode: '2042' }).eq('id', family.id)
  const machine = async (owner: TestUser, postcode: string | null) =>
    (
      await admin
        .from('printers')
        .insert({ owner_id: owner.id, name: 'Near test', materials: ['PLA'], bed_x: 200, bed_y: 200, bed_z: 200, postcode })
        .select('id')
        .single()
    ).data!.id as string
  printerIds.near = await machine(near, '2042')
  printerIds.far = await machine(far, '3000')
  printerIds.none = await machine(far, null)
  const { data: toy } = await admin
    .from('toys')
    .insert({ name: 'Near toy', condition: 8, owner_id: near.id, quantity: 1, offer_type: 'donation', status: 'published', photo_urls: ['https://example.com/near.jpg'] })
    .select('id')
    .single()
  toyId = toy!.id
  orgId = await createOrg({ createdBy: far.id })
  await admin.from('organizations').update({ pickup_postcode: '3000' }).eq('id', orgId)
  const { data: t } = await admin
    .from('tutorials')
    .insert({ title: 'Near build', description: 'x', difficulty: 'easy', status: 'approved' })
    .select('id')
    .single()
  tutorialId = t!.id
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('toy_transactions').delete().eq('tutorial_id', tutorialId)
  await admin.from('printers').delete().in('id', Object.values(printerIds))
  await admin.from('toys').delete().eq('id', toyId)
  await admin.from('tutorials').delete().eq('id', tutorialId)
  await admin.from('organizations').delete().eq('id', orgId)
  await Promise.all([viewer, near, far, family].map((u) => deleteTestUser(u.id)))
})

describe('printers near a postcode', () => {
  it('puts the nearest first, the unknown last, with km on each', async () => {
    const rows = (await (await app.request('/api/printers?near=2000', authed(viewer))).json()) as Array<{ id: string; km: number | null }>
    const mine = rows.filter((r) => Object.values(printerIds).includes(r.id))
    expect(mine.map((r) => r.id)).toEqual([printerIds.near, printerIds.far, printerIds.none])
    expect(mine[0].km).toBeLessThanOrEqual(6)
    expect(mine[2].km).toBeNull()
  })
  it('drops everything beyond the radius, and anything with no distance', async () => {
    const rows = (await (await app.request('/api/printers?near=2000&within=10', authed(viewer))).json()) as Array<{ id: string }>
    const ids = rows.map((r) => r.id)
    expect(ids).toContain(printerIds.near)
    expect(ids).not.toContain(printerIds.far)
    expect(ids).not.toContain(printerIds.none)
  })
  it('refuses a near that is not a postcode', async () => {
    expect((await app.request('/api/printers?near=Newtown', authed(viewer))).status).toBe(400)
  })
  it('saves a printer’s postcode, and refuses one that is not four digits', async () => {
    const patch = (postcode: string) =>
      app.request(`/api/printers/${printerIds.near}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${near.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ postcode }),
      })
    expect((await patch('20 42')).status).toBe(400)
    expect((await patch('2042')).status).toBe(200)
  })
})

describe('the public lists', () => {
  it('gives a toy its owner’s distance, never their postcode', async () => {
    const rows = (await (await app.request('/api/public/toys?near=2000&within=10')).json()) as Array<Record<string, unknown>>
    const row = rows.find((r) => r.id === toyId)!
    expect(row.km).toBeLessThanOrEqual(6)
    expect(JSON.stringify(row)).not.toContain('2042')
  })
  it('gives an organisation its distance', async () => {
    const rows = (await (await app.request('/api/public/organizations?near=2000')).json()) as Array<{ id: string; km: number | null }>
    expect(rows.find((r) => r.id === orgId)!.km).toBeGreaterThan(700)
  })
})

describe('Makers wanted', () => {
  it('copies the family’s postcode onto the request, and shows the maker only the km', async () => {
    const res = await app.request('/api/toy-transactions/build', {
      method: 'POST',
      headers: { Authorization: `Bearer ${family.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tutorial_id: tutorialId, build_brief: 'Please.', requester_suburb: 'Newtown', travel_km: 10 }),
    })
    expect(res.status).toBe(201)
    const rows = (await (await app.request('/api/toy-transactions/open-builds?near=2000', authed(viewer))).json()) as Array<Record<string, unknown>>
    const row = rows.find((r) => r.tutorial_id === tutorialId)!
    expect(row.km).toBeLessThanOrEqual(6)
    expect(row).not.toHaveProperty('requester_postcode')
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/api exec vitest run tests/unit/distance.test.ts` → FAIL (module missing).
Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/public/near.test.ts` → FAIL.

- [ ] **Step 3: Implement**

`packages/api/src/distance.ts`:

```ts
/**
 * Distance for the four list APIs (099): `near=<postcode>` and `within=<km>`
 * on the query string, `km` on every row, nearest first when `near` is set.
 *
 * A row says which postcode it is at; postcode_kms (SQL: haversine between ABS
 * centroids, whole km) answers for all of them in one call. A row whose
 * postcode is missing or not an ABS postal area gets km: null, sorts last, and
 * is dropped only when `within` asks for a radius.
 */
import { createAdminClient } from './supabase/client.js'

export type Near = { near: string | null; within: number | null }

/** `near` and `within` from the query string, or the sentence the 400 carries. */
export function readNear(query: (key: string) => string | undefined): Near | string {
  const near = query('near')?.trim() || null
  if (near !== null && !/^\d{4}$/.test(near)) return 'near is a four-digit postcode.'
  const raw = query('within')
  if (raw === undefined || raw === '') return { near, within: null }
  const within = Number(raw)
  if (!Number.isInteger(within) || within < 1 || within > 5000) return 'within is whole kilometres, 1 to 5000.'
  return { near, within }
}

export async function byDistance<T extends object>(
  rows: T[],
  postcodeOf: (row: T) => string | null | undefined,
  { near, within }: Near
): Promise<Array<T & { km: number | null }>> {
  if (!near) return rows.map((r) => ({ ...r, km: null }))
  const postcodes = [...new Set(rows.map(postcodeOf).filter((p): p is string => !!p))]
  const km = new Map<string, number>()
  if (postcodes.length) {
    const { data, error } = await createAdminClient().rpc('postcode_kms', { origin: near, postcodes })
    if (error) throw new Error(error.message)
    for (const r of (data ?? []) as Array<{ postcode: string; km: number | null }>) {
      if (r.km !== null) km.set(r.postcode, r.km)
    }
  }
  const unknown = Number.MAX_SAFE_INTEGER
  return rows
    .map((r) => ({ ...r, km: km.get(postcodeOf(r) ?? '') ?? null }))
    .filter((r) => within === null || (r.km !== null && r.km <= within))
    .sort((a, b) => (a.km ?? unknown) - (b.km ?? unknown))
}
```

`printers.ts`:
- Import `readNear, byDistance` from `../distance.js`; `SELECT` gains `, postcode` (after `state`); `Row` gains `postcode: string | null`.
- Delete `// PENDING(locations-and-distance): distance from the asker needs a stored location, not a suburb.`
- `invalid()`, before `return null`:

```ts
  // 099. Four digits or nothing; a postcode is what distance is measured from.
  if (has('postcode') && body.postcode !== null && body.postcode !== '') {
    if (typeof body.postcode !== 'string' || !/^\d{4}$/.test(body.postcode.trim())) {
      return 'Postcode is four digits.'
    }
  }
```

- `GET /` — first lines of the handler:

```ts
  const near = readNear((key) => c.req.query(key))
  if (typeof near === 'string') return c.json({ error: near }, 400)
```

  and its `return c.json(rows.map(…))` becomes `return c.json(await byDistance(rows.map(…), (r) => r.postcode, near))` (same mapping inside). Update its doc comment: "Every machine, newest first — or nearest first with `near` (099) — with its owner's name and how full it is."
- POST insert gains `postcode: typeof body.postcode === 'string' ? body.postcode.trim() || null : null,`; PATCH's trimmed-string list becomes `['suburb', 'state', 'notes', 'rate_note', 'postcode']`.

`toy-transactions.ts`:
- Import `readNear, byDistance` from `../distance.js`.
- `GET /open-builds`: parse `near` first (400 on a string, as above); add `requester_postcode` to the select; replace the final `return c.json(rows.map(…))` with:

```ts
  // Nearest first with `near` (099). The postcode decides the km and is then
  // dropped: the card says "Family in Newtown", and that stays the whole of it.
  const ranked = await byDistance(rows, (r) => r.requester_postcode as string | null, near)
  return c.json(
    ranked.map((r) => {
      const { requester_id, requester_postcode: _postcode, ...rest } = r as Record<string, unknown>
      return {
        ...rest,
        tutorial: guide.get(r.tutorial_id as string) ?? null,
        mine: requester_id === userId,
      }
    })
  )
```

- `POST /build`, before the insert:

```ts
  // 099. The family's postcode, from their profile, so the board can tell a
  // maker how far away they are. Never returned — only the km is.
  const { data: me } = await admin.from('profiles').select('pickup_postcode').eq('id', userId).maybeSingle()
  const requesterPostcode = /^\d{4}$/.test(me?.pickup_postcode ?? '') ? (me!.pickup_postcode as string) : null
```

  and the insert gains `requester_postcode: requesterPostcode,`.

`public.ts`:
- Import `readNear, byDistance` from `../distance.js`.
- Helper, above `GET /toys`:

```ts
/**
 * pickup_postcode of these profiles and organisations, by id (099). Admin
 * client: neither column is public, and only a km built from it leaves here.
 */
async function pickupPostcodes(people: string[], orgs: string[]): Promise<Map<string, string | null>> {
  const admin = createAdminClient()
  const reads = [
    ...chunk([...new Set(people)]).map((ids) => admin.from('profiles').select('id, pickup_postcode').in('id', ids)),
    ...chunk([...new Set(orgs)]).map((ids) => admin.from('organizations').select('id, pickup_postcode').in('id', ids)),
  ]
  const results = await Promise.all(reads)
  return new Map(
    results.flatMap((r) => (r.data ?? []) as Array<{ id: string; pickup_postcode: string | null }>).map((x) => [x.id, x.pickup_postcode])
  )
}
```

- `GET /toys`: parse `near` first (400 on a string); replace `return c.json((data ?? []).filter((t) => !hidden.has(t.id)))` with:

```ts
  const shown = (data ?? []).filter((t) => !hidden.has(t.id))
  // Postcodes are read only when somebody asked for distance.
  const postcodes = near.near
    ? await pickupPostcodes(
        shown.map((t) => t.owner_id).filter((id): id is string => !!id),
        shown.map((t) => t.owner_org_id).filter((id): id is string => !!id)
      )
    : new Map<string, string | null>()
  return c.json(await byDistance(shown, (t) => postcodes.get(t.owner_org_id ?? t.owner_id) ?? null, near))
```

- `GET /organizations`: parse `near` first; replace `return c.json(data ?? [])` with:

```ts
  const orgs = data ?? []
  const postcodes = near.near ? await pickupPostcodes([], orgs.map((o) => o.id)) : new Map<string, string | null>()
  return c.json(await byDistance(orgs, (o) => postcodes.get(o.id) ?? null, near))
```

`index.ts`: `Printer` gains `/** 099. Four digits; distance is measured from it. Optional: fixtures predate it. */ postcode?: string | null`; `PrinterWithOwner` gains `/** 099. Whole km from the viewer's postcode; null when either is unknown or none was asked for. */ km?: number | null`.

- [ ] **Step 4: Run the tests to see them pass**

Run both commands from Step 2, plus `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/printers tests/integration/toy-transactions/open-builds.test.ts tests/integration/public` (the existing list tests must not notice). Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/api/src/distance.ts packages/api/src/routes/printers.ts packages/api/src/routes/toy-transactions.ts packages/api/src/routes/public.ts packages/api/tests/unit/distance.test.ts packages/api/tests/integration/public/near.test.ts packages/types/src/index.ts
git commit -m "feat(api): printers, toys, organisations and Makers wanted sort and filter by distance

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 15: Near you on the phone (`locations-and-distance`, part 3a)

**Files:**
- Modify: `packages/mobile/components/profile-screen.tsx` (a Postcode field)
- Modify: `packages/mobile/components/printing/find-screen.tsx` (Within 10 km, km on cards), `add-printer-screen.tsx` (sends the profile's postcode)
- Modify: `packages/mobile/components/builds/makers-wanted-screen.tsx` (real distance chips, km on rows, header comment)
- Modify: `packages/mobile/components/toys/toy-library-screen.tsx` (Nearest first, km on rows)
- Modify: `packages/mobile/lib/pending-icons.ts` (drop `'locations-and-distance'`)
- Test: `packages/mobile/tests/unit/components/profile-screen.test.tsx`, `printing/find-screen.test.tsx`, `printing/add-printer-screen.test.tsx`, `toys/toy-library-screen.test.tsx`, `builds/makers-wanted-screen.test.tsx` (new)

**Interfaces:**
- Consumes: Task 14's `near` / `within` and `km`; `caps.profile.pickup_postcode` (mobile `useCapabilities`); `PATCH /api/contributors/me` (already accepts `pickup_postcode`).
- Produces: nothing other tasks use. Every "Add your postcode" control pushes `/account` (the profile screen, `app/(my)/account/index.tsx`).

- [ ] **Step 1: Write the failing tests**

`profile-screen.test.tsx` (append):

```tsx
it('saves a postcode, for everything that measures distance', async () => {
  ;(useAuth as jest.Mock).mockReturnValue(auth({}))
  mockGet.mockResolvedValue([])
  mockPatch.mockResolvedValue({})
  render(<ProfileScreen />)
  fireEvent(screen.getByLabelText('Postcode'), 'endEditing', { nativeEvent: { text: '2042' } })
  await waitFor(() => expect(mockPatch).toHaveBeenCalledWith('/api/contributors/me', { pickup_postcode: '2042' }))
})
```

`find-screen.test.tsx` — make the capabilities mock mutable: replace it with

```tsx
const mockCaps: { profile: Record<string, unknown>; ledOrgs: unknown[] } = { profile: { id: 'me' }, ledOrgs: [] }
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: mockCaps }) }))
```

and add `delete mockCaps.profile.pickup_postcode` to `beforeEach`. Then append:

```tsx
it('asks for a postcode before it can say what is within 10 km', async () => {
  render(<FindPrinterScreen guideId="g1" />)
  fireEvent.press(await screen.findByText('Add your postcode'))
  expect(mockPush).toHaveBeenCalledWith('/account')
})

it('measures from the profile postcode and keeps what is within 10 km', async () => {
  mockCaps.profile.pickup_postcode = '2000'
  mockGet.mockImplementation((path: string) =>
    Promise.resolve(
      path === '/api/printers?near=2000' ? [printer('a', { km: 4 }), printer('b', { km: 40 })] : GUIDE
    )
  )
  render(<FindPrinterScreen guideId="g1" />)
  expect(await screen.findByText(/· 4 km/)).toBeTruthy()
  fireEvent.press(screen.getByText('Within 10 km'))
  expect(screen.queryByText('Maker B')).toBeNull()
  expect(screen.getByText('Maker A')).toBeTruthy()
})
```

`add-printer-screen.test.tsx` — the capabilities mock's profile gains `pickup_postcode: '2042'`; in "sends the standard rates with the printer" add `postcode: '2042'` to the `objectContaining`.

`toy-library-screen.test.tsx` — replace its capabilities mock with a mutable `mockCaps` (`let`-free: `const mockCaps = { current: null as null | { profile: Record<string, unknown> } }` and `useCapabilities: () => ({ caps: mockCaps.current, loading: false, refresh: jest.fn() })`, reset to `null` in `beforeEach`), and append:

```tsx
  it('asks for a postcode before it can sort nearest first', async () => {
    render(<ToyLibraryScreen />)
    fireEvent.press(await screen.findByText('Add your postcode'))
    expect(mockPush).toHaveBeenCalledWith('/account')
  })

  it('sorts nearest first from the profile postcode, with km on each toy', async () => {
    mockCaps.current = { profile: { id: 'me', pickup_postcode: '2000' } }
    mockGet.mockImplementation((path: string) =>
      Promise.resolve(path === '/api/public/toys?near=2000' ? [toy({ id: 't1', name: 'Bubble machine', km: 3 })] : [])
    )
    render(<ToyLibraryScreen />)
    fireEvent.press(await screen.findByText('Nearest first'))
    expect(await screen.findByText('3 km')).toBeTruthy()
    expect(mockGet).toHaveBeenCalledWith('/api/public/toys?near=2000')
  })
```

  (use the file's own router mock name in place of `mockPush` if it differs.)

`packages/mobile/tests/unit/components/builds/makers-wanted-screen.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react-native'
import { MakersWantedScreen } from '../../../../components/builds/makers-wanted-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a), post: jest.fn() } }))
const mockPush = jest.fn()
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react')
  return {
    Stack: { Screen: () => null },
    useLocalSearchParams: () => ({}),
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (effect: () => void) => useEffect(effect, []),
  }
})
const mockCaps = { current: null as null | { profile: Record<string, unknown> } }
jest.mock('../../../../lib/capabilities', () => ({ useCapabilities: () => ({ caps: mockCaps.current }) }))

const build = (id: string, km: number | null, suburb: string) => ({
  id, tutorial_id: 'g', build_brief: 'Please.', travel_km: 10, urgency: null, child_label: null, requester_suburb: suburb,
  family_has_toy: false, created_at: new Date().toISOString(), mine: false, km,
  tutorial: { id: 'g', title: 'Bubble machine', difficulty: 'easy', status: 'approved' },
})

beforeEach(() => {
  jest.clearAllMocks()
  mockCaps.current = null
})

it('asks for a postcode before it filters by distance', async () => {
  mockGet.mockResolvedValue([build('b1', null, 'Newtown')])
  render(<MakersWantedScreen />)
  fireEvent.press(await screen.findByText('Add your postcode'))
  expect(mockPush).toHaveBeenCalledWith('/account')
  expect(mockGet).toHaveBeenCalledWith('/api/toy-transactions/open-builds')
})

it('filters on the real distance from the maker, and says it on the row', async () => {
  mockCaps.current = { profile: { id: 'me', pickup_postcode: '2000' } }
  mockGet.mockResolvedValue([build('b1', 4, 'Newtown'), build('b2', 40, 'Penrith')])
  render(<MakersWantedScreen />)
  expect(await screen.findByText('4 km away')).toBeTruthy()
  expect(mockGet).toHaveBeenCalledWith('/api/toy-transactions/open-builds?near=2000')
  fireEvent.press(screen.getByText('10 km'))
  expect(screen.queryByText(/Penrith/)).toBeNull()
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/profile-screen.test.tsx tests/unit/components/printing tests/unit/components/toys/toy-library-screen.test.tsx tests/unit/components/builds` → FAIL.

- [ ] **Step 3: Implement**

`profile-screen.tsx` — beside `saveName`:

```tsx
  // 099. Distance on Find a printer, Makers wanted and the toy library is
  // measured from here. Four digits or nothing; anything else saves and simply
  // measures nothing.
  async function savePostcode(raw: string) {
    const postcode = raw.trim()
    if (postcode === (profile?.pickup_postcode ?? '')) return
    try {
      await apiClient.patch('/api/contributors/me', { pickup_postcode: postcode || null })
    } catch (err) {
      console.error('[ProfileScreen] postcode save failed:', err)
    }
  }
```

  and after the Display name `TextField`'s status `<Text>`:

```tsx
              <TextField
                label="Postcode"
                accessibilityLabel="Postcode"
                inputMode="numeric"
                maxLength={4}
                defaultValue={profile?.pickup_postcode ?? ''}
                onEndEditing={(e) => void savePostcode(e.nativeEvent.text)}
              />
```

  (if the `profile` type from `useAuth` has no `pickup_postcode`, read it as `(profile as { pickup_postcode?: string | null } | null)?.pickup_postcode`.)

`find-screen.tsx`:
- `const postcode = caps?.profile.pickup_postcode ?? null` (before the effect); the effect fetches `apiClient.get<PrinterWithOwner[]>(postcode ? `/api/printers?near=${postcode}` : '/api/printers')` and its deps become `[guideId, postcode]`.
- State `const [within10, setWithin10] = useState(false)`; `shown` adds `&& (!within10 || (p.km != null && p.km <= 10))`; Clear filters also `setWithin10(false)`.
- Replace the `PENDING(locations-and-distance)` comment and chip with:

```tsx
          {postcode ? (
            <Chip label="Within 10 km" icon="location-outline" active={within10} onPress={() => setWithin10((v) => !v)} />
          ) : (
            <Chip label="Add your postcode" icon="location-outline" active={false} onPress={() => router.push('/account')} />
          )}
```

- The meta join gains the board's km after the kind ("{kindLabel} · {km} km · {stats}"):

```tsx
                      {[
                        p.owner_org_id ? 'Organisation' : 'Contributor',
                        p.km != null ? `${p.km} km` : null,
                        [p.suburb, p.state].filter(Boolean).join(' ') || null,
                        p.name,
                        statsLine(p.printer_stats),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
```
- Drop the `pendingHref` import if nothing else uses it.
- Header comment's remaining sentence about "Within 10 km" not being drawn: delete it.

`add-printer-screen.tsx` — the POST body gains `postcode: caps?.profile.pickup_postcode ?? '',` after `state`.

`makers-wanted-screen.tsx`:
- Import `useCapabilities` from `../../lib/capabilities`; `OpenBuild` gains `/** 099. Whole km from the maker's postcode; null when either is unknown. */ km: number | null`.
- `const postcode = useCapabilities().caps?.profile.pickup_postcode ?? null`; `load` fetches `postcode ? `/api/toy-transactions/open-builds?near=${postcode}` : '/api/toy-transactions/open-builds'` and its deps become `[postcode]`.
- `const shown = range === 0 ? inTab : inTab.filter((b) => b.km != null && b.km <= range)`
- Replace the `PENDING(locations-and-distance)` comment and the ranges row with:

```tsx
        {postcode ? (
          <View style={styles.ranges}>
            {/* The board's one word, so the chips fit on one row. */}
            <Text style={styles.rangeLabel}>Within</Text>
            {RANGES.map((km) => (
              <Chip key={km} label={km === 0 ? 'Anywhere' : `${km} km`} active={range === km} onPress={() => setRange(km)} />
            ))}
          </View>
        ) : (
          <View style={styles.ranges}>
            <Chip label="Add your postcode" icon="location-outline" active={false} onPress={() => router.push('/account')} />
          </View>
        )}
```

- In `BuildCard`'s facts, first: `{b.km !== null ? <Fact icon="navigate-outline" text={`${b.km} km away`} /> : null}` ("{km} km" on rows; "away" separates it from the family's own travel range, which is the next fact).
- Header comment: replace the "Distance from the maker…" bullet with "- Distance is measured from the maker's profile postcode to the family's (099); without one, the chips ask for it."

`toy-library-screen.tsx`:
- `const postcode = caps?.profile.pickup_postcode ?? null`; state `const [nearest, setNearest] = useState(false)`.
- The fetch path: `nearest && postcode ? `/api/public/toys?near=${postcode}` : '/api/public/toys'`; deps `[reloadKey, nearest, postcode]`. The list type: `useState<Array<ToyWithOwner & { km?: number | null }>>([])`.
- `const heading = filtered ? 'Matching toys' : newest ? 'Newest first' : nearest ? 'Nearest first' : 'All toys'` (the API already returns nearest first; Newest re-sorts on top of it). Delete the "The board says "Nearest first", but no toy carries a place yet" comment.
- Replace the `PENDING(locations-and-distance)` comment and chip with:

```tsx
              {postcode ? (
                <Chip variant="filter" icon="navigate-outline" label="Nearest first" active={nearest} onPress={() => setNearest((v) => !v)} />
              ) : (
                <Chip variant="filter" icon="navigate-outline" label="Add your postcode" active={false} onPress={() => router.push('/account')} />
              )}
```

- In `meta`, after the holder: `{item.km != null ? <MetaItem icon="navigate-outline">{`${item.km} km`}</MetaItem> : null}`.
- Drop the `pendingHref` import.

`pending-icons.ts` (mobile) — delete `'locations-and-distance': 'navigate-outline',`.

- [ ] **Step 4: Run the tests to see them pass**

Run the command from Step 2. Expected: PASS. Then `grep -rn "locations-and-distance" packages/mobile` → no output.

- [ ] **Step 5: Commit**

```bash
git add packages/mobile/components/profile-screen.tsx packages/mobile/components/printing/find-screen.tsx packages/mobile/components/printing/add-printer-screen.tsx packages/mobile/components/builds/makers-wanted-screen.tsx packages/mobile/components/toys/toy-library-screen.tsx packages/mobile/lib/pending-icons.ts packages/mobile/tests/unit/components/profile-screen.test.tsx packages/mobile/tests/unit/components/printing/find-screen.test.tsx packages/mobile/tests/unit/components/printing/add-printer-screen.test.tsx packages/mobile/tests/unit/components/toys/toy-library-screen.test.tsx packages/mobile/tests/unit/components/builds/makers-wanted-screen.test.tsx
git commit -m "feat(mobile): Within 10 km, Makers wanted by distance and Nearest first, from your postcode

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 16: Distance from you on the web, the ABS credit, and shipping (`locations-and-distance`, part 3b)

**Files:**
- Modify: `packages/web/app/printing/page.tsx` (fetch with `near`; `hasPostcode`), `packages/web/components/printer-directory.tsx` (the Distance from you facet; km on cards; header comment)
- Modify: `packages/web/components/printer-form.tsx` (Postcode field), `packages/web/app/dashboard/printers/new/page.tsx` (`defaultPostcode`)
- Modify: `packages/web/app/about/page.tsx` (the ABS credit)
- Modify: `scripts/parity/app-screen-map.json` (the `toy_library` rule naming `locations-and-distance`), `packages/types/src/pending.ts`, `docs/PENDING.md`
- Test: `packages/web/tests/unit/components/printer-directory.test.tsx`, `packages/web/tests/unit/components/printer-form.test.tsx` (new), `packages/web/tests/unit/app/about.test.tsx`

**Interfaces:**
- Consumes: Task 14's `km` on `/api/printers` rows; `caps.profile.pickup_postcode` (web `getCapabilities`).
- Produces: `PrinterDirectory` takes `hasPostcode?: boolean`; `PrinterForm` takes `defaultPostcode?: string`.

- [ ] **Step 1: Write the failing tests**

Append to `printer-directory.test.tsx`:

```tsx
  it('filters by the distance from you', () => {
    render(
      <PrinterDirectory
        printers={[{ ...base, id: 'n', owner_name: 'Near Nell', km: 3 }, { ...base, id: 'f', owner_name: 'Far Fred', km: 30 }]}
        gate={null}
        hasPostcode
      />
    )
    expect(screen.getByText(/3 km/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Within 5 km' }))
    expect(screen.queryByText('Far Fred')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Within 25 km' }))
    expect(screen.queryByText('Far Fred')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Anywhere' }))
    expect(screen.getByText('Far Fred')).toBeInTheDocument()
  })

  it('asks for a postcode when the profile has none', () => {
    render(<PrinterDirectory printers={printers} gate={null} />)
    expect(screen.getByRole('link', { name: 'Add your postcode' })).toHaveAttribute('href', '/dashboard/profile')
  })
```

`packages/web/tests/unit/components/printer-form.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { PrinterForm } from '@/components/printer-form'
import { browserApiClient } from '@/lib/browser-api-client'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }))
vi.mock('@/lib/browser-api-client', () => ({ browserApiClient: { post: vi.fn() } }))

describe('PrinterForm', () => {
  it('sends the postcode, starting from the profile’s', async () => {
    const post = vi.mocked(browserApiClient.post).mockResolvedValue({})
    const { container } = render(<PrinterForm ledOrgs={[]} defaultPostcode="2042" />)
    fireEvent.change(container.querySelector('input[name="name"]')!, { target: { value: 'Garage Bambu' } })
    for (const [axis, v] of [['Bed width', '256'], ['Bed depth', '256'], ['Bed height', '256']]) {
      fireEvent.change(screen.getByLabelText(axis), { target: { value: v } })
    }
    expect(screen.getByLabelText('Postcode')).toHaveValue('2042')
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(post).toHaveBeenCalledWith('/api/printers', expect.objectContaining({ postcode: '2042' })))
  })
})
```

`about.test.tsx` (append inside its `describe`, adapting the render call to the file's):

```tsx
  it('credits the ABS for the postcode centres', async () => {
    render(await AboutPage())
    expect(screen.getByRole('link', { name: 'CC BY 4.0' })).toHaveAttribute('href', 'https://creativecommons.org/licenses/by/4.0/')
    expect(screen.getByText(/Australian Bureau of Statistics/)).toBeInTheDocument()
  })
```

- [ ] **Step 2: Run them to see them fail**

Run: `pnpm --filter @splat-connect/web exec vitest run tests/unit/components/printer-directory.test.tsx tests/unit/components/printer-form.test.tsx tests/unit/app/about.test.tsx` → FAIL.

- [ ] **Step 3: Implement**

`printing/page.tsx`:

```tsx
  const postcode = caps?.profile.pickup_postcode ?? null
  const printers = caps
    ? await apiClient
        .get<PrinterWithOwner[]>(postcode ? `/api/printers?near=${encodeURIComponent(postcode)}` : '/api/printers')
        .catch(() => [] as PrinterWithOwner[])
    : []
```

and pass `hasPostcode={!!postcode}` to `<PrinterDirectory …>`.

`printer-directory.tsx`:
- Import `Car, GlobeHemisphereWest, PersonSimpleWalk` from Phosphor.
- `Filters` gains `dist?: 'd5' | 'd25' | 'anyd'`.
- `FACETS` gains, after `who` (the board's facet, word for word):

```tsx
  {
    key: 'dist',
    label: 'Distance from you',
    icon: MapPin,
    opts: [
      ['d5', 'Within 5 km', PersonSimpleWalk],
      ['d25', 'Within 25 km', Car],
      ['anyd', 'Anywhere', GlobeHemisphereWest],
    ],
  },
```

- `matches` gains:

```tsx
  // 099. A printer with no distance is "Anywhere" only.
  if (f.dist === 'd5' && !(p.km != null && p.km <= 5)) return false
  if (f.dist === 'd25' && !(p.km != null && p.km <= 25)) return false
```

- Props gain `hasPostcode = false` (`hasPostcode?: boolean`). In the facet loop, for `facet.key === 'dist' && !hasPostcode`, render instead of the option buttons:

```tsx
              <Link href="/dashboard/profile" className="chip gap-1.5">
                <MapPin size={14} weight="bold" className="text-brand-dark" aria-hidden="true" />
                Add your postcode
              </Link>
```

- `PrinterCard`'s `where` line: after the suburb, `{p.km != null && <> · {p.km} km</>}`.
- Header comment: "The board's rail has five facets. Three are here…" → "The board's rail has five facets. Four are here: whether it is taking jobs, which filaments it holds, who runs it, and the distance from you (099, from the profile postcode). "Verified only" is not — the web directory does not draw the badge yet."

`printer-form.tsx`:
- Props gain `defaultPostcode = ''` (`defaultPostcode?: string`).
- The suburb/state grid becomes `sm:grid-cols-[2fr_1fr_1fr]` with a third label:

```tsx
          <label className={LABEL}>
            Postcode
            <input name="postcode" className={INPUT} inputMode="numeric" maxLength={4} defaultValue={defaultPostcode} />
          </label>
```

- The POST body gains `postcode: String(form.get('postcode') ?? '').trim(),` after `state`.

`dashboard/printers/new/page.tsx` — pass `defaultPostcode={caps.profile.pickup_postcode ?? ''}`.

`about/page.tsx` — after the "In this section" grid, before the closing `</div>`:

```tsx
      {/* 099. Distance uses ABS postal-area centres; CC BY 4.0 asks for this line. */}
      <p className="mt-[46px] max-w-prose text-[13px] leading-[1.5] text-muted">
        Distances use postcode centre points derived from the Australian Bureau of Statistics’ Postal Areas (ASGS
        Edition 3, 2021), © Commonwealth of Australia, licensed under{' '}
        <a href="https://creativecommons.org/licenses/by/4.0/" className="underline">
          CC BY 4.0
        </a>
        .
      </p>
```

- [ ] **Step 4: Run the tests to see them pass**

Run the command from Step 2, then `pnpm typecheck`. Expected: PASS; typecheck clean.

- [ ] **Step 5: Ship the item** — `git grep -n "locations-and-distance" -- packages scripts` shows only `packages/types/src/pending.ts` and the `toy_library` rule; delete that `explained` rule in `scripts/parity/app-screen-map.json` (drop `explained` if it empties); `shipped: true,` on `'locations-and-distance'`; `node scripts/pending.mjs`; drift test → `Tests  11 passed (11)`.

- [ ] **Step 6: Commit**

```bash
git add packages/web/app/printing/page.tsx packages/web/components/printer-directory.tsx packages/web/components/printer-form.tsx packages/web/app/dashboard/printers/new/page.tsx packages/web/app/about/page.tsx packages/web/tests/unit/components/printer-directory.test.tsx packages/web/tests/unit/components/printer-form.test.tsx packages/web/tests/unit/app/about.test.tsx scripts/parity/app-screen-map.json packages/types/src/pending.ts docs/PENDING.md
git commit -m "feat(web): Distance from you on the printer directory; credit the ABS postcode data

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

---

### Task 17: Full verification and graph update

No new code. Every check the spec names, in an order where a failure points at one thing.

**Files:**
- Modify (generated only): `graphify-out/*`, `scripts/parity/parity-report.json`, `scripts/parity/app-parity-report.json`, `scripts/parity/mobile-report.json`

- [ ] **Step 1: Registry and drift**

Run: `node scripts/pending.mjs --check`
Expected: `docs/PENDING.md is up to date`
Run: `git grep -nE 'PENDING\((print-part-quantity|message-printer|add-printer-rates|print-cost-estimate|print-answer-by|print-fit-feedback|printer-stats|printer-verified|bed-fit-filter|customization-metrics|printing-parts|saved-parts|locations-and-distance)\)|pending="(print-part-quantity|message-printer|add-printer-rates|print-cost-estimate|print-answer-by|print-fit-feedback|printer-stats|printer-verified|bed-fit-filter|customization-metrics|printing-parts|saved-parts|locations-and-distance)"' -- . ':!docs/**' ':!packages/types/src/pending.ts'`
Expected: no output.
Run the drift test. Expected: `Tests  11 passed (11)`.

- [ ] **Step 2: Types and unit suites**

Run: `pnpm typecheck` → exit 0.
Run: `pnpm --filter @splat-connect/api test:unit` → all pass.
Run: `pnpm --filter @splat-connect/web test:unit` → all pass.
Run: `pnpm --filter @splat-connect/mobile test:unit` → all pass.

- [ ] **Step 3: API integration against a clean local database**

Run: `supabase db reset` (applies 001–099 from scratch — proves each migration runs on its own, including 099's 2,641-row insert), then `pnpm --filter @splat-connect/api test:integration`.
Expected: all pass, including `tests/integration/printers/*`, `tests/integration/public/{printable-parts,near}.test.ts` and `tests/integration/postcodes.test.ts`.

- [ ] **Step 4: Web e2e** (not at the same time as any mobile e2e)

Run: `lsof -i :3000 -i :3100` first — a days-old server on the e2e port makes Playwright test a stale build (memory: stale e2e server reuse); kill it if present. Then `pnpm --filter @splat-connect/web test:e2e`.
Expected: all pass, `tests/e2e/printing/answer-by.spec.ts` and `tests/e2e/public/printing-parts.spec.ts` among them.

- [ ] **Step 5: Parity re-run**

Run: `./scripts/parity/stack.sh up`, then from `packages/web`: `node ../../scripts/parity/run.js` and `node ../../scripts/parity/app.js --id print_find,print_request,print_job,print_add,print_offer,saved,toy_library,makers_wanted`.
Expected: web keeps its prior count with no new findings on `/printing`, `/printing/parts`, `/dashboard/saved/[type]` or `/admin/test-prints`; the app screens report no `pending` exemption errors. A new finding is a real divergence to fix or explain with `why: "intended"` and a reason — never `why: "pending"` naming a shipped id (the drift test refuses that). Then `node scripts/parity/mobile.js --id print_find,print_request,makers_wanted` for the 390px width check. (Use the ids `scripts/parity/app-screen-map.json` actually gives these screens if they differ.)

- [ ] **Step 6: Graph update**

Run: `graphify update .`
Expected: completes without error; `graphify-out/` updated.

- [ ] **Step 7: Commit the generated reports**

```bash
git add graphify-out scripts/parity/parity-report.json scripts/parity/app-parity-report.json scripts/parity/mobile-report.json
git commit -m "chore(printing): parity reports and graph after the printing batch

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV"
```

Hosted database: migrations 094–099 are **not** pushed by this plan. Pushing to the live "development" project is a separate step Byron approves (`supabase db push`, then `pnpm db:guards`, which now checks the 098 row). 099 carries 2,641 rows of ABS data; the push sends them in six statements.
