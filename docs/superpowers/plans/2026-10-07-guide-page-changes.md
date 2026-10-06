# Guide Page Changes (mobile) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the mobile guide page's What you'll need card, tabs, Feedback tab, Files tab and end-of-build flow, add a view-only 3D STL preview, and cover every new and touched piece with unit, integration and e2e tests.

**Architecture:** All UI lives in `packages/mobile` (Expo 57, expo-router, React Native). The guide page is `components/home/detail-screen.tsx`; build mode is `components/guides/build-mode.tsx`; notes are `components/guides/community-notes.tsx` plus `lib/guide-notes.ts`. New pieces: a `FeedbackSheet` (the one composer, opened from the Feedback tab and from build mode), a `lib/guide-focus.ts` hand-off store so build mode can land the guide page on a freshly posted note, a `lib/guide-files.ts` helper pair, and a `model` route whose WebView runs a generated three.js page. One API/DB change: reports gain the subject kind `note` (types constant + migration 132).

**Tech Stack:** TypeScript, React Native 0.81 / Expo SDK 57, expo-router, react-native-webview 13.16, three.js r128 (dev dependency, inlined at build time), Jest + @testing-library/react-native (mobile unit), Playwright on react-native-web (mobile e2e), Vitest (API unit + integration against local Supabase), Maestro (device), Supabase migrations.

**Spec:** `docs/superpowers/specs/2026-10-07-guide-page-changes-design.md`

## Global Constraints

- Agents: pass `model: "sonnet"` (or `haiku`) on every Agent call. Opus and Fable are banned (memory `no-opus-or-fable`).
- Commits: one commit per task, only at the plan's commit steps. Do not push.
- Copy: tab labels are exactly `Overview`, `Supplies`, `Files`, `Feedback`. Build-mode button is `Leave feedback`. PDF pill is `View`; PDF viewer footer is `Download on the web`; bottom bar for a step-less guide is `View full guide`. Composer bar placeholder is `Share a fix or a tip…`.
- No download, share or open-in-browser control for the PDF or STLs anywhere in the app.
- Text sizes come only from `theme.type.*`; colours only from `theme.colors.*` (`tests/unit/lib/type-scale.test.ts` and the dark-mode guard test fail otherwise).
- E2E specs import only from `tests/e2e/*` and `lib/`, never from `components/` (memory `e2e-specs-import-no-components`).
- Never run web and mobile e2e suites at the same time. Run mobile e2e from `packages/mobile` with `node_modules/.bin/playwright test`.
- Step bodies, tips and safety notes (author content) are never rewritten.
- Mobile unit tests run from `packages/mobile`: `pnpm test:unit -- <path>`. API unit: `pnpm --filter api test:unit`. API integration needs local Supabase up (`supabase start` from repo root, then `pnpm --filter api test:integration`).
- Migrations: next number is `132`. Apply locally with `supabase migration up` from repo root.

## Review Focus

1. A guide with no steps: the Feedback composer's step chips are empty except Missing step, so Post must still enable; the bottom bar reads View full guide and opens the PDF viewer. Test pinned in Task 5 and Task 9.
2. A note whose `step_position` exceeds the step count (a pinned Missing step given a position past the end): the filter chips must not render a `Step 9` chip for a 4-step guide; it files under Missing. Test pinned in Task 6.
3. Posting from build mode when the API answers 401 (session expired): the sheet stays open and shows the message, nothing navigates, `setGuideFocus` is never called. Test pinned in Task 5 and Task 8.
4. Signing the STL path fails (object missing or offline): the model screen shows the error state with Retry, never a blank WebView or a crash from `injectJavaScript` on an unmounted ref. Test pinned in Task 10.
5. `EXPO_PUBLIC_WEB_URL` unset in a build: the web links must not open `undefined/tutorials/…`; `webGuideUrl` returns null and the footer/link is hidden. Test pinned in Task 9 (lib) and Task 9 (Files tab).

---

### Task 1: Report subject kind `note` (types, migration 132, API, mobile reasons)

**Files:**
- Modify: `packages/types/src/index.ts:2527`
- Create: `supabase/migrations/132_report_note_kind.sql`
- Create: `packages/api/tests/unit/report-kinds-drift.test.ts`
- Modify: `packages/api/tests/integration/admin/report-kinds.test.ts`
- Modify: `packages/mobile/components/reports/report-problem.tsx:30-35`
- Create: `packages/mobile/tests/unit/components/reports/report-problem-note.test.tsx`

**Interfaces:**
- Produces: `REPORT_SUBJECT_KINDS` includes `'note'`; `ReportSubjectKind` admits `'note'`; `POST /api/reports` accepts `subject_kind: 'note'`; `ReportProblem` offers reasons for `subjectKind="note"`.

- [ ] **Step 1: Write the drift test (API unit)**

`packages/api/tests/unit/report-kinds-drift.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { REPORT_SUBJECT_KINDS } from '@splat-connect/types'

// The constant the API validates against and the DB check that stores it must
// name the same kinds; 132 is the latest migration that rewrites the check.
describe('report subject kinds', () => {
  it('includes note', () => {
    expect(REPORT_SUBJECT_KINDS).toContain('note')
  })
  it('match migration 132 exactly', () => {
    const sql = readFileSync(new URL('../../../../supabase/migrations/132_report_note_kind.sql', import.meta.url), 'utf8')
    const check = /check \(subject_kind in \(([^)]+)\)\)/g
    const matches = [...sql.matchAll(check)]
    const last = matches[matches.length - 1]![1]!
    const inDb = last.split(',').map((s) => s.trim().replace(/'/g, '')).sort()
    expect(inDb).toEqual([...REPORT_SUBJECT_KINDS].sort())
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd packages/api && pnpm vitest run tests/unit/report-kinds-drift.test.ts`
Expected: FAIL — `expected [...] to include 'note'` and ENOENT on the migration.

- [ ] **Step 3: Add the kind, the migration and the mobile reasons**

`packages/types/src/index.ts` line 2527:
```ts
export const REPORT_SUBJECT_KINDS = ['guide', 'toy', 'person', 'organisation', 'print_job', 'exchange', 'build', 'note', 'other'] as const
```

`supabase/migrations/132_report_note_kind.sql`:
```sql
-- 132 — a community note on a guide can be reported on its own (the mobile
-- Feedback tab's ⋯ menu). Until now the app filed such a report against the
-- whole guide, so the admin queue could not tell which note was meant.
-- Guarded like 118: abort rather than drop a kind the live check permits.
--
-- DOWN:
--   alter table public.member_reports drop constraint member_reports_subject_kind_check;
--   alter table public.member_reports add constraint member_reports_subject_kind_check
--     check (subject_kind in ('guide', 'toy', 'person', 'organisation', 'print_job', 'exchange', 'build', 'other'));

do $$
declare
  def  text;
  lost text;
begin
  select pg_get_constraintdef(oid) into def
    from pg_constraint
   where conname = 'member_reports_subject_kind_check' and conrelid = 'public.member_reports'::regclass;
  if def is null then raise exception 'member_reports_subject_kind_check is absent'; end if;
  select string_agg(distinct m[1], ', ') into lost
    from regexp_matches(def, '''([a-z_]+)''', 'g') as m
   where m[1] not in ('guide', 'toy', 'person', 'organisation', 'print_job', 'exchange', 'build', 'note', 'other');
  if lost is not null then
    raise exception 'live member_reports_subject_kind_check permits values 132 would drop: %', lost;
  end if;
end $$;

alter table public.member_reports drop constraint member_reports_subject_kind_check;
alter table public.member_reports add constraint member_reports_subject_kind_check
  check (subject_kind in ('guide', 'toy', 'person', 'organisation', 'print_job', 'exchange', 'build', 'note', 'other'));
```

`packages/mobile/components/reports/report-problem.tsx`, in `REASONS_FOR` add after `organisation`:
```ts
  note: ['safety', 'wrong_info', 'conduct', 'other'],
```

- [ ] **Step 4: Run the drift test and typecheck**

Run: `cd packages/api && pnpm vitest run tests/unit/report-kinds-drift.test.ts && pnpm typecheck`
Expected: PASS, no type errors.

- [ ] **Step 5: Extend the integration test**

In `packages/api/tests/integration/admin/report-kinds.test.ts`:
- change the first `it.each([...])` list to `['guide', 'toy', 'exchange', 'build', 'note', 'print_job', 'person', 'organisation', 'other']`
- add inside the describe:
```ts
  it('files a report about one note, keeping the note id (132)', async () => {
    const subject_id = crypto.randomUUID()
    const res = await file('note', 'wrong_info', { subject_id, subject_label: "Sam R's note on Switch toy guide" })
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ subject_kind: 'note', subject_id, category: 'wrong_info' })
    const { data } = await adminClient().from('member_reports').select('subject_kind').eq('subject_id', subject_id).single()
    expect(data?.subject_kind).toBe('note')
  })
```

- [ ] **Step 6: Apply the migration locally and run the integration file**

Run: `supabase migration up` (repo root; local Supabase must be running), then `cd packages/api && pnpm vitest run -c vitest.integration.config.ts tests/integration/admin/report-kinds.test.ts`
Expected: PASS including the new case. If the first run fails with a check-constraint error, the migration did not apply; run `supabase migration list` and fix before continuing.

- [ ] **Step 7: Mobile unit test for the note reasons**

`packages/mobile/tests/unit/components/reports/report-problem-note.test.tsx`:
```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { ReportProblem } from '../../../../components/reports/report-problem'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockPost = jest.fn().mockResolvedValue({})
jest.mock('../../../../lib/api-client', () => ({ apiClient: { post: (...a: unknown[]) => mockPost(...a) } }))

it('offers the note reasons and posts subject_kind note with the note id', async () => {
  render(<ReportProblem subjectKind="note" subjectId="n1" subjectLabel="Sam R's note on Light Touch Switch" />)
  fireEvent.press(screen.getByText('Report a problem'))
  expect(screen.getByText("About Sam R's note on Light Touch Switch. Goes to the SPLAT team only.")).toBeTruthy()
  expect(screen.queryByText('Didn’t show up')).toBeNull()
  fireEvent.press(screen.getByText('Wrong or missing info'))
  fireEvent.changeText(screen.getByLabelText('What happened?'), 'The tip is for a different switch.')
  fireEvent.press(screen.getByRole('button', { name: 'Send' }))
  await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/reports', expect.objectContaining({ subject_kind: 'note', subject_id: 'n1' })))
})
```
If the field label or Send button name differs, read `report-problem.tsx` lines 140–200 and use the real `accessibilityLabel` / button label; do not change the component to fit the test.

- [ ] **Step 8: Run it**

Run: `cd packages/mobile && pnpm test:unit -- tests/unit/components/reports/report-problem-note.test.tsx`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/types/src/index.ts supabase/migrations/132_report_note_kind.sql packages/api/tests packages/mobile/components/reports/report-problem.tsx packages/mobile/tests/unit/components/reports/report-problem-note.test.tsx
git commit -m "feat(reports): a community note can be reported on its own (subject kind note, migration 132)"
```

---

### Task 2: Segmented badge and the new tab labels

**Files:**
- Modify: `packages/mobile/components/ui/Segmented.tsx`
- Modify: `packages/mobile/tests/unit/components/ui/Segmented.test.tsx`
- Modify: `packages/mobile/components/home/detail-screen.tsx:373-385`
- Modify: `packages/mobile/tests/unit/components/home/detail-screen.test.tsx` (every `tab('You’ll need')` and any `Notes` tab name)
- Modify: `packages/mobile/tests/unit/components/home/detail-screen-actions.test.tsx` (same)
- Modify: `packages/mobile/tests/e2e/guides-detail.spec.ts:22,73` (`You’ll need` → `Supplies`)
- Modify: `packages/mobile/tests/e2e/guides-reader-journeys.spec.ts`, `guides-notes.spec.ts`, `guides-build-mode.spec.ts` (`/^Notes/` → `/^Feedback/`)

**Interfaces:**
- Produces: `Segmented` option type `{ value: T; label: string; icon?: IconName; testID?: string; badge?: number }`. A tab with a badge has `accessibilityLabel` `` `${label} (${badge})` ``.

- [ ] **Step 1: Write the failing Segmented tests**

Append to `tests/unit/components/ui/Segmented.test.tsx` inside the describe:
```tsx
  it('draws a count badge after the label and folds it into the a11y name', () => {
    render(<Segmented label="Guide sections" value="a" onChange={() => {}} options={[{ value: 'a', label: 'Overview' }, { value: 'b', label: 'Feedback', badge: 3 }]} />)
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Feedback (3)' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Overview' })).toBeTruthy()
  })

  it('draws no badge at zero', () => {
    render(<Segmented label="Guide sections" value="a" onChange={() => {}} options={[{ value: 'a', label: 'Feedback', badge: 0 }]} />)
    expect(screen.queryByText('0')).toBeNull()
    expect(screen.getByRole('tab', { name: 'Feedback' })).toBeTruthy()
  })
```

- [ ] **Step 2: Run to see them fail**

Run: `cd packages/mobile && pnpm test:unit -- tests/unit/components/ui/Segmented.test.tsx`
Expected: FAIL — no element with text `3`; tab name `Feedback (3)` not found.

- [ ] **Step 3: Implement the badge**

In `Segmented.tsx`:
- option type: add `badge?: number`.
- in the non-boxed Pressable: `accessibilityLabel={o.badge ? `${o.label} (${o.badge})` : o.label}`.
- after the label `<Text>` add:
```tsx
            {o.badge ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{o.badge}</Text>
              </View>
            ) : null}
```
- styles:
```ts
  badge: { minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: theme.radii.pill, backgroundColor: theme.colors.apricot, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: theme.fonts.black, fontSize: theme.type.micro, color: theme.colors.tone.apricot.fg, lineHeight: 14 },
```

- [ ] **Step 4: Run Segmented tests**

Run: `cd packages/mobile && pnpm test:unit -- tests/unit/components/ui/Segmented.test.tsx`
Expected: PASS (all cases, including the pre-existing one-line checks).

- [ ] **Step 5: Rename the tabs on the guide page**

In `detail-screen.tsx` replace the options array:
```tsx
            options={[
              { value: 'overview', label: 'Overview' },
              { value: 'parts', label: 'Supplies' },
              { value: 'files', label: 'Files' },
              { value: 'notes', label: 'Feedback', badge: notes.length },
            ]}
```

- [ ] **Step 6: Update the unit tests that name the old tabs**

In `detail-screen.test.tsx` and `detail-screen-actions.test.tsx`: `tab('You’ll need')` → `tab('Supplies')`; any `tab('Notes')`/`tab('Notes 1')` → `tab('Feedback')` / `tab('Feedback (1)')`. Add to `detail-screen.test.tsx`:
```tsx
  it('shows the feedback count as a badge on the Feedback tab', async () => {
    ;(apiClient.get as jest.Mock).mockImplementation((p: string) =>
      p === '/api/saves/ids' ? Promise.resolve(NO_SAVES) : p === '/api/child-profiles' ? Promise.resolve([]) : p.endsWith('/notes')
        ? Promise.resolve([{ id: 'n1', step_position: 1, author_id: 'p', author_name: 'Priya', body: 'x', photo_url: null, photo_caption: null, pinned_at: null, pinned_by: null, pinned_by_name: null, created_at: '2026-09-01T00:00:00Z' }])
        : Promise.resolve(DETAIL)
    )
    render(<DetailScreen id="1" />)
    await screen.findByText('Build a Robot Arm')
    expect(await screen.findByRole('tab', { name: 'Feedback (1)' })).toBeTruthy()
  })
```

- [ ] **Step 7: Run the two detail-screen test files**

Run: `cd packages/mobile && pnpm test:unit -- tests/unit/components/home/detail-screen`
Expected: PASS.

- [ ] **Step 8: Update e2e tab names**

In `tests/e2e/guides-detail.spec.ts` lines 22 and 73: `getByRole('tab', { name: 'You’ll need' })` → `getByRole('tab', { name: 'Supplies' })`. In `guides-reader-journeys.spec.ts` (lines 92, 117, 132), `guides-notes.spec.ts` (every `/^Notes/`), `guides-build-mode.spec.ts` (any `/^Notes/`): `{ name: /^Notes/ }` → `{ name: /^Feedback/ }`. Do not run e2e yet; Task 11 runs the suite once everything that changes copy is in.

- [ ] **Step 9: Commit**

```bash
git add packages/mobile/components/ui/Segmented.tsx packages/mobile/components/home/detail-screen.tsx packages/mobile/tests
git commit -m "feat(mobile): guide tabs read Overview, Supplies, Files, Feedback, with the feedback count as a badge"
```

---

### Task 3: What you'll need rows that name their tab, and the print row

**Files:**
- Modify: `packages/mobile/components/home/detail-screen.tsx:271-274, 349-370, 582-598` and styles
- Modify: `packages/mobile/tests/unit/components/home/detail-screen.test.tsx`

**Interfaces:**
- Produces: `openTab(t: Tab, opts?: { highlight?: 'print' })`; state `highlight: 'print' | null` cleared after 1600 ms; testIDs `need-parts`, `need-tools`, `need-print`, `print-card`.

- [ ] **Step 1: Write the failing tests**

Append to `detail-screen.test.tsx`:
```tsx
  describe('What you’ll need', () => {
    it('has a row per destination, each naming the tab it opens', async () => {
      mockEndpoints({ detail: Promise.resolve({ ...DETAIL, stl_files: [{ id: 'f1', tutorial_id: '1', filename: 'base.stl', file_url: '1/base.stl', print_minutes: 55, filament_grams: 14, material: 'PLA' }] }) })
      render(<DetailScreen id="1" />)
      await screen.findByText('Build a Robot Arm')
      expect(screen.getByRole('button', { name: '1 part, opens Supplies' })).toBeTruthy()
      expect(screen.getByRole('button', { name: '1 tool, opens Supplies' })).toBeTruthy()
      expect(screen.getByRole('button', { name: '1 part to 3D print, opens Files' })).toBeTruthy()
      expect(screen.queryByText(/gathered/)).toBeNull()
      expect(screen.queryByText(/about \$/)).toBeNull()
    })

    it('hides the print row when the guide has no STL files', async () => {
      render(<DetailScreen id="1" />)
      await screen.findByText('Build a Robot Arm')
      expect(screen.queryByTestId('need-print')).toBeNull()
    })

    it('the print row opens Files and rings the print card, then the ring goes', async () => {
      jest.useFakeTimers()
      mockEndpoints({ detail: Promise.resolve({ ...DETAIL, stl_files: [{ id: 'f1', tutorial_id: '1', filename: 'base.stl', file_url: '1/base.stl', print_minutes: null, filament_grams: null, material: null }] }) })
      render(<DetailScreen id="1" />)
      await screen.findByText('Build a Robot Arm')
      fireEvent.press(screen.getByTestId('need-print'))
      expect(screen.getByRole('tab', { name: 'Files', selected: true })).toBeTruthy()
      expect(screen.getByTestId('print-card').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ borderColor: expect.any(String) })]))
      act(() => { jest.advanceTimersByTime(1700) })
      expect(screen.getByTestId('print-card').props.style).not.toEqual(expect.arrayContaining([expect.objectContaining({ borderWidth: 3 })]))
      jest.useRealTimers()
    })

    it('the parts row opens Supplies', async () => {
      render(<DetailScreen id="1" />)
      await screen.findByText('Build a Robot Arm')
      fireEvent.press(screen.getByTestId('need-parts'))
      expect(screen.getByRole('tab', { name: 'Supplies', selected: true })).toBeTruthy()
    })
  })
```
(`act` is already imported in this file.)

- [ ] **Step 2: Run to see them fail**

Run: `cd packages/mobile && pnpm test:unit -- tests/unit/components/home/detail-screen.test.tsx -t "What you"`
Expected: FAIL — buttons named `… opens Supplies` not found.

- [ ] **Step 3: Implement**

In `detail-screen.tsx`:

State and `openTab`:
```tsx
  const [highlight, setHighlight] = useState<'print' | null>(null)
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (highlightTimer.current) clearTimeout(highlightTimer.current) }, [])
  const openTab = (t: Tab, opts?: { highlight?: 'print' }) => {
    setTab(t)
    scroller.current?.scrollTo({ y: tabsY, animated: true })
    if (opts?.highlight) {
      setHighlight(opts.highlight)
      if (highlightTimer.current) clearTimeout(highlightTimer.current)
      highlightTimer.current = setTimeout(() => setHighlight(null), 1600)
    }
  }
```
(Move `openTab` below `tabsY` as it is today; the `useState`/`useRef`/`useEffect` go with the other hooks near the top of the component so hooks stay unconditional.)

Replace the What you'll need block (lines 349–370) with:
```tsx
          {gatherTotal || tutorial.stl_files.length ? (
            <View style={styles.need}>
              <Text style={styles.needTitle}>What you’ll need</Text>
              {tutorial.parts.length ? (
                <NeedRow testID="need-parts" icon="cube-outline" text={`${tutorial.parts.length} part${tutorial.parts.length === 1 ? '' : 's'}`} tab="Supplies" onPress={() => openTab('parts')} />
              ) : null}
              {tutorial.tools.length ? (
                <NeedRow testID="need-tools" icon="construct-outline" text={`${tutorial.tools.length} tool${tutorial.tools.length === 1 ? '' : 's'}`} tab="Supplies" onPress={() => openTab('parts')} />
              ) : null}
              {tutorial.stl_files.length ? (
                <NeedRow testID="need-print" icon="print-outline" print text={`${tutorial.stl_files.length} part${tutorial.stl_files.length === 1 ? '' : 's'} to 3D print`} tab="Files" onPress={() => openTab('files', { highlight: 'print' })} />
              ) : null}
            </View>
          ) : null}
```

Add above `DetailScreen` (module level):
```tsx
/** One line of What you'll need: what, and the pill naming the tab it opens. */
function NeedRow({ testID, icon, text, tab, print, onPress }: { testID: string; icon: React.ComponentProps<typeof Ionicons>['name']; text: string; tab: string; print?: boolean; onPress: () => void }) {
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${text}, opens ${tab}`} style={[styles.needRow, print && styles.needPrint]}>
      <View style={[styles.needIcon, print && styles.needIconPrint]}>
        <Ionicons name={icon} size={18} color={print ? theme.colors.ink : theme.colors.primaryDeep} />
      </View>
      <Text style={styles.needText}>{text}</Text>
      <View style={styles.needGo}>
        <Text style={styles.needGoText}>{tab}</Text>
        <Ionicons name="chevron-down" size={14} color={theme.colors.primaryDeep} />
      </View>
    </Pressable>
  )
}
```

Styles (replace `needRule`, `needSoft`, keep `need`, `needTitle`, `needText`, `needCount`):
```ts
  needRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), paddingHorizontal: theme.spacing(4), paddingVertical: theme.spacing(3), borderTopWidth: theme.border.hairline, borderTopColor: theme.colors.border },
  needPrint: { backgroundColor: theme.colors.accentFaint },
  needIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.accentLight },
  needIconPrint: { backgroundColor: theme.colors.apricotSoft },
  needGo: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: theme.spacing(2), paddingVertical: 3, borderRadius: theme.radii.pill, backgroundColor: theme.colors.accentLight },
  needGoText: { fontFamily: theme.fonts.black, fontSize: theme.type.micro, color: theme.colors.primaryDeep },
  printRing: { borderWidth: 3, borderColor: theme.colors.primary },
```
The first row after the title has a hairline; give `needTitle` `paddingBottom: theme.spacing(2)` and the `need` card `overflow: 'hidden'`.

The print card (Files tab, around line 582): add `testID="print-card"` and `style={[styles.printCard, styles.flush, highlight === 'print' && styles.printRing]}`. The highlight ring is the only thing this task changes on the Files tab; Task 9 restyles the card.

- [ ] **Step 4: Run the detail-screen tests**

Run: `cd packages/mobile && pnpm test:unit -- tests/unit/components/home/detail-screen`
Expected: PASS. If the `print-card` style assertion is brittle against `AnimatedPressable`'s style shape, assert on `toJSON()` containing `borderWidth: 3` instead; keep the behaviour (ring on, ring off after 1.6 s).

- [ ] **Step 5: Add the e2e assertions**

Append to `tests/e2e/guides-detail.spec.ts`:
```ts
test('What you’ll need rows open their tab, and the print row lands on Files with the print card in view', async ({ page }) => {
  await signInAsNewContributor(page)
  const author = await createContributor()
  const id = await createTutorial(author.id, { title: uniqueTitle('E2E Need Rows') })
  const { error } = await adminClient().from('stl_files').insert({ tutorial_id: id, filename: 'base.stl', file_url: `${id}/base.stl`, print_minutes: 55, filament_grams: 14, material: 'PLA' })
  if (error) throw new Error(error.message)

  await page.goto(`/guides/${id}`)
  await page.getByRole('button', { name: /^1 part, opens Supplies$/ }).click()
  await expect(page.getByRole('tab', { name: 'Supplies', selected: true })).toBeVisible()

  await page.getByRole('button', { name: '1 part to 3D print, opens Files' }).click()
  await expect(page.getByRole('tab', { name: 'Files', selected: true })).toBeVisible()
  await expect(page.getByTestId('print-card')).toBeInViewport()
})
```
Import `adminClient` from `./helpers` if the file does not already.

- [ ] **Step 6: Commit**

```bash
git add packages/mobile/components/home/detail-screen.tsx packages/mobile/tests
git commit -m "feat(mobile): What you'll need rows name the tab they open, and a print row leads to Files"
```

---

### Task 4: `lib/guide-focus.ts` and `lib/guide-files.ts`

**Files:**
- Create: `packages/mobile/lib/guide-focus.ts`
- Create: `packages/mobile/tests/unit/lib/guide-focus.test.ts`
- Create: `packages/mobile/lib/guide-files.ts`
- Create: `packages/mobile/tests/unit/lib/guide-files.test.ts`

**Interfaces:**
- Produces:
```ts
// lib/guide-focus.ts
export type GuideFocus = { tutorialId: string; noteId: string | null }
export function setGuideFocus(f: GuideFocus): void
export function takeGuideFocus(tutorialId: string): GuideFocus | null
// lib/guide-files.ts
export function stlName(filename: string): string        // 'lts_base.stl' → 'Lts base'
export function webGuideUrl(tutorialId: string): string | null   // null when EXPO_PUBLIC_WEB_URL is unset
export const STL_PREVIEW_MAX_BYTES = 25 * 1024 * 1024
```

- [ ] **Step 1: Write the failing tests**

`tests/unit/lib/guide-focus.test.ts`:
```ts
import { setGuideFocus, takeGuideFocus } from '../../../lib/guide-focus'

it('hands a focus to the guide it names, once', () => {
  setGuideFocus({ tutorialId: 'g1', noteId: 'n1' })
  expect(takeGuideFocus('g1')).toEqual({ tutorialId: 'g1', noteId: 'n1' })
  expect(takeGuideFocus('g1')).toBeNull()
})

it('keeps a focus meant for another guide', () => {
  setGuideFocus({ tutorialId: 'g1', noteId: null })
  expect(takeGuideFocus('g2')).toBeNull()
  expect(takeGuideFocus('g1')).toEqual({ tutorialId: 'g1', noteId: null })
})
```

`tests/unit/lib/guide-files.test.ts`:
```ts
import { stlName, webGuideUrl, STL_PREVIEW_MAX_BYTES } from '../../../lib/guide-files'

describe('stlName', () => {
  it.each([
    ['lts_base.stl', 'Lts base'],
    ['Rumble-Plate_lid.STL', 'Rumble Plate lid'],
    ['mount', 'Mount'],
    ['', ''],
  ])('%s → %s', (input, out) => expect(stlName(input)).toBe(out))
})

describe('webGuideUrl', () => {
  const was = process.env.EXPO_PUBLIC_WEB_URL
  afterEach(() => { process.env.EXPO_PUBLIC_WEB_URL = was })
  it('points at the guide on the website', () => {
    process.env.EXPO_PUBLIC_WEB_URL = 'https://splat.example'
    expect(webGuideUrl('abc')).toBe('https://splat.example/tutorials/abc')
  })
  it('is null when the web address is not configured', () => {
    delete process.env.EXPO_PUBLIC_WEB_URL
    expect(webGuideUrl('abc')).toBeNull()
  })
})

it('caps previews at 25 MB', () => expect(STL_PREVIEW_MAX_BYTES).toBe(26214400))
```

- [ ] **Step 2: Run to see them fail**

Run: `cd packages/mobile && pnpm test:unit -- tests/unit/lib/guide-focus.test.ts tests/unit/lib/guide-files.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

`lib/guide-focus.ts`:
```ts
// packages/mobile/lib/guide-focus.ts
//
// Build mode posts feedback and then closes back onto the guide page already
// mounted beneath it. The guide must open on Feedback with that note in view,
// and router.back() carries no params, so the hand-off lives here: set before
// closing, taken once by the guide's focus effect.
export type GuideFocus = { tutorialId: string; noteId: string | null }

let pending: GuideFocus | null = null

export function setGuideFocus(f: GuideFocus) {
  pending = f
}

/** The focus meant for this guide, cleared on read; null for any other guide. */
export function takeGuideFocus(tutorialId: string): GuideFocus | null {
  if (!pending || pending.tutorialId !== tutorialId) return null
  const f = pending
  pending = null
  return f
}
```

`lib/guide-files.ts`:
```ts
// packages/mobile/lib/guide-files.ts
//
// The Files tab's helpers. Downloads live on the website; the app only views.

/** 'lts_base.stl' → 'Lts base': the filename without its extension, as words. */
export function stlName(filename: string): string {
  const bare = filename.replace(/\.stl$/i, '').replace(/[_-]+/g, ' ').trim()
  return bare ? bare[0]!.toUpperCase() + bare.slice(1) : ''
}

/** The guide's page on the website, where the PDF and STLs download; null when no web address is configured. */
export function webGuideUrl(tutorialId: string): string | null {
  const web = process.env.EXPO_PUBLIC_WEB_URL
  return web ? `${web}/tutorials/${tutorialId}` : null
}

// Above this the parse takes seconds on a phone and the page is told to say so.
export const STL_PREVIEW_MAX_BYTES = 25 * 1024 * 1024
```

- [ ] **Step 4: Run the tests**

Run: `cd packages/mobile && pnpm test:unit -- tests/unit/lib/guide-focus.test.ts tests/unit/lib/guide-files.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/mobile/lib/guide-focus.ts packages/mobile/lib/guide-files.ts packages/mobile/tests/unit/lib/guide-focus.test.ts packages/mobile/tests/unit/lib/guide-files.test.ts
git commit -m "feat(mobile): guide-focus hand-off and guide-files helpers"
```

---

### Task 5: `FeedbackSheet`

**Files:**
- Create: `packages/mobile/components/guides/feedback-sheet.tsx`
- Create: `packages/mobile/tests/unit/components/guides/feedback-sheet.test.tsx`

**Interfaces:**
- Consumes: `apiClient.post`, `pickAndUploadPhoto` (`lib/upload`), `apiMessage` (`@splat-connect/types`), `Chip`, `TextField`, `Button`, `ErrorRow`.
- Produces:
```ts
export type FeedbackSheetProps = {
  tutorialId: string
  steps: TutorialStep[]
  authorFirstName: string
  initialStep?: number | null        // undefined: nothing chosen; null: Missing step; n: Step n
  open: boolean
  onClose: () => void
  onPosted: (note: GuideNote) => void
  onSeeOnGuide?: (note: GuideNote) => void   // build mode only
}
export function FeedbackSheet(props: FeedbackSheetProps): JSX.Element
```
Copy: title `How did it go?`; sub `{authorFirstName} can pin it as a fix so the next builder sees it.`; eyebrow `Which step?`; chips `Step N` and `Missing step`; body placeholder `What was missing, or what you did differently…` (a11y label `Your note`); `Add a photo`; caption field a11y `Photo caption`; `Post`. Confirmation: `Feedback posted`, `It's on the guide's Feedback tab now, under {step label}.`, `See it on the guide`, `Stay here`.

- [ ] **Step 1: Write the failing tests**

`tests/unit/components/guides/feedback-sheet.test.tsx`:
```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { FeedbackSheet } from '../../../../components/guides/feedback-sheet'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
const mockPick = jest.fn()
jest.mock('../../../../lib/upload', () => ({ pickAndUploadPhoto: (...a: unknown[]) => mockPick(...a) }))
const mockPost = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { post: (...a: unknown[]) => mockPost(...a) } }))

const steps = [
  { id: 's1', tutorial_id: 'g', position: 1, title: 'Prepare', body: 'b', photo_url: null },
  { id: 's2', tutorial_id: 'g', position: 2, title: 'Solder', body: 'b', photo_url: null },
]
const posted = { id: 'n9', step_position: 2, author_id: 'me', author_name: 'You', body: 'Tin first.', photo_url: null, photo_caption: null, pinned_at: null, pinned_by: null, pinned_by_name: null, created_at: '2026-10-07T00:00:00Z' }
const base = { tutorialId: 'g', steps, authorFirstName: 'Mei', open: true, onClose: jest.fn(), onPosted: jest.fn() }

beforeEach(() => { jest.clearAllMocks(); mockPost.mockResolvedValue(posted) })

it('needs a step and a body before Post enables, then posts and shows the confirmation', async () => {
  render(<FeedbackSheet {...base} steps={steps as never} />)
  expect(screen.getByText('How did it go?')).toBeTruthy()
  expect(screen.getByText('Mei can pin it as a fix so the next builder sees it.')).toBeTruthy()
  const post = () => screen.getByRole('button', { name: 'Post' })
  expect(post().props.accessibilityState?.disabled).toBe(true)
  fireEvent.press(screen.getByText('Step 2'))
  fireEvent.changeText(screen.getByLabelText('Your note'), ' Tin first. ')
  expect(post().props.accessibilityState?.disabled).toBeFalsy()
  fireEvent.press(post())
  await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/tutorials/g/notes', { step_position: 2, body: 'Tin first.', photo_path: null, photo_caption: null }))
  expect(base.onPosted).toHaveBeenCalledWith(posted)
  expect(screen.getByText('Feedback posted')).toBeTruthy()
  expect(screen.getByText("It's on the guide's Feedback tab now, under Step 2.")).toBeTruthy()
})

it('preselects the step it was opened on', () => {
  render(<FeedbackSheet {...base} steps={steps as never} initialStep={1} />)
  fireEvent.changeText(screen.getByLabelText('Your note'), 'x')
  expect(screen.getByRole('button', { name: 'Post' }).props.accessibilityState?.disabled).toBeFalsy()
})

it('a guide with no steps still posts, as a missing step', async () => {
  render(<FeedbackSheet {...base} steps={[]} />)
  expect(screen.queryByText(/^Step \d/)).toBeNull()
  fireEvent.press(screen.getByText('Missing step'))
  fireEvent.changeText(screen.getByLabelText('Your note'), 'Worked great.')
  fireEvent.press(screen.getByRole('button', { name: 'Post' }))
  await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/tutorials/g/notes', expect.objectContaining({ step_position: null })))
})

it('stays open and says why when the post fails', async () => {
  mockPost.mockRejectedValue(new Error('API POST failed with status 401'))
  render(<FeedbackSheet {...base} steps={steps as never} initialStep={1} />)
  fireEvent.changeText(screen.getByLabelText('Your note'), 'x')
  fireEvent.press(screen.getByRole('button', { name: 'Post' }))
  expect(await screen.findByText(/Could not post that|status 401/)).toBeTruthy()
  expect(screen.getByText('How did it go?')).toBeTruthy()
  expect(base.onPosted).not.toHaveBeenCalled()
  expect(base.onClose).not.toHaveBeenCalled()
})

it('uploads a photo and sends its path and caption', async () => {
  mockPick.mockResolvedValue({ path: 'g/photo.jpg' })
  render(<FeedbackSheet {...base} steps={steps as never} initialStep={1} />)
  fireEvent.press(screen.getByText('Add a photo'))
  await waitFor(() => expect(mockPick).toHaveBeenCalledWith('/api/upload/note-photo', 'g'))
  fireEvent.changeText(screen.getByLabelText('Photo caption'), 'The jig')
  fireEvent.changeText(screen.getByLabelText('Your note'), 'x')
  fireEvent.press(screen.getByRole('button', { name: 'Post' }))
  await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/tutorials/g/notes', expect.objectContaining({ photo_path: 'g/photo.jpg', photo_caption: 'The jig' })))
})

it('from build mode, See it on the guide hands the note over; Stay here just closes', async () => {
  const onSeeOnGuide = jest.fn()
  render(<FeedbackSheet {...base} steps={steps as never} initialStep={2} onSeeOnGuide={onSeeOnGuide} />)
  fireEvent.changeText(screen.getByLabelText('Your note'), 'x')
  fireEvent.press(screen.getByRole('button', { name: 'Post' }))
  await screen.findByText('Feedback posted')
  fireEvent.press(screen.getByRole('button', { name: 'Stay here' }))
  expect(base.onClose).toHaveBeenCalledTimes(1)
  fireEvent.press(screen.getByRole('button', { name: 'See it on the guide' }))
  expect(onSeeOnGuide).toHaveBeenCalledWith(posted)
})

it('without onSeeOnGuide, See it on the guide closes', async () => {
  render(<FeedbackSheet {...base} steps={steps as never} initialStep={2} />)
  fireEvent.changeText(screen.getByLabelText('Your note'), 'x')
  fireEvent.press(screen.getByRole('button', { name: 'Post' }))
  await screen.findByText('Feedback posted')
  fireEvent.press(screen.getByRole('button', { name: 'See it on the guide' }))
  expect(base.onClose).toHaveBeenCalled()
})

it('resets to a blank form each time it opens', async () => {
  const view = render(<FeedbackSheet {...base} steps={steps as never} initialStep={2} />)
  fireEvent.changeText(screen.getByLabelText('Your note'), 'x')
  fireEvent.press(screen.getByRole('button', { name: 'Post' }))
  await screen.findByText('Feedback posted')
  view.rerender(<FeedbackSheet {...base} steps={steps as never} initialStep={2} open={false} />)
  view.rerender(<FeedbackSheet {...base} steps={steps as never} initialStep={2} open />)
  expect(screen.getByText('How did it go?')).toBeTruthy()
  expect(screen.getByLabelText('Your note').props.value).toBe('')
})
```

- [ ] **Step 2: Run to see them fail**

Run: `cd packages/mobile && pnpm test:unit -- tests/unit/components/guides/feedback-sheet.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`components/guides/feedback-sheet.tsx`:
```tsx
// packages/mobile/components/guides/feedback-sheet.tsx
//
// The one place feedback on a guide is written: opened from the Feedback
// tab's composer bar and from build mode's done screen. After a post the same
// sheet becomes the confirmation, so there is never a second popup.
import { useEffect, useState } from 'react'
import { View, Text, Modal, Pressable, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import type { GuideNote, TutorialStep } from '@splat-connect/types'
import { apiMessage } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { pickAndUploadPhoto } from '../../lib/upload'
import { stepLabel } from '../../lib/guide-notes'
import { theme } from '../../lib/theme'
import { Chip } from '../ui/Chip'
import { TextField } from '../ui/TextField'
import { Button } from '../ui/Button'
import { ErrorRow } from '../ui/ErrorRow'

export type FeedbackSheetProps = {
  tutorialId: string
  steps: TutorialStep[]
  authorFirstName: string
  /** undefined: nothing chosen yet; null: Missing step; n: Step n. */
  initialStep?: number | null
  open: boolean
  onClose: () => void
  /** The 201 body, as soon as it lands; the host reloads and highlights. */
  onPosted: (note: GuideNote) => void
  /** Build mode only: close build mode onto the guide with this note in view. */
  onSeeOnGuide?: (note: GuideNote) => void
}

export function FeedbackSheet({ tutorialId, steps, authorFirstName, initialStep, open, onClose, onPosted, onSeeOnGuide }: FeedbackSheetProps) {
  const [at, setAt] = useState<number | null | undefined>(initialStep)
  const [body, setBody] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [posted, setPosted] = useState<GuideNote | null>(null)

  // A blank form every time it opens: the last post must not linger.
  useEffect(() => {
    if (!open) return
    setAt(initialStep)
    setBody('')
    setPhoto(null)
    setCaption('')
    setError(null)
    setPosted(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function addPhoto() {
    try {
      const uploaded = await pickAndUploadPhoto('/api/upload/note-photo', tutorialId)
      if (uploaded) setPhoto(uploaded.path ?? null)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function post() {
    setBusy(true)
    setError(null)
    try {
      const note = await apiClient.post<GuideNote>(`/api/tutorials/${tutorialId}/notes`, {
        step_position: at ?? null,
        body: body.trim(),
        photo_path: photo,
        photo_caption: caption.trim() || null,
      })
      setPosted(note)
      onPosted(note)
    } catch (err) {
      setError(apiMessage(err, 'Could not post that. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal visible={open} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={StyleSheet.absoluteFill} />
        <View style={styles.sheet} testID="feedback-sheet">
          <View style={styles.grabber} />
          {posted ? (
            <View style={styles.done}>
              <View style={styles.tick}><Ionicons name="checkmark" size={30} color={theme.colors.onColor} /></View>
              <Text style={styles.title} accessibilityRole="header">Feedback posted</Text>
              <Text style={styles.sub}>{`It's on the guide's Feedback tab now, under ${stepLabel(posted, steps.length)}.`}</Text>
              <Button label="See it on the guide" onPress={() => (onSeeOnGuide ? onSeeOnGuide(posted) : onClose())} />
              <Button label="Stay here" variant="ghost" onPress={onClose} />
            </View>
          ) : (
            <>
              <View style={styles.head}>
                <Text style={styles.title} accessibilityRole="header">How did it go?</Text>
                <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={6}>
                  <Ionicons name="close" size={22} color={theme.colors.muted} />
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
                <Text style={styles.sub}>{`${authorFirstName} can pin it as a fix so the next builder sees it.`}</Text>
                <Text style={styles.eyebrow}>Which step?</Text>
                <View accessibilityLabel="Which step is it about?" style={styles.chips}>
                  {steps.map((s) => (
                    <Chip key={s.id} label={`Step ${s.position}`} active={at === s.position} onPress={() => setAt(s.position)} />
                  ))}
                  <Chip label="Missing step" active={at === null} onPress={() => setAt(null)} />
                </View>
                <TextField accessibilityLabel="Your note" placeholder="What was missing, or what you did differently…" multiline maxLength={1000} value={body} onChangeText={setBody} />
                {photo ? (
                  <TextField accessibilityLabel="Photo caption" placeholder="Caption (optional)" maxLength={60} value={caption} onChangeText={setCaption} />
                ) : null}
                <ErrorRow message={error} />
                <View style={styles.actions}>
                  {photo ? null : <Button label="Add a photo" variant="ghost" onPress={() => void addPhoto()} />}
                  <Button label="Post" variant="primary" disabled={at === undefined || !body.trim()} loading={busy} onPress={() => void post()} style={styles.post} />
                </View>
              </ScrollView>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: theme.colors.scrim },
  sheet: { backgroundColor: theme.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: theme.spacing(4), paddingBottom: theme.spacing(6), maxHeight: '88%', ...theme.shadow(3) },
  grabber: { width: 40, height: 5, borderRadius: 3, backgroundColor: theme.colors.border, alignSelf: 'center', marginVertical: theme.spacing(2) },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: theme.fonts.display, fontSize: theme.type.title, color: theme.colors.ink },
  sub: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted, lineHeight: 20 },
  eyebrow: { fontFamily: theme.fonts.black, fontSize: theme.type.micro, letterSpacing: 1, textTransform: 'uppercase', color: theme.colors.muted },
  form: { gap: theme.spacing(3), paddingTop: theme.spacing(2) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
  actions: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) },
  post: { flex: 1 },
  done: { alignItems: 'center', gap: theme.spacing(3), paddingTop: theme.spacing(2) },
  tick: { width: 58, height: 58, borderRadius: 29, backgroundColor: theme.colors.success, alignItems: 'center', justifyContent: 'center' },
})
```
If `Button` does not accept `style`, check `components/ui/Button.tsx` and use its container prop; if `TextField` has no `value`/`onChangeText` names as above, match its real prop names (it is used exactly this way in today's `community-notes.tsx`, so it should).

- [ ] **Step 4: Run the tests**

Run: `cd packages/mobile && pnpm test:unit -- tests/unit/components/guides/feedback-sheet.test.tsx`
Expected: PASS (8 tests).

- [ ] **Step 5: Typecheck and commit**

Run: `cd packages/mobile && pnpm typecheck`
```bash
git add packages/mobile/components/guides/feedback-sheet.tsx packages/mobile/tests/unit/components/guides/feedback-sheet.test.tsx
git commit -m "feat(mobile): FeedbackSheet, the one composer for guide feedback, with its posted confirmation"
```

---

### Task 6: The Feedback tab (CommunityNotes rewrite)

**Files:**
- Modify: `packages/mobile/components/guides/community-notes.tsx` (rewrite)
- Modify: `packages/mobile/tests/unit/components/guides/community-notes.test.tsx` (rewrite)
- Modify: `packages/mobile/tests/unit/components/guides/community-notes-edges.test.tsx` (rewrite the cases that assert the inline form or the old headings; keep the data edge cases)

**Interfaces:**
- Consumes: `FeedbackSheet` (Task 5), `ReportProblem` with `subjectKind="note"` (Task 1), `noteSummary`/`stepLabel`, `PhotoViewer`, `Chip`, `FlashLine`/`useFlash`, `relativeTime`, `initials` from `@splat-connect/types`.
- Produces:
```ts
type Props = {
  tutorialId: string
  guideTitle: string
  authorName: string
  steps: TutorialStep[]
  notes: GuideNote[]
  reload: () => Promise<unknown>
  canPin: boolean
  viewerId: string | null
  viewerName: string | null
  /** A note to scroll to and ring (the one just posted). */
  highlightId?: string | null
  /** Called with the highlighted row's ref once laid out, so the host can scroll to it. */
  onHighlightRow?: (row: View) => void
  /** The 201 note from the composer; the host reloads and sets highlightId. */
  onPosted?: (note: GuideNote) => void
}
export function CommunityNotes(props: Props): JSX.Element
```
Test ids: `feedback-composer`, `feedback-filter-<all|fixes|missing|step-N>`, `note-row-<id>`, `note-menu-<id>`, `note-menu` (the open sheet).

- [ ] **Step 1: Rewrite `community-notes.test.tsx` (failing)**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native'
import { CommunityNotes } from '../../../../components/guides/community-notes'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('../../../../lib/upload', () => ({ pickAndUploadPhoto: jest.fn() }))
const mockPost = jest.fn().mockResolvedValue({})
const mockDelete = jest.fn().mockResolvedValue(undefined)
jest.mock('../../../../lib/api-client', () => ({ apiClient: { post: (...a: unknown[]) => mockPost(...a), delete: (...a: unknown[]) => mockDelete(...a) } }))
const mockReport = jest.fn()
jest.mock('../../../../components/reports/report-problem', () => ({
  ReportProblem: (p: { subjectKind: string; subjectId: string; subjectLabel: string; trigger?: (open: () => void) => unknown }) => {
    mockReport(p.subjectKind, p.subjectId, p.subjectLabel)
    return p.trigger ? (p.trigger(() => mockReport('opened')) as never) : null
  },
}))

const steps = [1, 2, 3, 4].map((p) => ({ id: `s${p}`, tutorial_id: 'g', position: p, title: `Step ${p} title`, body: 'b', photo_url: null }))
const note = (over: object) => ({
  id: 'n1', step_position: 1, author_id: 'p', author_name: 'Priya S', body: 'Needs a second zip tie.', photo_url: null, photo_caption: null,
  pinned_at: null, pinned_by: null, pinned_by_name: null, created_at: '2026-09-01T00:00:00Z', ...over,
})
const reload = jest.fn().mockResolvedValue(undefined)
const props = { tutorialId: 'g', guideTitle: 'Light Touch Switch', authorName: 'Mei Tan', steps: steps as never, reload, canPin: false, viewerId: 'me', viewerName: 'Byron P' }

beforeEach(() => jest.clearAllMocks())

it('lists fixes first, then the rest, with filter chips that count', () => {
  const notes = [note({ id: 'a', step_position: 3, pinned_at: 'x', pinned_by_name: 'Mei Tan', body: 'Tin both leads first.' }), note({ id: 'b', step_position: 4, author_name: 'Sam R', body: 'Cap was tight.' }), note({ id: 'c', step_position: null, body: 'Test before gluing.' })]
  render(<CommunityNotes {...props} notes={notes as never} />)
  expect(screen.getByTestId('feedback-filter-all')).toHaveTextContent('All 3')
  expect(screen.getByTestId('feedback-filter-fixes')).toHaveTextContent('Fixes 1')
  expect(screen.getByTestId('feedback-filter-step-3')).toBeTruthy()
  expect(screen.getByTestId('feedback-filter-step-4')).toBeTruthy()
  expect(screen.queryByTestId('feedback-filter-step-1')).toBeNull()
  expect(screen.getByTestId('feedback-filter-missing')).toBeTruthy()
  expect(screen.getByText('Fix · approved by Mei')).toBeTruthy()
  expect(screen.getByText('Tin both leads first.')).toBeTruthy()
  expect(screen.getByText('Sam R')).toBeTruthy()
  expect(screen.queryByText(/^Revisions/)).toBeNull()
  expect(screen.queryByText(/^Discussion/)).toBeNull()
})

it('filters by step, fixes and missing', () => {
  const notes = [note({ id: 'a', step_position: 3, pinned_at: 'x', pinned_by_name: 'Mei' }), note({ id: 'b', step_position: 4, body: 'Cap was tight.' }), note({ id: 'c', step_position: null, body: 'Test before gluing.' })]
  render(<CommunityNotes {...props} notes={notes as never} />)
  fireEvent.press(screen.getByTestId('feedback-filter-step-4'))
  expect(screen.getByText('Cap was tight.')).toBeTruthy()
  expect(screen.queryByText('Test before gluing.')).toBeNull()
  fireEvent.press(screen.getByTestId('feedback-filter-missing'))
  expect(screen.getByText('Test before gluing.')).toBeTruthy()
  expect(screen.queryByText('Cap was tight.')).toBeNull()
  fireEvent.press(screen.getByTestId('feedback-filter-fixes'))
  expect(screen.getByText('Fix · approved by Mei')).toBeTruthy()
  expect(screen.queryByText('Cap was tight.')).toBeNull()
})

it('a note past the end of the steps files under Missing, with no chip of its own', () => {
  render(<CommunityNotes {...props} notes={[note({ id: 'z', step_position: 9, body: 'Past the end.' })] as never} />)
  expect(screen.queryByTestId('feedback-filter-step-9')).toBeNull()
  fireEvent.press(screen.getByTestId('feedback-filter-missing'))
  expect(screen.getByText('Past the end.')).toBeTruthy()
})

it('the composer bar opens the sheet; a post reloads and hands the note up', async () => {
  const onPosted = jest.fn()
  mockPost.mockResolvedValueOnce(note({ id: 'new', step_position: 2, body: 'Posted.' }))
  render(<CommunityNotes {...props} notes={[]} onPosted={onPosted} />)
  expect(screen.getByText('No feedback yet. Built it? Say how it went.')).toBeTruthy()
  fireEvent.press(screen.getByTestId('feedback-composer'))
  expect(screen.getByText('How did it go?')).toBeTruthy()
  fireEvent.press(screen.getByText('Step 2'))
  fireEvent.changeText(screen.getByLabelText('Your note'), 'Posted.')
  fireEvent.press(screen.getByRole('button', { name: 'Post' }))
  await waitFor(() => expect(onPosted).toHaveBeenCalledWith(expect.objectContaining({ id: 'new' })))
  expect(reload).toHaveBeenCalled()
})

it('signed out, the bar says to sign in and opens nothing', () => {
  render(<CommunityNotes {...props} viewerId={null} viewerName={null} notes={[]} />)
  fireEvent.press(screen.getByText('Sign in to leave feedback'))
  expect(screen.queryByText('How did it go?')).toBeNull()
})

it('the ⋯ menu lists only what this viewer can do', () => {
  render(<CommunityNotes {...props} notes={[note({ id: 'mine', author_id: 'me' }), note({ id: 'theirs', author_id: 'p', author_name: 'Sam R', step_position: 4 })] as never} />)
  fireEvent.press(screen.getByTestId('note-menu-theirs'))
  expect(screen.getByText("Sam R's note on Step 4")).toBeTruthy()
  expect(screen.getByText('Report this note')).toBeTruthy()
  expect(screen.queryByText('Delete')).toBeNull()
  expect(screen.queryByText('Pin as a fix')).toBeNull()
  fireEvent.press(screen.getByRole('button', { name: 'Cancel' }))
  fireEvent.press(screen.getByTestId('note-menu-mine'))
  expect(screen.getByText('Delete')).toBeTruthy()
  expect(screen.queryByText('Report this note')).toBeNull()
})

it('an author sees Pin as a fix, pins, and the flash says so', async () => {
  render(<CommunityNotes {...props} canPin notes={[note({ id: 'b', step_position: 4 })] as never} />)
  fireEvent.press(screen.getByTestId('note-menu-b'))
  fireEvent.press(screen.getByText('Pin as a fix'))
  await waitFor(() => expect(mockPost).toHaveBeenCalledWith('/api/tutorials/g/notes/b/pin', {}))
  expect(reload).toHaveBeenCalled()
  expect(screen.getByText('Pinned as a fix — shows on its step in build mode')).toBeTruthy()
})

it('Delete removes your own note', async () => {
  render(<CommunityNotes {...props} notes={[note({ id: 'mine', author_id: 'me' })] as never} />)
  fireEvent.press(screen.getByTestId('note-menu-mine'))
  fireEvent.press(screen.getByText('Delete'))
  await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/api/tutorials/g/notes/mine'))
  expect(screen.getByText('Note deleted')).toBeTruthy()
})

it('Report this note reports the note, not the guide', () => {
  render(<CommunityNotes {...props} notes={[note({ id: 'theirs', author_id: 'p', author_name: 'Sam R' })] as never} />)
  fireEvent.press(screen.getByTestId('note-menu-theirs'))
  fireEvent.press(screen.getByText('Report this note'))
  expect(mockReport).toHaveBeenCalledWith('note', 'theirs', "Sam R's note on Light Touch Switch")
  expect(mockReport).toHaveBeenCalledWith('opened')
})

it('a photo shows as a thumbnail that opens the viewer', () => {
  render(<CommunityNotes {...props} notes={[note({ id: 'p', photo_url: 'https://x/p.jpg', photo_caption: 'The jig' })] as never} />)
  fireEvent.press(screen.getByRole('imagebutton', { name: "Open Priya S's photo full screen" }))
  expect(screen.getByLabelText('The jig')).toBeTruthy()
})

it('rings the highlighted note and reports its row', () => {
  const onHighlightRow = jest.fn()
  render(<CommunityNotes {...props} notes={[note({ id: 'new', author_id: 'me' })] as never} highlightId="new" onHighlightRow={onHighlightRow} />)
  fireEvent(screen.getByTestId('note-row-new'), 'layout', { nativeEvent: { layout: { x: 0, y: 120, width: 300, height: 80 } } })
  expect(onHighlightRow).toHaveBeenCalled()
  expect(screen.getByTestId('note-row-new').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ borderWidth: 2 })]))
})
```

- [ ] **Step 2: Run to see it fail**

Run: `cd packages/mobile && pnpm test:unit -- tests/unit/components/guides/community-notes.test.tsx`
Expected: FAIL on the first test (no `feedback-filter-all`).

- [ ] **Step 3: Rewrite `community-notes.tsx`**

```tsx
// packages/mobile/components/guides/community-notes.tsx
//
// The guide's Feedback tab (spec 2026-10-07): a composer bar that opens the
// FeedbackSheet, filter chips, pinned notes as Fix cards, then one row per
// note with everything a viewer can do behind ⋯. Report targets the note.
import { useEffect, useRef, useState, type ComponentRef } from 'react'
import { View, Text, Image, Pressable, Modal, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import type { GuideNote, TutorialStep } from '@splat-connect/types'
import { initials } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { relativeTime } from '../../lib/notifications'
import { noteSummary, stepLabel } from '../../lib/guide-notes'
import { theme } from '../../lib/theme'
import { Chip } from '../ui/Chip'
import { Button } from '../ui/Button'
import { FlashLine, useFlash } from '../ui/Flash'
import { PhotoViewer } from '../ui/PhotoViewer'
import { ReportProblem } from '../reports/report-problem'
import { FeedbackSheet } from './feedback-sheet'

type Props = {
  tutorialId: string
  guideTitle: string
  authorName: string
  steps: TutorialStep[]
  notes: GuideNote[]
  reload: () => Promise<unknown>
  canPin: boolean
  viewerId: string | null
  viewerName: string | null
  highlightId?: string | null
  onHighlightRow?: (row: ComponentRef<typeof View>) => void
  onPosted?: (note: GuideNote) => void
}

type Filter = 'all' | 'fixes' | 'missing' | number

const isMissing = (n: GuideNote, count: number) => n.step_position == null || n.step_position > count

/** Opens the report sheet as soon as it mounts: the ⋯ menu has already closed. */
function AutoOpen({ open }: { open: () => void }) {
  useEffect(() => { open() }, [open])
  return null
}

export function CommunityNotes({ tutorialId, guideTitle, authorName, steps, notes, reload, canPin, viewerId, viewerName, highlightId, onHighlightRow, onPosted }: Props) {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>('all')
  const [composer, setComposer] = useState(false)
  const [menuFor, setMenuFor] = useState<GuideNote | null>(null)
  const [reportFor, setReportFor] = useState<{ note: GuideNote; n: number } | null>(null)
  const [viewing, setViewing] = useState<{ uri: string; caption: string | null } | null>(null)
  const [flash, setFlash] = useFlash()
  const [ringed, setRinged] = useState<string | null>(null)
  const summary = noteSummary(notes, steps.length)

  // The ring on a just-posted note fades after two seconds.
  useEffect(() => {
    if (!highlightId) return
    setRinged(highlightId)
    const t = setTimeout(() => setRinged(null), 2000)
    return () => clearTimeout(t)
  }, [highlightId])

  const stepsWithNotes = steps.filter((s) => notes.some((n) => n.step_position === s.position))
  const anyMissing = notes.some((n) => isMissing(n, steps.length))
  const shown = notes.filter((n) =>
    filter === 'all' ? true : filter === 'fixes' ? !!n.pinned_at : filter === 'missing' ? isMissing(n, steps.length) : n.step_position === filter
  )
  const fixes = shown.filter((n) => n.pinned_at)
  const rest = shown.filter((n) => !n.pinned_at)

  async function act(path: string, done: string, method: 'post' | 'delete' = 'post') {
    setMenuFor(null)
    try {
      if (method === 'post') await apiClient.post(path, {})
      else await apiClient.delete(path)
      setFlash(done)
      await reload()
    } catch {
      setFlash('That did not work. Try again.')
    }
  }

  const row = (n: GuideNote) => {
    const ring = ringed === n.id
    return (
      <View
        key={n.id}
        testID={`note-row-${n.id}`}
        ref={(r) => { if (r && n.id === highlightId) rowRefs.current.set(n.id, r) }}
        onLayout={() => { const r = rowRefs.current.get(n.id); if (r && n.id === highlightId) onHighlightRow?.(r) }}
        style={[styles.row, n.pinned_at && styles.fix, ring && styles.ring]}
      >
        {n.pinned_at ? (
          <View style={styles.fixHead}>
            <Ionicons name="pin" size={14} color={theme.colors.ink} />
            <Text style={styles.fixHeadText}>{`Fix · approved by ${(n.pinned_by_name ?? 'the author').split(' ')[0]}`}</Text>
            <MenuButton note={n} />
          </View>
        ) : null}
        <View style={styles.rowMain}>
          {n.pinned_at ? null : (
            <View style={styles.avatar}><Text style={styles.avatarText}>{initials(n.author_name, '?')}</Text></View>
          )}
          <View style={styles.rowBody}>
            {n.pinned_at ? null : (
              <View style={styles.top}>
                <Text style={styles.author}>{n.author_id === viewerId ? 'You' : n.author_name}</Text>
                <Text style={styles.when}>{relativeTime(n.created_at)}</Text>
                <MenuButton note={n} />
              </View>
            )}
            {n.pinned_at ? (
              <Text style={styles.body}><Text style={styles.strong}>{`${stepLabel(n, steps.length)}. `}</Text>{n.body}</Text>
            ) : (
              <>
                <View style={styles.stepTag}><Text style={styles.stepTagText}>{stepLabel(n, steps.length)}</Text></View>
                <Text style={styles.body}>{n.body}</Text>
              </>
            )}
            {n.pinned_at ? <Text style={styles.when}>{`${n.author_name} · ${relativeTime(n.created_at)}`}</Text> : null}
          </View>
          {n.photo_url ? (
            <Pressable onPress={() => setViewing({ uri: n.photo_url!, caption: n.photo_caption })} accessibilityRole="imagebutton" accessibilityLabel={`Open ${n.author_name}'s photo full screen`}>
              <Image source={{ uri: n.photo_url }} style={styles.thumb} accessibilityLabel={n.photo_caption ?? 'Photo with the note'} />
            </Pressable>
          ) : null}
        </View>
      </View>
    )
  }

  const rowRefs = useRef(new Map<string, ComponentRef<typeof View>>())

  function MenuButton({ note }: { note: GuideNote }) {
    return (
      <Pressable testID={`note-menu-${note.id}`} onPress={() => setMenuFor(note)} accessibilityRole="button" accessibilityLabel={`More on ${note.author_name}'s note`} hitSlop={8} style={styles.more}>
        <Ionicons name="ellipsis-horizontal" size={18} color={theme.colors.muted} />
      </Pressable>
    )
  }

  const mine = menuFor ? menuFor.author_id === viewerId : false

  return (
    <View style={styles.wrap}>
      {viewerId === null ? (
        <Pressable onPress={() => router.push('/sign-in')} accessibilityRole="button" style={styles.composer}>
          <Ionicons name="chatbubble-ellipses-outline" size={20} color={theme.colors.primaryDeep} />
          <Text style={styles.composerText}>Sign in to leave feedback</Text>
        </Pressable>
      ) : (
        <Pressable testID="feedback-composer" onPress={() => setComposer(true)} accessibilityRole="button" accessibilityLabel="Share a fix or a tip" style={styles.composer}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{initials(viewerName ?? '', '?')}</Text></View>
          <Text style={[styles.composerText, styles.flex]}>Share a fix or a tip…</Text>
          <Ionicons name="camera-outline" size={20} color={theme.colors.primaryDeep} />
        </Pressable>
      )}
      <FlashLine message={flash} />

      {notes.length ? (
        <View style={styles.chips}>
          <Chip label={`All ${notes.length}`} active={filter === 'all'} onPress={() => setFilter('all')} testID="feedback-filter-all" />
          {summary.pinned.length ? <Chip label={`Fixes ${summary.pinned.length}`} active={filter === 'fixes'} onPress={() => setFilter('fixes')} testID="feedback-filter-fixes" /> : null}
          {stepsWithNotes.map((s) => (
            <Chip key={s.id} label={`Step ${s.position}`} active={filter === s.position} onPress={() => setFilter(s.position)} testID={`feedback-filter-step-${s.position}`} />
          ))}
          {anyMissing ? <Chip label="Missing" active={filter === 'missing'} onPress={() => setFilter('missing')} testID="feedback-filter-missing" /> : null}
        </View>
      ) : (
        <Text style={styles.empty}>No feedback yet. Built it? Say how it went.</Text>
      )}

      {fixes.map(row)}
      {rest.map(row)}

      <FeedbackSheet
        tutorialId={tutorialId}
        steps={steps}
        authorFirstName={authorName.split(' ')[0] ?? 'The author'}
        open={composer}
        onClose={() => setComposer(false)}
        onPosted={(note) => { void reload(); onPosted?.(note) }}
      />

      <Modal visible={!!menuFor} transparent animationType="fade" onRequestClose={() => setMenuFor(null)}>
        <Pressable onPress={() => setMenuFor(null)} accessibilityRole="button" accessibilityLabel="Close" style={styles.backdrop} />
        <View testID="note-menu" style={styles.menu}>
          <View style={styles.grabber} />
          {menuFor ? <Text style={styles.menuTitle}>{`${menuFor.author_id === viewerId ? 'Your' : `${menuFor.author_name}'s`} note on ${stepLabel(menuFor, steps.length)}`}</Text> : null}
          {menuFor && canPin ? (
            <Pressable style={styles.menuRow} accessibilityRole="button" onPress={() => void act(`/api/tutorials/${tutorialId}/notes/${menuFor.id}/${menuFor.pinned_at ? 'unpin' : 'pin'}`, menuFor.pinned_at ? 'Unpinned' : 'Pinned as a fix — shows on its step in build mode')}>
              <Ionicons name="pin-outline" size={20} color={theme.colors.ink} />
              <Text style={styles.menuText}>{menuFor.pinned_at ? 'Unpin' : 'Pin as a fix'}</Text>
            </Pressable>
          ) : null}
          {menuFor && !mine ? (
            <Pressable style={styles.menuRow} accessibilityRole="button" onPress={() => { setReportFor({ note: menuFor, n: Date.now() }); setMenuFor(null) }}>
              <Ionicons name="flag-outline" size={20} color={theme.colors.ink} />
              <Text style={styles.menuText}>Report this note</Text>
            </Pressable>
          ) : null}
          {menuFor && mine ? (
            <Pressable style={styles.menuRow} accessibilityRole="button" onPress={() => void act(`/api/tutorials/${tutorialId}/notes/${menuFor.id}`, 'Note deleted', 'delete')}>
              <Ionicons name="trash-outline" size={20} color={theme.colors.danger} />
              <Text style={[styles.menuText, styles.danger]}>Delete</Text>
            </Pressable>
          ) : null}
          <Button label="Cancel" variant="secondary" onPress={() => setMenuFor(null)} />
        </View>
      </Modal>

      {reportFor ? (
        <ReportProblem
          key={reportFor.n}
          subjectKind="note"
          subjectId={reportFor.note.id}
          subjectLabel={`${reportFor.note.author_name}'s note on ${guideTitle}`}
          trigger={(open) => <AutoOpen open={open} />}
        />
      ) : null}

      <PhotoViewer photos={viewing ? [viewing] : []} index={viewing ? 0 : null} onClose={() => setViewing(null)} />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: theme.spacing(3), paddingTop: theme.spacing(3) },
  flex: { flex: 1 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), paddingHorizontal: theme.spacing(3), paddingVertical: theme.spacing(2), borderRadius: theme.radii.pill, borderWidth: theme.border.hairline, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, ...theme.shadow(1) },
  composerText: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.label, color: theme.colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing(2) },
  empty: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted },
  row: { paddingVertical: theme.spacing(3), borderTopWidth: theme.border.hairline, borderTopColor: theme.colors.border, gap: theme.spacing(2) },
  fix: { borderTopWidth: 0, borderRadius: theme.radii.panel, backgroundColor: theme.colors.honeySoft, paddingHorizontal: theme.spacing(4) },
  ring: { borderWidth: 2, borderColor: theme.colors.primary, borderRadius: theme.radii.panel, backgroundColor: theme.colors.accentFaint, paddingHorizontal: theme.spacing(3) },
  fixHead: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) },
  fixHeadText: { flex: 1, fontFamily: theme.fonts.black, fontSize: theme.type.caption, color: theme.colors.ink },
  rowMain: { flexDirection: 'row', gap: theme.spacing(3), alignItems: 'flex-start' },
  rowBody: { flex: 1, gap: theme.spacing(1) },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.mintSoft },
  avatarText: { fontFamily: theme.fonts.black, fontSize: theme.type.micro, color: theme.colors.ink },
  top: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2) },
  author: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.ink },
  when: { flex: 1, fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption, color: theme.colors.muted },
  more: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  stepTag: { alignSelf: 'flex-start', paddingHorizontal: theme.spacing(2), paddingVertical: 2, borderRadius: theme.radii.pill, backgroundColor: theme.colors.accentLight },
  stepTagText: { fontFamily: theme.fonts.black, fontSize: theme.type.micro, color: theme.colors.primaryDeep },
  body: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.text, lineHeight: 20 },
  strong: { fontFamily: theme.fonts.black },
  thumb: { width: 64, height: 64, borderRadius: theme.radii.field, backgroundColor: theme.colors.surfaceSunken },
  backdrop: { flex: 1, backgroundColor: theme.colors.scrim },
  menu: { backgroundColor: theme.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: theme.spacing(4), paddingBottom: theme.spacing(6), gap: theme.spacing(2) },
  grabber: { width: 40, height: 5, borderRadius: 3, backgroundColor: theme.colors.border, alignSelf: 'center' },
  menuTitle: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption, color: theme.colors.muted },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), minHeight: 48, borderTopWidth: theme.border.hairline, borderTopColor: theme.colors.border },
  menuText: { fontFamily: theme.fonts.bold, fontSize: theme.type.body, color: theme.colors.ink },
  danger: { color: theme.colors.danger },
})
```
Notes for the implementer: `rowRefs` must be declared before `row` is called (move the `useRef` above `row`); `Chip` needs a `testID` prop passthrough if it has none — add `testID?: string` to `Chip` and pass it to its `AnimatedPressable` (one line, covered by this task's tests). The old `Section` wrapper is gone; `DetailScreen` renders the tab under its sticky tabs, so no title is needed.

- [ ] **Step 4: Run the new test file; then update the edges file**

Run: `cd packages/mobile && pnpm test:unit -- tests/unit/components/guides/community-notes.test.tsx`
Expected: PASS (11 tests).

Then in `community-notes-edges.test.tsx`: delete the cases that assert `Community notes N`, `Add a note`, the inline chips, `Pin as revision`, `Report a problem` and the `Not part of any step above` hint (that copy now lives in the sheet or is gone); keep and adapt the data edge cases (200 notes renders, unicode author/body, a note with no `pinned_by_name` reads `approved by the author`, past-the-end positions). Add `viewerName: 'Me'` to its `props`. Run: `pnpm test:unit -- tests/unit/components/guides/community-notes-edges.test.tsx` → PASS.

- [ ] **Step 5: Typecheck, then commit**

Run: `cd packages/mobile && pnpm typecheck`
```bash
git add packages/mobile/components/guides/community-notes.tsx packages/mobile/components/ui/Chip.tsx packages/mobile/tests/unit/components/guides
git commit -m "feat(mobile): the Feedback tab is a comment list with filters, fix cards and a per-note menu; reports target the note"
```

---

### Task 7: DetailScreen wires the Feedback tab, the highlight and the focus hand-off

**Files:**
- Modify: `packages/mobile/components/home/detail-screen.tsx` (hooks near line 148–163, the `CommunityNotes` call near line 605)
- Modify: `packages/mobile/tests/unit/components/home/detail-screen.test.tsx`

**Interfaces:**
- Consumes: `takeGuideFocus` (Task 4), `CommunityNotes` props (Task 6), `useToast`.
- Produces: on focus with a pending `GuideFocus` for this guide: `reload()`, `setTab('notes')`, `setHighlightId(noteId)`, toast `Your feedback is on the guide` when `noteId` is set. `onHighlightRow(row)` measures the row against the ScrollView's inner node and scrolls so it sits 72 px under the top.

- [ ] **Step 1: Write the failing tests**

Append to `detail-screen.test.tsx`. Add at the top with the other mocks:
```tsx
jest.mock('../../../../lib/guide-focus', () => {
  const actual = jest.requireActual('../../../../lib/guide-focus')
  return { ...actual, takeGuideFocus: jest.fn(actual.takeGuideFocus) }
})
import { setGuideFocus, takeGuideFocus } from '../../../../lib/guide-focus'
```
Tests:
```tsx
  describe('Feedback hand-off', () => {
    const NOTE = { id: 'new', step_position: 1, author_id: 'me', author_name: 'You', body: 'Posted from build mode.', photo_url: null, photo_caption: null, pinned_at: null, pinned_by: null, pinned_by_name: null, created_at: '2026-10-07T00:00:00Z' }

    it('on refocus with a pending focus it opens Feedback, reloads and rings the note', async () => {
      render(<DetailScreen id="1" />)
      await screen.findByText('Build a Robot Arm')
      ;(apiClient.get as jest.Mock).mockImplementation((p: string) => (p.endsWith('/notes') ? Promise.resolve([NOTE]) : p === '/api/saves/ids' ? Promise.resolve(NO_SAVES) : p === '/api/child-profiles' ? Promise.resolve([]) : Promise.resolve(DETAIL)))
      setGuideFocus({ tutorialId: '1', noteId: 'new' })
      act(() => { mockFocus.forEach((cb) => cb()) })
      expect(takeGuideFocus).toHaveBeenCalledWith('1')
      expect(screen.getByRole('tab', { name: /^Feedback/, selected: true })).toBeTruthy()
      expect(await screen.findByText('Posted from build mode.')).toBeTruthy()
      expect(screen.getByTestId('note-row-new').props.style).toEqual(expect.arrayContaining([expect.objectContaining({ borderWidth: 2 })]))
      expect(screen.getByText('Your feedback is on the guide')).toBeTruthy()
    })

    it('a focus with no note opens Feedback without a toast', async () => {
      render(<DetailScreen id="1" />)
      await screen.findByText('Build a Robot Arm')
      setGuideFocus({ tutorialId: '1', noteId: null })
      act(() => { mockFocus.forEach((cb) => cb()) })
      expect(screen.getByRole('tab', { name: /^Feedback/, selected: true })).toBeTruthy()
      expect(screen.queryByText('Your feedback is on the guide')).toBeNull()
    })

    it('a focus for another guide is left alone', async () => {
      render(<DetailScreen id="1" />)
      await screen.findByText('Build a Robot Arm')
      setGuideFocus({ tutorialId: 'other', noteId: 'x' })
      act(() => { mockFocus.forEach((cb) => cb()) })
      expect(screen.getByRole('tab', { name: 'Overview', selected: true })).toBeTruthy()
      expect(takeGuideFocus('other')).toEqual({ tutorialId: 'other', noteId: 'x' })
    })

    it('a post from the Feedback tab rings the new note too', async () => {
      ;(apiClient.post as jest.Mock).mockResolvedValue(NOTE)
      render(<DetailScreen id="1" />)
      await screen.findByText('Build a Robot Arm')
      tab('Feedback')
      ;(apiClient.get as jest.Mock).mockImplementation((p: string) => (p.endsWith('/notes') ? Promise.resolve([NOTE]) : p === '/api/saves/ids' ? Promise.resolve(NO_SAVES) : p === '/api/child-profiles' ? Promise.resolve([]) : Promise.resolve(DETAIL)))
      fireEvent.press(screen.getByTestId('feedback-composer'))
      fireEvent.press(screen.getByText('Missing step'))
      fireEvent.changeText(screen.getByLabelText('Your note'), 'Posted from build mode.')
      fireEvent.press(screen.getByRole('button', { name: 'Post' }))
      await screen.findByText('Feedback posted')
      fireEvent.press(screen.getByRole('button', { name: 'See it on the guide' }))
      expect(await screen.findByTestId('note-row-new')).toBeTruthy()
      expect(screen.getByText('Your feedback is on the guide')).toBeTruthy()
    })
  })
```
`capabilities` mock in this file returns `{ profile: { id: 'me' } }`; add `name: 'Me'` to it so `viewerName` is defined.

- [ ] **Step 2: Run to see them fail**

Run: `cd packages/mobile && pnpm test:unit -- tests/unit/components/home/detail-screen.test.tsx -t "Feedback hand-off"`
Expected: FAIL — tab not selected / toast missing.

- [ ] **Step 3: Implement**

In `detail-screen.tsx`:
- import `{ takeGuideFocus } from '../../lib/guide-focus'` and `type { ComponentRef } from 'react'`.
- state: `const [highlightId, setHighlightId] = useState<string | null>(null)`.
- replace the `useFocusEffect` body:
```tsx
  useFocusEffect(
    useCallback(() => {
      reread()
      const focus = takeGuideFocus(id)
      if (focus) {
        void reload()
        setTab('notes')
        setHighlightId(focus.noteId)
        if (focus.noteId) toaster.show('Your feedback is on the guide')
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id])
  )
```
- scroll-to-row:
```tsx
  const scrollToRow = (row: ComponentRef<typeof View>) => {
    const inner = (scroller.current as unknown as { getInnerViewNode?: () => unknown } | null)?.getInnerViewNode?.()
    if (!inner) return
    // ponytail: measureLayout against the inner node; if RN drops getInnerViewNode, sum onLayout offsets instead.
    ;(row as unknown as { measureLayout: (n: unknown, ok: (x: number, y: number) => void, fail: () => void) => void }).measureLayout(
      inner,
      (_x, y) => scroller.current?.scrollTo({ y: Math.max(0, y - 72), animated: true }),
      () => {}
    )
  }
```
- the `CommunityNotes` call:
```tsx
            <CommunityNotes
              tutorialId={tutorial.id}
              guideTitle={tutorial.title}
              authorName={primary?.profiles.name ?? 'The author'}
              steps={steps}
              notes={notes}
              reload={reload}
              canPin={!!thanks?.own || !!caps?.isAdmin}
              viewerId={caps?.profile.id ?? null}
              viewerName={caps?.profile.name ?? null}
              highlightId={highlightId}
              onHighlightRow={scrollToRow}
              onPosted={(note) => { setHighlightId(note.id); toaster.show('Your feedback is on the guide') }}
            />
```
- `summary.extras` copy (line 441): `+ N steps added by builders, in Feedback.`; the "Read the fix" link already calls `openTab('notes')`.

- [ ] **Step 4: Run the whole detail-screen suite**

Run: `cd packages/mobile && pnpm test:unit -- tests/unit/components/home/detail-screen`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/mobile/components/home/detail-screen.tsx packages/mobile/tests/unit/components/home/detail-screen.test.tsx
git commit -m "feat(mobile): the guide page opens on Feedback with a just-posted note in view, from build mode or its own composer"
```

---

### Task 8: Build mode: Leave feedback

**Files:**
- Modify: `packages/mobile/components/guides/build-mode.tsx:31-44, 54-66, 87-88, 255-272, 305-310`
- Modify: `packages/mobile/tests/unit/components/guides/build-mode.test.tsx`

**Interfaces:**
- Consumes: `FeedbackSheet` (Task 5), `setGuideFocus` (Task 4).
- Produces: done-screen button `Leave feedback`; the two in-step links to the guide's feedback set `{ tutorialId: id, noteId: null }` and `router.back()`; `toNotes`/`router.replace` removed.

- [ ] **Step 1: Write the failing tests**

In `build-mode.test.tsx` add mocks near the top:
```tsx
const mockSetFocus = jest.fn()
jest.mock('../../../../lib/guide-focus', () => ({ setGuideFocus: (...a: unknown[]) => mockSetFocus(...a) }))
```
Add `tutorial_contributors: [{ profile_id: 'c1', role: 'primary', profiles: { name: 'Mei Tan' } }]` to `GUIDE`. Append tests (reuse this file's existing helpers for loading the guide and reaching the done screen; it already has a test that finishes every step — copy its arrival steps):
```tsx
it('the done screen offers Leave feedback, which opens the sheet on the last step viewed', async () => {
  // …load GUIDE, press Start step 1, Next, Done as the existing completion test does…
  fireEvent.press(screen.getByRole('button', { name: 'Leave feedback' }))
  expect(screen.getByText('How did it go?')).toBeTruthy()
  expect(screen.getByText('Mei can pin it as a fix so the next builder sees it.')).toBeTruthy()
  // Step 2 was the last step on screen, so Post needs only a body.
  fireEvent.changeText(screen.getByLabelText('Your note'), 'Great.')
  expect(screen.getByRole('button', { name: 'Post' }).props.accessibilityState?.disabled).toBeFalsy()
  expect(mockReplace).not.toHaveBeenCalled()
})

it('See it on the guide hands the note to the guide and closes build mode', async () => {
  ;(apiClient.post as jest.Mock).mockResolvedValue({ id: 'n9', step_position: 2, author_id: 'me', author_name: 'You', body: 'Great.', photo_url: null, photo_caption: null, pinned_at: null, pinned_by: null, pinned_by_name: null, created_at: '2026-10-07T00:00:00Z' })
  // …reach the done screen…
  fireEvent.press(screen.getByRole('button', { name: 'Leave feedback' }))
  fireEvent.changeText(screen.getByLabelText('Your note'), 'Great.')
  fireEvent.press(screen.getByRole('button', { name: 'Post' }))
  await screen.findByText('Feedback posted')
  fireEvent.press(screen.getByRole('button', { name: 'See it on the guide' }))
  expect(mockSetFocus).toHaveBeenCalledWith({ tutorialId: 'g', noteId: 'n9' })
  expect(mockBack).toHaveBeenCalled()
})

it('a failed post keeps build mode where it is', async () => {
  ;(apiClient.post as jest.Mock).mockRejectedValue(new Error('API POST failed with status 401'))
  // …reach the done screen…
  fireEvent.press(screen.getByRole('button', { name: 'Leave feedback' }))
  fireEvent.changeText(screen.getByLabelText('Your note'), 'Great.')
  fireEvent.press(screen.getByRole('button', { name: 'Post' }))
  expect(await screen.findByText(/status 401|Could not post/)).toBeTruthy()
  expect(mockSetFocus).not.toHaveBeenCalled()
  expect(mockBack).not.toHaveBeenCalled()
})

it('the notes link on a step opens the guide’s Feedback tab by hand-off, not a second copy', async () => {
  // …load GUIDE with notes containing one unpinned note on step 1, reach Step 1…
  fireEvent.press(screen.getByText("1 note on this step in the guide's Feedback"))
  expect(mockSetFocus).toHaveBeenCalledWith({ tutorialId: 'g', noteId: null })
  expect(mockBack).toHaveBeenCalled()
  expect(mockReplace).not.toHaveBeenCalled()
})
```
Where the comment says "reach the done screen", repeat the exact presses from the existing completion test in this file (do not factor a helper unless one exists).

- [ ] **Step 2: Run to see them fail**

Run: `cd packages/mobile && pnpm test:unit -- tests/unit/components/guides/build-mode.test.tsx`
Expected: FAIL — `Leave feedback` not found.

- [ ] **Step 3: Implement**

In `build-mode.tsx`:
- `BuildGuide` gains `tutorial_contributors?: { profiles: { name: string } }[]`.
- imports: `FeedbackSheet` from `./feedback-sheet`, `setGuideFocus` from `../../lib/guide-focus`.
- state: `const [feedbackOpen, setFeedbackOpen] = useState(false)` and `const lastStep = useRef<number | null>(null)`; after `step` is computed is too late for a hook, so put `useEffect(() => { if (at && at >= 1 && at <= (guide?.steps?.length ?? 0)) lastStep.current = at }, [at, guide])` with the other effects.
- replace `const toNotes = …` with:
```tsx
  const toFeedback = () => { setGuideFocus({ tutorialId: id, noteId: null }); router.back() }
```
and use `toFeedback` where `toNotes` was. Copy: `` `${plural(onStep - pinned.length, 'more note')} in the guide's Feedback` `` and `` `${plural(onStep, 'note')} on this step in the guide's Feedback` ``.
- done screen: `<Button label="Leave feedback" variant="secondary" onPress={() => setFeedbackOpen(true)} style={styles.flex} />`.
- before the closing `</View>` of the screen:
```tsx
      <FeedbackSheet
        tutorialId={id}
        steps={steps}
        authorFirstName={guide.tutorial_contributors?.[0]?.profiles.name.split(' ')[0] ?? 'The author'}
        initialStep={lastStep.current ?? undefined}
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        onPosted={() => {}}
        onSeeOnGuide={(note) => { setFeedbackOpen(false); setGuideFocus({ tutorialId: id, noteId: note.id }); router.back() }}
      />
```

- [ ] **Step 4: Run the build-mode tests**

Run: `cd packages/mobile && pnpm test:unit -- tests/unit/components/guides/build-mode.test.tsx`
Expected: PASS (existing tests may assert `Notes from builders` and the old link copy — update those strings).

- [ ] **Step 5: Commit**

```bash
git add packages/mobile/components/guides/build-mode.tsx packages/mobile/tests/unit/components/guides/build-mode.test.tsx
git commit -m "feat(mobile): Leave feedback at the end of a build opens the sheet, then lands on the guide with the note in view"
```

---

### Task 9: Files tab, PDF viewer wording, bottom bar

**Files:**
- Modify: `packages/mobile/components/home/detail-screen.tsx` (Files tab block, lines ~553–603; action bar line ~635)
- Modify: `packages/mobile/components/home/preview-screen.tsx`
- Modify: `packages/mobile/app/(tabs)/guides/[id]/preview.tsx` and `_layout.tsx:49` (title `Full guide`)
- Modify: `packages/mobile/tests/unit/components/home/preview-screen.test.tsx`
- Modify: `packages/mobile/tests/unit/components/home/detail-screen.test.tsx`
- Modify: `packages/mobile/tests/e2e/guides-pdf.spec.ts`, `guides-detail.spec.ts:27-36, 88-91`, `guides-reader-journeys.spec.ts:46-51`

**Interfaces:**
- Consumes: `stlName`, `webGuideUrl` (Task 4).
- Produces: `PreviewScreen({ pdfUrl, tutorialId })`; the preview route passes `tutorialId` from params (`id`). Files tab testIDs: `file-row-pdf`, `file-row-<stl id>`, `files-web-link`, `print-card`. The 3D pill pushes `{ pathname: '/guides/[id]/model', params: { id, file } }` (route built in Task 10; the push is wired here).

- [ ] **Step 1: Write the failing tests**

`preview-screen.test.tsx` — replace the `opens the pdf in the system browser` and `offers no Open in browser` cases with:
```tsx
  it('the footer opens the guide on the website, never the file', () => {
    process.env.EXPO_PUBLIC_WEB_URL = 'https://splat.example'
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
    render(<PreviewScreen pdfUrl="https://example.com/robot-arm.pdf" tutorialId="abc" />)
    expect(screen.queryByText('Open in browser')).toBeNull()
    fireEvent.press(screen.getByRole('button', { name: 'Download on the web' }))
    expect(open).toHaveBeenCalledWith('https://splat.example/tutorials/abc')
  })

  it('hides the web footer when no web address is configured', () => {
    delete process.env.EXPO_PUBLIC_WEB_URL
    render(<PreviewScreen pdfUrl="https://example.com/robot-arm.pdf" tutorialId="abc" />)
    expect(screen.queryByText('Download on the web')).toBeNull()
  })
```
Update the other cases to pass `tutorialId="abc"`.

`detail-screen.test.tsx` — rename `fireEvent.press(screen.getByText('Download PDF'))` in the two signing tests to `fireEvent.press(screen.getByRole('button', { name: 'View' }))` after `tab('Files')`, and add:
```tsx
  describe('Files tab', () => {
    const STL = [{ id: 'f1', tutorial_id: '1', filename: 'lts_base.stl', file_url: '1/lts_base.stl', print_minutes: 55, filament_grams: 14, material: 'PLA' }, { id: 'f2', tutorial_id: '1', filename: 'lts_cap.stl', file_url: '1/lts_cap.stl', print_minutes: null, filament_grams: null, material: null }]

    it('lists the PDF and each STL with a single View or 3D pill, and links to the web for downloads', async () => {
      process.env.EXPO_PUBLIC_WEB_URL = 'https://splat.example'
      mockEndpoints({ detail: Promise.resolve({ ...DETAIL, stl_files: STL }) })
      render(<DetailScreen id="1" />)
      await screen.findByText('Build a Robot Arm')
      tab('Files')
      expect(screen.getByText('Full guide')).toBeTruthy()
      expect(screen.getByRole('button', { name: 'View' })).toBeTruthy()
      expect(screen.getByText('Lts base')).toBeTruthy()
      expect(screen.getByText('55 min · 14 g')).toBeTruthy()
      expect(screen.getByText('Lts cap')).toBeTruthy()
      expect(screen.getAllByRole('button', { name: /^3D/ })).toHaveLength(2)
      expect(screen.queryByText(/Download PDF|Open in browser/)).toBeNull()
      const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
      fireEvent.press(screen.getByTestId('files-web-link'))
      expect(open).toHaveBeenCalledWith('https://splat.example/tutorials/1')
    })

    it('a 3D pill opens the model route for that file', async () => {
      mockEndpoints({ detail: Promise.resolve({ ...DETAIL, stl_files: STL }) })
      render(<DetailScreen id="1" />)
      await screen.findByText('Build a Robot Arm')
      tab('Files')
      fireEvent.press(screen.getAllByRole('button', { name: /^3D/ })[0]!)
      expect(mockPush).toHaveBeenCalledWith({ pathname: '/guides/[id]/model', params: { id: '1', file: 'f1' } })
    })

    it('hides the web link when no web address is configured', async () => {
      delete process.env.EXPO_PUBLIC_WEB_URL
      mockEndpoints({ detail: Promise.resolve({ ...DETAIL, stl_files: STL }) })
      render(<DetailScreen id="1" />)
      await screen.findByText('Build a Robot Arm')
      tab('Files')
      expect(screen.queryByTestId('files-web-link')).toBeNull()
    })

    it('orders Ask someone to print above Print settings', async () => {
      mockEndpoints({ detail: Promise.resolve({ ...DETAIL, stl_files: STL, layer_height_mm: 0.2 }) })
      render(<DetailScreen id="1" />)
      await screen.findByText('Build a Robot Arm')
      tab('Files')
      const json = JSON.stringify(screen.toJSON())
      expect(json.indexOf('Ask someone to print')).toBeLessThan(json.indexOf('Print settings'))
    })

    it('a guide with no steps makes View full guide the bottom action', async () => {
      mockEndpoints({ detail: Promise.resolve({ ...DETAIL, steps: [] }) })
      render(<DetailScreen id="1" />)
      await screen.findByText('Build a Robot Arm')
      expect(screen.getByRole('button', { name: 'View full guide' })).toBeTruthy()
      expect(screen.queryByText('Download PDF')).toBeNull()
    })
  })
```
Import `Linking` from `react-native` at the top of the test file.

- [ ] **Step 2: Run to see them fail**

Run: `cd packages/mobile && pnpm test:unit -- tests/unit/components/home`
Expected: FAIL on the new cases.

- [ ] **Step 3: Implement the Files tab**

In `detail-screen.tsx` import `{ stlName, webGuideUrl } from '../../lib/guide-files'` and replace the `tab === 'files'` block with:
```tsx
          ) : tab === 'files' ? (
            <View style={styles.stack}>
              {tutorial.tutorial_pdf_url || tutorial.stl_files.length ? (
                <View style={styles.card}>
                  <Text style={styles.cardHead}>Guide files</Text>
                  {tutorial.tutorial_pdf_url ? (
                    <View testID="file-row-pdf" style={styles.fileRow}>
                      <View style={styles.needIcon}><Ionicons name="document-text-outline" size={18} color={theme.colors.primaryDeep} /></View>
                      <View style={styles.flex}>
                        <Text style={styles.fileName}>Full guide</Text>
                        <Text style={styles.fileSub}>PDF · read on screen</Text>
                      </View>
                      <Pressable onPress={openPreview} accessibilityRole="button" accessibilityLabel="View" style={styles.filePill}>
                        <Ionicons name="eye-outline" size={14} color={theme.colors.primaryDeep} />
                        <Text style={styles.filePillText}>View</Text>
                      </Pressable>
                    </View>
                  ) : null}
                  {tutorial.stl_files.map((f) => {
                    const sub = [f.print_minutes ? `${f.print_minutes} min` : '', f.filament_grams ? `${f.filament_grams} g` : ''].filter(Boolean).join(' · ')
                    return (
                      <View key={f.id} testID={`file-row-${f.id}`} style={styles.fileRow}>
                        <View style={styles.needIcon}><Ionicons name="cube-outline" size={18} color={theme.colors.primaryDeep} /></View>
                        <View style={styles.flex}>
                          <Text style={styles.fileName} numberOfLines={1}>{stlName(f.filename)}</Text>
                          <Text style={styles.fileSub} numberOfLines={1}>{sub || f.filename}</Text>
                        </View>
                        <Pressable
                          onPress={() => router.push({ pathname: '/guides/[id]/model', params: { id: tutorial.id, file: f.id } })}
                          accessibilityRole="button"
                          accessibilityLabel={`3D view of ${stlName(f.filename)}`}
                          style={styles.filePill}
                        >
                          <Ionicons name="sync-outline" size={14} color={theme.colors.primaryDeep} />
                          <Text style={styles.filePillText}>3D</Text>
                        </Pressable>
                      </View>
                    )
                  })}
                  {webGuideUrl(tutorial.id) ? (
                    <Pressable testID="files-web-link" onPress={() => void Linking.openURL(webGuideUrl(tutorial.id)!)} accessibilityRole="link" style={styles.webLink}>
                      <Ionicons name="globe-outline" size={16} color={theme.colors.primaryDeep} />
                      <Text style={[styles.webLinkText, styles.flex]}>
                        Printing it yourself? <Text style={styles.webLinkStrong}>Download the files on the web</Text>
                      </Text>
                      <Ionicons name="open-outline" size={16} color={theme.colors.primaryDeep} />
                    </Pressable>
                  ) : null}
                </View>
              ) : (
                <Text style={styles.small}>Nothing to download for this guide.</Text>
              )}
              {tutorial.stl_files.length > 0 ? (
                <AnimatedPressable
                  testID="print-card"
                  onPress={() => router.push({ pathname: '/printing', params: printWith ? { guide: tutorial.id, printWith } : { guide: tutorial.id } })}
                  accessibilityRole="button"
                  accessibilityLabel="Ask someone to print"
                  accessibilityHint="Pick up to three printers nearby"
                  pressScale={0.985}
                  style={[styles.printCardFilled, styles.flush, highlight === 'print' && styles.printRing]}
                >
                  <View style={styles.printHeader}>
                    <Text style={styles.printTitleOn}>Ask someone to print</Text>
                    <Ionicons name="chevron-forward" size={16} color={theme.colors.onColor} />
                  </View>
                  <Text style={styles.printHintOn}>
                    {tutorial.stl_files.length} printable part{tutorial.stl_files.length === 1 ? '' : 's'} · pick up to three printers nearby
                  </Text>
                </AnimatedPressable>
              ) : null}
              {settings.length ? (
                <View style={styles.card}>
                  <Text style={styles.cardHead}>Print settings</Text>
                  <View style={[styles.settings, styles.settingsPad]}>
                    {settings.map((r) => (
                      <View key={r.k} style={styles.setting}>
                        <Text style={styles.settingKey}>{r.k}</Text>
                        <Text style={styles.settingValue}>{r.v}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          ) : (
```
Styles to add (reuse `card`, `needIcon`, `printHeader`, `settings`, `setting*` from the file):
```ts
  cardHead: { fontFamily: theme.fonts.black, fontSize: theme.type.body, color: theme.colors.ink, paddingHorizontal: theme.spacing(4), paddingTop: theme.spacing(4), paddingBottom: theme.spacing(2) },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), paddingHorizontal: theme.spacing(4), paddingVertical: theme.spacing(3), borderTopWidth: theme.border.hairline, borderTopColor: theme.colors.border },
  fileName: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.ink },
  fileSub: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted },
  filePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: theme.spacing(3), paddingVertical: 6, borderRadius: theme.radii.pill, backgroundColor: theme.colors.accentLight },
  filePillText: { fontFamily: theme.fonts.black, fontSize: theme.type.caption, color: theme.colors.primaryDeep },
  webLink: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2), paddingHorizontal: theme.spacing(4), paddingVertical: theme.spacing(3), borderTopWidth: theme.border.hairline, borderTopColor: theme.colors.border, backgroundColor: theme.colors.surfaceSunken },
  webLinkText: { fontFamily: theme.fonts.semiBold, fontSize: theme.type.caption, color: theme.colors.muted, lineHeight: 18 },
  webLinkStrong: { fontFamily: theme.fonts.black, color: theme.colors.primaryDeep },
  printCardFilled: { borderRadius: theme.radii.panel, backgroundColor: theme.colors.primary, padding: theme.spacing(5), ...theme.shadow(2) },
  printTitleOn: { fontFamily: theme.fonts.black, fontSize: theme.type.body, color: theme.colors.onColor },
  printHintOn: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.onColor, marginTop: theme.spacing(1) },
  settingsPad: { paddingHorizontal: theme.spacing(4), paddingBottom: theme.spacing(4) },
```
Remove the old `fileRow`/`fileName` definitions (replaced above) and the old `Section`-based PDF block. The Overview's "Can't build it? Ask a maker nearby" card keeps `styles.printCard` as today.

Action bar (line ~635): `<Button label="View full guide" onPress={openPreview} style={styles.primaryAction} />`.

- [ ] **Step 4: Implement the PDF viewer change**

`preview-screen.tsx`: props `{ pdfUrl: string | null; tutorialId: string }`; import `webGuideUrl`; footer:
```tsx
      {webGuideUrl(tutorialId) ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, theme.spacing(3)) }]}>
          <Button label="Download on the web" variant="secondary" onPress={() => void Linking.openURL(webGuideUrl(tutorialId)!)} style={styles.open} />
        </View>
      ) : null}
```
Header comment: replace the "Open in browser" sentence with "Downloads live on the website; the footer links to the guide's page there."

`app/(tabs)/guides/[id]/preview.tsx`:
```tsx
export default function TutorialPreviewRoute() {
  const { id, pdfUrl } = useLocalSearchParams<{ id: string; pdfUrl?: string }>()
  return <PreviewScreen pdfUrl={pdfUrl || null} tutorialId={id} />
}
```
`_layout.tsx` line 49: `options={{ title: 'Full guide' }}`.

- [ ] **Step 5: Run the unit tests**

Run: `cd packages/mobile && pnpm test:unit -- tests/unit/components/home && pnpm typecheck`
Expected: PASS, no type errors.

- [ ] **Step 6: Update the e2e specs**

`guides-pdf.spec.ts` — rewrite the test:
```ts
test('Files > View opens the full guide, whose footer links to the guide on the website', async ({ page }) => {
  await signInAsNewContributor(page)
  const author = await createContributor()
  const id = await createTutorial(author.id, { title: uniqueTitle('E2E PDF Guide') })
  await addSteps(id, [{ body: 'Only step.' }])

  await page.goto(`/guides/${id}`)
  await page.getByRole('tab', { name: 'Files' }).click()
  await expect(page.getByText('Full guide')).toBeVisible()
  await expect(page.getByText(/Download PDF/)).toHaveCount(0)
  await page.getByRole('button', { name: 'View', exact: true }).click()

  await expect(page.getByText('No PDF is available for this tutorial yet.')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Open in browser' })).toHaveCount(0)
  await page.evaluate(() => {
    const w = window as unknown as { opened: string[] }
    w.opened = []
    window.open = (u?: string | URL) => (w.opened.push(String(u)), null)
  })
  await page.getByRole('button', { name: 'Download on the web', exact: true }).click()
  const opened = await page.evaluate(() => (window as unknown as { opened: string[] }).opened)
  expect(opened).toHaveLength(1)
  expect(opened[0]).toMatch(new RegExp(`/tutorials/${id}$`))
  expect(opened[0]).not.toContain('/storage/v1/')
})
```
`guides-detail.spec.ts` lines 27–36 and 88–91: `getByText('Download PDF')` → `getByRole('tab', { name: 'Files' }).click()` then `getByRole('button', { name: 'View', exact: true })`; `Open in browser` expectations → `Download on the web`. For the no-PDF case (line 88–91) keep asserting the empty message and that there is no `View` pill.
`guides-reader-journeys.spec.ts` line 46–51: `'Download PDF'` → `'View full guide'`.

- [ ] **Step 7: Commit**

```bash
git add packages/mobile/components/home packages/mobile/app/\(tabs\)/guides packages/mobile/tests
git commit -m "feat(mobile): the Files tab views the PDF and parts in the app and sends downloads to the web"
```

---

### Task 10: The 3D viewer (generated page, model screen, route)

**Files:**
- Create: `packages/mobile/assets/stl-viewer/index.html`
- Create: `packages/mobile/scripts/build-stl-viewer.mjs`
- Create: `packages/mobile/lib/stl-viewer-html.ts` (generated, committed)
- Create: `packages/mobile/tests/unit/lib/stl-viewer-html.test.ts`
- Create: `packages/mobile/components/guides/model-screen.tsx`
- Create: `packages/mobile/app/(tabs)/guides/[id]/model.tsx`
- Modify: `packages/mobile/app/(tabs)/guides/_layout.tsx` (add the route)
- Modify: `packages/mobile/package.json` (devDependency `three@0.128.0`, script `build:stl-viewer`)
- Create: `packages/mobile/tests/unit/components/guides/model-screen.test.tsx`

**Interfaces:**
- Consumes: `supabase.storage.from('stl-files').createSignedUrl(path, 60)`, `apiClient.get('/api/public/tutorials/:id')`, `STL_PREVIEW_MAX_BYTES`, `stlName`.
- Produces: `STL_VIEWER_HTML: string`; `ModelScreen({ id, file }: { id: string; file: string })`. Page ↔ app protocol: app → page `window.__load(url, maxBytes)`; page → app `postMessage(JSON.stringify({ type: 'ready' | 'loaded' | 'toobig' | 'error', message?: string }))`.

- [ ] **Step 1: Add three as a dev dependency and write the page**

Run: `cd packages/mobile && pnpm add -D three@0.128.0`

`assets/stl-viewer/index.html`:
```html
<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  html, body { margin: 0; height: 100%; background: transparent; overflow: hidden; touch-action: none; }
  canvas { display: block; }
</style>
<body>
<script>/*THREE*/</script>
<script>/*STLLOADER*/</script>
<script>/*ORBIT*/</script>
<script>
(function () {
  var RN = window.ReactNativeWebView
  var send = function (m) { if (RN) RN.postMessage(JSON.stringify(m)) }
  var renderer, scene, camera, controls, mesh
  function setup() {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(window.innerWidth, window.innerHeight)
    document.body.appendChild(renderer.domElement)
    scene = new THREE.Scene()
    camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 10000)
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 0.9))
    var key = new THREE.DirectionalLight(0xffffff, 0.8); key.position.set(1, 2, 1.5); scene.add(key)
    controls = new THREE.OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true; controls.enablePan = false
    controls.autoRotate = true; controls.autoRotateSpeed = 1.6
    renderer.domElement.addEventListener('pointerdown', function () { controls.autoRotate = false })
    window.addEventListener('resize', function () {
      camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
    })
    ;(function loop() { controls.update(); renderer.render(scene, camera); requestAnimationFrame(loop) })()
  }
  function show(geometry) {
    geometry.computeBoundingBox()
    var box = geometry.boundingBox, size = new THREE.Vector3(); box.getSize(size)
    var centre = new THREE.Vector3(); box.getCenter(centre)
    geometry.translate(-centre.x, -centre.y, -centre.z)
    if (mesh) scene.remove(mesh)
    mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: 0x1998d5, roughness: 0.55, metalness: 0.05 }))
    mesh.rotation.x = -Math.PI / 2   // STLs are Z-up; the camera looks at Y-up.
    scene.add(mesh)
    var radius = Math.max(size.x, size.y, size.z)
    camera.position.set(radius * 1.6, radius * 1.3, radius * 1.9)
    controls.minDistance = radius * 0.8; controls.maxDistance = radius * 6
    controls.target.set(0, 0, 0); controls.update()
  }
  window.__load = function (url, maxBytes) {
    fetch(url).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status)
      var len = Number(res.headers.get('content-length') || 0)
      if (maxBytes && len > maxBytes) { send({ type: 'toobig' }); return null }
      return res.arrayBuffer()
    }).then(function (buf) {
      if (!buf) return
      if (maxBytes && buf.byteLength > maxBytes) { send({ type: 'toobig' }); return }
      show(new THREE.STLLoader().parse(buf))
      send({ type: 'loaded' })
    }).catch(function (e) { send({ type: 'error', message: String(e && e.message || e) }) })
  }
  try { setup(); send({ type: 'ready' }) } catch (e) { send({ type: 'error', message: String(e && e.message || e) }) }
})()
</script>
</body>
```

`scripts/build-stl-viewer.mjs`:
```js
// Inlines three.js (r128 UMD builds) into the viewer page and writes it as a
// string module, so the WebView needs no asset loading and no network.
// `node scripts/build-stl-viewer.mjs` writes; `--check` exits 1 if stale.
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const three = dirname(require.resolve('three/package.json'))
const read = (p) => readFileSync(p, 'utf8')

export function build() {
  const page = read(join(here, '../assets/stl-viewer/index.html'))
    .replace('/*THREE*/', () => read(join(three, 'build/three.min.js')))
    .replace('/*STLLOADER*/', () => read(join(three, 'examples/js/loaders/STLLoader.js')))
    .replace('/*ORBIT*/', () => read(join(three, 'examples/js/controls/OrbitControls.js')))
  return `// GENERATED by scripts/build-stl-viewer.mjs — do not edit. Source: assets/stl-viewer/index.html + three@0.128.0.\nexport const STL_VIEWER_HTML = ${JSON.stringify(page)}\n`
}

const out = join(here, '../lib/stl-viewer-html.ts')
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const next = build()
  if (process.argv.includes('--check')) {
    let current = ''
    try { current = read(out) } catch {}
    if (current !== next) { console.error('lib/stl-viewer-html.ts is stale: run pnpm build:stl-viewer'); process.exit(1) }
  } else {
    writeFileSync(out, next)
    console.log(`wrote ${out} (${(next.length / 1024).toFixed(0)} KB)`)
  }
}
```
`package.json` scripts: `"build:stl-viewer": "node scripts/build-stl-viewer.mjs"`.

Run: `cd packages/mobile && pnpm build:stl-viewer` → writes `lib/stl-viewer-html.ts`.

- [ ] **Step 2: Drift test**

`tests/unit/lib/stl-viewer-html.test.ts`:
```ts
import { execFileSync } from 'node:child_process'
import { STL_VIEWER_HTML } from '../../../lib/stl-viewer-html'

it('is the page the build script produces today', () => {
  expect(() => execFileSync('node', ['scripts/build-stl-viewer.mjs', '--check'], { cwd: process.cwd(), stdio: 'pipe' })).not.toThrow()
})

it('carries three, the STL loader and orbit controls, and the load hook', () => {
  expect(STL_VIEWER_HTML).toContain('THREE.STLLoader')
  expect(STL_VIEWER_HTML).toContain('THREE.OrbitControls')
  expect(STL_VIEWER_HTML).toContain('window.__load')
  expect(STL_VIEWER_HTML.length).toBeLessThan(1_200_000)
})
```
Run: `cd packages/mobile && pnpm test:unit -- tests/unit/lib/stl-viewer-html.test.ts` → PASS.

- [ ] **Step 3: Write the failing model-screen tests**

`tests/unit/components/guides/model-screen.test.tsx`:
```tsx
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native'
import { ModelScreen } from '../../../../components/guides/model-screen'

jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }))
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }))
const mockBack = jest.fn(); const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack, push: mockPush }) }))
const mockGet = jest.fn()
jest.mock('../../../../lib/api-client', () => ({ apiClient: { get: (...a: unknown[]) => mockGet(...a) } }))
const mockSign = jest.fn()
jest.mock('../../../../lib/supabase', () => ({ supabase: { storage: { from: (b: string) => ({ createSignedUrl: (...a: unknown[]) => mockSign(b, ...a) }) } } }))
const mockInject = jest.fn()
let onMessage: ((e: { nativeEvent: { data: string } }) => void) | undefined
jest.mock('react-native-webview', () => {
  const React = require('react'); const { View } = require('react-native')
  const WebView = React.forwardRef((props: { onMessage?: typeof onMessage; source: { html: string } }, ref: React.Ref<unknown>) => {
    React.useImperativeHandle(ref, () => ({ injectJavaScript: mockInject }))
    onMessage = props.onMessage
    return <View testID="webview" {...props} />
  })
  return { WebView }
})
jest.mock('../../../../lib/stl-viewer-html', () => ({ STL_VIEWER_HTML: '<html>viewer</html>' }))

const GUIDE = { id: 'g', title: 'Light Touch Switch', stl_files: [
  { id: 'f1', tutorial_id: 'g', filename: 'lts_base.stl', file_url: 'g/lts_base.stl', print_minutes: 55, filament_grams: 14, material: 'PLA' },
  { id: 'f2', tutorial_id: 'g', filename: 'lts_cap.stl', file_url: 'g/lts_cap.stl', print_minutes: null, filament_grams: null, material: null },
] }
const page = (m: object) => act(() => { onMessage?.({ nativeEvent: { data: JSON.stringify(m) } }) })

beforeEach(() => { jest.clearAllMocks(); mockGet.mockResolvedValue(GUIDE); mockSign.mockResolvedValue({ data: { signedUrl: 'https://s/signed.stl' }, error: null }) })

it('names the part, signs its path and loads it into the page once the page is ready', async () => {
  render(<ModelScreen id="g" file="f1" />)
  expect(await screen.findByText('Lts base · lts_base.stl')).toBeTruthy()
  expect(screen.getByText('55 min print')).toBeTruthy()
  expect(screen.getByText('14 g PLA')).toBeTruthy()
  expect(screen.getByText('1 of 2')).toBeTruthy()
  expect(screen.getByTestId('webview').props.source).toEqual({ html: '<html>viewer</html>' })
  await waitFor(() => expect(mockSign).toHaveBeenCalledWith('stl-files', 'g/lts_base.stl', 60))
  page({ type: 'ready' })
  await waitFor(() => expect(mockInject).toHaveBeenCalledWith(expect.stringContaining('window.__load("https://s/signed.stl", 26214400)')))
  expect(screen.getByText('Drag to turn · pinch to zoom')).toBeTruthy()
  page({ type: 'loaded' })
})

it('shows the error state with Retry when signing fails, and never injects', async () => {
  mockSign.mockResolvedValue({ data: null, error: { message: 'Object not found' } })
  render(<ModelScreen id="g" file="f1" />)
  expect(await screen.findByText("Couldn't load this part.")).toBeTruthy()
  page({ type: 'ready' })
  expect(mockInject).not.toHaveBeenCalled()
  mockSign.mockResolvedValue({ data: { signedUrl: 'https://s/again.stl' }, error: null })
  fireEvent.press(screen.getByRole('button', { name: 'Retry' }))
  await waitFor(() => expect(mockSign).toHaveBeenCalledTimes(2))
})

it('shows the error state when the page reports a failure', async () => {
  render(<ModelScreen id="g" file="f1" />)
  await screen.findByText('Lts base · lts_base.stl')
  page({ type: 'ready' })
  page({ type: 'error', message: 'HTTP 403' })
  expect(await screen.findByText("Couldn't load this part.")).toBeTruthy()
})

it('says when a part is too big to preview, with the web link', async () => {
  process.env.EXPO_PUBLIC_WEB_URL = 'https://splat.example'
  render(<ModelScreen id="g" file="f1" />)
  await screen.findByText('Lts base · lts_base.stl')
  page({ type: 'ready' })
  page({ type: 'toobig' })
  expect(await screen.findByText('This part is too big to preview on a phone.')).toBeTruthy()
  expect(screen.getByRole('link', { name: 'Download on the web' })).toBeTruthy()
})

it('has no save, share or open-in-browser control', async () => {
  render(<ModelScreen id="g" file="f1" />)
  await screen.findByText('Lts base · lts_base.stl')
  expect(screen.queryByText(/Open in browser|Share|Save|Download/)).toBeNull()
})

it('✕ goes back; Ask someone to print opens the printer finder for this guide', async () => {
  render(<ModelScreen id="g" file="f1" />)
  await screen.findByText('Lts base · lts_base.stl')
  fireEvent.press(screen.getByRole('button', { name: 'Close 3D view' }))
  expect(mockBack).toHaveBeenCalled()
  fireEvent.press(screen.getByRole('button', { name: 'Ask someone to print' }))
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/printing', params: { guide: 'g' } })
})

it('a file id the guide does not have shows not found', async () => {
  render(<ModelScreen id="g" file="nope" />)
  expect(await screen.findByText('This part is no longer on the guide.')).toBeTruthy()
})
```

- [ ] **Step 4: Run to see them fail**

Run: `cd packages/mobile && pnpm test:unit -- tests/unit/components/guides/model-screen.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 5: Implement the screen and route**

`components/guides/model-screen.tsx`:
```tsx
// packages/mobile/components/guides/model-screen.tsx
//
// One printable part, turned by hand (spec 2026-10-07 §8): a WebView running
// the generated three.js page, fed a 60-second signed URL. View only: no save,
// share or open-in-browser anywhere here; downloads live on the website.
import { useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, Linking, StyleSheet } from 'react-native'
import { WebView } from 'react-native-webview'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { StlFile } from '@splat-connect/types'
import { apiClient } from '../../lib/api-client'
import { supabase } from '../../lib/supabase'
import { STL_PREVIEW_MAX_BYTES, stlName, webGuideUrl } from '../../lib/guide-files'
import { STL_VIEWER_HTML } from '../../lib/stl-viewer-html'
import { theme } from '../../lib/theme'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { Skeleton } from '../ui/Skeleton'

type PageMessage = { type: 'ready' | 'loaded' | 'toobig' | 'error'; message?: string }
type State = 'loading' | 'ready' | 'shown' | 'toobig' | 'error' | 'missing'

export function ModelScreen({ id, file }: { id: string; file: string }) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const web = useRef<WebView>(null)
  const [files, setFiles] = useState<StlFile[] | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [pageReady, setPageReady] = useState(false)
  const [state, setState] = useState<State>('loading')
  const [attempt, setAttempt] = useState(0)
  const [hint, setHint] = useState(true)

  const part = files?.find((f) => f.id === file) ?? null
  const index = files && part ? files.indexOf(part) : -1

  useEffect(() => {
    apiClient.get<{ stl_files: StlFile[] }>(`/api/public/tutorials/${id}`).then((g) => setFiles(g.stl_files)).catch(() => setState('error'))
  }, [id])

  useEffect(() => {
    if (!files) return
    if (!part) return setState('missing')
    let live = true
    supabase.storage.from('stl-files').createSignedUrl(part.file_url, 60).then(({ data, error }) => {
      if (!live) return
      if (error || !data) setState('error')
      else setUrl(data.signedUrl)
    })
    return () => { live = false }
  }, [files, part, attempt])

  // Load once both the page and the URL are in: whichever lands second fires it.
  useEffect(() => {
    if (!pageReady || !url || state === 'error' || state === 'toobig') return
    web.current?.injectJavaScript(`window.__load(${JSON.stringify(url)}, ${STL_PREVIEW_MAX_BYTES}); true;`)
  }, [pageReady, url, state])

  useEffect(() => { const t = setTimeout(() => setHint(false), 3000); return () => clearTimeout(t) }, [])

  function onMessage(e: { nativeEvent: { data: string } }) {
    let m: PageMessage
    try { m = JSON.parse(e.nativeEvent.data) } catch { return }
    if (m.type === 'ready') setPageReady(true)
    else if (m.type === 'loaded') setState('shown')
    else if (m.type === 'toobig') setState('toobig')
    else if (m.type === 'error') setState('error')
  }

  function retry() {
    setState('loading'); setUrl(null); setAttempt((n) => n + 1)
  }

  const title = part ? `${stlName(part.filename)} · ${part.filename}` : '3D view'
  const chips = part ? [part.print_minutes ? `${part.print_minutes} min print` : '', part.filament_grams ? `${part.filament_grams} g${part.material ? ` ${part.material}` : ''}` : '', files ? `${index + 1} of ${files.length}` : ''].filter(Boolean) : []
  const webLink = webGuideUrl(id)

  return (
    <View style={styles.page}>
      <View style={[styles.head, { paddingTop: insets.top + theme.spacing(2) }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close 3D view" hitSlop={6} style={styles.round}>
          <Ionicons name="close" size={20} color={theme.colors.ink} />
        </Pressable>
        <Text style={styles.headText} numberOfLines={1} accessibilityRole="header">{title}</Text>
        <View style={styles.roundSpace} />
      </View>

      <View style={styles.body}>
        {state === 'missing' ? (
          <EmptyState icon="cube-outline" title="This part is no longer on the guide." />
        ) : state === 'error' ? (
          <View style={styles.center}>
            <EmptyState icon="cloud-offline-outline" title="Couldn't load this part." />
            <Button label="Retry" variant="secondary" onPress={retry} />
          </View>
        ) : state === 'toobig' ? (
          <View style={styles.center}>
            <EmptyState icon="cube-outline" title="This part is too big to preview on a phone." />
            {webLink ? (
              <Text accessibilityRole="link" onPress={() => void Linking.openURL(webLink)} style={styles.link}>Download on the web</Text>
            ) : null}
          </View>
        ) : (
          <>
            {!files ? <Skeleton width="100%" height={200} /> : null}
            <WebView
              ref={web}
              source={{ html: STL_VIEWER_HTML }}
              originWhitelist={['*']}
              javaScriptEnabled
              allowFileAccess={false}
              onMessage={onMessage}
              style={styles.web}
            />
            {hint ? <Text style={styles.hint} pointerEvents="none">Drag to turn · pinch to zoom</Text> : null}
            <View style={styles.chips} pointerEvents="none">
              {chips.map((c) => <View key={c} style={styles.chip}><Text style={styles.chipText}>{c}</Text></View>)}
            </View>
          </>
        )}
      </View>

      {files?.length ? (
        <View style={[styles.foot, { paddingBottom: insets.bottom + theme.spacing(3) }]}>
          <Button label="Ask someone to print" onPress={() => router.push({ pathname: '/printing', params: { guide: id } })} />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.surfaceSunken },
  head: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(3), paddingHorizontal: theme.spacing(4), paddingBottom: theme.spacing(2), backgroundColor: theme.colors.background },
  round: { width: 44, height: 44, borderRadius: theme.radii.pill, backgroundColor: theme.colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' },
  roundSpace: { width: 44, height: 44 },
  headText: { flex: 1, fontFamily: theme.fonts.black, fontSize: theme.type.body, color: theme.colors.ink, textAlign: 'center' },
  body: { flex: 1 },
  web: { flex: 1, backgroundColor: 'transparent' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: theme.spacing(3), padding: theme.spacing(4) },
  hint: { position: 'absolute', top: theme.spacing(3), left: 0, right: 0, textAlign: 'center', fontFamily: theme.fonts.bold, fontSize: theme.type.caption, color: theme.colors.muted },
  chips: { position: 'absolute', left: theme.spacing(4), right: theme.spacing(4), bottom: theme.spacing(3), flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: theme.spacing(2) },
  chip: { paddingHorizontal: theme.spacing(3), paddingVertical: 5, borderRadius: theme.radii.pill, backgroundColor: theme.colors.surface, ...theme.shadow(1) },
  chipText: { fontFamily: theme.fonts.black, fontSize: theme.type.caption, color: theme.colors.ink },
  link: { fontFamily: theme.fonts.black, fontSize: theme.type.label, color: theme.colors.primaryDeep },
  foot: { paddingHorizontal: theme.spacing(4), paddingTop: theme.spacing(3), borderTopWidth: theme.border.hairline, borderTopColor: theme.colors.border, backgroundColor: theme.colors.surface },
})
```
`'transparent'` is a colour literal: if the dark-mode guard test rejects it, use `theme.colors.surfaceSunken` for `web.backgroundColor`.

`app/(tabs)/guides/[id]/model.tsx`:
```tsx
import { useLocalSearchParams } from 'expo-router'
import { ModelScreen } from '../../../../components/guides/model-screen'

export default function TutorialModelRoute() {
  const { id, file } = useLocalSearchParams<{ id: string; file: string }>()
  return <ModelScreen id={id} file={file} />
}
```
`_layout.tsx` after the build screen: `<Stack.Screen name="[id]/model" options={{ presentation: 'fullScreenModal', headerShown: false }} />`.

- [ ] **Step 6: Run the tests and typecheck**

Run: `cd packages/mobile && pnpm test:unit -- tests/unit/components/guides/model-screen.test.tsx tests/unit/lib && pnpm typecheck`
Expected: PASS. Then run the full mobile unit suite: `pnpm test:unit` → all green (the type-scale and dark-mode guard tests included).

- [ ] **Step 7: Prove the fetch path on the simulator**

Run the dev client on the iOS simulator (XcodeBuildMCP `session_show_defaults` then `build_run_sim`, or `pnpm expo run:ios` from `packages/mobile`; see memory `expo-dev-bundle-hosted-env` — a dev client reads the hosted Supabase, which already holds the demo cast's STLs). Open Guides → Light Touch Switch → Files → a `3D` pill. Expected: the part draws and turns. If instead the error state appears and the Metro log shows the page's `{ type: 'error', message: 'TypeError: Load failed' }` (a cross-origin fetch refused from the `about:blank` origin), switch to the fallback: in `model-screen.tsx` fetch the signed URL in RN, read it as a data URL and inject that instead:
```ts
const res = await fetch(url)
if (Number(res.headers.get('content-length') || 0) > STL_PREVIEW_MAX_BYTES) return setState('toobig')
const blob = await res.blob()
const dataUrl: string = await new Promise((ok, fail) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => fail(r.error); r.readAsDataURL(blob) })
web.current?.injectJavaScript(`window.__load(${JSON.stringify(dataUrl)}, 0); true;`)
```
(the page's `fetch` accepts a `data:` URL). Update the first model-screen test's expectation to the data URL form if you take this path, and note which path shipped in the commit message.

- [ ] **Step 8: Commit**

```bash
git add packages/mobile/assets/stl-viewer packages/mobile/scripts/build-stl-viewer.mjs packages/mobile/lib/stl-viewer-html.ts packages/mobile/components/guides/model-screen.tsx "packages/mobile/app/(tabs)/guides/[id]/model.tsx" "packages/mobile/app/(tabs)/guides/_layout.tsx" packages/mobile/package.json pnpm-lock.yaml packages/mobile/tests
git commit -m "feat(mobile): a printable part turns in a 3D view, in the WebView the PDF already uses"
```

---

### Task 11: E2E specs: feedback, files, build-mode hand-off; run the suites

**Files:**
- Rename: `packages/mobile/tests/e2e/guides-notes.spec.ts` → `guides-feedback.spec.ts` (rewrite)
- Create: `packages/mobile/tests/e2e/guides-files.spec.ts`
- Modify: `packages/mobile/tests/e2e/guides-build-mode.spec.ts` (append)
- Modify: `packages/mobile/tests/e2e/guides-reader-journeys.spec.ts` (notes cases at lines ~89–140)
- Modify: `packages/mobile/tests/e2e/guides-report.spec.ts` (if it reports a note, it now asserts `subject_kind: 'note'`)

**Interfaces:**
- Consumes: testIDs and copy from Tasks 2–10; helpers `signIn`, `signInAsNewContributor`, `createContributor`, `createTutorial`, `renameProfile`, `adminClient`, `uniqueTitle`; fixtures `addSteps`, `addNote`.

- [ ] **Step 1: Write `guides-feedback.spec.ts`**

```ts
import { test, expect } from '@playwright/test'
import { adminClient, createContributor, createTutorial, renameProfile, signIn, signInAsNewContributor, uniqueTitle } from './helpers'
import { addNote, addSteps } from './guides-fixtures'

// The Feedback tab (spec 2026-10-07): the list, its filters, the composer
// sheet, the per-note menu from every seat, and a report that names the note.

async function guideWithFeedback() {
  const author = await createContributor()
  await renameProfile(author.id, 'Mei Author')
  const builder = await createContributor()
  await renameProfile(builder.id, 'Dan Builder')
  const id = await createTutorial(author.id, { title: uniqueTitle('E2E Feedback Guide') })
  await addSteps(id, [{ title: 'Open the bay', body: 'One screw.' }, { title: 'Close it', body: 'Click.' }])
  const stepNote = `Use a longer screw ${Date.now()}`
  const missingNote = 'You also need a rubber band.'
  const stepNoteId = await addNote(id, builder.id, { step_position: 1, body: stepNote })
  const missingNoteId = await addNote(id, builder.id, { step_position: null, body: missingNote })
  return { author, builder, id, stepNote, missingNote, stepNoteId, missingNoteId }
}

test('a reader sees the list with filters, and a menu with Report only', async ({ page }) => {
  await signInAsNewContributor(page)
  const g = await guideWithFeedback()
  await page.goto(`/guides/${g.id}`)
  await page.getByRole('tab', { name: 'Feedback (2)' }).click()

  await expect(page.getByTestId('feedback-filter-all')).toHaveText('All 2')
  await expect(page.getByTestId('feedback-filter-step-1')).toBeVisible()
  await expect(page.getByTestId('feedback-filter-missing')).toBeVisible()
  await expect(page.getByText(g.stepNote, { exact: true })).toBeVisible()
  await expect(page.getByText('Community notes')).toHaveCount(0)

  await page.getByTestId('feedback-filter-missing').click()
  await expect(page.getByText(g.missingNote)).toBeVisible()
  await expect(page.getByText(g.stepNote, { exact: true })).toHaveCount(0)

  await page.getByTestId(`note-menu-${g.missingNoteId}`).click()
  await expect(page.getByText('Report this note')).toBeVisible()
  await expect(page.getByText('Pin as a fix')).toHaveCount(0)
  await expect(page.getByText('Delete', { exact: true })).toHaveCount(0)
})

test('the author pins from the menu; the fix card and the Overview card follow', async ({ page }) => {
  const g = await guideWithFeedback()
  await signIn(page, g.author.email, g.author.password)
  await page.waitForURL(/\/home$/)
  await page.goto(`/guides/${g.id}`)
  await page.getByRole('tab', { name: /^Feedback/ }).click()
  await page.getByTestId(`note-menu-${g.stepNoteId}`).click()
  const pin = page.waitForResponse((r) => r.url().endsWith(`/notes/${g.stepNoteId}/pin`) && r.request().method() === 'POST')
  await page.getByText('Pin as a fix').click()
  expect((await pin).status()).toBe(200)
  await expect(page.getByText('Fix · approved by Mei')).toBeVisible()
  await expect(page.getByTestId('feedback-filter-fixes')).toHaveText('Fixes 1')
  await page.getByRole('tab', { name: 'Overview' }).click()
  await expect(page.getByText('1 fix from builders')).toBeVisible()
})

test('the composer posts feedback that lands in the list, ringed', async ({ page }) => {
  await signInAsNewContributor(page)
  const g = await guideWithFeedback()
  await page.goto(`/guides/${g.id}`)
  await page.getByRole('tab', { name: /^Feedback/ }).click()
  await page.getByTestId('feedback-composer').click()
  await expect(page.getByRole('heading', { name: 'How did it go?' })).toBeVisible()
  await page.getByText('Step 2', { exact: true }).click()
  const body = `Tinning first helped ${Date.now()}`
  await page.getByLabel('Your note').fill(body)
  const post = page.waitForResponse((r) => r.url().endsWith(`/tutorials/${g.id}/notes`) && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Post', exact: true }).click()
  const created = await (await post).json()
  await expect(page.getByRole('heading', { name: 'Feedback posted' })).toBeVisible()
  await page.getByRole('button', { name: 'See it on the guide' }).click()
  await expect(page.getByTestId(`note-row-${created.id}`)).toBeInViewport()
  await expect(page.getByText('Your feedback is on the guide')).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Feedback (3)' })).toBeVisible()
})

test('Report this note files a report about the note', async ({ page }) => {
  await signInAsNewContributor(page)
  const g = await guideWithFeedback()
  await page.goto(`/guides/${g.id}`)
  await page.getByRole('tab', { name: /^Feedback/ }).click()
  await page.getByTestId(`note-menu-${g.stepNoteId}`).click()
  await page.getByText('Report this note').click()
  await expect(page.getByText(`About Dan Builder's note on`, { exact: false })).toBeVisible()
  await page.getByText('Wrong or missing info').click()
  await page.getByLabel('What happened?').fill('Wrong screw size.')
  const sent = page.waitForResponse((r) => r.url().endsWith('/api/reports') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Send' }).click()
  const req = (await sent).request().postDataJSON()
  expect(req).toMatchObject({ subject_kind: 'note', subject_id: g.stepNoteId })
  const { data } = await adminClient().from('member_reports').select('subject_kind, subject_id').eq('subject_id', g.stepNoteId).single()
  expect(data).toEqual({ subject_kind: 'note', subject_id: g.stepNoteId })
})

test('signed out, the bar asks to sign in', async ({ page }) => {
  const g = await guideWithFeedback()
  await page.goto(`/guides/${g.id}`)
  await page.getByRole('tab', { name: /^Feedback/ }).click()
  await expect(page.getByText('Sign in to leave feedback')).toBeVisible()
  await expect(page.getByTestId('feedback-composer')).toHaveCount(0)
})
```
Delete `guides-notes.spec.ts` (`git mv` then overwrite). If the report sheet's field label/button differ from `What happened?`/`Send`, use the component's real strings (same note as Task 1 Step 7).

- [ ] **Step 2: Write `guides-files.spec.ts`**

```ts
import { test, expect } from '@playwright/test'
import { adminClient, createContributor, createTutorial, signInAsNewContributor, uniqueTitle } from './helpers'
import { stlName } from '../../lib/guide-files'

// The Files tab (spec 2026-10-07 §7–8): one card of files with View / 3D pills,
// the web footer for downloads, the model route. three.js itself is proven on
// device (Maestro); here the shell, the signing and the copy.

async function guideWithParts() {
  const author = await createContributor()
  const id = await createTutorial(author.id, { title: uniqueTitle('E2E Files Guide') })
  const { data, error } = await adminClient().from('stl_files').insert([
    { tutorial_id: id, filename: 'lts_base.stl', file_url: `${id}/lts_base.stl`, print_minutes: 55, filament_grams: 14, material: 'PLA' },
    { tutorial_id: id, filename: 'lts_cap.stl', file_url: `${id}/lts_cap.stl`, print_minutes: 20, filament_grams: 4, material: 'PLA' },
  ]).select('id')
  if (error || !data) throw new Error(error?.message)
  return { id, files: data.map((r) => r.id) }
}

test('lists the PDF and parts with a single pill each, and links downloads to the web', async ({ page }) => {
  await signInAsNewContributor(page)
  const g = await guideWithParts()
  await page.goto(`/guides/${g.id}`)
  await page.getByRole('tab', { name: 'Files' }).click()
  await expect(page.getByText('Guide files')).toBeVisible()
  await expect(page.getByTestId('file-row-pdf')).toContainText('Full guide')
  await expect(page.getByTestId(`file-row-${g.files[0]}`)).toContainText(stlName('lts_base.stl'))
  await expect(page.getByTestId(`file-row-${g.files[0]}`)).toContainText('55 min · 14 g')
  await expect(page.getByRole('button', { name: /^3D view of/ })).toHaveCount(2)
  await expect(page.getByText(/Download PDF|Open in browser/)).toHaveCount(0)
  await expect(page.getByTestId('files-web-link')).toContainText('Download the files on the web')
  await page.evaluate(() => { const w = window as unknown as { opened: string[] }; w.opened = []; window.open = (u?: string | URL) => (w.opened.push(String(u)), null) })
  await page.getByTestId('files-web-link').click()
  const opened = await page.evaluate(() => (window as unknown as { opened: string[] }).opened)
  expect(opened[0]).toMatch(new RegExp(`/tutorials/${g.id}$`))
})

test('a 3D pill opens the viewer for that part with its facts, and ✕ returns to Files', async ({ page }) => {
  await signInAsNewContributor(page)
  const g = await guideWithParts()
  await page.goto(`/guides/${g.id}`)
  await page.getByRole('tab', { name: 'Files' }).click()
  await page.getByRole('button', { name: `3D view of ${stlName('lts_cap.stl')}` }).click()
  await expect(page).toHaveURL(new RegExp(`/guides/${g.id}/model\\?file=${g.files[1]}`))
  await expect(page.getByRole('heading', { name: `${stlName('lts_cap.stl')} · lts_cap.stl` })).toBeVisible()
  await expect(page.getByText('20 min print')).toBeVisible()
  await expect(page.getByText('2 of 2')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ask someone to print' })).toBeVisible()
  await expect(page.getByText(/Open in browser|Share|Save/)).toHaveCount(0)
  await page.getByRole('button', { name: 'Close 3D view' }).click()
  await expect(page.getByRole('tab', { name: 'Files', selected: true })).toBeVisible()
})

test('a guide with nothing to download says so', async ({ page }) => {
  await signInAsNewContributor(page)
  const author = await createContributor()
  const id = await createTutorial(author.id, { title: uniqueTitle('E2E No Files'), withPdf: false })
  await page.goto(`/guides/${id}`)
  await page.getByRole('tab', { name: 'Files' }).click()
  await expect(page.getByText('Nothing to download for this guide.')).toBeVisible()
  await expect(page.getByTestId('print-card')).toHaveCount(0)
})
```

- [ ] **Step 3: Append to `guides-build-mode.spec.ts`**

```ts
test('Leave feedback at the end posts and lands on the same guide page with the note in view', async ({ page }) => {
  await signInAsNewContributor(page)
  const author = await createContributor()
  await renameProfile(author.id, 'Mei Author')
  const id = await createTutorial(author.id, { title: uniqueTitle('E2E Build Feedback') })
  await addSteps(id, STEPS.slice(0, 2))

  await page.goto(`/guides/${id}`)
  const before = await page.evaluate(() => history.length)
  await page.getByRole('button', { name: 'Start building', exact: true }).click()
  await page.getByRole('button', { name: 'Start step 1' }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'You built it!' })).toBeVisible()

  await page.getByRole('button', { name: 'Leave feedback' }).click()
  await expect(page.getByText('Mei can pin it as a fix so the next builder sees it.')).toBeVisible()
  // Step 2 was the last on screen, so it is already chosen: no chip tap needed.
  const body = `Great build ${Date.now()}`
  await page.getByLabel('Your note').fill(body)
  const post = page.waitForResponse((r) => r.url().endsWith(`/tutorials/${id}/notes`) && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Post', exact: true }).click()
  const created = await (await post).json()
  expect(created.step_position).toBe(2)
  await expect(page.getByRole('heading', { name: 'Feedback posted' })).toBeVisible()
  await page.getByRole('button', { name: 'See it on the guide' }).click()

  await expect(page).toHaveURL(new RegExp(`/guides/${id}$`))
  expect(await page.evaluate(() => history.length)).toBe(before + 1)   // one push, one pop: no second guide page
  await expect(page.getByRole('tab', { name: 'Feedback (1)', selected: true })).toBeVisible()
  await expect(page.getByTestId(`note-row-${created.id}`)).toBeInViewport()
  await expect(page.getByText('Your feedback is on the guide')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Build it again' })).toBeVisible()
})

test('the step link to feedback hands off to the guide instead of opening a second copy', async ({ page }) => {
  await signInAsNewContributor(page)
  const author = await createContributor()
  const builder = await createContributor()
  const id = await createTutorial(author.id, { title: uniqueTitle('E2E Build Feedback Link') })
  await addSteps(id, STEPS.slice(0, 1))
  await addNote(id, builder.id, { step_position: 1, body: 'A tip on step 1.' })
  await page.goto(`/guides/${id}`)
  await page.getByRole('button', { name: 'Start building', exact: true }).click()
  await page.getByRole('button', { name: 'Start step 1' }).click()
  await page.getByText("1 note on this step in the guide's Feedback").click()
  await expect(page).toHaveURL(new RegExp(`/guides/${id}$`))
  await expect(page.getByRole('tab', { name: /^Feedback/, selected: true })).toBeVisible()
  await expect(page.getByText('A tip on step 1.')).toBeVisible()
})
```
If `history.length` is unreliable under react-native-web's router, drop that one line and keep the URL assertion plus a check that `page.goBack()` lands on the library (`/guides`), which it would not if a second guide page had been pushed.

- [ ] **Step 4: Update `guides-reader-journeys.spec.ts` notes cases**

Lines ~89–140: replace `Community notes 1` / `Community notes 0` with `getByRole('tab', { name: 'Feedback (1)' })` / `getByRole('tab', { name: 'Feedback' })`; posting goes through `getByTestId('feedback-composer')` → chips → `getByLabel('Your note')` → `Post`; deleting goes through `getByTestId('note-menu-<id>')` → `Delete`. Read the two tests and keep their intent (post your own note, delete it).

- [ ] **Step 5: Run the mobile unit suite, then the e2e suite**

Run: `cd packages/mobile && pnpm test:unit`
Expected: all green.

Run: `cd packages/mobile && lsof -i :$(node -e "console.log(require('./playwright.config.ts').WEB_PORT ?? '')") 2>/dev/null; node_modules/.bin/playwright test tests/e2e/guides-*.spec.ts`
(First, make sure nothing stale is serving the e2e port, memory `stale-e2e-server-reuse`; if `lsof` shows a server, kill it.) Expected: all guides specs pass. Then the full suite: `node_modules/.bin/playwright test` → pass, 0 failed.

- [ ] **Step 6: Commit**

```bash
git add packages/mobile/tests/e2e
git commit -m "test(mobile): e2e for the Feedback tab, the Files tab, the 3D viewer shell and the build-mode feedback hand-off"
```

---

### Task 12: Device flow, parity, API suites, graph

**Files:**
- Modify: `packages/mobile/.maestro/flows/guide-page.yaml`
- Run: `scripts/parity` (web), API unit + integration, `graphify update .`

- [ ] **Step 1: Extend the Maestro flow**

In `guide-page.yaml`, after the `Pick up at step 2` assertion and before the header-✕ block, add:
```yaml
# The 3D viewer is the WebView + three.js on Hermes and a real GPU: Playwright
# draws the shell only. The device guide is seeded with one STL.
- tapOn:
    text: "Files"
- tapOn:
    text: "3D"
- assertVisible:
    text: "Drag to turn · pinch to zoom"
- assertVisible:
    text: "Ask someone to print"
- assertNotVisible:
    text: "Couldn't load this part."
- tapOn:
    text: "Close 3D view"
- assertVisible:
    text: "Guide files"
- tapOn:
    text: "Overview"
```
Check `scripts/` for the device provisioning script named in the flow's header comment (`provision-device-parent`); if its guide has no STL, add one row to its seed (`stl_files` insert mirroring the e2e `addPart`), so the `3D` pill exists on device.

Run on the phone: `maestro test packages/mobile/.maestro/flows/guide-page.yaml --env DEVICE_EMAIL=… --env DEVICE_PASSWORD=…` (see memory `iphone-mobile-mcp-setup`; needs Java 17 — if absent, report the flow as written-but-unrun and say so in the summary rather than claiming it passed).

- [ ] **Step 2: API suites**

Run: `cd packages/api && pnpm test:unit && pnpm test:integration`
Expected: green (the report-kinds file and the drift test included).

- [ ] **Step 3: Web parity**

The shared `Segmented` change does not touch web, but the parity harness re-runs after any shared change (memory `artboard-parity-harness`). Run: `cd packages/web && node ../../scripts/parity/run.js` (read `scripts/parity/TRIAGE.md` first for the current expected score). Expected: 118/118 unchanged. Do not run web e2e concurrently with mobile e2e.

- [ ] **Step 4: Refresh the graph**

Run: `cd /Users/byronpetselis/Documents/splat-connect && graphify update .`

- [ ] **Step 5: Commit**

```bash
git add packages/mobile/.maestro scripts graphify-out
git commit -m "test(mobile): the device flow opens a part in 3D; graph refreshed"
```

---

## Self-review notes

- Spec §1 → Task 3; §2 → Task 2; §3 → Task 6; §4 → Task 5; §5 → Task 8; §6 → Tasks 6–7; §7 → Task 9; §8 → Task 10; §9 → covered across 5–10; §10 → each task's tests + Task 11–12; the "interacting components" table rows map: Segmented (T2), Chip (T6 testID + T5/T6 use), Toast (T7), PhotoViewer (T6), EmptyState/ErrorRow/Flash (T5, T6, T10), Button/TextField (T5), report-problem (T1, T6), guide-notes (T6 chips/labels), guide-progress (T11 build-mode e2e asserts Build it again), guide-focus ↔ DetailScreen (T4, T7), router.back ✕ (T10 test, T11 e2e), upload (T5), supabase signing (T9 existing tests, T10), api-client 401 (T5, T8), detail-screen overview (T7 copy, T3 openTab), build-mode links (T8, T11), preview-screen (T9), API tutorial-notes 201 shape (T5 mocks the shape; the live shape is exercised by T11's e2e `created.step_position`), API reports (T1), public notes ordering (T11 pin test relies on it), web admin queue (verified by reading `admin-reports.tsx`: `subject_kind` is a free string with no switch; nothing to change), types drift (T1).
- Review Focus 1 → T5 "no steps" + T9 "View full guide"; 2 → T6 past-the-end; 3 → T5 + T8 failed post; 4 → T10 signing failure; 5 → T4 + T9 + T10 web URL unset.
- Names used consistently: `openTab(t, { highlight })`, `setGuideFocus`/`takeGuideFocus`, `FeedbackSheet` props, `CommunityNotes` props (`viewerName`, `highlightId`, `onHighlightRow`, `onPosted`), `ModelScreen({ id, file })`, `STL_VIEWER_HTML`, `stlName`, `webGuideUrl`, `STL_PREVIEW_MAX_BYTES`, testIDs `need-*`, `print-card`, `feedback-composer`, `feedback-filter-*`, `note-row-*`, `note-menu-*`, `file-row-*`, `files-web-link`.
