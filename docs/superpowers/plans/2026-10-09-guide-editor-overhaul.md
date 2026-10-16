# Guide Editor Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the mobile guide editor lighter and more guiding (animated save icon, ⓘ hints, build-time slider, per-page progress strip, a Collaborators section) and replace "a guide PDF is required" with "steps or a PDF", deleting the maturity field.

**Architecture:** One source of truth, `sectionChecks()` in `lib/tutorial-sections.ts`, feeds `getMissingFields`, the hub, and the new per-page progress strip, so they cannot disagree. The steps-or-PDF rule is changed in the two hand-synced validators, the review surfaces and one new server guard. Everything else is isolated UI components with their own tests.

**Tech Stack:** Expo SDK 57 / React Native 0.8x (Hermes), expo-router, react-native-reanimated 4.5.1, Hono API (`tsx watch`), Next.js web, Supabase migrations, Jest + Testing Library (`npx jest` in `packages/mobile`), Playwright e2e.

**Spec:** `docs/superpowers/specs/2026-10-09-guide-editor-overhaul-design.md`. **Correction to the spec found while planning:** §4 says Recommendations must be built. It already exists on mobile as the "Worth a look" section (`sections/picks-section.tsx`, route `picks.tsx`). Only the hub's stale "More" row ("edit on the web") is wrong, so Task 11 links that row to it. Only **Collaborators** is a new section.

Mockups: `.superpowers/brainstorm/17262-1791502667/content/*.html`.

## Global Constraints

- Expo SDK 57: read the versioned docs at https://docs.expo.dev/versions/v57.0.0/ before adding any Expo/native dependency (`packages/mobile/AGENTS.md`).
- Text sizes are `theme.type` steps only; no raw colour values (guard tests: mobile-type-scale, mobile-dark-mode). Use `theme.colors.*`, `theme.radii.*`, `theme.spacing(n)`.
- iOS formSheet screens cannot be presented over from a root `Modal`; a Modal must live inside the screen's own tree (see `components/ui/PhotoPreviewHost.tsx`, mounted in `components/ui/Screen.tsx`).
- `getMissingFields` exists twice and is synced by hand: `packages/web/lib/validation.ts` and `packages/mobile/lib/tutorial-sections.ts`. Any rule change edits both in the same commit.
- Optional sections never appear in gaps and are excluded from `sectionProgress` (`suits`, `picks`, and the new `collaborators`).
- Only `development` is pushed to, never `main`; licensing stays embargoed. This plan does not push.
- One commit per individual fix, not per area. Commit trailer: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_013gf54gnBn1ykL5YnT5vcNK`.
- Existing tests carry `// journeys: Tnn` tags checked by `scripts/journeys/check.mjs`. When rewriting a test file, keep its tag line.
- Before reporting done: whole `npx jest` in `packages/mobile` (not a subset), `npx tsc --noEmit` in every package touched, web unit tests and API tests for touched packages.
- Every migration takes the next free number (`ls supabase/migrations | tail -1` was `134_customization_fields.sql`, so **135**; re-check at execution time). A new gitignored-`ios/` native module needs `npx expo prebuild` before the phone crashes less (stale-prebuild gotcha).

## Review Focus

- A guide with **neither** steps nor a PDF that already exists as a draft: hub and strip must say "Steps or a guide PDF" and not crash; submit stays blocked.
- A guide with **both** steps and a PDF: no gap, Steps shows the editor (not the redirect card), Files shows the PDF as optional.
- Feedback sheet on a guide with **zero steps**: Post enabled with only a note; stored `step_position` is `null`.
- Existing notes on a guide that *later* gets steps: labels revert to "Missing step"; nothing throws.
- Build-time slider with **no value yet** (`build_minutes == null`): shows "Not set", does not save on mount, the build-time gap stays open; value saved only on release.
- `maturity` dropped while old clients still send it in PATCH bodies: the API must ignore unknown/removed keys rather than 500.

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/mobile/lib/tutorial-sections.ts` | `sectionChecks()` single source; `getMissingFields` derives from it; `collaborators` SectionId; new summaries |
| `packages/mobile/components/my-tutorials/section-progress.tsx` (new) | The per-page progress strip |
| `packages/mobile/components/ui/InfoHint.tsx` (new) | ⓘ icon + centred card |
| `packages/mobile/components/ui/BuildTimeSlider.tsx` (new) | Index slider over `BUILD_TIME_OPTIONS` |
| `packages/mobile/components/my-tutorials/sections/save-chip.tsx` | Animated cloud → tick |
| `packages/mobile/components/my-tutorials/sections/steps-section.tsx` | Neither / PDF-only / editor states |
| `packages/mobile/components/my-tutorials/sections/collaborators-section.tsx` (new) + `app/(my)/tutorials/[id]/collaborators.tsx` (new) | Team list, invite, remove |
| `packages/mobile/lib/team-state.ts` (new) | `teamRows()` port of web `team-state.tsx` |
| `supabase/migrations/135_drop_tutorial_maturity.sql` (new) | Drop the column |
| `packages/api/src/routes/tutorials.ts` | Remove `maturity`; steps-or-PDF guards |

---

### Task 1: Delete maturity everywhere

**Files:**
- Modify: `packages/types/src/index.ts` (remove `TutorialMaturity`, `MATURITY_LABEL`, the `maturity` field on `Tutorial` and on `Recommendation`'s tutorial pick)
- Modify: `packages/api/src/routes/tutorials.ts:97,186`, `packages/api/src/routes/public.ts:48-49,84,110`
- Modify: `packages/web/components/edit-details-section.tsx:~201`, `packages/web/app/tutorials/[id]/edit/page.tsx`, `packages/web/components/tutorial-card.tsx:19,95-96`, `packages/web/components/tutorial-view.tsx:454-455`, `packages/web/components/badge.tsx`
- Modify: `packages/mobile/components/my-tutorials/sections/details-section.tsx` (field + imports + `MATURITY_OPTIONS`), `packages/mobile/components/home/detail-screen.tsx:408-409`, `packages/mobile/components/ui/Badge.tsx:12`
- Create: `supabase/migrations/135_drop_tutorial_maturity.sql`
- Test: grep guard + existing suites

**Interfaces:**
- Produces: no `maturity` anywhere in `packages/*/src`, `packages/*/app`, `packages/*/components`, `packages/*/lib`.

- [ ] **Step 1: Inventory every reference**

Run: `cd /Users/byronpetselis/Documents/splat-connect && grep -rIn "maturity\|MATURITY\|TutorialMaturity" packages supabase scripts --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=coverage --exclude-dir=.expo --exclude-dir=dist --exclude-dir=graphify-out | grep -v "supabase/migrations/05"`
Expected: a list including the files above plus tests and fixtures. Keep it open; every line must be gone or intentionally kept (migration 052 stays, it is history).

- [ ] **Step 2: Add a failing guard test**

Create `packages/api/tests/unit/no-maturity.test.ts`:

```ts
import { execSync } from 'node:child_process'
import { resolve } from 'node:path'

// maturity was deleted on 2026-10-09 (the library filter hid guides from their authors' readers
// with no way to see why). This fails if any source file reintroduces it.
it('has no maturity reference left in shipped source', () => {
  const root = resolve(__dirname, '../../../..')
  const out = execSync(
    `grep -rIl "maturity" packages/types/src packages/api/src packages/web/app packages/web/components packages/web/lib packages/mobile/app packages/mobile/components packages/mobile/lib || true`,
    { cwd: root }
  ).toString().trim()
  expect(out).toBe('')
})
```

(If the API suite uses vitest rather than jest, keep the same body with its imports; check `packages/api/package.json` `test` script.)

- [ ] **Step 3: Run it to confirm it fails**

Run: `cd packages/api && pnpm test -- no-maturity` (use the repo's test runner command)
Expected: FAIL listing the files from Step 1.

- [ ] **Step 4: Remove the references**

Per file:
- `types/src/index.ts`: delete `TutorialMaturity`, `MATURITY_LABEL`, the `maturity` property on `Tutorial`, and `maturity` in the `Recommendation` tutorial pick type.
- `api/src/routes/tutorials.ts:97`: delete `, maturity` from the `tutorials!recommended_id(...)` select. Line 186: delete `'maturity', ` from `EDITABLE`. Because `EDITABLE` is an allow-list, an old client's `maturity` key is ignored by the existing filter; confirm by reading the PATCH handler and add a test in Step 5 if it is not.
- `api/src/routes/public.ts`: delete both `.eq('maturity', 'complete')` lines (49, 84), the comment above line 49, and `maturity,` in the line-110 select.
- Web: remove the "How far along is it?" `<label>/<select>` block and its state in `edit-details-section.tsx`, the `maturity` handling in `edit/page.tsx`, the maturity pill in `tutorial-card.tsx` and `tutorial-view.tsx`, and the `maturity` tone in `badge.tsx`.
- Mobile: in `details-section.tsx` delete `TutorialMaturity`, `MATURITY_LABEL` imports, `MATURITY_OPTIONS`, and the "How far along is it?" label + chip row + its hint; in `detail-screen.tsx` delete the `tutorial.maturity !== 'complete'` badge row (408-410); in `Badge.tsx` delete the maturity comment/tones if they are only for maturity.
- Delete maturity from test fixtures and assertions found in Step 1 (`grep` the tests directories too).

- [ ] **Step 5: Write the migration**

Create `supabase/migrations/135_drop_tutorial_maturity.sql`:

```sql
-- 135: maturity is gone. It decided which guides the public library listed
-- (only 'complete'), and Byron judged the field unnecessary: a guide is either
-- submitted for review or it is a draft. Dropping it makes every approved guide
-- listable; the rows that were hidden are counted in the PR description before
-- this is applied to the hosted database.
alter table tutorials drop column if exists maturity;
```

Also grep `supabase/SCHEMA.md` for `maturity` and remove the line.

- [ ] **Step 6: Run guard + type checks + suites**

Run: `cd /Users/byronpetselis/Documents/splat-connect && pnpm -r exec tsc --noEmit` (or per-package `npx tsc --noEmit` in `types`, `api`, `web`, `mobile`), then the API tests, `cd packages/web && npx vitest run` (or its configured runner), `cd packages/mobile && npx jest`.
Expected: guard PASS, tsc clean, suites green.

- [ ] **Step 7: Count the rows the drop will un-hide (hosted DB, read-only)**

Run (using the project's existing hosted-read pattern, e.g. `scripts/` helpers or the Supabase SQL editor): `select status, maturity, count(*) from tutorials where maturity <> 'complete' group by 1,2;`
Record the result in the commit body. **If any row has `status = 'approved'`, do not apply the migration; stop and tell Byron.**

- [ ] **Step 8: Commit**

```bash
git add -A packages supabase
git commit -m "feat: delete the guide maturity field

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013gf54gnBn1ykL5YnT5vcNK"
```

---

### Task 2: `sectionChecks` as the single source (mobile)

**Files:**
- Modify: `packages/mobile/lib/tutorial-sections.ts`
- Test: `packages/mobile/tests/unit/lib/tutorial-sections.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface Check { section: SectionId; label: string; done: boolean }
  export function sectionChecks(t: TutorialWithDetails): Check[]
  export function getMissingFields(t: TutorialWithDetails): Gap[]   // unchanged signature
  ```
- Task 3 changes the *content* of the checks; this task only changes the structure and keeps behaviour identical.

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/lib/tutorial-sections.test.ts` (reuse the file's existing `tutorial()`/fixture helper; if its helper is named differently, use that name):

```ts
import { sectionChecks, getMissingFields } from '../../../lib/tutorial-sections'

describe('sectionChecks', () => {
  it('lists every requirement with its done state, in the order getMissingFields reports them', () => {
    const t = tutorial({ title: '', build_minutes: null })
    const checks = sectionChecks(t)
    const missingLabels = checks.filter((c) => !c.done).map((c) => c.label)
    expect(getMissingFields(t).map((g) => g.label)).toEqual(missingLabels)
    expect(checks.every((c) => typeof c.section === 'string')).toBe(true)
  })

  it('marks a satisfied requirement done instead of dropping it', () => {
    const t = tutorial({ title: 'Drum' })
    expect(sectionChecks(t).find((c) => c.label === 'A title')?.done).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/mobile && npx jest tests/unit/lib/tutorial-sections.test.ts`
Expected: FAIL — `sectionChecks` is not exported.

- [ ] **Step 3: Implement**

Replace the body of `getMissingFields` in `lib/tutorial-sections.ts` with:

```ts
export interface Check {
  section: SectionId
  label: string
  done: boolean
}

/** Every requirement, met or not. getMissingFields and the per-page strip both read this. */
export function sectionChecks(tutorial: TutorialWithDetails): Check[] {
  return [
    { section: 'details', label: 'A title', done: Boolean(tutorial.title.trim()) },
    { section: 'details', label: 'A difficulty', done: DIFFICULTIES.includes(tutorial.difficulty) },
    { section: 'details', label: 'A build time', done: tutorial.build_minutes != null },
    { section: 'files', label: 'The guide PDF', done: Boolean(tutorial.tutorial_pdf_url?.trim()) },
    { section: 'files', label: 'A photo', done: tutorial.photo_urls.length > 0 },
    { section: 'parts', label: 'A part', done: tutorial.parts.length > 0 },
    { section: 'tools', label: 'A tool', done: tutorial.tools.length > 0 },
    // A printed part is what an assistive-tech tutorial IS; a toy adaptation has no STL section.
    ...(tutorial.kind === 'assistive_tech'
      ? [{ section: 'stl' as const, label: 'A 3D-print file', done: tutorial.stl_files.length > 0 }]
      : []),
    { section: 'safety', label: 'The safety declaration', done: Boolean(tutorial.safety_declared_at) },
  ]
}

export function getMissingFields(tutorial: TutorialWithDetails): Gap[] {
  return sectionChecks(tutorial)
    .filter((c) => !c.done)
    .map(({ section, label }) => ({ section, label }))
}
```

Keep the existing file-header comment about the web port.

- [ ] **Step 4: Run to verify it passes (and nothing else moved)**

Run: `cd packages/mobile && npx jest tests/unit/lib tests/unit/components/my-tutorials`
Expected: PASS (behaviour unchanged).

- [ ] **Step 5: Commit**

```bash
git add packages/mobile/lib/tutorial-sections.ts packages/mobile/tests/unit/lib/tutorial-sections.test.ts
git commit -m "refactor(mobile): one list of section checks feeds the gaps

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013gf54gnBn1ykL5YnT5vcNK"
```

---

### Task 3: Steps-or-PDF rule in both validators and summaries

**Files:**
- Modify: `packages/mobile/lib/tutorial-sections.ts`, `packages/web/lib/validation.ts`
- Modify (comments): `packages/web/lib/edit-steps.ts:15-17`, `packages/mobile/components/my-tutorials/sections/steps-section.tsx:8`
- Test: `packages/mobile/tests/unit/lib/tutorial-sections.test.ts`, `packages/mobile/tests/unit/lib/guide-draft-rules.test.ts`, `packages/web/tests/unit/lib/validation.test.ts`, `packages/web/tests/unit/lib/edit-steps.test.ts`

**Interfaces:**
- Consumes: `sectionChecks` (Task 2).
- Produces: gap `{ section: 'steps', label: 'Steps or a guide PDF' }` when `steps.length === 0 && !pdf`; no `'The guide PDF'` gap anywhere. Web's equivalent uses `step: 'steps'`.

- [ ] **Step 1: Write failing tests (mobile)**

In `tutorial-sections.test.ts`:

```ts
describe('steps or a guide PDF', () => {
  const gap = (t: TutorialWithDetails) => getMissingFields(t).find((g) => g.label === 'Steps or a guide PDF')

  it('is a gap, on the Steps section, when there are neither', () => {
    expect(gap(tutorial({ steps: [], tutorial_pdf_url: null }))?.section).toBe('steps')
  })
  it('is satisfied by a PDF alone', () => {
    expect(gap(tutorial({ steps: [], tutorial_pdf_url: 'a/b.pdf' }))).toBeUndefined()
  })
  it('is satisfied by steps alone', () => {
    expect(gap(tutorial({ steps: [step()], tutorial_pdf_url: null }))).toBeUndefined()
  })
  it('is satisfied by both', () => {
    expect(gap(tutorial({ steps: [step()], tutorial_pdf_url: 'a/b.pdf' }))).toBeUndefined()
  })
  it('never asks for "The guide PDF" any more', () => {
    expect(getMissingFields(tutorial({ steps: [], tutorial_pdf_url: null })).map((g) => g.label)).not.toContain('The guide PDF')
  })
  it('counts Steps as a section that can be incomplete in the progress total', () => {
    const { ready, total } = sectionProgress(tutorial({ steps: [], tutorial_pdf_url: null }))
    expect(total - ready).toBeGreaterThanOrEqual(1)
  })
})

describe('sectionSummary for steps and files', () => {
  it('Steps says it is using the PDF when there are no steps and a PDF', () => {
    expect(sectionSummary('steps', tutorial({ steps: [], tutorial_pdf_url: 'a.pdf' }))).toBe('Using your PDF')
  })
  it('Steps asks for steps or a PDF when there is neither', () => {
    expect(sectionSummary('steps', tutorial({ steps: [], tutorial_pdf_url: null }))).toBe('Steps or PDF needed')
  })
  it('Files only asks for a photo when steps exist and there is no PDF', () => {
    expect(sectionSummary('files', tutorial({ steps: [step()], tutorial_pdf_url: null, photo_urls: [] }))).toBe('A photo - PDF optional')
  })
  it('Files says PDF optional with steps, a photo and no PDF', () => {
    expect(sectionSummary('files', tutorial({ steps: [step()], tutorial_pdf_url: null, photo_urls: ['p.jpg'] }))).toBe('Photo added - PDF optional')
  })
})
```

(`step()` is a one-step fixture: reuse the file's existing step fixture or add `const step = () => ({ id: 's1', position: 1, title: 'Cut', body: 'Cut it', photo_url: null, tip: null, minutes: null })`.)

- [ ] **Step 2: Run to verify they fail**

Run: `cd packages/mobile && npx jest tests/unit/lib/tutorial-sections.test.ts`
Expected: FAIL (old PDF gap still present; summaries differ).

- [ ] **Step 3: Implement (mobile)**

In `sectionChecks` replace the `'The guide PDF'` entry with:

```ts
    {
      section: 'steps',
      label: 'Steps or a guide PDF',
      done: (tutorial.steps?.length ?? 0) > 0 || Boolean(tutorial.tutorial_pdf_url?.trim()),
    },
```

Replace the `steps` and `files` cases in `sectionSummary`:

```ts
    case 'steps': {
      const n = t.steps?.length ?? 0
      if (n) return count(n, 'step')
      return t.tutorial_pdf_url?.trim() ? 'Using your PDF' : 'Steps or PDF needed'
    }
```

```ts
    case 'files': {
      const pdf = Boolean(t.tutorial_pdf_url?.trim())
      const photo = t.photo_urls.length > 0
      const steps = (t.steps?.length ?? 0) > 0
      if (steps && !pdf) return photo ? 'Photo added - PDF optional' : 'A photo - PDF optional'
      if (pdf && photo) return 'PDF and photo added'
      if (!pdf && !photo) return 'Guide PDF and a photo'
      return pdf ? 'A photo' : 'The guide PDF'
    }
```

Remove the line-14/15 comment claiming `steps` never gaps and `// 'steps' (080) is optional ...`; replace with: `// 'steps' gaps only when a guide has neither steps nor a PDF.`

- [ ] **Step 4: Web validator, same rule**

In `packages/web/lib/validation.ts` replace the `tutorial_pdf_url` line with:

```ts
  if ((tutorial.steps?.length ?? 0) === 0 && !tutorial.tutorial_pdf_url?.trim())
    missing.push({ step: 'steps', label: 'Steps or a guide PDF' })
```

Check `EditStepId` in `packages/web/lib/edit-steps.ts` includes `'steps'` (it should; if the type lacks it, add it) and update the header comment at lines 15-17 that says steps never attention-flag. Update the `steps-section.tsx:8` mobile comment the same way. In `packages/web/tests/unit/lib/validation.test.ts` rewrite the PDF assertions (lines ~65, 111) to the four cases above, with web's fixture helper.

- [ ] **Step 5: Update the other tests that pin the old rule**

Run: `cd packages/mobile && npx jest tests/unit 2>&1 | tail -60` and `cd packages/web && npx vitest run tests/unit 2>&1 | tail -60`
For each failure, change the expectation to the new rule (the old `'The guide PDF'` label becomes `'Steps or a guide PDF'`, and the gap's section becomes `steps`). Known files: `guide-draft-rules.test.ts`, `hub.test.tsx:95`, `hub-journey.test.tsx`, `section-footer.test.tsx`, `list-screen*.test.tsx`, web `admin-review.test.tsx`, `edit-tutorial.test.tsx:246`, `edit-steps.test.ts:92`, `stepper.test.tsx:133`. Do not weaken assertions; change values only.

- [ ] **Step 6: Run both suites**

Run the two commands from Step 5.
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/mobile packages/web
git commit -m "feat: a guide needs steps or a PDF, not both

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013gf54gnBn1ykL5YnT5vcNK"
```

---

### Task 4: Per-page progress strip

**Files:**
- Create: `packages/mobile/components/my-tutorials/section-progress.tsx`
- Modify: each of `details-section.tsx`, `steps-section.tsx`, `items-section.tsx` (parts + tools), `safety-section.tsx`, `files-section.tsx`, `stl-section.tsx` — add `<SectionProgress section="..." />` as the first child inside the `ScrollView`
- Test: `packages/mobile/tests/unit/components/my-tutorials/section-progress.test.tsx`

**Interfaces:**
- Consumes: `sectionChecks`, `SectionId` (Task 2), `useDraft()`.
- Produces: `export function SectionProgress({ section }: { section: SectionId }): JSX.Element | null`. Returns `null` when the section has no checks (suits, picks, collaborators, backing). `testID="section-progress"`, bar fill `testID="section-progress-bar"`.

- [ ] **Step 1: Write the failing test**

```tsx
// journeys: T20
import { render, screen } from '@testing-library/react-native'
import { SectionProgress } from '../../../../components/my-tutorials/section-progress'

let mockTutorial: any
jest.mock('../../../../lib/use-tutorial-draft', () => ({ useDraft: () => ({ tutorial: mockTutorial }) }))

const base = { title: 'Drum', difficulty: 'easy', build_minutes: null, tutorial_pdf_url: null, photo_urls: [], parts: [], tools: [], stl_files: [], steps: [], kind: 'toy_adaptation', safety_declared_at: null }

it('says how many of a page’s requirements are done and names what is left', () => {
  mockTutorial = { ...base }
  render(<SectionProgress section="details" />)
  expect(screen.getByText('2 of 3 done')).toBeTruthy()
  expect(screen.getByText('Still needed: A build time')).toBeTruthy()
})

it('turns to "Nothing left here" when every check is done', () => {
  mockTutorial = { ...base, build_minutes: 30 }
  render(<SectionProgress section="details" />)
  expect(screen.getByText('3 of 3 done')).toBeTruthy()
  expect(screen.getByText('Nothing left here')).toBeTruthy()
})

it('renders nothing for a section with no requirements', () => {
  mockTutorial = { ...base }
  render(<SectionProgress section="suits" />)
  expect(screen.queryByTestId('section-progress')).toBeNull()
})

it('lists several gaps joined with a middle dot', () => {
  mockTutorial = { ...base, title: '', build_minutes: null }
  render(<SectionProgress section="details" />)
  expect(screen.getByText('Still needed: A title · A build time')).toBeTruthy()
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd packages/mobile && npx jest tests/unit/components/my-tutorials/section-progress.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// packages/mobile/components/my-tutorials/section-progress.tsx
//
// "3 of 4 done" with a bar, at the top of a section page. It reads the same
// sectionChecks the hub's gap list reads, so the two cannot disagree. Sections
// with no requirements (Who it's for, Worth a look, Collaborators, Backing)
// render nothing.
import { View, Text, StyleSheet } from 'react-native'
import { useDraft } from '../../lib/use-tutorial-draft'
import { sectionChecks, type SectionId } from '../../lib/tutorial-sections'
import { theme } from '../../lib/theme'

export function SectionProgress({ section }: { section: SectionId }) {
  const { tutorial } = useDraft()
  if (!tutorial) return null
  const checks = sectionChecks(tutorial).filter((c) => c.section === section)
  if (!checks.length) return null
  const done = checks.filter((c) => c.done).length
  const left = checks.filter((c) => !c.done)
  const complete = left.length === 0
  return (
    <View testID="section-progress" style={styles.wrap} accessibilityLabel={`${done} of ${checks.length} done`}>
      <View style={styles.top}>
        <Text style={styles.count}>{`${done} of ${checks.length} done`}</Text>
      </View>
      <View style={styles.track}>
        <View
          testID="section-progress-bar"
          style={[styles.fill, { width: `${(done / checks.length) * 100}%`, backgroundColor: complete ? theme.colors.success : theme.colors.primary }]}
        />
      </View>
      <Text style={styles.sub}>{complete ? 'Nothing left here' : `Still needed: ${left.map((c) => c.label).join(' · ')}`}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginBottom: theme.spacing(4) },
  top: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing(1) },
  count: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.ink },
  track: { height: 7, borderRadius: 4, backgroundColor: theme.colors.surfaceSunken, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  sub: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted, marginTop: theme.spacing(1) },
})
```

Mount it in each section screen as the first child of the `ScrollView`: `import { SectionProgress } from '../section-progress'` and `<SectionProgress section="details" />` (use `"steps"`, `"parts"`, `"tools"`, `"safety"`, `"files"`, `"stl"` in the matching files; `items-section.tsx` is shared by parts and tools, so pass its existing kind prop through: `section={kind}` — read the file for the prop name).

- [ ] **Step 4: Run to verify pass, plus the section suites**

Run: `cd packages/mobile && npx jest tests/unit/components/my-tutorials`
Expected: PASS. Existing section tests that mock `useDraft` without `tutorial` shape for the strip may need the mock to provide `tutorial` (they already do for the sections).

- [ ] **Step 5: Commit**

```bash
git add packages/mobile
git commit -m "feat(mobile): each guide section opens with what is still needed on it

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013gf54gnBn1ykL5YnT5vcNK"
```

---

### Task 5: Steps screen — choice, redirect card, editor

**Files:**
- Modify: `packages/mobile/components/my-tutorials/sections/steps-section.tsx`
- Test: `packages/mobile/tests/unit/components/my-tutorials/steps-section.test.tsx`

**Interfaces:**
- Consumes: `useDraft().tutorial.tutorial_pdf_url`, `tutorial.steps`; `supabase` client and the `/guides/[id]/preview` route (same call as `home/detail-screen.tsx:329-338`).
- Produces: `StepsEditor` renders one of three states: `choice` (no rows, no PDF), `pdf` (no rows, PDF, user has not opted in), `editor`. Local state `wantsSteps: boolean`.

- [ ] **Step 1: Write failing tests**

Add to `steps-section.test.tsx` (use the file's existing render/mocking helper for `useDraft`; set `tutorial.steps` and `tutorial.tutorial_pdf_url` per case):

```tsx
it('offers a choice when the guide has neither steps nor a PDF', () => {
  mockDraft({ steps: [], tutorial_pdf_url: null })
  render(<StepsSection />)
  expect(screen.getByText('Write the steps here')).toBeTruthy()
  expect(screen.getByText('Or upload a PDF guide')).toBeTruthy()
})

it('shows the redirect card when there is a PDF and no steps', () => {
  mockDraft({ steps: [], tutorial_pdf_url: 'a/guide.pdf' })
  render(<StepsSection />)
  expect(screen.getByText('Your guide is the PDF')).toBeTruthy()
  expect(screen.getByText('View PDF')).toBeTruthy()
  expect(screen.queryByText('Add a step')).toBeNull()
})

it('"Add steps as well" opens the editor even with a PDF', () => {
  mockDraft({ steps: [], tutorial_pdf_url: 'a/guide.pdf' })
  render(<StepsSection />)
  fireEvent.press(screen.getByText('Add steps as well'))
  expect(screen.getByText('Add a step')).toBeTruthy()
})

it('"Add the first step" opens the editor', () => {
  mockDraft({ steps: [], tutorial_pdf_url: null })
  render(<StepsSection />)
  fireEvent.press(screen.getByText('Add the first step'))
  expect(screen.getByText('Add a step')).toBeTruthy()
})

it('"Upload a PDF" goes to Files', () => {
  mockDraft({ steps: [], tutorial_pdf_url: null })
  render(<StepsSection />)
  fireEvent.press(screen.getByText('Upload a PDF'))
  expect(mockRouter.push).toHaveBeenCalledWith('/tutorials/t1/files')
})

it('shows the editor, not the card, when there are steps and a PDF', () => {
  mockDraft({ steps: [oneStep], tutorial_pdf_url: 'a/guide.pdf' })
  render(<StepsSection />)
  expect(screen.queryByText('Your guide is the PDF')).toBeNull()
  expect(screen.getByTestId('step-row-0')).toBeTruthy()
})
```

Match `'Add a step'` to the real add-button label in the file (grep `Add a step\|Add step` in `steps-section.tsx`); if it differs, use that string in both the test and the cards.

- [ ] **Step 2: Run to verify they fail**

Run: `cd packages/mobile && npx jest tests/unit/components/my-tutorials/steps-section.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

In `StepsEditor`, add `const router = useRouter()` (import from `expo-router`) and `const [wantsSteps, setWantsSteps] = useState(false)`. Before the existing `return (<Screen>...`, add:

```tsx
  const pdf = tutorial.tutorial_pdf_url?.trim() || null
  if (rows.length === 0 && !wantsSteps) {
    return (
      <Screen>
        <ScrollView showsVerticalScrollIndicator={false}>
          <SectionProgress section="steps" />
          {pdf ? (
            <View style={styles.pdfCard}>
              <Text style={styles.pdfPill}>PDF guide added</Text>
              <Text style={styles.cardTitle}>Your guide is the PDF</Text>
              <Text style={styles.cardBody}>Builders will download and follow it. Steps are optional.</Text>
              <Button label="View PDF" onPress={() => void openPdf(pdf)} />
              <Button label="Add steps as well" variant="secondary" onPress={() => setWantsSteps(true)} />
            </View>
          ) : (
            <>
              <View style={styles.choiceCard}>
                <Text style={styles.cardTitle}>Write the steps here</Text>
                <Text style={styles.cardBody}>Step by step instructions with photos. Builders can tick them off as they go.</Text>
                <Button label="Add the first step" onPress={() => setWantsSteps(true)} />
              </View>
              <View style={styles.choiceCard}>
                <Text style={styles.cardTitle}>Or upload a PDF guide</Text>
                <Text style={styles.cardBody}>Already have one? Upload it and skip writing steps.</Text>
                <Button label="Upload a PDF" variant="secondary" onPress={() => router.push(`/tutorials/${id}/files`)} />
              </View>
            </>
          )}
        </ScrollView>
        <SectionFooter section="steps" />
      </Screen>
    )
  }
```

Add `openPdf` inside `StepsEditor`:

```tsx
  async function openPdf(path: string) {
    const { data, error } = await supabase.storage.from('tutorial-pdfs').createSignedUrl(path, 60)
    router.push({ pathname: '/guides/[id]/preview', params: { id, pdfUrl: error || !data ? '' : data.signedUrl } })
  }
```

(import `supabase` from the same module `detail-screen.tsx` imports it from.) Add styles `pdfCard`, `choiceCard` (surface background, `theme.radii.card`, border `theme.colors.border`, padding `theme.spacing(4)`, `gap: theme.spacing(2)`, `marginBottom: theme.spacing(3)`), `pdfPill` (caption, bold, `tone.mint` bg, pill radius), `cardTitle` (bold, `theme.type.body` — use an existing step; grep `theme.type` for valid keys), `cardBody` (regular, muted). Delete the old empty-state text ("One photo and one instruction per action. Optional — the PDF still carries the guide.") and the `{rows.length === 0 ? ... }` block; in the editor state with zero rows show `One photo and one instruction per action.` Also mount `<SectionProgress section="steps" />` in the editor state if not already added in Task 4 (avoid double mounting).

- [ ] **Step 4: Run to verify pass**

Run: `cd packages/mobile && npx jest tests/unit/components/my-tutorials/steps-section.test.tsx`
Expected: PASS (existing editor tests must set `wantsSteps` implicitly by having rows; for any that start with zero rows, press "Add the first step" first).

- [ ] **Step 5: Commit**

```bash
git add packages/mobile
git commit -m "feat(mobile): Steps asks for steps or a PDF, and points a PDF-only guide at its PDF

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013gf54gnBn1ykL5YnT5vcNK"
```

---

### Task 6: Files screen says the PDF is optional once steps exist

**Files:**
- Modify: `packages/mobile/components/my-tutorials/sections/files-section.tsx:~276-292`
- Test: `packages/mobile/tests/unit/components/my-tutorials/files-section.test.tsx`

- [ ] **Step 1: Failing test**

```tsx
it('calls the PDF optional when the guide already has steps', () => {
  mockDraft({ steps: [oneStep], tutorial_pdf_url: null })
  render(<FilesSection />)
  expect(screen.getByText('Guide PDF (optional)')).toBeTruthy()
})
it('does not call it optional when there are no steps', () => {
  mockDraft({ steps: [], tutorial_pdf_url: null })
  render(<FilesSection />)
  expect(screen.getByText('Guide PDF')).toBeTruthy()
})
```

- [ ] **Step 2: Run, expect FAIL** — `cd packages/mobile && npx jest tests/unit/components/my-tutorials/files-section.test.tsx`

- [ ] **Step 3: Implement** — replace `<Text style={styles.heading}>Guide PDF</Text>` with `<Text style={styles.heading}>{(tutorial.steps?.length ?? 0) > 0 ? 'Guide PDF (optional)' : 'Guide PDF'}</Text>`.

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Commit** — `git commit -m "feat(mobile): Files marks the guide PDF optional when the guide has steps"` with trailers.

---

### Task 7: Feedback on a guide with no steps

**Files:**
- Modify: `packages/mobile/lib/guide-notes.ts`, `packages/mobile/components/guides/feedback-sheet.tsx`, `packages/mobile/components/guides/community-notes.tsx:161,164,244`, `packages/mobile/components/guides/step-picker.tsx`, `packages/web/components/tutorial-view.tsx:542,557`
- Test: `packages/mobile/tests/unit/lib/guide-notes.test.ts` (create if absent), `packages/mobile/tests/unit/components/guides/feedback-sheet.test.tsx:43`, `community-notes` test

**Interfaces:**
- Produces: `stepLabel(n, stepCount)` returns `'Whole guide'` when `stepCount === 0 && isMissing`, else unchanged. `FeedbackSheet` with `steps.length === 0`: no `StepPicker`, `at` initialised to `null`, sub-line gains `Your note goes on the whole guide.`

- [ ] **Step 1: Failing tests**

`guide-notes.test.ts`:

```ts
import { stepLabel } from '../../../lib/guide-notes'
const note = (step_position: number | null) => ({ step_position }) as any

it('calls a note on a guide with no steps "Whole guide"', () => {
  expect(stepLabel(note(null), 0)).toBe('Whole guide')
})
it('keeps "Missing step" when the guide has steps', () => {
  expect(stepLabel(note(null), 3)).toBe('Missing step')
  expect(stepLabel(note(9), 3)).toBe('Missing step')
})
it('keeps "Step n" for a real step', () => {
  expect(stepLabel(note(2), 3)).toBe('Step 2')
})
```

`feedback-sheet.test.tsx` — replace the existing "a guide with no steps still posts, as a missing step" test with:

```tsx
it('on a guide with no steps there is no step picker and Post only needs a note', async () => {
  renderSheet({ steps: [] })
  expect(screen.queryByText('Which step?')).toBeNull()
  expect(screen.queryByText('Missing step')).toBeNull()
  expect(screen.getByText(/Your note goes on the whole guide/)).toBeTruthy()
  fireEvent.changeText(screen.getByLabelText('Your note'), 'The strap length is missing')
  fireEvent.press(screen.getByText('Post'))
  await waitFor(() => expect(mockPost).toHaveBeenCalledWith(expect.objectContaining({ step_position: null })))
})
```

(Use the file's real helper/mocks for rendering and for the post call; match `step_position: null` to how the existing test asserted the request body.)

`community-notes` test: with `steps=[]` and one note, expect `Whole guide` tag, and `queryByTestId('feedback-filter-missing')` is null.

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

`guide-notes.ts`:

```ts
export const stepLabel = (n: GuideNote, stepCount: number) =>
  isMissing(n, stepCount) ? (stepCount === 0 ? 'Whole guide' : 'Missing step') : `Step ${n.step_position}`
```

`feedback-sheet.tsx`: initial `useState<number | null | undefined>(steps.length === 0 ? null : initialStep)` and in the open-effect `setAt(steps.length === 0 ? null : initialStep)`. In the form replace the picker line with:

```tsx
{steps.length === 0 ? null : <StepPicker steps={steps} value={at} onChange={setAt} hereStep={initialStep} eyebrow="Which step?" />}
```

and the sub-line with `` `${authorFirstName} can pin it as a fix so the next builder sees it.${steps.length === 0 ? ' Your note goes on the whole guide.' : ''}` ``.

`community-notes.tsx`: hide the Missing filter chip when `steps.length === 0`: change `{anyMissing ? <Chip ... "Missing" .../> : null}` to `{anyMissing && steps.length > 0 ? ... : null}`. The lines 161/164/244 already call `stepLabel(n, steps.length)`; no change beyond verifying. `detail-screen.tsx:484` banner already uses `stepLabel`; verify by reading.

Web `tutorial-view.tsx:542,557`: where the note label is the literal "Missing step", use `tutorial.steps.length === 0 ? 'Whole guide' : 'Missing step'`.

- [ ] **Step 4: Run, expect PASS** — `cd packages/mobile && npx jest tests/unit/components/guides tests/unit/lib` and the web `tutorial-view` tests.

- [ ] **Step 5: Commit** — `fix: feedback on a guide with no steps goes on the whole guide` with trailers.

---

### Task 8: Review surfaces (mobile checklist, web admin)

**Files:**
- Modify: `packages/mobile/lib/review-checklist.ts`, `packages/web/components/admin-review-pane.tsx:24,37-39`, `packages/web/app/admin/review/[id]/page.tsx:135-146`, `packages/web/components/tutorial-review-panel.tsx:74`
- Test: `packages/mobile/tests/unit/lib/review-checklist.test.ts`, `packages/web/tests/unit/components/admin-review-pane.test.ts`, `packages/web/tests/unit/pages/admin-review.test.tsx`

**Interfaces:**
- Produces: mobile `reviewRows` first content row is `Guide content` (replaces `Steps`), and `Files` keeps only the STL/photo rule.

- [ ] **Step 1: Failing tests (mobile)**

```ts
it('Guide content is ok for steps alone', () => {
  const row = reviewRows(tutorial({ steps: [step({ photo_url: 'p.jpg' })], tutorial_pdf_url: null })).find((r) => r.title === 'Guide content')!
  expect(row.ok).toBe(true)
  expect(row.meta).toBe('1 step, all photographed')
})
it('Guide content is ok for a PDF alone', () => {
  const row = reviewRows(tutorial({ steps: [], tutorial_pdf_url: 'a.pdf' })).find((r) => r.title === 'Guide content')!
  expect(row.ok).toBe(true)
  expect(row.meta).toBe('PDF guide')
})
it('Guide content flags neither', () => {
  const row = reviewRows(tutorial({ steps: [], tutorial_pdf_url: null })).find((r) => r.title === 'Guide content')!
  expect(row.ok).toBe(false)
  expect(row.meta).toBe('No steps or PDF yet')
})
it('Files no longer flags a missing PDF', () => {
  const row = reviewRows(tutorial({ steps: [step({ photo_url: 'p.jpg' })], tutorial_pdf_url: null, kind: 'toy_adaptation' })).find((r) => r.title === 'Files')!
  expect(row.ok).toBe(true)
})
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement (mobile)** — in `review-checklist.ts` replace the `Steps` row with:

```ts
    {
      title: 'Guide content',
      meta: steps.length
        ? bare ? `${count(steps.length, 'step')}, ${bare} without a photo` : `${count(steps.length, 'step')}, all photographed`
        : pdf ? 'PDF guide' : 'No steps or PDF yet',
      ok: (steps.length > 0 && bare === 0) || (steps.length === 0 && pdf) || (steps.length > 0 && pdf),
    },
```

and the `Files` row with:

```ts
    {
      title: 'Files',
      meta: [pdf ? 'PDF' : 'no PDF', stl ? count(stl, 'STL file') : needsStl ? 'no STL yet' : 'none needed to print'].join(' · '),
      ok: !needsStl || stl > 0,
    },
```

(`ok` for Guide content: a PDF-only or steps+PDF guide passes; steps-only passes only when all photographed, matching the old Steps rule. Simplify to `ok: pdf || (steps.length > 0 && bare === 0)`; use that simpler form.)

- [ ] **Step 4: Web admin** — `admin-review-pane.tsx`: change the PDF check at lines 24 and 37-39 so a missing PDF is `bad` only when `tutorial.steps.length === 0`; otherwise `ok`/neutral with label "No PDF (steps used)". In `admin/review/[id]/page.tsx:135-146` do the same for the "No guide PDF" / "The step-by-step guide has not been uploaded." row, and add a **Steps** section rendering `tutorial.steps` (position, title, body, photo) in the same card style the page uses for Parts/Tools (read the page and copy its section markup; the data is already on `TutorialWithDetails`, confirm `steps` is selected by the admin query and add `steps:tutorial_steps(*)` if not). In `tutorial-review-panel.tsx:74` show "Tutorial PDF: Not uploaded" only when there are no steps; else "Not uploaded (steps used)". Write the matching tests first in the three web test files (neither → bad; steps only → not bad; PDF only → not bad; Steps section rendered for a steps-only guide).

- [ ] **Step 5: Run** — `cd packages/mobile && npx jest tests/unit/lib/review-checklist.test.ts tests/unit/components/organisation` and `cd packages/web && npx vitest run tests/unit/components/admin-review-pane.test.ts tests/unit/pages/admin-review.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit** — `fix: review checklists accept a guide that is steps-only or PDF-only` with trailers.

---

### Task 9: Server guard — never leave a live guide empty

**Files:**
- Modify: `packages/api/src/routes/tutorials.ts` (submit near 328-356; PATCH near the `EDITABLE` filter; `PUT /:id/steps` near 491-546)
- Test: `packages/api/tests/unit/` (the file that already tests tutorial submit/steps; `grep -l "nothing to update\|status: 'pending'" packages/api/tests -r`)

**Interfaces:**
- Produces: HTTP 400 `{ error: 'A guide needs steps or a PDF' }` when (a) status becomes `pending` with neither, (b) `PUT steps []` on a `pending`/`approved` guide with no PDF, (c) `PATCH tutorial_pdf_url: null` on a `pending`/`approved` guide with no steps. Draft guides unaffected.

- [ ] **Step 1: Failing tests** — using the existing API test harness (mock Supabase pattern in that file), add four cases: submit with neither → 400; submit with only a PDF → passes the new check; `PUT steps []` on an approved guide without a PDF → 400, with a PDF → 200; `PATCH {tutorial_pdf_url: null}` on an approved guide without steps → 400, on a draft → 200.

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement** — add near the top of `tutorials.ts`:

```ts
const NEEDS_CONTENT = 'A guide needs steps or a PDF'

/** True when a guide with these facts would have neither steps nor a PDF. */
export const hasNoGuideContent = (stepCount: number, pdfPath: string | null | undefined) =>
  stepCount === 0 && !pdfPath?.trim()
```

In the submit branch (where `build_minutes` and safety are checked) load the step count (`select('id', { count: 'exact', head: true })` on `tutorial_steps` for the id) and the current `tutorial_pdf_url`, and `return c.json({ error: NEEDS_CONTENT }, 400)` when `hasNoGuideContent`. In `PUT /:id/steps` empty branch and the PATCH handler's `tutorial_pdf_url: null` case, read the guide's current `status` plus the other half (PDF path or step count) and reject only when `status !== 'draft'` and `hasNoGuideContent(...)` would be true after the change.

- [ ] **Step 4: Run, expect PASS** — `cd packages/api && pnpm test`.

- [ ] **Step 5: Commit** — `fix(api): a submitted guide can never be left with neither steps nor a PDF` with trailers.

---

### Task 10: Copy that assumed a PDF or steps

**Files:**
- Modify: `packages/mobile/components/my-tutorials/sections/steps-section.tsx` (already done in Task 5), `packages/web/components/edit-steps-section.tsx:105`, `packages/web/app/tutorials/[id]/edit/page.tsx:288,300,488,491`, `packages/web/components/tutorial-view.tsx:647`, `packages/mobile/components/home/preview-screen.tsx` (hint), `packages/mobile/components/home/detail-screen.tsx:667-669`, `packages/web/app/dashboard/tutorials/page.tsx:72`, `docs/superpowers/specs/2026-09-02-mobile-guide-authoring-design.md:86`, `docs/superpowers/specs/2026-05-25-splat-connect-library-design.md:67`
- Test: update any test asserting the old strings

- [ ] **Step 1:** `grep -rn "PDF still carries\|step-by-step PDF\|Nothing to download\|PDF anyone can download\|come with an account" packages docs --include=*.ts --include=*.tsx --include=*.md --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=coverage` and list each hit.
- [ ] **Step 2:** Edit each: steps-section copy "Optional — the PDF still carries the guide" removed; `detail-screen.tsx:668` → `This guide has no files to download.`; `preview-screen.tsx` hint → `This guide has no PDF. Its steps are on the guide page.`; `tutorial-view.tsx:647` render the "comes with an account" line only when a PDF or STL exists; the two older specs get a one-line note `Superseded 2026-10-09: a guide needs steps or a PDF (see guide-editor-overhaul-design).`
- [ ] **Step 3:** Run mobile and web unit suites; fix string assertions that changed.
- [ ] **Step 4:** Commit — `fix: copy no longer assumes every guide has a PDF` with trailers.

---

### Task 11: Collaborators section; hub More rows

**Files:**
- Create: `packages/mobile/lib/team-state.ts`, `packages/mobile/components/my-tutorials/sections/collaborators-section.tsx`, `packages/mobile/app/(my)/tutorials/[id]/collaborators.tsx`
- Modify: `packages/mobile/lib/tutorial-sections.ts` (`SectionId` gets `'collaborators'`; `SECTION_LABEL`; **not** in `sectionsFor`, since it lives under More, or add it — see Step 5), `packages/mobile/app/(my)/tutorials/[id]/_layout.tsx` (`<Stack.Screen name="collaborators" options={{ title: 'Collaborators' }} />`), `packages/mobile/components/my-tutorials/hub.tsx:~310-335`, `packages/mobile/components/my-tutorials/sections/details-section.tsx` (remove the Backing button and `useRouter` import if now unused; reword the lead to `What the toy is and who it suits.`)
- Test: `tests/unit/lib/team-state.test.ts`, `tests/unit/components/my-tutorials/collaborators-section.test.tsx`, `tests/unit/components/my-tutorials/hub.test.tsx`, `details-section.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export type TeamState = 'primary' | 'collaborator' | 'pending' | 'declined'
  export interface TeamRow { profileId: string; name: string; state: TeamState; isContributor: boolean }
  export function teamRows(contributors: (TutorialContributor & { profiles: Profile })[], invites: (TutorialCollaboratorInvite & { profiles: Profile })[]): TeamRow[]
  export const TEAM_WORD: Record<TeamState, string>  // OWNER MEMBER PENDING REJECTED
  ```
- API: `POST /api/tutorials/:id/collaborators/invite` body `{ email }`; `DELETE /api/tutorials/:id/collaborators/:profileId`; data from `useDraft().tutorial.tutorial_contributors` and `.tutorial_collaborator_invites`; reload via `useDraft().reload`.

- [ ] **Step 1: Failing test for `teamRows`** (port of web `team-state.tsx`):

```ts
import { teamRows } from '../../../lib/team-state'
const profile = (id: string, name: string) => ({ id, name }) as any
it('puts the owner first, then members, then pending, then declined', () => {
  const rows = teamRows(
    [{ profile_id: 'a', role: 'primary', profiles: profile('a', 'Ada') }, { profile_id: 'b', role: 'collaborator', profiles: profile('b', 'Bo') }] as any,
    [{ invited_profile_id: 'd', status: 'declined', profiles: profile('d', 'Di') }, { invited_profile_id: 'c', status: 'pending', profiles: profile('c', 'Cy') }] as any
  )
  expect(rows.map((r) => r.state)).toEqual(['primary', 'collaborator', 'pending', 'declined'])
})
it('hides an accepted invite whose seat is visible or not', () => {
  const rows = teamRows([{ profile_id: 'a', role: 'primary', profiles: profile('a', 'Ada') }] as any, [
    { invited_profile_id: 'a', status: 'accepted', profiles: profile('a', 'Ada') },
    { invited_profile_id: 'z', status: 'accepted', profiles: profile('z', 'Zed') },
  ] as any)
  expect(rows).toHaveLength(1)
})
```

- [ ] **Step 2: Run, expect FAIL**, then create `lib/team-state.ts` as a direct port of `packages/web/components/team-state.tsx` lines 28-90 without the JSX `TeamBadge` and without Tailwind classes; export `TEAM_WORD = { primary: 'OWNER', collaborator: 'MEMBER', pending: 'PENDING', declined: 'REJECTED' }`. Run again, expect PASS.

- [ ] **Step 3: Failing component test**

```tsx
// journeys: T20
it('lists the team, and the owner can invite by email', async () => {
  mockDraft({ tutorial_contributors: [owner], tutorial_collaborator_invites: [], viewerId: 'a' })
  render(<CollaboratorsSection />)
  expect(screen.getByText('Ada')).toBeTruthy()
  expect(screen.getByText('OWNER')).toBeTruthy()
  fireEvent.changeText(screen.getByLabelText('Their email'), 'bo@example.com')
  fireEvent.press(screen.getByText('Invite'))
  await waitFor(() => expect(mockApi.post).toHaveBeenCalledWith('/api/tutorials/t1/collaborators/invite', { email: 'bo@example.com' }))
  expect(mockReload).toHaveBeenCalled()
})
it('shows the API error when the email has no account', async () => {
  mockApi.post.mockRejectedValueOnce(new Error('No account found with that email'))
  /* render as owner, type email, press Invite */
  await waitFor(() => expect(screen.getByText(/No account found/)).toBeTruthy())
})
it('lets the owner remove a member and a member leave', async () => { /* press Remove on Bo; expect mockApi.delete('/api/tutorials/t1/collaborators/b'); as Bo, row for self says Leave */ })
it('hides the invite box from a non-owner', () => { /* viewer is a collaborator: queryByLabelText('Their email') is null */ })
```

Fill the elided cases fully using the same mock helper as the first test (the viewer id comes from the auth hook the hub uses, e.g. `useSession`; read how `community-notes.tsx` gets `viewerId` and use the same hook).

- [ ] **Step 4: Implement `collaborators-section.tsx`**

Structure (use `Screen`, `ScrollView` with the three keyboard props used by the other sections, `TextField`, `Button`, `ErrorRow`, `SectionFooter section="collaborators"`):

```tsx
export function CollaboratorsSection() {
  return <DraftGate>{() => <CollaboratorsEditor />}</DraftGate>
}

function CollaboratorsEditor() {
  const { tutorial, reload } = useDraft()
  const viewerId = useViewerId()          // same hook community-notes uses
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (!tutorial) return null
  const rows = teamRows(tutorial.tutorial_contributors, tutorial.tutorial_collaborator_invites ?? [])
  const isOwner = rows.some((r) => r.state === 'primary' && r.profileId === viewerId)

  async function run(key: string, fn: () => Promise<unknown>) {
    setBusy(key); setError(null)
    try { await fn(); await reload() } catch (err) { logFailure('[CollaboratorsSection]', err); setError(apiMessage(err) ?? 'That did not work. Please try again.') } finally { setBusy(null) }
  }
  /* render rows: badge text TEAM_WORD[state] (tone: primary/collaborator mint, pending honey, declined apricot via theme.colors.tone),
     name, and for r.isContributor && r.state==='collaborator' && (isOwner || r.profileId===viewerId) a Button "Remove"/"Leave" calling
     run(r.profileId, () => apiClient.delete(`/api/tutorials/${tutorial.id}/collaborators/${r.profileId}`));
     if isOwner: TextField accessibilityLabel="Their email" keyboardType="email-address" autoCapitalize="none" + Button "Invite"
     calling run('invite', async () => { await apiClient.post(`/api/tutorials/${tutorial.id}/collaborators/invite`, { email: email.trim() }); setEmail('') }) */
}
```

Write the render block out in full in the file (no placeholders): a `<View>` per row with the badge `<Text>`, name `<Text>`, and optional `<Button variant="ghost">`; a heading "Invite a collaborator" above the email field; `<ErrorRow message={error} />`. `apiMessage` is exported from `@splat-connect/types`. Check `apiClient.delete` exists in `lib/api-client.ts`; if the method is named differently, use that name in both component and test.

Route file `app/(my)/tutorials/[id]/collaborators.tsx`:

```tsx
import { CollaboratorsSection } from '../../../../components/my-tutorials/sections/collaborators-section'
export default function CollaboratorsRoute() { return <CollaboratorsSection /> }
```

- [ ] **Step 5: Wire the hub, layout, and Details**

- `tutorial-sections.ts`: add `'collaborators'` to `SectionId` and `SECTION_LABEL` (`collaborators: 'Collaborators'`); leave it out of `sectionsFor` (it is reached from More, like Backing). Because `SECTION_ICON` in `hub.tsx` is `Record<SectionId, ...>`, add `collaborators: 'people-circle-outline'`. `sectionSummary` needs a `collaborators` case: `const n = t.tutorial_contributors.length; return n > 1 ? count(n, 'person') : 'Just you'`.
- `hub.tsx` More rows: change the Collaborators `View` to a `Pressable` (same props as the Backing row) with `onPress={() => router.push(`/tutorials/${id}/collaborators`)}`, `accessibilityRole="button"`, `accessibilityLabel={`Collaborators. ...`}`, and the value `names || 'Just you'` (drop `' - edit on the web'`). Change the Recommendations `View` to a `Pressable` to `/tutorials/${id}/picks` with value `` `${tutorial.tutorial_recommendations.length} of 3` ``. Update the comment above `More` to: `Facts under the checklist. Backing, Collaborators and Recommendations each open their own screen.`
- `_layout.tsx`: add the `collaborators` Stack.Screen.
- `details-section.tsx`: remove the `<Button label="Backing" .../>`, the unused `Button`/`useRouter` imports, and reword the lead.
- Tests: `hub.test.tsx` — the Collaborators and Recommendations rows are buttons that navigate (`router.push` called with the right path); `details-section.test.tsx` — no "Backing" button.

- [ ] **Step 6: Run** — `cd packages/mobile && npx jest tests/unit/lib/team-state.test.ts tests/unit/components/my-tutorials` then `npx tsc --noEmit`.
Expected: PASS and clean.

- [ ] **Step 7: Commit** (two commits: team-state + section; then hub/details wiring) with trailers.

---

### Task 12: InfoHint component and moving the blurbs behind it

**Files:**
- Create: `packages/mobile/components/ui/InfoHint.tsx`
- Modify: `details-section.tsx` and every `styles.hint` use in `packages/mobile/components/my-tutorials/sections/*.tsx` (`grep -n "styles.hint\|<Text style={styles.hint}" -r components/my-tutorials`)
- Test: `packages/mobile/tests/unit/components/ui/InfoHint.test.tsx`

**Interfaces:**
- Produces: `export function InfoHint({ title, children }: { title: string; children: React.ReactNode }): JSX.Element`. ⓘ button `accessibilityLabel={`About ${title}`}`; card shows `title`, body, and a `Got it` button; closes on Got it or backdrop press. `testID="info-hint-card"` on the card.

- [ ] **Step 1: Failing test**

```tsx
// journeys: T20
import { fireEvent, render, screen } from '@testing-library/react-native'
import { InfoHint } from '../../../../components/ui/InfoHint'

it('opens a card with the explanation and closes with Got it', () => {
  render(<InfoHint title="Works with">The switches this build accepts.</InfoHint>)
  expect(screen.queryByTestId('info-hint-card')).toBeNull()
  fireEvent.press(screen.getByLabelText('About Works with'))
  expect(screen.getByTestId('info-hint-card')).toBeTruthy()
  expect(screen.getByText('The switches this build accepts.')).toBeTruthy()
  fireEvent.press(screen.getByText('Got it'))
  expect(screen.queryByTestId('info-hint-card')).toBeNull()
})
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement**

```tsx
// packages/mobile/components/ui/InfoHint.tsx
//
// An ⓘ beside a label that opens the explanation in a centred card. Replaces
// the grey paragraphs under fields. The Modal is rendered here, inside the
// screen's own tree: an iOS formSheet cannot be presented over from the root.
import { useState, type ReactNode } from 'react'
import { Modal, Pressable, Text, View, StyleSheet } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { theme } from '../../lib/theme'
import { Button } from './Button'

export function InfoHint({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={`About ${title}`} onPress={() => setOpen(true)} hitSlop={12}>
        <Ionicons name="information-circle-outline" size={20} color={theme.colors.primaryDeep} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Close">
          <Pressable testID="info-hint-card" style={styles.card} onPress={() => {}}>
            <Text style={styles.title} accessibilityRole="header">{title}</Text>
            <Text style={styles.body}>{children}</Text>
            <Button label="Got it" onPress={() => setOpen(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: theme.colors.scrim, justifyContent: 'center', padding: theme.spacing(5) },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radii.card, padding: theme.spacing(4), gap: theme.spacing(3), ...theme.shadow(3) },
  title: { fontFamily: theme.fonts.bold, fontSize: theme.type.title, color: theme.colors.ink },
  body: { fontFamily: theme.fonts.regular, fontSize: theme.type.label, color: theme.colors.muted, lineHeight: 20 },
})
```

(If `theme.type.title` / `theme.shadow` differ, use the names the neighbouring `feedback-sheet.tsx` uses, which this mirrors.) The Modal-in-tree constraint: if a section screen is a formSheet (check `app/(my)/tutorials/[id]/_layout.tsx` `presentation`; it is a plain Stack so `Modal` works), no host is needed. Confirm on the phone in Task 14.

- [ ] **Step 4: Run, expect PASS.**

- [ ] **Step 5: Move the blurbs.** For each `<Text style={styles.hint}>…</Text>` that is explanation (Works with, "If someone would rather not build it", Closing line, Age range, build time, and the equivalents in other sections), delete the paragraph and put `<InfoHint title="<label>">…same text…</InfoHint>` in a label row. Add to `details-section.tsx`:

```tsx
function LabelRow({ children, hint }: { children: string; hint?: { title: string; text: string } }) {
  return (
    <View style={styles.labelRow}>
      <Text style={styles.label}>{children}</Text>
      {hint ? <InfoHint title={hint.title}>{hint.text}</InfoHint> : null}
    </View>
  )
}
```

with `labelRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2), marginBottom: theme.spacing(2) }`. `TextField` takes `label` as a prop (the Works-with field), so for TextField-labelled fields add an optional `labelAccessory?: ReactNode` prop to `components/ui/TextField.tsx` rendered beside the label, and pass `<InfoHint ...>`; add one test in `tests/unit/components/ui/` that the accessory renders. Instructions (not explanations), like "Leave both blank if it suits any age", move into the `InfoHint` text rather than staying inline, for consistency.

- [ ] **Step 6: Run** — `cd packages/mobile && npx jest tests/unit/components` ; fix tests that asserted the hint text being visible by opening the hint first.

- [ ] **Step 7: Commit** (InfoHint + test; then the migration of hints) with trailers.

---

### Task 13: Build-time slider

**Files:**
- Create: `packages/mobile/components/ui/BuildTimeSlider.tsx`
- Modify: `details-section.tsx`, `packages/mobile/package.json` (via `npx expo install`)
- Test: `packages/mobile/tests/unit/components/ui/BuildTimeSlider.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export const indexForMinutes = (m: number | null): number | null
  export const minutesForIndex = (i: number): number
  export function BuildTimeSlider({ value, onCommit }: { value: number | null; onCommit: (minutes: number) => void }): JSX.Element
  ```
  `BUILD_TIME_OPTIONS` from `@splat-connect/types` supplies the stops; the slider works in indices so uneven minutes sit evenly.

- [ ] **Step 1: Install the library the SDK expects**

Read https://docs.expo.dev/versions/v57.0.0/sdk/ for the slider guidance, then: `cd packages/mobile && npx expo install @react-native-community/slider`. If the install notes it is already bundled, skip. **Fallback if SDK 57 has no compatible build:** do not hand-roll a native module; use a `PanResponder` track in the same component (same exported interface). Record which route was taken in the commit message.

- [ ] **Step 2: Failing tests (pure mapping + behaviour)**

```tsx
import { BUILD_TIME_OPTIONS } from '@splat-connect/types'
import { indexForMinutes, minutesForIndex, BuildTimeSlider } from '../../../../components/ui/BuildTimeSlider'

it('maps minutes to the nearest stop and back', () => {
  expect(indexForMinutes(60)).toBe(BUILD_TIME_OPTIONS.indexOf(60))
  expect(minutesForIndex(0)).toBe(10)
  expect(minutesForIndex(BUILD_TIME_OPTIONS.length - 1)).toBe(240)
})
it('has no index for an unset value', () => {
  expect(indexForMinutes(null)).toBeNull()
})
it('snaps an off-list stored value (e.g. 100) to the nearest stop', () => {
  expect(minutesForIndex(indexForMinutes(100)!)).toBe(90)
})
it('shows Not set until a value exists and saves only on release', () => {
  const onCommit = jest.fn()
  render(<BuildTimeSlider value={null} onCommit={onCommit} />)
  expect(screen.getByText('Not set')).toBeTruthy()
  const slider = screen.getByLabelText('Build time')
  fireEvent(slider, 'valueChange', 5)
  expect(onCommit).not.toHaveBeenCalled()
  fireEvent(slider, 'slidingComplete', 5)
  expect(onCommit).toHaveBeenCalledWith(BUILD_TIME_OPTIONS[5])
})
it('labels the top stop "4 h or more"', () => {
  render(<BuildTimeSlider value={240} onCommit={() => {}} />)
  expect(screen.getByText('4 h or more')).toBeTruthy()
})
```

- [ ] **Step 3: Run, expect FAIL.**

- [ ] **Step 4: Implement**

```tsx
// packages/mobile/components/ui/BuildTimeSlider.tsx
//
// Build time as a slider over BUILD_TIME_OPTIONS. The options are uneven
// (10, 15, 20, 30 ... 240 minutes), so the slider moves through their
// indices and each stop gets equal width. The value saves on release, not on
// every drag tick, so a drag is one autosave rather than dozens.
import { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Slider from '@react-native-community/slider'
import { BUILD_TIME_OPTIONS, formatBuildTime } from '@splat-connect/types'
import { theme } from '../../lib/theme'

const LAST = BUILD_TIME_OPTIONS.length - 1

export function indexForMinutes(m: number | null): number | null {
  if (m == null) return null
  let best = 0
  BUILD_TIME_OPTIONS.forEach((opt, i) => {
    if (Math.abs(opt - m) < Math.abs(BUILD_TIME_OPTIONS[best] - m)) best = i
  })
  return best
}
export const minutesForIndex = (i: number) => BUILD_TIME_OPTIONS[Math.max(0, Math.min(LAST, Math.round(i)))]

const label = (m: number) => (m === BUILD_TIME_OPTIONS[LAST] ? '4 h or more' : formatBuildTime(m))

export function BuildTimeSlider({ value, onCommit }: { value: number | null; onCommit: (minutes: number) => void }) {
  const stored = indexForMinutes(value)
  const [drag, setDrag] = useState<number | null>(stored)
  useEffect(() => setDrag(stored), [stored])
  return (
    <View>
      <Text style={styles.value}>{drag == null ? 'Not set' : label(minutesForIndex(drag))}</Text>
      <Slider
        accessibilityLabel="Build time"
        minimumValue={0}
        maximumValue={LAST}
        step={1}
        value={drag ?? 0}
        minimumTrackTintColor={drag == null ? theme.colors.border : theme.colors.primary}
        maximumTrackTintColor={theme.colors.surfaceSunken}
        thumbTintColor={drag == null ? theme.colors.muted : theme.colors.primary}
        onValueChange={setDrag}
        onSlidingComplete={(i) => onCommit(minutesForIndex(i))}
      />
      <View style={styles.ends}>
        <Text style={styles.end}>{label(BUILD_TIME_OPTIONS[0])}</Text>
        <Text style={styles.end}>{label(BUILD_TIME_OPTIONS[LAST])}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  value: { fontFamily: theme.fonts.bold, fontSize: theme.type.label, color: theme.colors.ink, marginBottom: theme.spacing(1) },
  ends: { flexDirection: 'row', justifyContent: 'space-between' },
  end: { fontFamily: theme.fonts.regular, fontSize: theme.type.caption, color: theme.colors.muted },
})
```

If the test renders the library's native component under Jest and it needs a mock, add `jest.mock('@react-native-community/slider', () => 'Slider')` to `jest-setup.js` (event simulation in the test uses the prop callbacks via `fireEvent(slider, 'valueChange', n)`; adjust the event names to `onValueChange` / `onSlidingComplete` props if `fireEvent` cannot map them).

- [ ] **Step 5: Use it in Details.** Replace the build-time chip row and its hint with:

```tsx
<LabelRow hint={{ title: 'About how long does it take?', text: "Hands-on time only — printing time isn't included." }}>About how long does it take?</LabelRow>
<BuildTimeSlider value={tutorial.build_minutes} onCommit={(m) => save({ build_minutes: m })} />
```

Remove the now-unused `BUILD_TIME_OPTIONS`, `formatBuildTime` imports there. Update `details-section*.test.tsx` expectations that pressed build-time chips: drive the slider via `fireEvent(screen.getByLabelText('Build time'), 'slidingComplete', n)` and assert `save` called with `{ build_minutes: BUILD_TIME_OPTIONS[n] }`.

- [ ] **Step 6: Run** — `cd packages/mobile && npx jest tests/unit/components && npx tsc --noEmit`. Expected PASS. If a native module was added: `npx expo prebuild` is needed before the phone build (note in the commit).

- [ ] **Step 7: Commit** with trailers: `feat(mobile): build time is a slider`.

---

### Task 14: Animated save indicator

**Files:**
- Modify: `packages/mobile/components/my-tutorials/sections/save-chip.tsx`, `packages/mobile/app/(my)/tutorials/[id]/_layout.tsx:45`
- Test: `packages/mobile/tests/unit/components/my-tutorials/save-chip.test.tsx`

**Interfaces:**
- Produces: `SaveChip` renders icons instead of text. Keep `export const SAVE_CHIP_LABEL` (the layout uses it to decide whether to mount the header item; its strings become the accessibility labels). `testID="save-chip"` stays on the container; add `testID="save-chip-saving"` and `testID="save-chip-saved"` on the icons.

- [ ] **Step 1: Update the tests first** (keep the `// journeys: T20` line):

```tsx
it('shows the saving icon while a write is in flight', () => {
  mockDraft.saveState = 'saving'
  render(<SaveChip />)
  expect(screen.getByLabelText('Saving')).toBeTruthy()
  expect(screen.getByTestId('save-chip-saving')).toBeTruthy()
})
it('shows the tick when a write landed', () => {
  mockDraft.saveState = 'saved'
  render(<SaveChip />)
  expect(screen.getByLabelText('Saved')).toBeTruthy()
  expect(screen.getByTestId('save-chip-saved')).toBeTruthy()
})
/* keep the two existing tests: idle renders nothing; error renders nothing */
```

- [ ] **Step 2: Run, expect FAIL.**

- [ ] **Step 3: Implement** with Reanimated (already a dependency):

```tsx
import { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, withSpring, useReducedMotion } from 'react-native-reanimated'
import { Ionicons } from '@expo/vector-icons'
import { useDraft } from '../../../lib/use-tutorial-draft'
import { theme } from '../../../lib/theme'
import type { DraftSaveState } from '../../../lib/use-tutorial-draft'

export const SAVE_CHIP_LABEL: Record<DraftSaveState, string | null> = {
  idle: null,
  saving: 'Saving',
  saved: 'Saved',
  // The error itself is shown by an ErrorRow in the section; an icon as well would be the same news twice.
  error: null,
}

export function SaveChip() {
  const { saveState } = useDraft()
  const reduce = useReducedMotion()
  const bob = useSharedValue(0)
  const pop = useSharedValue(0)
  useEffect(() => {
    if (saveState === 'saving' && !reduce) {
      bob.value = withRepeat(withSequence(withTiming(-3, { duration: 350 }), withTiming(0, { duration: 350 })), -1)
    } else bob.value = 0
    pop.value = saveState === 'saved' ? (reduce ? 1 : withSpring(1, { damping: 8 })) : 0
  }, [saveState, reduce, bob, pop])
  const cloud = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value }] }))
  const tick = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }], opacity: pop.value }))

  const label = SAVE_CHIP_LABEL[saveState]
  if (!label) return null
  return saveState === 'saving' ? (
    <Animated.View testID="save-chip" accessibilityLabel={label} style={cloud}>
      <Ionicons testID="save-chip-saving" name="cloud-upload-outline" size={22} color={theme.colors.primary} />
    </Animated.View>
  ) : (
    <Animated.View testID="save-chip" accessibilityLabel={label} style={tick}>
      <Ionicons testID="save-chip-saved" name="checkmark-circle" size={22} color={theme.colors.success} />
    </Animated.View>
  )
}
```

`StyleSheet` import can be dropped if unused. The "Saved" hold-and-fade duration stays owned by `use-tutorial-draft.tsx:60` (state returns to `idle`), which unmounts the icon; a fade-out is not added (YAGNI), the tick simply disappears when state goes idle.

Layout `_layout.tsx` needs no change (it keys off `SAVE_CHIP_LABEL[saveState]`), but update its comment mention of "chip" only if it describes text.

- [ ] **Step 4: Run, expect PASS** — `cd packages/mobile && npx jest tests/unit/components/my-tutorials/save-chip.test.tsx`; if the Reanimated Jest mock lacks `useReducedMotion`, add it to the existing Reanimated mock in `jest-setup.js` (`useReducedMotion: () => false`).

- [ ] **Step 5: Commit** — `feat(mobile): the save indicator is an animated cloud and tick, not text` with trailers.

---

### Task 15: Whole-repo verification and the phone pass

**Files:** none (verification). Any fix found here is its own commit.

- [ ] **Step 1: Mobile whole suite and types**

Run: `cd packages/mobile && npx tsc --noEmit && npx jest`
Expected: tsc clean; every suite passes (not a subset).

- [ ] **Step 2: Other packages**

Run: `cd packages/types && npx tsc --noEmit`; `cd packages/api && npx tsc --noEmit && pnpm test`; `cd packages/web && npx tsc --noEmit && npx vitest run tests/unit` (use the repo's configured runners).
Expected: all pass.

- [ ] **Step 3: Journeys and parity guards**

Run: `node scripts/journeys/check.mjs` (journey tags intact) and, if the repo exposes it, the mobile route-parity test (`grep -rl "route-parity\|mobile-nav" packages/*/tests -r`). A new `collaborators` route and hub row must pass the guard that pairs a web hub row with its mobile screen.
Expected: no missing tagged tests.

- [ ] **Step 4: e2e**

Update `packages/mobile/tests/e2e/helpers.ts` and `packages/web/tests/e2e/helpers.ts` fixtures: `createTutorial` gains `withSteps` alongside `withPdf`, and the specs that used `withPdf:false` to produce a "missing PDF" gap (`guides-authoring.spec.ts:123-138`, `guides-authoring-sections.spec.ts:117`, `guides-authoring-edges.spec.ts:129`, web `edit-tutorial.spec.ts:257-268`) now use `withPdf:false, withSteps:false` and the new label "Steps or a guide PDF". Run mobile and web e2e **one at a time** (never concurrently; lsof the e2e port first).

- [ ] **Step 5: On the phone** (`~/.local/bin/iphone-qa start`, API `pnpm dev` on :3101, Metro detached via nohup; after the slider install run `npx expo prebuild` if a native module was added)

Walk, in light and dark mode: save icon animates while typing a title and ticks after; ⓘ cards open and close on Details; slider moves and saves on release; progress strip updates after fixing a gap; Steps shows the choice / redirect card / editor in the three states; Files marks the PDF optional with steps; hub More → Collaborators (invite an unknown email → error shown) and Recommendations opens Worth a look; Feedback sheet on a PDF-only guide has no picker and Post works with just a note; Backing button gone from Details. Stop with `iphone-qa stop` when done.

- [ ] **Step 6: `graphify update .`** (AST-only), then final commit if it changed tracked files.

- [ ] **Step 7: Report** what shipped, what was not verified, the maturity row-count result from Task 1, and that nothing is pushed.
