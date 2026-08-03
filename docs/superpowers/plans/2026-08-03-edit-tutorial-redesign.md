# Edit Tutorial Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the edit-tutorial page's seven stacked `<details>` accordions with a free-jump pill stepper, a sticky Submit-for-review bar, and shared save-confirmation feedback (toast + persistent "last saved" line), per `docs/superpowers/specs/2026-08-03-edit-tutorial-redesign-design.md`.

**Architecture:** A new pure status-computation module (`lib/edit-steps.ts`) mirrors `getMissingFields()` to classify each of the 7 sections as done/attention/neutral. A new client component (`EditStepper`) renders the pill row, the active section's content, and the sticky bar, replacing the `<details>` stack in `page.tsx`. Two small shared primitives — a toast provider and a live "last saved" line — are wired into every section's existing save action, reusing one implementation instead of duplicating feedback logic per section.

**Tech Stack:** Next.js 16 App Router (Server Components + `'use server'` actions), React 19 Client Components, Tailwind v4 `@theme`/`@layer components` tokens already in `packages/web/app/globals.css`, Vitest + Testing Library for unit tests. No new dependencies.

## Global Constraints

- Every data fetch and every `'use server'` action in `page.tsx` stays unchanged (names, signatures, and bodies of `askOrg`, `withdrawOrg`, `saveDetails`, `inviteCollaborator`, `removeCollaborator`, `patchFileUrls`, `saveParts`, `saveTools`, `addStlFileRecord`, `submitForReview`).
- Each section component's internal editing logic (form fields, validation, `EditDetailsSection`'s 409 conflict-detection UI) is unchanged — only save-confirmation feedback is added.
- Step status rules mirror `getMissingFields()` in `packages/web/lib/validation.ts` exactly — no second copy of the required-fields rule. Description is optional and never affects `details`' status.
- The stepper is free-jump, not linear: every pill is clickable at any time, in any order.
- The sticky bar carries Submit only, never a general Save. Each section keeps its own inline save action.
- Active step persists in the URL as `?step=<id>` and is restored on load.
- The rejection-note banner stays a separate alert above the stepper, unchanged from today.
- Save confirmation is one shared toast implementation and one shared "last saved" line implementation, reused by every section — never duplicated per section.
- No new npm dependencies. Use existing design tokens (`var(--color-*)`, `var(--shadow-*)`, `var(--ease-out-quart)`) from `globals.css`, not new hex values.

---

## File structure

**New files:**
- `packages/web/lib/relative-time.ts` — pure `formatRelativeTime()`.
- `packages/web/tests/unit/lib/relative-time.test.ts`
- `packages/web/lib/use-live-relative-time.ts` — hook wrapping `formatRelativeTime()` with a ticking re-render.
- `packages/web/components/save-status-line.tsx` — `<SaveStatusLine savedAt={...} />`, the shared "last saved" UI.
- `packages/web/tests/unit/components/save-status-line.test.tsx`
- `packages/web/components/toast.tsx` — `ToastProvider` + `useToast()`, the shared toast.
- `packages/web/tests/unit/components/toast.test.tsx`
- `packages/web/lib/edit-steps.ts` — `EditStepId`, `EditStepStatus`, `EditStep` types + `computeStepStatuses()`.
- `packages/web/tests/unit/lib/edit-steps.test.ts`
- `packages/web/components/edit-stepper.tsx` — the pill row, active content, sticky bar.
- `packages/web/tests/unit/components/edit-stepper.test.tsx`
- `packages/web/tests/unit/components/edit-items-section.test.tsx` — none existed before; added because this task adds new save-feedback behavior to `EditItemsSection`.
- `packages/web/tests/unit/components/add-stl-form.test.tsx` — same reason.

**Modified files:**
- `packages/web/app/globals.css` — new `.step-pill*`, `.sticky-submit-bar*`, `.edit-toast` component classes.
- `packages/web/components/edit-details-section.tsx`, `edit-files-section.tsx`, `edit-items-section.tsx`, `add-stl-form.tsx` — wire toast + persistent save-status line into each existing save action.
- `packages/web/components/edit-backing-section.tsx`, `edit-collaborators-section.tsx` — wire toast only (no persistent line: neither has one singular "save" button, each row acts independently).
- `packages/web/tests/unit/components/edit-details-section.test.tsx`, `edit-files-section.test.tsx`, `edit-backing-section.test.tsx`, `edit-collaborators-section.test.tsx` — add coverage for the new feedback.
- `packages/web/app/tutorials/[id]/edit/page.tsx` — replace the `<details>` stack with `EditStepper`; build the `EditStep[]` manifest via `computeStepStatuses()`.
- `packages/web/tests/unit/pages/edit-tutorial.test.tsx` — rewritten for the new structure, per the design's testing note.

**Deleted files:**
- `packages/web/components/submit-for-review-button.tsx` — superseded by the sticky bar built into `EditStepper`. Confirmed as the only file that imported it besides `page.tsx` and its own file.

---

### Task 1: Relative-time formatting

**Files:**
- Create: `packages/web/lib/relative-time.ts`
- Test: `packages/web/tests/unit/lib/relative-time.test.ts`

**Interfaces:**
- Produces: `formatRelativeTime(iso: string, now?: Date): string` — used by Task 2's hook and, through it, by every save-status line and the sticky bar's quiet indicator.

- [ ] **Step 1: Write the failing test**

```ts
// packages/web/tests/unit/lib/relative-time.test.ts
import { describe, it, expect } from 'vitest'
import { formatRelativeTime } from '@/lib/relative-time'

describe('formatRelativeTime', () => {
  const now = new Date('2026-08-03T12:00:00.000Z')

  it('returns "just now" for under a minute', () => {
    expect(formatRelativeTime('2026-08-03T11:59:31.000Z', now)).toBe('just now')
  })

  it('returns minutes for under an hour', () => {
    expect(formatRelativeTime('2026-08-03T11:55:00.000Z', now)).toBe('5m ago')
  })

  it('returns hours for under a day', () => {
    expect(formatRelativeTime('2026-08-03T09:00:00.000Z', now)).toBe('3h ago')
  })

  it('returns days at a day or more', () => {
    expect(formatRelativeTime('2026-08-01T12:00:00.000Z', now)).toBe('2d ago')
  })

  it('clamps a timestamp slightly in the future to "just now"', () => {
    expect(formatRelativeTime('2026-08-03T12:00:05.000Z', now)).toBe('just now')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @splat-connect/web test:unit -- tests/unit/lib/relative-time.test.ts`
Expected: FAIL — `Cannot find module '@/lib/relative-time'`

- [ ] **Step 3: Write the implementation**

```ts
// packages/web/lib/relative-time.ts
/**
 * Formats an ISO timestamp as a short relative string for save-confirmation UI.
 * `now` is injectable so callers (and tests) get a deterministic reference point.
 */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const diffSec = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 1000))
  if (diffSec < 60) return 'just now'
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHour = Math.round(diffMin / 60)
  if (diffHour < 24) return `${diffHour}h ago`
  const diffDay = Math.round(diffHour / 24)
  return `${diffDay}d ago`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @splat-connect/web test:unit -- tests/unit/lib/relative-time.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/lib/relative-time.ts packages/web/tests/unit/lib/relative-time.test.ts
git commit -m "feat(web): add formatRelativeTime for save-confirmation UI"
```

---

### Task 2: Shared "last saved" line

**Files:**
- Create: `packages/web/lib/use-live-relative-time.ts`
- Create: `packages/web/components/save-status-line.tsx`
- Test: `packages/web/tests/unit/components/save-status-line.test.tsx`

**Interfaces:**
- Consumes: `formatRelativeTime` from `@/lib/relative-time` (Task 1).
- Produces: `useLiveRelativeTime(iso: string | null): string | null`; `<SaveStatusLine savedAt={string | null} />` — the single shared "last saved" UI every section (Task 7-10) and the sticky bar (Task 5) render.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/web/tests/unit/components/save-status-line.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SaveStatusLine } from '@/components/save-status-line'

describe('SaveStatusLine', () => {
  it('renders nothing when there is no save yet', () => {
    const { container } = render(<SaveStatusLine savedAt={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows "Last saved just now" right after a save', () => {
    render(<SaveStatusLine savedAt={new Date().toISOString()} />)
    expect(screen.getByText('Last saved just now')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @splat-connect/web test:unit -- tests/unit/components/save-status-line.test.tsx`
Expected: FAIL — `Cannot find module '@/components/save-status-line'`

- [ ] **Step 3: Write the implementation**

```ts
// packages/web/lib/use-live-relative-time.ts
'use client'
import { useEffect, useState } from 'react'
import { formatRelativeTime } from '@/lib/relative-time'

// The interval only forces a re-render; formatRelativeTime does the actual
// (already-tested) math each tick, so this hook has no logic of its own
// worth a separate test beyond what SaveStatusLine's test exercises.
export function useLiveRelativeTime(iso: string | null): string | null {
  const [, forceTick] = useState(0)

  useEffect(() => {
    if (!iso) return
    const id = setInterval(() => forceTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [iso])

  return iso ? formatRelativeTime(iso) : null
}
```

```tsx
// packages/web/components/save-status-line.tsx
'use client'
import { useLiveRelativeTime } from '@/lib/use-live-relative-time'

export function SaveStatusLine({ savedAt }: { savedAt: string | null }) {
  const label = useLiveRelativeTime(savedAt)
  if (!label) return null
  return <p className="text-xs text-muted">Last saved {label}</p>
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @splat-connect/web test:unit -- tests/unit/components/save-status-line.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/lib/use-live-relative-time.ts packages/web/components/save-status-line.tsx packages/web/tests/unit/components/save-status-line.test.tsx
git commit -m "feat(web): add shared SaveStatusLine for save-confirmation UI"
```

---

### Task 3: Shared toast

**Files:**
- Create: `packages/web/components/toast.tsx`
- Test: `packages/web/tests/unit/components/toast.test.tsx`

**Interfaces:**
- Produces: `ToastProvider` (wraps `EditStepper`'s subtree in Task 5), `useToast(): (message: string) => void` — every section's save handler (Tasks 7-12) calls this on success.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/web/tests/unit/components/toast.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ToastProvider, useToast } from '@/components/toast'

function Trigger({ message }: { message: string }) {
  const showToast = useToast()
  return (
    <button type="button" onClick={() => showToast(message)}>
      Trigger
    </button>
  )
}

describe('ToastProvider / useToast', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('shows the message after showToast is called', () => {
    render(
      <ToastProvider>
        <Trigger message="Details saved" />
      </ToastProvider>
    )
    fireEvent.click(screen.getByText('Trigger'))
    expect(screen.getByRole('status')).toHaveTextContent('Details saved')
  })

  it('clears the message on its own after a few seconds', () => {
    render(
      <ToastProvider>
        <Trigger message="Details saved" />
      </ToastProvider>
    )
    fireEvent.click(screen.getByText('Trigger'))
    vi.advanceTimersByTime(3000)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('useToast is a safe no-op outside a provider', () => {
    render(<Trigger message="hi" />)
    expect(() => fireEvent.click(screen.getByText('Trigger'))).not.toThrow()
    expect(screen.queryByRole('status')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @splat-connect/web test:unit -- tests/unit/components/toast.test.tsx`
Expected: FAIL — `Cannot find module '@/components/toast'`

- [ ] **Step 3: Write the implementation**

```tsx
// packages/web/components/toast.tsx
'use client'
/**
 * One shared toast for every edit-page save action. useToast() defaults to a
 * no-op outside a ToastProvider so section components — most of which already
 * have standalone unit tests that render them without a provider — keep
 * working unchanged; only the live app (ToastProvider lives in EditStepper)
 * ever shows anything.
 */
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

type ShowToast = (message: string) => void

const ToastContext = createContext<ShowToast>(() => {})

export function useToast(): ShowToast {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((msg: string) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setMessage(msg)
    timeoutRef.current = setTimeout(() => setMessage(null), 3000)
  }, [])

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      {message && (
        <div role="status" aria-live="polite" className="edit-toast">
          {message}
        </div>
      )}
    </ToastContext.Provider>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @splat-connect/web test:unit -- tests/unit/components/toast.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/components/toast.tsx packages/web/tests/unit/components/toast.test.tsx
git commit -m "feat(web): add shared ToastProvider for save-confirmation UI"
```

---

### Task 4: Step status computation

**Files:**
- Create: `packages/web/lib/edit-steps.ts`
- Test: `packages/web/tests/unit/lib/edit-steps.test.ts`

**Interfaces:**
- Consumes: `getMissingFields(tutorial: TutorialWithDetails): string[]` from `@/lib/validation` (existing, unchanged).
- Produces: `EditStepId`, `EditStepStatus`, `EditStep` types and `computeStepStatuses(tutorial: TutorialWithDetails, backing: TutorialOrg[]): Record<EditStepId, { status: EditStepStatus; attentionNote?: string }>` — consumed by `EditStepper` (Task 5) and `page.tsx` (Task 13).

- [ ] **Step 1: Write the failing test**

```ts
// packages/web/tests/unit/lib/edit-steps.test.ts
import { describe, it, expect } from 'vitest'
import { computeStepStatuses } from '@/lib/edit-steps'
import type { TutorialWithDetails } from '@splat-connect/types'

function tutorial(overrides: Partial<TutorialWithDetails> = {}): TutorialWithDetails {
  return {
    id: 't1',
    title: 'Spoon Holder',
    description: null,
    difficulty: 'easy',
    status: 'draft',
    toy_photo_url: 'https://example.com/photo.jpg',
    tutorial_pdf_url: 'https://example.com/tutorial.pdf',
    rejection_note: null,
    created_at: '',
    updated_at: '',
    reviewed_at: null,
    reviewed_by: null,
    reviewed_for_org_id: null,
    parts: [{ id: 'p1', tutorial_id: 't1', name: 'Screw', quantity: 4, is_optional: false, buy_links: [] }],
    tools: [{ id: 'to1', tutorial_id: 't1', name: 'Screwdriver', is_optional: false, buy_links: [] }],
    stl_files: [],
    tutorial_contributors: [
      {
        tutorial_id: 't1',
        profile_id: 'p1',
        role: 'primary',
        added_at: '',
        profiles: { id: 'p1', name: 'Primary', email: 'p@test.local', role: 'contributor', created_at: '' },
      },
    ],
    ...overrides,
  }
}

describe('computeStepStatuses', () => {
  it('marks details, files, parts, tools done when all required fields are present', () => {
    const statuses = computeStepStatuses(tutorial(), [])
    expect(statuses.details.status).toBe('done')
    expect(statuses.files.status).toBe('done')
    expect(statuses.parts.status).toBe('done')
    expect(statuses.tools.status).toBe('done')
  })

  it('flags details as attention when title is missing, naming the missing field', () => {
    const statuses = computeStepStatuses(tutorial({ title: '' }), [])
    expect(statuses.details.status).toBe('attention')
    expect(statuses.details.attentionNote).toBe('Title')
  })

  it('does not flag details for a missing description', () => {
    const statuses = computeStepStatuses(tutorial({ description: null }), [])
    expect(statuses.details.status).toBe('done')
  })

  it('flags files as attention when either the photo or PDF is missing', () => {
    const statuses = computeStepStatuses(tutorial({ toy_photo_url: null }), [])
    expect(statuses.files.status).toBe('attention')
    expect(statuses.files.attentionNote).toBe('Toy photo')
  })

  it('flags parts as attention when there are zero parts', () => {
    const statuses = computeStepStatuses(tutorial({ parts: [] }), [])
    expect(statuses.parts.status).toBe('attention')
  })

  it('flags tools as attention when there are zero tools', () => {
    const statuses = computeStepStatuses(tutorial({ tools: [] }), [])
    expect(statuses.tools.status).toBe('attention')
  })

  it('stl is neutral when empty and done once a file exists', () => {
    expect(computeStepStatuses(tutorial({ stl_files: [] }), []).stl.status).toBe('neutral')
    expect(
      computeStepStatuses(tutorial({ stl_files: [{ id: 's1', tutorial_id: 't1', filename: 'a.stl', file_url: 'https://x/a.stl' }] }), [])
        .stl.status
    ).toBe('done')
  })

  it('backing is neutral when no organisation has been asked and done once one has', () => {
    expect(computeStepStatuses(tutorial(), []).backing.status).toBe('neutral')
    expect(
      computeStepStatuses(tutorial(), [
        { id: 'b1', tutorial_id: 't1', org_id: 'o1', status: 'pending', requested_at: '', responded_at: null, responded_by: null },
      ]).backing.status
    ).toBe('done')
  })

  it('collaborators is neutral with only the primary and done once a second contributor joins', () => {
    expect(computeStepStatuses(tutorial(), []).collaborators.status).toBe('neutral')
    const withCollaborator = tutorial({
      tutorial_contributors: [
        ...tutorial().tutorial_contributors,
        {
          tutorial_id: 't1',
          profile_id: 'p2',
          role: 'collaborator',
          added_at: '',
          profiles: { id: 'p2', name: 'Jane', email: 'j@test.local', role: 'contributor', created_at: '' },
        },
      ],
    })
    expect(computeStepStatuses(withCollaborator, []).collaborators.status).toBe('done')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @splat-connect/web test:unit -- tests/unit/lib/edit-steps.test.ts`
Expected: FAIL — `Cannot find module '@/lib/edit-steps'`

- [ ] **Step 3: Write the implementation**

```ts
// packages/web/lib/edit-steps.ts
/**
 * Step manifest and status rules for the edit-tutorial stepper. Status
 * mirrors getMissingFields() in lib/validation.ts exactly — that function
 * stays the single source of truth for what's required to submit; this
 * module only groups its output per step and adds the purely-optional
 * sections (STL, Backing, Collaborators) that getMissingFields() never
 * covers because they're not required.
 */
import type { ReactNode } from 'react'
import type { TutorialWithDetails, TutorialOrg } from '@splat-connect/types'
import { getMissingFields } from '@/lib/validation'

export type EditStepId = 'details' | 'files' | 'parts' | 'tools' | 'stl' | 'backing' | 'collaborators'
export type EditStepStatus = 'done' | 'attention' | 'neutral'

export interface EditStep {
  id: EditStepId
  label: string
  status: EditStepStatus
  attentionNote?: string
  content: ReactNode
}

export interface EditStepStatusResult {
  status: EditStepStatus
  attentionNote?: string
}

const DETAILS_FIELDS = ['Title', 'Difficulty']
const FILES_FIELDS = ['Tutorial PDF', 'Toy photo']
const PARTS_FIELDS = ['At least one part']
const TOOLS_FIELDS = ['At least one tool']

function fieldStatus(missing: string[], fields: string[]): EditStepStatusResult {
  const relevant = missing.filter((f) => fields.includes(f))
  return relevant.length > 0
    ? { status: 'attention', attentionNote: relevant.join(', ') }
    : { status: 'done' }
}

export function computeStepStatuses(
  tutorial: TutorialWithDetails,
  backing: TutorialOrg[]
): Record<EditStepId, EditStepStatusResult> {
  const missing = getMissingFields(tutorial)
  return {
    details: fieldStatus(missing, DETAILS_FIELDS),
    files: fieldStatus(missing, FILES_FIELDS),
    parts: fieldStatus(missing, PARTS_FIELDS),
    tools: fieldStatus(missing, TOOLS_FIELDS),
    stl: tutorial.stl_files.length > 0 ? { status: 'done' } : { status: 'neutral' },
    backing: backing.length > 0 ? { status: 'done' } : { status: 'neutral' },
    collaborators:
      tutorial.tutorial_contributors.length > 1 ? { status: 'done' } : { status: 'neutral' },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @splat-connect/web test:unit -- tests/unit/lib/edit-steps.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/lib/edit-steps.ts packages/web/tests/unit/lib/edit-steps.test.ts
git commit -m "feat(web): add computeStepStatuses for the edit-tutorial stepper"
```

---

### Task 5: EditStepper component

**Files:**
- Create: `packages/web/components/edit-stepper.tsx`
- Test: `packages/web/tests/unit/components/edit-stepper.test.tsx`

**Interfaces:**
- Consumes: `EditStep`, `EditStepId`, `EditStepStatus` from `@/lib/edit-steps` (Task 4); `ToastProvider` from `@/components/toast` (Task 3); `SaveStatusLine` from `@/components/save-status-line` (Task 2); `TutorialStatus` from `@splat-connect/types`.
- Produces: `<EditStepper steps={EditStep[]} tutorialStatus={TutorialStatus} tutorialUpdatedAt={string} missingFields={string[]} onSubmit={() => Promise<void>} />` — consumed by `page.tsx` (Task 13).

- [ ] **Step 1: Write the failing test**

```tsx
// packages/web/tests/unit/components/edit-stepper.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ReactNode } from 'react'
import { EditStepper } from '@/components/edit-stepper'
import type { EditStep } from '@/lib/edit-steps'

const replace = vi.fn()
let searchParamsValue = ''
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace }),
  usePathname: () => '/tutorials/t1/edit',
  useSearchParams: () => new URLSearchParams(searchParamsValue),
}))

function makeSteps(content: { details: ReactNode; files: ReactNode }): EditStep[] {
  return [
    { id: 'details', label: 'Details', status: 'attention', attentionNote: 'Title', content: content.details },
    { id: 'files', label: 'Files', status: 'done', content: content.files },
  ]
}

describe('EditStepper', () => {
  beforeEach(() => {
    replace.mockClear()
    searchParamsValue = ''
  })

  it('shows the first step content by default', () => {
    render(
      <EditStepper
        steps={makeSteps({ details: <p>Details content</p>, files: <p>Files content</p> })}
        tutorialStatus="draft"
        tutorialUpdatedAt="2026-08-01T00:00:00.000Z"
        missingFields={['Title']}
        onSubmit={vi.fn()}
      />
    )
    expect(screen.getByText('Details content')).toBeInTheDocument()
    expect(screen.queryByText('Files content')).toBeNull()
  })

  it('switches content and writes ?step= when a pill is clicked', () => {
    render(
      <EditStepper
        steps={makeSteps({ details: <p>Details content</p>, files: <p>Files content</p> })}
        tutorialStatus="draft"
        tutorialUpdatedAt="2026-08-01T00:00:00.000Z"
        missingFields={[]}
        onSubmit={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole('tab', { name: /files/i }))
    expect(screen.getByText('Files content')).toBeInTheDocument()
    expect(replace).toHaveBeenCalledWith('/tutorials/t1/edit?step=files', { scroll: false })
  })

  it('opens on the step named in ?step= on load', () => {
    searchParamsValue = 'step=files'
    render(
      <EditStepper
        steps={makeSteps({ details: <p>Details content</p>, files: <p>Files content</p> })}
        tutorialStatus="draft"
        tutorialUpdatedAt="2026-08-01T00:00:00.000Z"
        missingFields={[]}
        onSubmit={vi.fn()}
      />
    )
    expect(screen.getByText('Files content')).toBeInTheDocument()
  })

  it('disables submit and names the missing fields when required data is absent', () => {
    render(
      <EditStepper
        steps={makeSteps({ details: <p>Details content</p>, files: <p>Files content</p> })}
        tutorialStatus="draft"
        tutorialUpdatedAt="2026-08-01T00:00:00.000Z"
        missingFields={['Title', 'At least one part']}
        onSubmit={vi.fn()}
      />
    )
    expect(screen.getByText('Add Title, At least one part to submit')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit for review/i })).toBeDisabled()
  })

  it('enables submit and calls onSubmit when nothing is missing', () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(
      <EditStepper
        steps={makeSteps({ details: <p>Details content</p>, files: <p>Files content</p> })}
        tutorialStatus="draft"
        tutorialUpdatedAt="2026-08-01T00:00:00.000Z"
        missingFields={[]}
        onSubmit={onSubmit}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /submit for review/i }))
    expect(onSubmit).toHaveBeenCalled()
  })

  it('shows a quiet last-saved indicator instead of Submit when status is not draft', () => {
    render(
      <EditStepper
        steps={makeSteps({ details: <p>Details content</p>, files: <p>Files content</p> })}
        tutorialStatus="pending"
        tutorialUpdatedAt={new Date().toISOString()}
        missingFields={[]}
        onSubmit={vi.fn()}
      />
    )
    expect(screen.queryByRole('button', { name: /submit for review/i })).toBeNull()
    expect(screen.getByText(/last saved/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @splat-connect/web test:unit -- tests/unit/components/edit-stepper.test.tsx`
Expected: FAIL — `Cannot find module '@/components/edit-stepper'`

- [ ] **Step 3: Write the implementation**

```tsx
// packages/web/components/edit-stepper.tsx
'use client'
/**
 * Free-jump step navigator for the edit-tutorial page: a pill row (one per
 * section, each carrying a status dot), the active section's content, and a
 * sticky bottom bar for Submit. The active step persists in ?step= so a
 * refresh or shared link lands back on the same section.
 */
import { useState } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import type { TutorialStatus } from '@splat-connect/types'
import type { EditStep, EditStepId, EditStepStatus } from '@/lib/edit-steps'
import { ToastProvider } from '@/components/toast'
import { SaveStatusLine } from '@/components/save-status-line'

const STATUS_GLYPH: Record<EditStepStatus, string> = { done: '✓', attention: '!', neutral: '·' }

export function EditStepper({
  steps,
  tutorialStatus,
  tutorialUpdatedAt,
  missingFields,
  onSubmit,
}: {
  steps: EditStep[]
  tutorialStatus: TutorialStatus
  tutorialUpdatedAt: string
  missingFields: string[]
  onSubmit: () => Promise<void>
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const stepIds = steps.map((s) => s.id)
  const requested = searchParams.get('step') as EditStepId | null
  const [activeId, setActiveId] = useState<EditStepId>(
    requested && stepIds.includes(requested) ? requested : steps[0].id
  )
  const [submitting, setSubmitting] = useState(false)

  function selectStep(id: EditStepId) {
    setActiveId(id)
    router.replace(`${pathname}?step=${id}`, { scroll: false })
  }

  async function handleSubmit() {
    setSubmitting(true)
    try {
      await onSubmit()
    } finally {
      setSubmitting(false)
    }
  }

  const active = steps.find((s) => s.id === activeId) ?? steps[0]

  return (
    <ToastProvider>
      <div className="step-pill-row" role="tablist" aria-label="Tutorial sections">
        {steps.map((step) => (
          <button
            key={step.id}
            type="button"
            role="tab"
            aria-selected={step.id === activeId}
            data-active={step.id === activeId || undefined}
            onClick={() => selectStep(step.id)}
            className="step-pill"
          >
            <span className="step-pill-dot" data-status={step.status}>
              {STATUS_GLYPH[step.status]}
            </span>
            {step.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">{active.content}</div>

      {tutorialStatus === 'draft' ? (
        <div className="sticky-submit-bar">
          <span className="sticky-submit-note">
            {missingFields.length > 0
              ? `Add ${missingFields.join(', ')} to submit`
              : 'Ready to submit'}
          </span>
          <button
            type="button"
            disabled={missingFields.length > 0 || submitting}
            onClick={handleSubmit}
            className="btn btn-accent"
          >
            {submitting ? 'Submitting…' : 'Submit for review'}
          </button>
        </div>
      ) : (
        <div className="sticky-submit-bar sticky-submit-bar-quiet">
          <SaveStatusLine savedAt={tutorialUpdatedAt} />
        </div>
      )}
    </ToastProvider>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @splat-connect/web test:unit -- tests/unit/components/edit-stepper.test.tsx`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/components/edit-stepper.tsx packages/web/tests/unit/components/edit-stepper.test.tsx
git commit -m "feat(web): add EditStepper — pill navigation and sticky submit bar"
```

---

### Task 6: Stepper, sticky bar, and toast styles

**Files:**
- Modify: `packages/web/app/globals.css`

**Interfaces:**
- Produces: `.step-pill-row`, `.step-pill`, `.step-pill[data-active]`, `.step-pill-dot[data-status]`, `.sticky-submit-bar`, `.sticky-submit-bar-quiet`, `.sticky-submit-note`, `.edit-toast` — consumed by `EditStepper` (Task 5), already referenced by its class names.

This task has no unit-testable logic (pure CSS); verification is visual, in Task 14's manual check.

- [ ] **Step 1: Add the component classes**

Insert after the existing `.panel-summary:hover { ... }` block (packages/web/app/globals.css:388-390) and before the `/* --- File drop zone --- */` comment (line 392):

```css
  /* --- Edit stepper (edit-tutorial page) --------------------------------- */
  .step-pill-row {
    display: flex;
    gap: 0.5rem;
    padding: 0.75rem;
    overflow-x: auto;
    background-color: var(--color-surface);
    border-radius: 1rem;
    box-shadow: var(--shadow-rest);
  }

  .step-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    flex-shrink: 0;
    padding: 0.5rem 0.9rem;
    background-color: var(--color-brand-tint);
    color: var(--color-brand-deep);
    border: none;
    border-radius: 9999px;
    font-size: 0.8125rem;
    font-weight: 700;
    cursor: pointer;
    transition:
      background-color 140ms var(--ease-out-quart),
      color 140ms var(--ease-out-quart);
  }

  .step-pill:hover {
    background-color: var(--color-brand-soft);
  }

  .step-pill[data-active] {
    background-color: var(--color-brand-dark);
    color: #ffffff;
  }

  .step-pill-dot {
    display: grid;
    place-items: center;
    width: 1.1rem;
    height: 1.1rem;
    border-radius: 9999px;
    background-color: var(--color-line);
    color: var(--color-muted);
    font-size: 0.6875rem;
    line-height: 1;
  }

  .step-pill-dot[data-status='done'] {
    background-color: var(--color-mint);
    color: #ffffff;
  }

  .step-pill-dot[data-status='attention'] {
    background-color: var(--color-apricot);
    color: var(--color-ink);
  }

  .step-pill[data-active] .step-pill-dot {
    background-color: rgb(255 255 255 / 0.25);
    color: #ffffff;
  }

  /* --- Sticky submit bar (edit-tutorial page) ---------------------------- */
  .sticky-submit-bar {
    position: sticky;
    bottom: 0;
    z-index: 30;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    margin-top: 1rem;
    padding: 0.875rem 1.25rem;
    background-color: var(--color-surface);
    border-top: 1px solid var(--color-line);
    border-radius: 1rem 1rem 0 0;
    box-shadow: var(--shadow-lift);
  }

  .sticky-submit-bar-quiet {
    justify-content: flex-start;
  }

  .sticky-submit-note {
    font-size: 0.8125rem;
    color: var(--color-muted);
  }

  /* --- Save toast (edit-tutorial page) ------------------------------------ */
  .edit-toast {
    position: fixed;
    bottom: 1.5rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 50;
    padding: 0.625rem 1.25rem;
    background-color: var(--color-brand-deep);
    color: #ffffff;
    border-radius: 9999px;
    font-size: 0.8125rem;
    font-weight: 700;
    box-shadow: var(--shadow-lift);
  }
```

- [ ] **Step 2: Commit**

```bash
git add packages/web/app/globals.css
git commit -m "style(web): add stepper, sticky-bar, and toast component classes"
```

---

### Task 7: Save feedback in EditDetailsSection

**Files:**
- Modify: `packages/web/components/edit-details-section.tsx`
- Modify: `packages/web/tests/unit/components/edit-details-section.test.tsx`

**Interfaces:**
- Consumes: `useToast` from `@/components/toast` (Task 3), `SaveStatusLine` from `@/components/save-status-line` (Task 2).

- [ ] **Step 1: Write the failing test**

Add to `packages/web/tests/unit/components/edit-details-section.test.tsx` (after the existing two `it` blocks, before the closing `})`):

```tsx
  it('shows a "Last saved" line after a successful save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<EditDetailsSection tutorial={tutorial} onSave={onSave} />)
    expect(screen.queryByText(/last saved/i)).toBeNull()
    fireEvent.click(screen.getByText('Save details'))
    await waitFor(() => expect(screen.getByText(/last saved just now/i)).toBeInTheDocument())
  })

  it('fires the shared toast with "Details saved" after a successful save', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <ToastProvider>
        <EditDetailsSection tutorial={tutorial} onSave={onSave} />
      </ToastProvider>
    )
    fireEvent.click(screen.getByText('Save details'))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Details saved'))
  })
```

Add the import at the top of the file, alongside the existing imports:

```tsx
import { ToastProvider } from '@/components/toast'
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @splat-connect/web test:unit -- tests/unit/components/edit-details-section.test.tsx`
Expected: FAIL — "Last saved" text not found; `screen.getByRole('status')` not found

- [ ] **Step 3: Wire the feedback into the component**

In `packages/web/components/edit-details-section.tsx`, add imports and a `savedAt` state, call both on success, and render the line:

```tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Tutorial, Difficulty } from '@splat-connect/types'
import { useToast } from '@/components/toast'
import { SaveStatusLine } from '@/components/save-status-line'

export function EditDetailsSection({
  tutorial,
  onSave,
}: {
  tutorial: Tutorial
  onSave: (patch: { title: string; description: string | null; difficulty: Difficulty; updated_at: string }) => Promise<void>
}) {
  const router = useRouter()
  const showToast = useToast()
  const [pending, setPending] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    setPending(true)
    setConflict(false)
    try {
      await onSave({
        title: formData.get('title') as string,
        description: (formData.get('description') as string) || null,
        difficulty: formData.get('difficulty') as Difficulty,
        updated_at: tutorial.updated_at,
      })
      setSavedAt(new Date().toISOString())
      showToast('Details saved')
      router.refresh()
    } catch {
      setConflict(true)
    } finally {
      setPending(false)
    }
  }
```

Replace the submit button block with the button plus the save-status line, right after it:

```tsx
      <div className="flex items-center justify-between gap-3">
        <SaveStatusLine savedAt={savedAt} />
        <button type="submit" disabled={pending} className="btn btn-primary btn-sm self-end">
          {pending ? 'Saving…' : 'Save details'}
        </button>
      </div>
```

(This replaces the standalone `<button type="submit" ...>Save details</button>` line that currently ends the form.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @splat-connect/web test:unit -- tests/unit/components/edit-details-section.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/components/edit-details-section.tsx packages/web/tests/unit/components/edit-details-section.test.tsx
git commit -m "feat(web): add save-confirmation feedback to EditDetailsSection"
```

---

### Task 8: Save feedback in EditFilesSection

**Files:**
- Modify: `packages/web/components/edit-files-section.tsx`
- Modify: `packages/web/tests/unit/components/edit-files-section.test.tsx`

**Interfaces:**
- Consumes: `useToast` (Task 3), `SaveStatusLine` (Task 2).

- [ ] **Step 1: Write the failing test**

Add to `packages/web/tests/unit/components/edit-files-section.test.tsx`, at the top add the import:

```tsx
import { ToastProvider } from '@/components/toast'
```

And append inside the `describe` block:

```tsx
  it('shows a "Last saved" line after a successful save', async () => {
    mockPostFormData.mockResolvedValue({ url: 'https://example.com/new-photo.png' })
    const { photoInput } = setup()
    fireEvent.change(photoInput, {
      target: { files: [new File(['img'], 'photo.png', { type: 'image/png' })] },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save files' }))
    await waitFor(() => expect(screen.getByText(/last saved just now/i)).toBeInTheDocument())
  })

  it('fires the shared toast with "Files saved" after a successful save', async () => {
    mockPostFormData.mockResolvedValue({ url: 'https://example.com/new-photo.png' })
    render(
      <ToastProvider>
        <EditFilesSection
          tutorialId="tid-1"
          currentPhotoUrl={null}
          currentPdfUrl={null}
          onSave={vi.fn().mockResolvedValue(undefined)}
        />
      </ToastProvider>
    )
    const photoInput = screen.getByLabelText(/toy photo/i, { selector: 'input' })
    fireEvent.change(photoInput, {
      target: { files: [new File(['img'], 'photo.png', { type: 'image/png' })] },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save files' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Files saved'))
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @splat-connect/web test:unit -- tests/unit/components/edit-files-section.test.tsx`
Expected: FAIL — "Last saved" text and `status` role not found

- [ ] **Step 3: Wire the feedback into the component**

In `packages/web/components/edit-files-section.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { browserApiClient } from '@/lib/browser-api-client'
import { FileDropZone } from '@/components/file-drop-zone'
import { useToast } from '@/components/toast'
import { SaveStatusLine } from '@/components/save-status-line'

export function EditFilesSection({
  tutorialId,
  currentPhotoUrl,
  currentPdfUrl,
  onSave,
}: {
  tutorialId: string
  currentPhotoUrl: string | null
  currentPdfUrl: string | null
  onSave: (photoUrl: string | null, pdfUrl: string | null) => Promise<void>
}) {
  const showToast = useToast()
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
```

Update `handleSave` to record and announce the save, right after `await onSave(...)`:

```tsx
  async function handleSave() {
    if (!hasChanges || saving) return
    setSaving(true)
    setError(null)
    try {
      const newPhotoUrl = photoFile
        ? await uploadFile('/api/upload/photo', photoFile)
        : currentPhotoUrl
      const newPdfUrl = pdfFile
        ? await uploadFile('/api/upload/pdf', pdfFile)
        : currentPdfUrl
      await onSave(newPhotoUrl, newPdfUrl)
      setSavedAt(new Date().toISOString())
      showToast('Files saved')
      setPhotoFile(null)
      setPdfFile(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setSaving(false)
    }
  }
```

Render the line next to the Save button — replace the closing block (currently `{saving && ...}` followed by the button) with:

```tsx
      {saving && <p className="text-sm font-semibold text-brand-dark">Saving…</p>}
      <div className="flex items-center justify-between gap-3">
        <SaveStatusLine savedAt={savedAt} />
        <button
          type="button"
          disabled={!hasChanges || saving}
          onClick={handleSave}
          className={btnCls}
        >
          Save files
        </button>
      </div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @splat-connect/web test:unit -- tests/unit/components/edit-files-section.test.tsx`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/components/edit-files-section.tsx packages/web/tests/unit/components/edit-files-section.test.tsx
git commit -m "feat(web): add save-confirmation feedback to EditFilesSection"
```

---

### Task 9: Save feedback in EditItemsSection (Parts and Tools)

**Files:**
- Modify: `packages/web/components/edit-items-section.tsx`
- Create: `packages/web/tests/unit/components/edit-items-section.test.tsx`

**Interfaces:**
- Consumes: `useToast` (Task 3), `SaveStatusLine` (Task 2).
- No change to `EditItemsSectionProps`, `EditPartsSection`, or `EditToolsSection` — both keep re-exporting this component unchanged.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/web/tests/unit/components/edit-items-section.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { EditItemsSection } from '@/components/edit-items-section'
import { ToastProvider } from '@/components/toast'

describe('EditItemsSection save feedback', () => {
  it('shows a "Last saved" line after adding an item', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<EditItemsSection noun="part" initialItems={[]} onSave={onSave} />)
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'Screw' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add part' }))
    await waitFor(() => expect(screen.getByText(/last saved just now/i)).toBeInTheDocument())
  })

  it('fires the shared toast with "Part added" after adding an item', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <ToastProvider>
        <EditItemsSection noun="part" initialItems={[]} onSave={onSave} />
      </ToastProvider>
    )
    fireEvent.change(screen.getByPlaceholderText('Name'), { target: { value: 'Screw' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add part' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Part added'))
  })

  it('fires the shared toast with "Tool removed" after deleting an item', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(
      <ToastProvider>
        <EditItemsSection
          noun="tool"
          initialItems={[{ id: 'i1', name: 'Screwdriver', is_optional: false, buy_links: [] }]}
          onSave={onSave}
        />
      </ToastProvider>
    )
    fireEvent.click(screen.getByText('Screwdriver'))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Tool removed'))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @splat-connect/web test:unit -- tests/unit/components/edit-items-section.test.tsx`
Expected: FAIL — "Last saved" text and `status` role not found

- [ ] **Step 3: Wire the feedback into the component**

In `packages/web/components/edit-items-section.tsx`, add imports and state:

```tsx
'use client'
import { useState, useEffect } from 'react'
import type { BuyLink } from '@splat-connect/types'
import { BuyLinksInput } from '@/components/buy-links-input'
import { useToast } from '@/components/toast'
import { SaveStatusLine } from '@/components/save-status-line'

// ... EditableItem, ItemInput, EditItemsSectionProps unchanged ...

export function EditItemsSection({ noun, withQuantity, initialItems, onSave }: EditItemsSectionProps) {
  const showToast = useToast()
  const [items, setItems] = useState<EditableItem[]>(initialItems)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ItemInput | null>(null)
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [addError, setAddError] = useState<string | null>(null)
  const [addKey, setAddKey] = useState(0)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  const capitalizedNoun = noun.charAt(0).toUpperCase() + noun.slice(1)

  function markSaved(action: 'added' | 'updated' | 'removed') {
    setSavedAt(new Date().toISOString())
    showToast(`${capitalizedNoun} ${action}`)
  }
```

Update the three save points to call `markSaved(...)` right after their `await onSave(...)`:

```tsx
  async function handleSave() {
    if (!draft || !editingId) return
    const updated = items.map((i) => (i.id === editingId ? { ...i, ...draft } : i))
    setSaving(true)
    try {
      await onSave(updated.map(toInput))
      setItems(updated)
      markSaved('updated')
      closeEdit()
    } catch {
      setEditError('Failed to save, please try again')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    const filtered = items.filter((i) => i.id !== id)
    setSaving(true)
    try {
      await onSave(filtered.map(toInput))
      setItems(filtered)
      markSaved('removed')
      closeEdit()
    } catch {
      setEditError('Failed to delete, please try again')
    } finally {
      setSaving(false)
    }
  }

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const rawLinks = data.get('buy_links') as string
    const newItem: ItemInput = {
      name: (data.get('name') as string).trim(),
      is_optional: data.get('is_optional') === 'on',
      buy_links: rawLinks ? JSON.parse(rawLinks) : [],
      ...(withQuantity ? { quantity: Number(data.get('quantity') ?? 1) } : {}),
    }
    setSaving(true)
    setAddError(null)
    try {
      await onSave([...items.map(toInput), newItem])
      setItems((prev) => [...prev, { ...newItem, id: `temp-${Date.now()}` }])
      markSaved('added')
      form.reset()
      setAddKey((k) => k + 1)
    } catch {
      setAddError(`Failed to add ${noun}, please try again`)
    } finally {
      setSaving(false)
    }
  }
```

Render the line above the "Add {noun}" form — replace the form's opening line:

```tsx
      <SaveStatusLine savedAt={savedAt} />
      <form onSubmit={handleAdd} className="mt-2 flex flex-col gap-2">
```

(The existing form previously opened with `<form onSubmit={handleAdd} className="flex flex-col gap-2">`; add `mt-2` since the save-status line now sits directly above it.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @splat-connect/web test:unit -- tests/unit/components/edit-items-section.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/components/edit-items-section.tsx packages/web/tests/unit/components/edit-items-section.test.tsx
git commit -m "feat(web): add save-confirmation feedback to EditItemsSection"
```

---

### Task 10: Save feedback in AddStlForm

**Files:**
- Modify: `packages/web/components/add-stl-form.tsx`
- Create: `packages/web/tests/unit/components/add-stl-form.test.tsx`

**Interfaces:**
- Consumes: `useToast` (Task 3), `SaveStatusLine` (Task 2).

- [ ] **Step 1: Write the failing test**

```tsx
// packages/web/tests/unit/components/add-stl-form.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AddStlForm } from '@/components/add-stl-form'
import { ToastProvider } from '@/components/toast'
import { browserApiClient } from '@/lib/browser-api-client'

vi.mock('@/lib/browser-api-client', () => ({
  browserApiClient: { postFormData: vi.fn() },
}))

const mockPostFormData = vi.mocked(browserApiClient.postFormData)

describe('AddStlForm save feedback', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows a "Last saved" line after a successful upload', async () => {
    mockPostFormData.mockResolvedValue({ url: 'https://example.com/model.stl', filename: 'model.stl' })
    const onAdd = vi.fn().mockResolvedValue(undefined)
    render(<AddStlForm tutorialId="tid-1" onAdd={onAdd} />)
    const fileInput = screen.getByLabelText(/stl file/i, { selector: 'input' })
    fireEvent.change(fileInput, {
      target: { files: [new File(['stl'], 'model.stl', { type: 'application/octet-stream' })] },
    })
    fireEvent.click(screen.getByRole('button', { name: /upload stl/i }))
    await waitFor(() => expect(screen.getByText(/last saved just now/i)).toBeInTheDocument())
  })

  it('fires the shared toast with "STL file added" after a successful upload', async () => {
    mockPostFormData.mockResolvedValue({ url: 'https://example.com/model.stl', filename: 'model.stl' })
    render(
      <ToastProvider>
        <AddStlForm tutorialId="tid-1" onAdd={vi.fn().mockResolvedValue(undefined)} />
      </ToastProvider>
    )
    const fileInput = screen.getByLabelText(/stl file/i, { selector: 'input' })
    fireEvent.change(fileInput, {
      target: { files: [new File(['stl'], 'model.stl', { type: 'application/octet-stream' })] },
    })
    fireEvent.click(screen.getByRole('button', { name: /upload stl/i }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('STL file added'))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @splat-connect/web test:unit -- tests/unit/components/add-stl-form.test.tsx`
Expected: FAIL — "Last saved" text and `status` role not found

- [ ] **Step 3: Wire the feedback into the component**

In `packages/web/components/add-stl-form.tsx`, add the imports and state, then update `handleUpload`:

```tsx
'use client'
import { useState, useTransition } from 'react'
import { browserApiClient } from '@/lib/browser-api-client'
import { FileDropZone } from '@/components/file-drop-zone'
import { useToast } from '@/components/toast'
import { SaveStatusLine } from '@/components/save-status-line'

export function AddStlForm({
  tutorialId,
  onAdd,
}: {
  tutorialId: string
  onAdd: (filename: string, fileUrl: string) => Promise<void>
}) {
  const showToast = useToast()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [savedAt, setSavedAt] = useState<string | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setSelectedFile(e.target.files?.[0] ?? null)
    setError(null)
  }

  async function handleUpload() {
    if (!selectedFile) return
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', selectedFile)
      fd.append('tutorialId', tutorialId)
      const { url, filename } = await browserApiClient.postFormData<{ url: string; filename: string }>(
        '/api/upload/stl',
        fd
      )
      startTransition(async () => {
        await onAdd(filename ?? selectedFile.name, url)
        setSavedAt(new Date().toISOString())
        showToast('STL file added')
      })
      setSelectedFile(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'STL upload failed')
    } finally {
      setUploading(false)
    }
  }
```

Render the line next to the Upload button — replace the closing button block:

```tsx
      {error && (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
      <div className="flex items-center justify-between gap-3">
        <SaveStatusLine savedAt={savedAt} />
        <button
          type="button"
          disabled={!selectedFile || uploading || pending}
          onClick={handleUpload}
          className={btnCls}
        >
          {uploading || pending ? 'Uploading…' : 'Upload STL'}
        </button>
      </div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @splat-connect/web test:unit -- tests/unit/components/add-stl-form.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/web/components/add-stl-form.tsx packages/web/tests/unit/components/add-stl-form.test.tsx
git commit -m "feat(web): add save-confirmation feedback to AddStlForm"
```

---

### Task 11: Toast feedback in EditBackingSection

**Files:**
- Modify: `packages/web/components/edit-backing-section.tsx`
- Modify: `packages/web/tests/unit/components/edit-backing-section.test.tsx`

**Interfaces:**
- Consumes: `useToast` (Task 3). No persistent save-status line — Backing has no single save button; each row acts independently.

- [ ] **Step 1: Write the failing test**

Add the import and a new test to `packages/web/tests/unit/components/edit-backing-section.test.tsx`:

```tsx
import { ToastProvider } from '@/components/toast'
```

```tsx
  it('fires the shared toast naming the organisation after Ask succeeds', async () => {
    render(
      <ToastProvider>
        <EditBackingSection {...base} backing={[]} />
      </ToastProvider>
    )
    fireEvent.change(screen.getByLabelText(/ask another organisation/i), { target: { value: 'o1' } })
    fireEvent.click(screen.getByText('Ask'))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Asked Riverside'))
  })

  it('fires the shared toast naming the organisation after Withdraw succeeds', async () => {
    render(
      <ToastProvider>
        <EditBackingSection {...base} backing={[row('o1', 'Riverside', 'pending')]} />
      </ToastProvider>
    )
    fireEvent.click(screen.getByText('Withdraw'))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Withdrew from Riverside'))
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @splat-connect/web test:unit -- tests/unit/components/edit-backing-section.test.tsx`
Expected: FAIL — `status` role not found

- [ ] **Step 3: Wire the feedback into the component**

In `packages/web/components/edit-backing-section.tsx`, add the import and extend `run()` to accept an optional toast message:

```tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { BackingBadge } from '@/components/backing-state'
import { useToast } from '@/components/toast'
import type { TutorialOrg, Organization, TutorialStatus } from '@splat-connect/types'

export function EditBackingSection({
  backing,
  organizations,
  tutorialStatus,
  reviewedForOrgId,
  onAsk,
  onWithdraw,
}: {
  backing: TutorialOrg[]
  organizations: Organization[]
  tutorialStatus: TutorialStatus
  reviewedForOrgId: string | null
  onAsk: (orgId: string) => Promise<void>
  onWithdraw: (orgId: string) => Promise<void>
}) {
  const router = useRouter()
  const showToast = useToast()
  const [choice, setChoice] = useState('')
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const readOnly = tutorialStatus === 'approved'
  const asked = new Set(backing.map((b) => b.org_id))
  const available = organizations.filter((o) => !asked.has(o.id) && o.status === 'active')

  async function run(key: string, fn: () => Promise<void>, toastMessage?: string) {
    setPendingAction(key)
    setError(null)
    try {
      await fn()
      if (toastMessage) showToast(toastMessage)
      router.refresh()
    } catch {
      setError('That did not work. Please try again.')
    } finally {
      setPendingAction(null)
    }
  }
```

Update the Withdraw button's call site:

```tsx
                {!readOnly && (
                  <button
                    type="button"
                    disabled={pendingAction !== null}
                    onClick={() => run(b.org_id, () => onWithdraw(b.org_id), `Withdrew from ${name}`)}
                    className="btn btn-quiet btn-sm ml-auto"
                  >
                    {pendingAction === b.org_id ? 'Withdrawing…' : 'Withdraw'}
                  </button>
                )}
```

Update the Ask button's call site:

```tsx
              <button
                type="button"
                disabled={!choice || pendingAction !== null}
                onClick={() => {
                  const orgName = available.find((o) => o.id === choice)?.name ?? 'the organisation'
                  run('ask', async () => {
                    await onAsk(choice)
                    setChoice('')
                  }, `Asked ${orgName}`)
                }}
                className="btn btn-accent"
              >
                {pendingAction === 'ask' ? 'Asking…' : 'Ask'}
              </button>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @splat-connect/web test:unit -- tests/unit/components/edit-backing-section.test.tsx`
Expected: PASS (all existing tests plus the 2 new ones)

- [ ] **Step 5: Commit**

```bash
git add packages/web/components/edit-backing-section.tsx packages/web/tests/unit/components/edit-backing-section.test.tsx
git commit -m "feat(web): add toast feedback to EditBackingSection"
```

---

### Task 12: Toast feedback in EditCollaboratorsSection

**Files:**
- Modify: `packages/web/components/edit-collaborators-section.tsx`
- Modify: `packages/web/tests/unit/components/edit-collaborators-section.test.tsx`

**Interfaces:**
- Consumes: `useToast` (Task 3). No persistent save-status line, same reasoning as Task 11.

- [ ] **Step 1: Write the failing test**

Add the import and two tests to `packages/web/tests/unit/components/edit-collaborators-section.test.tsx`:

```tsx
import { ToastProvider } from '@/components/toast'
```

```tsx
  it('fires the shared toast naming the invitee after Invite succeeds', async () => {
    const onInvite = vi.fn().mockResolvedValue(undefined)
    render(
      <ToastProvider>
        <EditCollaboratorsSection
          contributors={[primary]}
          currentProfileId="p1"
          isPrimary
          onInvite={onInvite}
          onRemove={vi.fn()}
        />
      </ToastProvider>
    )
    fireEvent.change(screen.getByLabelText(/invite/i), { target: { value: 'jane@example.test' } })
    fireEvent.click(screen.getByText('Invite'))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Invited jane@example.test'))
  })

  it('fires the shared toast with "Left tutorial" when a collaborator leaves', async () => {
    const onRemove = vi.fn().mockResolvedValue(undefined)
    render(
      <ToastProvider>
        <EditCollaboratorsSection
          contributors={[primary, collaborator]}
          currentProfileId="p2"
          isPrimary={false}
          onInvite={vi.fn()}
          onRemove={onRemove}
        />
      </ToastProvider>
    )
    fireEvent.click(screen.getByText('Leave'))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Left tutorial'))
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @splat-connect/web test:unit -- tests/unit/components/edit-collaborators-section.test.tsx`
Expected: FAIL — `status` role not found

- [ ] **Step 3: Wire the feedback into the component**

In `packages/web/components/edit-collaborators-section.tsx`, add the import and extend `run()`:

```tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/toast'
import type { TutorialContributor, Profile } from '@splat-connect/types'

export function EditCollaboratorsSection({
  contributors,
  currentProfileId,
  isPrimary,
  onInvite,
  onRemove,
}: {
  contributors: (TutorialContributor & { profiles: Profile })[]
  currentProfileId: string
  isPrimary: boolean
  onInvite: (email: string) => Promise<void>
  onRemove: (profileId: string) => Promise<void>
}) {
  const router = useRouter()
  const showToast = useToast()
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run(key: string, fn: () => Promise<void>, toastMessage?: string) {
    setPending(key)
    setError(null)
    try {
      await fn()
      if (toastMessage) showToast(toastMessage)
      router.refresh()
    } catch {
      setError('That did not work. Please try again.')
    } finally {
      setPending(null)
    }
  }
```

Update the Remove/Leave button's call site:

```tsx
              {canAct && (
                <button
                  type="button"
                  disabled={pending !== null}
                  onClick={() => run(c.profile_id, () => onRemove(c.profile_id), isSelf ? 'Left tutorial' : 'Removed collaborator')}
                  className="btn btn-quiet btn-sm ml-auto"
                >
                  {pending === c.profile_id ? 'Working…' : isSelf ? 'Leave' : 'Remove'}
                </button>
              )}
```

Update the Invite button's call site:

```tsx
            <button
              type="button"
              disabled={!email.trim() || pending !== null}
              onClick={() => {
                const invitee = email.trim()
                run('invite', async () => { await onInvite(invitee); setEmail('') }, `Invited ${invitee}`)
              }}
              className="btn btn-accent"
            >
              {pending === 'invite' ? 'Inviting…' : 'Invite'}
            </button>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @splat-connect/web test:unit -- tests/unit/components/edit-collaborators-section.test.tsx`
Expected: PASS (all existing tests plus the 2 new ones)

- [ ] **Step 5: Commit**

```bash
git add packages/web/components/edit-collaborators-section.tsx packages/web/tests/unit/components/edit-collaborators-section.test.tsx
git commit -m "feat(web): add toast feedback to EditCollaboratorsSection"
```

---

### Task 13: Rewire page.tsx to the stepper

**Files:**
- Modify: `packages/web/app/tutorials/[id]/edit/page.tsx`
- Delete: `packages/web/components/submit-for-review-button.tsx`

**Interfaces:**
- Consumes: `computeStepStatuses`, `EditStep` from `@/lib/edit-steps` (Task 4); `EditStepper` from `@/components/edit-stepper` (Task 5); `getMissingFields` from `@/lib/validation` (existing).

- [ ] **Step 1: Delete the superseded component**

```bash
git rm packages/web/components/submit-for-review-button.tsx
```

- [ ] **Step 2: Replace the imports**

Replace the top of `packages/web/app/tutorials/[id]/edit/page.tsx` (lines 1-13):

```tsx
import { apiClient } from '@/lib/api-client'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import Link from 'next/link'
import { Suspense } from 'react'
import { EditFilesSection } from '@/components/edit-files-section'
import { AddStlForm } from '@/components/add-stl-form'
import { EditPartsSection } from '@/components/edit-parts-section'
import { EditToolsSection } from '@/components/edit-tools-section'
import { EditBackingSection } from '@/components/edit-backing-section'
import { EditDetailsSection } from '@/components/edit-details-section'
import { EditCollaboratorsSection } from '@/components/edit-collaborators-section'
import { EditStepper } from '@/components/edit-stepper'
import { computeStepStatuses, type EditStep } from '@/lib/edit-steps'
import { getMissingFields } from '@/lib/validation'
import type { Tutorial, Part, Tool, StlFile, TutorialWithDetails, Difficulty, BuyLink, Profile, TutorialOrg, Organization } from '@splat-connect/types'
```

- [ ] **Step 3: Build the step manifest and replace the JSX**

All `'use server'` actions (lines 53-132 of the original file: `askOrg`, `withdrawOrg`, `saveDetails`, `inviteCollaborator`, `removeCollaborator`, `patchFileUrls`, `saveParts`, `saveTools`, `addStlFileRecord`, `submitForReview`) stay exactly as they are — do not modify them.

Replace everything from `const panelCls = 'panel mb-3'` (original line 134) to the end of the file with:

```tsx
  const missingFields = getMissingFields(tutorial!)
  const stepStatuses = computeStepStatuses(tutorial!, backing)

  const steps: EditStep[] = [
    {
      id: 'details',
      label: 'Details',
      ...stepStatuses.details,
      content: (
        <div className="panel">
          <EditDetailsSection tutorial={tutorial!} onSave={saveDetails} />
        </div>
      ),
    },
    {
      id: 'files',
      label: 'Files',
      ...stepStatuses.files,
      content: (
        <div className="panel">
          <EditFilesSection
            tutorialId={id}
            currentPhotoUrl={tutorial!.toy_photo_url}
            currentPdfUrl={tutorial!.tutorial_pdf_url}
            onSave={patchFileUrls}
          />
        </div>
      ),
    },
    {
      id: 'parts',
      label: 'Parts',
      ...stepStatuses.parts,
      content: (
        <div className="panel">
          <EditPartsSection initialParts={parts} onSave={saveParts} />
        </div>
      ),
    },
    {
      id: 'tools',
      label: 'Tools',
      ...stepStatuses.tools,
      content: (
        <div className="panel">
          <EditToolsSection initialTools={tools} onSave={saveTools} />
        </div>
      ),
    },
    {
      id: 'stl',
      label: 'STL Files',
      ...stepStatuses.stl,
      content: (
        <div className="panel px-5 pt-5 pb-5">
          {stlFiles.length > 0 && (
            <ul className="mb-4 flex flex-col gap-2">
              {stlFiles.map((f) => (
                <li key={f.id} className="card-flat px-4 py-3 text-sm">
                  <a
                    href={f.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-brand-dark hover:underline"
                  >
                    {f.filename}
                  </a>
                </li>
              ))}
            </ul>
          )}
          <AddStlForm tutorialId={id} onAdd={addStlFileRecord} />
        </div>
      ),
    },
    {
      id: 'backing',
      label: 'Backing',
      ...stepStatuses.backing,
      content: (
        <div className="panel">
          <EditBackingSection
            backing={backing}
            organizations={organizations}
            tutorialStatus={tutorial!.status}
            reviewedForOrgId={tutorial!.reviewed_for_org_id}
            onAsk={askOrg}
            onWithdraw={withdrawOrg}
          />
        </div>
      ),
    },
    {
      id: 'collaborators',
      label: 'Collaborators',
      ...stepStatuses.collaborators,
      content: (
        <div className="panel">
          <EditCollaboratorsSection
            contributors={tutorial!.tutorial_contributors}
            currentProfileId={profile!.id}
            isPrimary={tutorial!.tutorial_contributors.some(
              (tc) => tc.profile_id === profile!.id && tc.role === 'primary'
            )}
            onInvite={inviteCollaborator}
            onRemove={removeCollaborator}
          />
        </div>
      ),
    },
  ]

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Link
          href="/dashboard"
          className="text-sm font-semibold text-brand-dark hover:underline"
        >
          &larr; Dashboard
        </Link>
        <h1 className="truncate text-xl font-bold text-ink">{tutorial!.title}</h1>
      </div>

      {tutorial!.status === 'rejected' && (
        <div className="alert alert-danger mb-3">
          <p className="mb-1 font-bold">This tutorial was rejected</p>
          <p className="leading-relaxed">
            {tutorial!.rejection_note ?? 'No feedback was provided.'}
          </p>
        </div>
      )}

      {/* useSearchParams() inside EditStepper requires a Suspense boundary, or
          `next build` fails to prerender this page — same reasoning as
          app/onboarding/contributor-terms/page.tsx. */}
      <Suspense>
        <EditStepper
          steps={steps}
          tutorialStatus={tutorial!.status}
          tutorialUpdatedAt={tutorial!.updated_at}
          missingFields={missingFields}
          onSubmit={submitForReview}
        />
      </Suspense>
    </div>
  )
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @splat-connect/web typecheck`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add packages/web/app/tutorials/\[id\]/edit/page.tsx packages/web/components/submit-for-review-button.tsx
git commit -m "feat(web): replace the edit-tutorial accordion with EditStepper"
```

---

### Task 14: Rewrite the page unit tests

**Files:**
- Modify: `packages/web/tests/unit/pages/edit-tutorial.test.tsx`

**Interfaces:**
- Consumes: the real `computeStepStatuses` (Task 4) and `getMissingFields` (existing) — not mocked, so this test verifies `page.tsx` wires them correctly. Mocks `EditStepper` (Task 5) to inspect the props `page.tsx` passes it, matching how the file already mocks every other section component.

- [ ] **Step 1: Replace the test file**

```tsx
// packages/web/tests/unit/pages/edit-tutorial.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import EditTutorialPage from '@/app/tutorials/[id]/edit/page'
import type { Profile, TutorialWithDetails } from '@splat-connect/types'
import type { EditStep } from '@/lib/edit-steps'

vi.mock('@/lib/api-client', () => ({
  apiClient: { get: vi.fn(), patch: vi.fn(), post: vi.fn() },
}))
vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))
vi.mock('@/components/edit-files-section', () => ({ EditFilesSection: () => null }))
vi.mock('@/components/add-stl-form', () => ({ AddStlForm: () => null }))
vi.mock('@/components/edit-parts-section', () => ({ EditPartsSection: () => null }))
vi.mock('@/components/edit-tools-section', () => ({ EditToolsSection: () => null }))
vi.mock('@/components/edit-details-section', () => ({ EditDetailsSection: () => null }))
vi.mock('@/components/edit-backing-section', () => ({ EditBackingSection: () => null }))
vi.mock('@/components/edit-collaborators-section', () => ({ EditCollaboratorsSection: () => null }))
vi.mock('@/components/edit-stepper', () => ({
  EditStepper: ({
    steps,
    tutorialStatus,
    missingFields,
  }: {
    steps: EditStep[]
    tutorialStatus: string
    missingFields: string[]
  }) => (
    <div data-testid="edit-stepper" data-status={tutorialStatus} data-missing={missingFields.join('|')}>
      {steps.map((s) => (
        <span key={s.id} data-step={s.id} data-step-status={s.status} />
      ))}
    </div>
  ),
}))

import { apiClient } from '@/lib/api-client'
import { redirect } from 'next/navigation'

const mockProfile: Profile = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  role: 'contributor',
  created_at: '2026-01-01T00:00:00Z',
}

const baseTutorialWithDetails: TutorialWithDetails = {
  id: 'tutorial-1',
  title: 'Test Tutorial',
  difficulty: 'easy',
  status: 'draft',
  description: null,
  tutorial_pdf_url: null,
  toy_photo_url: null,
  rejection_note: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  reviewed_at: null,
  reviewed_by: null,
  reviewed_for_org_id: null,
  parts: [],
  tools: [],
  stl_files: [],
  tutorial_contributors: [{
    tutorial_id: 'tutorial-1',
    profile_id: 'user-1',
    role: 'primary',
    added_at: '2026-01-01T00:00:00Z',
    profiles: mockProfile,
  }],
}

const pageParams = { params: Promise.resolve({ id: 'tutorial-1' }) }

describe('EditTutorialPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // The page makes two further reads after the ones each test sets up with
    // mockResolvedValueOnce — the backing rows and the organisation list for the
    // EditStepper's Backing step. Without a fallback those return undefined and
    // every test dies on it. Empty is the ordinary case: most projects have
    // asked nobody.
    vi.mocked(apiClient.get).mockResolvedValue([])
  })

  it('redirects to /login when profile fetch throws', async () => {
    vi.mocked(redirect).mockImplementation(() => { throw new Error('NEXT_REDIRECT') })
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('Unauthorized'))
    await expect(EditTutorialPage(pageParams)).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/login')
  })

  it('redirects to /dashboard when tutorial fetch throws', async () => {
    vi.mocked(redirect).mockImplementation(() => { throw new Error('NEXT_REDIRECT') })
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(mockProfile)
      .mockRejectedValueOnce(new Error('Not Found'))
    await expect(EditTutorialPage(pageParams)).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/dashboard')
  })

  it('redirects to /dashboard when user is not a contributor on the tutorial', async () => {
    vi.mocked(redirect).mockImplementation(() => { throw new Error('NEXT_REDIRECT') })
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce({
        ...baseTutorialWithDetails,
        tutorial_contributors: [{
          ...baseTutorialWithDetails.tutorial_contributors[0],
          profile_id: 'different-user',
        }],
      })
    await expect(EditTutorialPage(pageParams)).rejects.toThrow('NEXT_REDIRECT')
    expect(redirect).toHaveBeenCalledWith('/dashboard')
  })

  it('renders the tutorial title', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce(baseTutorialWithDetails)
    render(await EditTutorialPage(pageParams))
    expect(screen.getByRole('heading', { name: /test tutorial/i })).toBeInTheDocument()
  })

  it('shows the rejection banner with note when status is rejected', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce({ ...baseTutorialWithDetails, status: 'rejected', rejection_note: 'Needs more parts' })
    render(await EditTutorialPage(pageParams))
    expect(screen.getByText('This tutorial was rejected')).toBeInTheDocument()
    expect(screen.getByText('Needs more parts')).toBeInTheDocument()
  })

  it('shows the rejection banner with fallback text when rejection_note is null', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce({ ...baseTutorialWithDetails, status: 'rejected', rejection_note: null })
    render(await EditTutorialPage(pageParams))
    expect(screen.getByText('No feedback was provided.')).toBeInTheDocument()
  })

  it('does not show the rejection banner when status is draft', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce(baseTutorialWithDetails)
    render(await EditTutorialPage(pageParams))
    expect(screen.queryByText('This tutorial was rejected')).toBeNull()
  })

  it('passes the tutorial status through to EditStepper', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce({ ...baseTutorialWithDetails, status: 'pending' })
    render(await EditTutorialPage(pageParams))
    expect(screen.getByTestId('edit-stepper')).toHaveAttribute('data-status', 'pending')
  })

  it('wires computeStepStatuses and getMissingFields into the step manifest', async () => {
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce(mockProfile)
      .mockResolvedValueOnce(baseTutorialWithDetails)
    render(await EditTutorialPage(pageParams))
    const stepper = screen.getByTestId('edit-stepper')
    expect(stepper).toHaveAttribute(
      'data-missing',
      'Tutorial PDF|Toy photo|At least one part|At least one tool'
    )
    expect(stepper.querySelector('[data-step="details"]')).toHaveAttribute('data-step-status', 'done')
    expect(stepper.querySelector('[data-step="files"]')).toHaveAttribute('data-step-status', 'attention')
    expect(stepper.querySelector('[data-step="parts"]')).toHaveAttribute('data-step-status', 'attention')
    expect(stepper.querySelector('[data-step="tools"]')).toHaveAttribute('data-step-status', 'attention')
    expect(stepper.querySelector('[data-step="stl"]')).toHaveAttribute('data-step-status', 'neutral')
    expect(stepper.querySelector('[data-step="backing"]')).toHaveAttribute('data-step-status', 'neutral')
    expect(stepper.querySelector('[data-step="collaborators"]')).toHaveAttribute('data-step-status', 'neutral')
  })
})
```

- [ ] **Step 2: Run test to verify it passes**

Run: `pnpm --filter @splat-connect/web test:unit -- tests/unit/pages/edit-tutorial.test.tsx`
Expected: PASS (9 tests)

- [ ] **Step 3: Commit**

```bash
git add packages/web/tests/unit/pages/edit-tutorial.test.tsx
git commit -m "test(web): rewrite edit-tutorial page tests for the stepper layout"
```

---

### Task 15: Full verification pass

**Files:** none (verification only; fix forward in the relevant file from an earlier task if something fails).

- [ ] **Step 1: Typecheck the web package**

Run: `pnpm --filter @splat-connect/web typecheck`
Expected: no errors

- [ ] **Step 2: Run the full unit suite**

Run: `pnpm --filter @splat-connect/web test:unit`
Expected: all tests pass, including every file touched or created by Tasks 1-14

- [ ] **Step 3: Lint**

Run: `pnpm --filter @splat-connect/web lint`
Expected: no errors

- [ ] **Step 4: Manual check in the browser**

Start the dev server (`pnpm --filter @splat-connect/web dev`) and open `/tutorials/<id>/edit` for a draft tutorial with at least one missing required field. Confirm: the pill row shows a status dot per section and switches content on click without a page reload; the URL updates to `?step=<id>` and reloading the page reopens the same step; the sticky bar names the missing fields and Submit is disabled; filling in a required field and clicking that section's own Save button clears its pill to done, shows the toast, and updates the sticky bar's note; switching a tutorial to `pending` (e.g. submit one that's already complete) shows the quiet "Last saved" bar instead of Submit; the pill row scrolls horizontally without wrapping at a narrow viewport width.

- [ ] **Step 5: Fix forward if anything fails**

If typecheck, tests, or lint fail, fix the issue in the file from the task that introduced it and re-run the relevant command. Commit the fix with a `fix(web): ...` message referencing what broke.

---
