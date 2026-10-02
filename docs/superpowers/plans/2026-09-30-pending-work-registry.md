# Pending Work Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One registry of every unfinished feature (104 items), shared by web, mobile and API; each item marked in code, board-drawn controls drawn and routed to "Not built yet", a generated `docs/PENDING.md`, and a drift test that keeps them in step.

**Architecture:** `packages/types/src/pending.ts` is the only list. Code refers to an item two ways — a `PENDING(<id>)` comment, or a `pending="<id>"` prop on `PendingButton`/`PendingRow` (mobile) or `PendingButton` (web). `scripts/pending.mjs` renders `docs/PENDING.md` from the registry plus a `git grep` of both forms; an API unit test runs the script in `--check` mode and asserts every id is referenced and every reference is registered.

**Tech Stack:** TypeScript registry (erasable syntax only — Node 26 imports it directly), Expo Router (mobile), Next.js app router (web), Hono (API), Jest (mobile), Vitest (web, API), Playwright (e2e).

**Spec:** `docs/superpowers/specs/2026-09-30-pending-work-registry-design.md` — its appendix is the registry content, row for row.

## Global Constraints

- Registry file uses only erasable TypeScript (no `enum`, no namespaces, no parameter properties) so `node` can import it without a build step.
- Item ids: lowercase kebab-case, exactly the 104 ids in the spec's appendix.
- Reference forms, and only these: `PENDING(<id>)` in a comment, or `pending="<id>"` as a JSX prop.
- Not built yet copy: pill "Not built yet", heading = item `title`, line = item `blurb`, button "Go back".
- A pending control looks like the real control; never invent data (no fake counts, prices, stats).
- The notify-signup key `map` stays `map` (existing `notify_signups` rows use it); the registry id is `impact-map`.
- Commit per task; message ends with the Co-Authored-By / Claude-Session trailer used across this repo.

## Review Focus

1. **Unknown id in a URL** (`/not-built?feature=nope`, `/not-built/nope`) — shows a generic "This part of SPLAT Connect isn't ready yet.", never a crash. Tested in Tasks 4 and 5.
2. **A marker inside a string or test file** — `git grep` would count `PENDING(x)` written in a test fixture as a reference. The scan excludes `**/tests/**` and `docs/**`. Tested in Task 3.
3. **Registry id renamed but markers not** — drift test reports the orphan marker by name. Tested in Task 3.
4. **Stale `docs/PENDING.md`** — `--check` exits non-zero with a message naming the command to run. Tested in Task 3.
5. **Pending control inside a disabled/loading screen** — tapping it must still navigate (it is not tied to the screen's data). Tested in Task 4.

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/types/src/pending.ts` (create) | The registry: `PENDING`, `PendingItem`, `PendingId`, `PendingKind` |
| `packages/types/src/index.ts` (modify) | Re-export the registry |
| `scripts/pending.mjs` (create) | Render/check `docs/PENDING.md` from registry + references |
| `docs/PENDING.md` (generated) | Human checklist; decision questions = Byron's agenda |
| `packages/api/tests/unit/pending-features.test.ts` (rewrite) | Drift test |
| `packages/mobile/components/ui/pending.tsx` (create) | `PendingButton`, `PendingRow`, `usePendingPress` |
| `packages/mobile/lib/pending-icons.ts` (create) | id → Ionicons name |
| `packages/mobile/app/not-built.tsx` (modify) | Read the shared registry |
| `packages/mobile/lib/pending-features.ts` (delete) | Replaced |
| `packages/web/app/not-built/[id]/page.tsx` (create) | Web Not built yet |
| `packages/web/components/pending-button.tsx` (create) | Web pending control |
| `packages/web/lib/pending-icons.ts` (create) | id → Phosphor icon |
| `packages/web/components/coming-soon.tsx` (modify) | Title/blurb from registry via `pending` prop |
| Screens listed in Tasks 6–10 | Markers and pending controls |
| `docs/superpowers/plans/2026-09-30-sign-in-remaining-work.md` (delete) | Superseded by `docs/PENDING.md` |

---

### Task 1: The shared registry

**Files:**
- Create: `packages/types/src/pending.ts`
- Modify: `packages/types/src/index.ts`
- Test: `packages/api/tests/unit/pending-registry.test.ts`

**Interfaces:**
- Produces: `PENDING: Record<PendingId, PendingItem>`, `type PendingId`, `type PendingItem`, `type PendingKind`, `isPendingId(x: string): x is PendingId`, exported from `@splat-connect/types`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/api/tests/unit/pending-registry.test.ts
import { describe, it, expect } from 'vitest'
import { PENDING, isPendingId } from '@splat-connect/types'

const entries = Object.entries(PENDING)

describe('pending registry', () => {
  it('holds the 104 items of the spec appendix', () => {
    expect(entries).toHaveLength(104)
  })
  it('uses kebab-case ids', () => {
    for (const [id] of entries) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  })
  it('gives every item a title, blurb, needs and at least one platform', () => {
    for (const [id, item] of entries) {
      expect(item.title, id).not.toBe('')
      expect(item.blurb, id).not.toBe('')
      expect(item.needs, id).not.toBe('')
      expect(item.platforms.length, id).toBeGreaterThan(0)
    }
  })
  it('asks a question for every decision item, and only for those', () => {
    for (const [id, item] of entries) expect(Boolean(item.question), id).toBe(item.kind === 'decision')
  })
  it('recognises its own ids only', () => {
    expect(isPendingId('apple-sign-in')).toBe(true)
    expect(isPendingId('nope')).toBe(false)
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd packages/api && npx vitest run tests/unit/pending-registry.test.ts`
Expected: FAIL — `PENDING` is not exported.

- [ ] **Step 3: Write the registry**

`packages/types/src/pending.ts` starts:

```ts
// Every unfinished feature in SPLAT Connect, measured against the Claude
// Design board — docs/superpowers/specs/2026-09-30-pending-work-registry-design.md.
// Code refers to an item as `PENDING(<id>)` in a comment or `pending="<id>"`
// on a pending control; docs/PENDING.md is generated from this file
// (`node scripts/pending.mjs`); packages/api/tests/unit/pending-features.test.ts
// fails when the three drift. Finishing an item: do the work at each
// reference, delete them, set `shipped: true` (or delete the entry), regenerate.
export type PendingKind = 'setup' | 'content' | 'build' | 'decision'
export type PendingPlatform = 'web' | 'mobile' | 'api'
export type PendingItem = {
  title: string
  blurb: string
  kind: PendingKind
  platforms: PendingPlatform[]
  board?: string
  needs: string
  question?: string
  shipped?: boolean
}

export const PENDING = {
  'apple-sign-in': {
    title: 'Sign in with Apple',
    blurb: "Apple sign-in isn't switched on yet. Use your email for now — you can link Apple later.",
    kind: 'setup',
    platforms: ['mobile'],
    board: 'Create account, Sign in',
    needs: 'Paid Apple Developer team with Sign in with Apple on com.splatconnect.mobile; Supabase Apple provider; EXPO_PUBLIC_APPLE_SIGN_IN=1; native rebuild.',
  },
  // …one entry per appendix row, in appendix order (setup, content, build, decision)
} satisfies Record<string, PendingItem>

export type PendingId = keyof typeof PENDING
export const isPendingId = (x: string): x is PendingId => Object.hasOwn(PENDING, x)
```

For every remaining appendix row write one entry: `title` = a short user-facing name (e.g. `'guide-step-tracking'` → `'Step tracking'`), `blurb` = one sentence a member reads on Not built yet ("Ticking off steps as you build is coming. Follow the steps below for now."), `kind`/`platforms` from the appendix `Where` column (`M`→`mobile`, `W`→`web`, `A`→`api`), `board` = the board screen name, `needs` = the appendix `Needs`/`Gap` text, `question` = the appendix Question (decision rows only). Carry the five existing entries' titles and blurbs over verbatim from `packages/mobile/lib/pending-features.ts`.

Append to `packages/types/src/index.ts`:

```ts
export * from './pending'
```

- [ ] **Step 4: Run the test**

Run: `cd packages/api && npx vitest run tests/unit/pending-registry.test.ts && cd ../types && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add packages/types/src/pending.ts packages/types/src/index.ts packages/api/tests/unit/pending-registry.test.ts
git commit -m "feat(types): one registry of every unfinished feature, 104 items"
```

---

### Task 2: Generated checklist

**Files:**
- Create: `scripts/pending.mjs`
- Create (generated): `docs/PENDING.md`

**Interfaces:**
- Consumes: `PENDING` from `packages/types/src/pending.ts` (imported by path).
- Produces: `node scripts/pending.mjs` writes `docs/PENDING.md`; `node scripts/pending.mjs --check` exits 1 with `docs/PENDING.md is stale — run: node scripts/pending.mjs` when it differs; exports `references(): Map<id, string[]>` (file:line list) and `render(): string`.

- [ ] **Step 1: Write the script**

```js
#!/usr/bin/env node
// Renders docs/PENDING.md from packages/types/src/pending.ts and the places
// the code refers to each item. `--check` fails when the file is stale.
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const { PENDING } = await import(path.join(root, 'packages/types/src/pending.ts'))
const OUT = path.join(root, 'docs/PENDING.md')

// Both reference forms; tests and docs are excluded so a fixture or a spec
// that mentions an id never counts as the code referring to it.
export function references() {
  let out = ''
  try {
    out = execFileSync(
      'git',
      ['grep', '-I', '-n', '-o', '-E', 'PENDING\\([a-z0-9-]+\\)|pending="[a-z0-9-]+"', '--',
        '.', ':!**/tests/**', ':!docs/**', ':!packages/types/src/pending.ts', ':!scripts/pending.mjs'],
      { cwd: root, encoding: 'utf8' }
    )
  } catch (e) {
    if (e.status !== 1) throw e // 1 = no matches
  }
  const refs = new Map()
  for (const line of out.trim().split('\n').filter(Boolean)) {
    const [file, lineNo, match] = line.split(':')
    const id = match.replace(/^PENDING\(|\)$|^pending="|"$/g, '')
    if (!refs.has(id)) refs.set(id, [])
    refs.get(id).push(`${file}:${lineNo}`)
  }
  return refs
}

const KINDS = [
  ['decision', 'Decisions — Byron’s calls, asked first in sub-project 4'],
  ['setup', 'Setup — needs Byron’s accounts'],
  ['content', 'Content — needs words or facts from a person'],
  ['build', 'Build — code only'],
]

export function render() {
  const refs = references()
  const open = Object.entries(PENDING).filter(([, i]) => !i.shipped)
  const lines = [
    '# Pending work',
    '',
    '<!-- Generated by `node scripts/pending.mjs` from packages/types/src/pending.ts. Do not edit by hand. -->',
    '',
    `${open.length} open items. Code refers to an item as \`PENDING(<id>)\` or \`pending="<id>"\`.`,
    'Finishing one: do the work at each reference, delete the references, set `shipped: true`, re-run the script.',
  ]
  for (const [kind, heading] of KINDS) {
    const items = open.filter(([, i]) => i.kind === kind)
    if (!items.length) continue
    lines.push('', `## ${heading}`, '')
    for (const [id, i] of items) {
      lines.push(`### \`${id}\` — ${i.title}`, '')
      if (i.question) lines.push(`**Question:** ${i.question}`, '')
      lines.push(`- Platforms: ${i.platforms.join(', ')}${i.board ? ` · Board: ${i.board}` : ''}`)
      lines.push(`- Needs: ${i.needs}`)
      lines.push(`- In code: ${(refs.get(id) ?? []).map((r) => `\`${r}\``).join(', ') || '_none yet_'}`, '')
    }
  }
  return lines.join('\n').trimEnd() + '\n'
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const next = render()
  if (process.argv.includes('--check')) {
    const now = existsSync(OUT) ? readFileSync(OUT, 'utf8') : ''
    if (now !== next) {
      console.error('docs/PENDING.md is stale — run: node scripts/pending.mjs')
      process.exit(1)
    }
  } else {
    writeFileSync(OUT, next)
    console.log(`wrote docs/PENDING.md (${Object.keys(PENDING).length} items)`)
  }
}
```

- [ ] **Step 2: Run it**

Run: `node scripts/pending.mjs && node scripts/pending.mjs --check; echo exit $?`
Expected: `wrote docs/PENDING.md (104 items)` then `exit 0`. `docs/PENDING.md` opens with the Decisions section; each of the 28 decision items prints its **Question**.

- [ ] **Step 3: Commit**

```bash
git add scripts/pending.mjs docs/PENDING.md
git commit -m "feat: docs/PENDING.md is generated from the pending registry"
```

---

### Task 3: The drift test

**Files:**
- Rewrite: `packages/api/tests/unit/pending-features.test.ts`

**Interfaces:**
- Consumes: `PENDING`, `isPendingId` (Task 1); `scripts/pending.mjs` `references()` and `--check` (Task 2).

- [ ] **Step 1: Write the test**

```ts
// The registry (packages/types/src/pending.ts), the references in the code
// and docs/PENDING.md must agree. See the registry's header.
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PENDING, isPendingId } from '@splat-connect/types'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const { references } = (await import(path.join(root, 'scripts/pending.mjs'))) as {
  references: () => Map<string, string[]>
}
const refs = references()
const entries = Object.entries(PENDING)

describe('pending work stays in step', () => {
  it('every reference names a registered item', () => {
    expect([...refs.keys()].filter((id) => !isPendingId(id))).toEqual([])
  })
  it('every open item is referenced somewhere in the code', () => {
    const unreferenced = entries.filter(([id, i]) => !i.shipped && !refs.has(id)).map(([id]) => id)
    expect(unreferenced).toEqual([])
  })
  it('a shipped item leaves no references behind', () => {
    const left = entries.filter(([id, i]) => i.shipped && refs.has(id)).map(([id]) => id)
    expect(left).toEqual([])
  })
  it('docs/PENDING.md is up to date', () => {
    expect(() => execFileSync('node', ['scripts/pending.mjs', '--check'], { cwd: root, stdio: 'pipe' })).not.toThrow()
  })
})
```

- [ ] **Step 2: Run it — the "referenced" case fails until Tasks 6–10 land**

Run: `cd packages/api && npx vitest run tests/unit/pending-features.test.ts`
Expected: 1 failure, "every open item is referenced" listing ~99 ids (only the five sign-in ids are referenced so far). The other three pass.

- [ ] **Step 3: Prove it catches an unknown id**

Run: `echo "// PENDING(made-up-item)" >> packages/api/src/mailer.ts && (cd packages/api && npx vitest run tests/unit/pending-features.test.ts -t "registered item"); git diff --stat packages/api/src/mailer.ts`
Expected: FAIL naming `made-up-item`. Then remove only that appended line (edit the file; do not `git checkout`, which would drop other uncommitted work) and re-run: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/api/tests/unit/pending-features.test.ts
git commit -m "test(api): drift test reads the shared registry and the generated checklist"
```

---

### Task 4: Mobile pending controls and Not built yet

**Files:**
- Create: `packages/mobile/components/ui/pending.tsx`
- Create: `packages/mobile/lib/pending-icons.ts`
- Modify: `packages/mobile/app/not-built.tsx`
- Modify: `packages/mobile/components/auth/parts.tsx` (import `PendingId` from `@splat-connect/types`)
- Delete: `packages/mobile/lib/pending-features.ts`
- Test: `packages/mobile/tests/unit/components/ui/pending.test.tsx`, `packages/mobile/tests/unit/app/auth-screens.test.tsx` (existing Not built yet cases keep passing)

**Interfaces:**
- Consumes: `PENDING`, `PendingId`, `isPendingId` from `@splat-connect/types`.
- Produces:
  - `PendingButton({ pending: PendingId, label: string, variant?: 'primary'|'secondary'|'ghost', style? })` — renders `Button` with the given look; press pushes `/not-built?feature=<id>`.
  - `PendingRow({ pending: PendingId, label: string, icon?: IoniconName })` — a list row with a chevron, same press.
  - `pendingHref(id: PendingId)` → `{ pathname: '/not-built', params: { feature: id } }`.
  - `pendingIcon(id: string): IoniconName` from `lib/pending-icons.ts`, fallback `'construct-outline'`.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/mobile/tests/unit/components/ui/pending.test.tsx
import { render, screen, fireEvent } from '@testing-library/react-native'
import { PendingButton, PendingRow } from '../../../../components/ui/pending'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))

beforeEach(() => jest.clearAllMocks())

describe('pending controls', () => {
  it('a pending button looks like its label and opens Not built yet', () => {
    render(<PendingButton pending="guide-build-done" label="Mark this build done" />)
    fireEvent.press(screen.getByText('Mark this build done'))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/not-built', params: { feature: 'guide-build-done' } })
  })
  it('a pending row does the same', () => {
    render(<PendingRow pending="customization-metrics" label="Customization" />)
    fireEvent.press(screen.getByText('Customization'))
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/not-built', params: { feature: 'customization-metrics' } })
  })
})
```

- [ ] **Step 2: Run it to see it fail**

Run: `cd packages/mobile && npx jest tests/unit/components/ui/pending.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```tsx
// packages/mobile/components/ui/pending.tsx
//
// A control the board draws but the app cannot do yet. It looks like the
// real thing and opens Not built yet, which names the registry item
// (packages/types/src/pending.ts). The `pending` prop is how the drift test
// finds it — keep it a string literal.
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native'
import { useRouter } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import type { PendingId } from '@splat-connect/types'
import { theme } from '../../lib/theme'
import { Button } from './Button'

export const pendingHref = (id: PendingId) => ({ pathname: '/not-built' as const, params: { feature: id } })

export function PendingButton({
  pending,
  label,
  variant = 'secondary',
  style,
}: {
  pending: PendingId
  label: string
  variant?: 'primary' | 'secondary' | 'ghost'
  style?: StyleProp<ViewStyle>
}) {
  const router = useRouter()
  return <Button label={label} variant={variant} style={style} onPress={() => router.push(pendingHref(pending))} />
}

export function PendingRow({
  pending,
  label,
  icon,
}: {
  pending: PendingId
  label: string
  icon?: React.ComponentProps<typeof Ionicons>['name']
}) {
  const router = useRouter()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => router.push(pendingHref(pending))}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {icon ? <Ionicons name={icon} size={21} color={theme.colors.primaryDark} /> : null}
      <Text style={styles.label}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={theme.colors.muted} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(3),
    minHeight: 52,
    paddingHorizontal: theme.spacing(4),
    borderRadius: theme.radii.panel,
    backgroundColor: theme.colors.surface,
    borderWidth: theme.border.hairline,
    borderColor: theme.colors.border,
  },
  pressed: { transform: [{ scale: theme.motion.pressScale }] },
  label: { flex: 1, fontFamily: theme.fonts.bold, fontSize: theme.type.body, color: theme.colors.ink },
})
```

`packages/mobile/lib/pending-icons.ts`:

```ts
// Registry ids → Ionicons for the Not built yet tile. Anything unlisted gets
// the fallback; the registry itself stays icon-free because web uses Phosphor.
import type { ComponentProps } from 'react'
import type { Ionicons } from '@expo/vector-icons'
type Icon = ComponentProps<typeof Ionicons>['name']

const ICONS: Record<string, Icon> = {
  'apple-sign-in': 'logo-apple',
  'google-sign-in': 'logo-google',
  'android-one-tap': 'flash-outline',
  'apple-revoke': 'key-outline',
  'email-delivery': 'mail-outline',
  'report-problem-mobile': 'flag-outline',
  'thank-people': 'heart-outline',
  'guide-community-notes': 'chatbubbles-outline',
  'guide-build-done': 'checkmark-done-outline',
  'makers-ask-first': 'chatbubble-ellipses-outline',
  'locations-and-distance': 'navigate-outline',
  'saved-parts': 'cube-outline',
}

export const pendingIcon = (id: string): Icon => ICONS[id] ?? 'construct-outline'
```

In `packages/mobile/app/not-built.tsx` replace the `PENDING_FEATURES` import and lookup with:

```tsx
import { PENDING, isPendingId } from '@splat-connect/types'
import { pendingIcon } from '../lib/pending-icons'
// …
const item = feature && isPendingId(feature)
  ? { ...PENDING[feature], icon: pendingIcon(feature) }
  : { title: 'Not built yet', blurb: "This part of SPLAT Connect isn't ready yet.", icon: 'construct-outline' as const }
```

In `components/auth/parts.tsx` change `import type { PendingFeatureId } from '../../lib/pending-features'` to `import type { PendingId } from '@splat-connect/types'` and rename the type in `notBuilt`. Delete `lib/pending-features.ts`.

- [ ] **Step 4: Run tests and typecheck**

Run: `cd packages/mobile && npx jest tests/unit/components/ui/pending.test.tsx tests/unit/app/auth-screens.test.tsx && npx tsc --noEmit -p .`
Expected: PASS; no type errors.

- [ ] **Step 5: Commit**

```bash
git add packages/mobile/components/ui/pending.tsx packages/mobile/lib/pending-icons.ts packages/mobile/app/not-built.tsx packages/mobile/components/auth/parts.tsx packages/mobile/tests/unit/components/ui/pending.test.tsx
git rm packages/mobile/lib/pending-features.ts
git commit -m "feat(mobile): PendingButton and PendingRow open Not built yet from the shared registry"
```

---

### Task 5: Web Not built yet, pending control, ComingSoon

**Files:**
- Create: `packages/web/app/not-built/[id]/page.tsx`
- Create: `packages/web/components/pending-button.tsx`
- Create: `packages/web/lib/pending-icons.ts`
- Modify: `packages/web/components/coming-soon.tsx`, `packages/web/app/printing/parts/page.tsx`, `packages/web/app/dashboard/saved/parts/page.tsx`, `packages/web/app/impact/map/page.tsx`
- Test: `packages/web/tests/unit/components/pending-button.test.tsx`, `packages/web/tests/unit/app/not-built-page.test.tsx`

**Interfaces:**
- Consumes: `PENDING`, `PendingId`, `isPendingId`.
- Produces:
  - `PendingButton({ pending: PendingId, label: string, className?: string })` — a `Link` styled by `className` (default `'btn btn-quiet'`) to `/not-built/<id>`.
  - `ComingSoon` gains `pending: PendingId`; `label`/`description` become optional and default to the registry's `title`/`blurb`.
  - `pendingIcon(id: string): PhosphorIcon`, fallback `Hourglass`.

- [ ] **Step 1: Write the failing tests**

```tsx
// packages/web/tests/unit/components/pending-button.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PendingButton } from '@/components/pending-button'

describe('PendingButton', () => {
  it('links to the item’s Not built yet page', () => {
    render(<PendingButton pending="makers-ask-first" label="Ask first" />)
    expect(screen.getByRole('link', { name: 'Ask first' }).getAttribute('href')).toBe('/not-built/makers-ask-first')
  })
})
```

```tsx
// packages/web/tests/unit/app/not-built-page.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import NotBuiltPage from '@/app/not-built/[id]/page'

describe('/not-built/[id]', () => {
  it('names the registry item', async () => {
    render(await NotBuiltPage({ params: Promise.resolve({ id: 'impact-map' }) }))
    expect(screen.getByText('Not built yet')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Deliveries map')
  })
  it('falls back for an unknown id', async () => {
    render(await NotBuiltPage({ params: Promise.resolve({ id: 'nope' }) }))
    expect(screen.getByText("This part of SPLAT Connect isn't ready yet.")).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run them to see them fail**

Run: `cd packages/web && npx vitest run tests/unit/components/pending-button.test.tsx tests/unit/app/not-built-page.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement**

```tsx
// packages/web/components/pending-button.tsx
// A control the board draws that the app cannot do yet: styled like the real
// one, linking to /not-built/<id>. The `pending` literal is what the drift test finds.
import Link from 'next/link'
import type { Route } from 'next'
import type { PendingId } from '@splat-connect/types'

export function PendingButton({ pending, label, className = 'btn btn-quiet' }: { pending: PendingId; label: string; className?: string }) {
  return (
    <Link href={`/not-built/${pending}` as Route} className={className}>
      {label}
    </Link>
  )
}
```

```ts
// packages/web/lib/pending-icons.ts
import { Hourglass, MapTrifold, Cube, ChatCircleDots, Heart, Flag, type Icon } from '@phosphor-icons/react/dist/ssr'

const ICONS: Record<string, Icon> = {
  'impact-map': MapTrifold,
  'printing-parts': Cube,
  'saved-parts': Cube,
  'makers-ask-first': ChatCircleDots,
  'thank-people': Heart,
  'report-problem-mobile': Flag,
}
export const pendingIcon = (id: string): Icon => ICONS[id] ?? Hourglass
```

```tsx
// packages/web/app/not-built/[id]/page.tsx
// The board's is_soon screen for anything in the pending registry that a
// PendingButton links to (packages/types/src/pending.ts).
import { PENDING, isPendingId } from '@splat-connect/types'
import { ComingSoon } from '@/components/coming-soon'
import { pendingIcon } from '@/lib/pending-icons'

export const metadata = { title: 'Not built yet — SPLAT Connect' }

export default async function NotBuiltPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!isPendingId(id)) {
    return <ComingSoon label="Not built yet" description="This part of SPLAT Connect isn't ready yet." steps={[]} alternatives={[{ label: 'Home', href: '/' }]} />
  }
  return <ComingSoon pending={id} steps={[]} icon={pendingIcon(id)} alternatives={[{ label: 'Home', href: '/' }]} />
}
```

In `components/coming-soon.tsx`: add `pending?: PendingId` to the props, make `label` and `description` optional, and at the top of the function body:

```tsx
const item = pending ? PENDING[pending] : null
label = label ?? item?.title ?? 'Not built yet'
description = description ?? item?.blurb ?? ''
```

Then in the three ComingSoon pages pass the registry id and let the text come from the registry (keep `featureKey` for the notify form — `map` stays `map`):
- `app/printing/parts/page.tsx`: `pending="printing-parts"`, add `{/* PENDING(printing-parts) */}` above the element.
- `app/dashboard/saved/parts/page.tsx`: `pending="saved-parts"`.
- `app/impact/map/page.tsx`: `pending="impact-map"` (keep `featureKey="map"`).

Run `npx next typegen` after adding the route.

- [ ] **Step 4: Run tests and typecheck**

Run: `cd packages/web && npx next typegen && npx vitest run tests/unit/components/pending-button.test.tsx tests/unit/app/not-built-page.test.tsx && npx tsc --noEmit -p .`
Expected: PASS; no type errors.

- [ ] **Step 5: Commit**

```bash
git add packages/web/app/not-built packages/web/components/pending-button.tsx packages/web/lib/pending-icons.ts packages/web/components/coming-soon.tsx packages/web/app/printing/parts/page.tsx packages/web/app/dashboard/saved/parts/page.tsx packages/web/app/impact/map/page.tsx packages/web/tests/unit/components/pending-button.test.tsx packages/web/tests/unit/app/not-built-page.test.tsx
git commit -m "feat(web): Not built yet page and PendingButton read the shared registry"
```

---

### Tasks 6–10: Placing the items

Each task below lists items with **where** (file), **form**, and **what**:
- **Button / Row / Tab / Chip** → a pending control with that label, drawn where the board draws it:
  - mobile: `<PendingButton pending="<id>" label="<label>" />` or `<PendingRow …/>`; a tab or chip is a `Chip`/tab element whose `onPress` is `() => router.push(pendingHref('<id>'))` with `{/* PENDING(<id>) */}` beside it.
  - web: `<PendingButton pending="<id>" label="<label>" className="…the neighbouring button's classes…" />`.
- **Marker** → `// PENDING(<id>): <one line of what goes here>` at the exact place the feature will render (JSX: `{/* PENDING(<id>): … */}`), or at the top of the named function for API/data work.

Every step: place, then `npx tsc --noEmit -p .` in the package, then run the screen's existing unit test file(s). Each task ends by running `node scripts/pending.mjs` and the drift test to confirm its ids are now referenced, then commits.

#### Task 6: Mobile — guides, printing, toys

| Id | File (packages/mobile/…) | Form | What |
|---|---|---|---|
| `clear-filters-empty` | `components/home/library-screen.tsx` (empty state), `components/toys/toy-library-screen.tsx` (empty state) | Button | "Clear filters" |
| `guides-search-parts` | `components/home/library-screen.tsx` (search filter) | Marker | match parts too |
| `guides-loading-caption` | `components/home/library-screen.tsx` (skeleton) | Marker | "Loading guides…" caption |
| `guide-step-tracking` | `components/home/detail-screen.tsx` (steps list) | Button | "Track my progress" above the steps |
| `guide-build-done` | `components/home/detail-screen.tsx` (after steps) | Button | "Mark this build done" |
| `guide-community-notes` | `components/home/detail-screen.tsx` (after steps) | Button | "Add a note" |
| `part-prices` | `components/home/detail-screen.tsx` (parts list) | Marker | per-line cost and total |
| `guide-tools-checklist` | `components/home/detail-screen.tsx` (tools list) | Marker | "I have it" checklist |
| `tool-notes` | `components/home/detail-screen.tsx` (tools list) | Marker | why / buy / borrow note |
| `print-settings` | `components/home/detail-screen.tsx` (printable parts card), `components/printing/request-screen.tsx` (info line), `components/printing/offer-screen.tsx` (incoming job) | Marker | layer, infill, material, time |
| `guide-ask-a-maker` | `components/home/detail-screen.tsx` (end) | Row | "Can't build it? Ask a maker nearby" |
| `guide-photo-captions` | `components/home/detail-screen.tsx` (photo carousel) | Marker | captions and thumbnails |
| `guide-draft-preview` | `components/home/preview-screen.tsx` (top) | Marker | draft summary vs PDF |
| `new-guide-fields` | `app/(tabs)/guides/new.tsx` (form) | Marker | cover, switch type, age range |
| `contributor-profile-details` | `components/guides/showcase-screen.tsx` (header) | Marker | bio, joined, delivered, thanks |
| `contributor-role-line` | `components/guides/showcase-screen.tsx` (header) | Marker | occupation and org chip |
| `thank-people` | `components/guides/showcase-screen.tsx` (header), `components/printing/job-screen.tsx` (after collection), `components/toys/toy-detail-screen.tsx` (person holder), `components/exchanges/thread-screen.tsx` (handed over) | Button | "Say thanks" |
| `report-problem-mobile` | `components/guides/showcase-screen.tsx`, `components/organisation/org-profile-screen.tsx` (replace the dead text), `components/printing/job-screen.tsx` | Button | "Report a problem" |
| `org-profile-rows` | `components/organisation/org-profile-screen.tsx` (backed guides, shelf toys) | Marker | photo, meta, See all |
| `org-recycling-details` | `components/organisation/org-profile-screen.tsx` (recycling panel) | Marker | machines, forms, min/max, hours |
| `printer-stats` | `components/printing/find-screen.tsx` (row), `components/printing/job-screen.tsx` (printer card), `components/organisation/org-profile-screen.tsx` (print panel) | Marker | jobs, median days, fit |
| `org-visit-map` | `components/organisation/org-profile-screen.tsx` (visit) | Marker | map and street address |
| `locations-and-distance` | `components/printing/find-screen.tsx` (filters), `components/toys/toy-library-screen.tsx` (chips) | Chip | "Within 10 km", "Nearest first" |
| `printer-verified` | `components/printing/find-screen.tsx` (filters) | Chip | "Verified" |
| `bed-fit-filter` | `components/printing/basics-screen.tsx` (bed size) | Marker | filter by part dimensions |
| `recycling-credit-spending` | `components/printing/request-screen.tsx` (before agree) | Row | "Use my recycling credit" |
| `print-cost-estimate` | `components/printing/request-screen.tsx` (agree line) | Marker | "about $X at the declared rate" |
| `print-part-quantity` | `components/printing/request-screen.tsx` (part rows) | Marker | quantity per part |
| `print-fit-feedback` | `components/printing/job-screen.tsx` (after collection) | Button | "Did it fit?" |
| `message-printer` | `components/printing/job-screen.tsx` (printer card) | Button | "Message" |
| `printing-basics-hero` | `components/printing/basics-screen.tsx` (top) | Marker | hero photo |
| `toy-holder-location` | `components/toys/toy-detail-screen.tsx` (subtitle) | Marker | suburb, state |
| `toy-condition-words` | `components/toys/toy-detail-screen.tsx` (condition) | Marker | word grade |
| `toy-holder-picks` | `components/toys/toy-detail-screen.tsx` (end) | Marker | "Also worth a look" |
| `organisations-list-meta` | `components/toys/organisations-screen.tsx` (row) | Marker | location, counts, badges |

- [ ] Place each row; typecheck; run `npx jest tests/unit/components/home tests/unit/components/printing tests/unit/components/toys tests/unit/components/guides tests/unit/components/organisation`.
- [ ] `node scripts/pending.mjs`; confirm these ids show "In code" in `docs/PENDING.md`.
- [ ] Commit: `feat(mobile): register and draw pending guides, printing and toys work`.

#### Task 7: Mobile — explore, challenges, makers, recycling, inbox, threads

| Id | File (packages/mobile/…) | Form | What |
|---|---|---|---|
| `explore-community-stats` | `components/explore/explore-screen.tsx` | Marker | "This community so far" |
| `learn-article-hero` | `components/explore/article-screen.tsx` | Marker | hero image |
| `about-content-mobile` | `components/explore/about-screen.tsx` | Marker | board lead and rows |
| `learn-ask-an-expert-mobile` | `components/explore/learn-hub.tsx` (Ask an expert row) | Marker | link vs Soon |
| `challenge-outcome-tab` | `components/challenges/detail-screen.tsx` (TABS) | Tab | "Outcome" |
| `challenge-thread-tab` | `components/challenges/detail-screen.tsx` (TABS) | Tab | "Thread" |
| `challenge-constraints` | `components/challenges/detail-screen.tsx` (brief) | Marker | named constraints |
| `challenge-brief-photo` | `components/challenges/detail-screen.tsx` (brief) | Marker | hero photo, requirement box |
| `challenge-maker-meta` | `components/challenges/detail-screen.tsx` (makers) | Marker | role, joined, You |
| `challenge-author-states` | `components/challenges/detail-screen.tsx` (load) | Marker | author's pending/rejected view |
| `challenge-writeup-stage` | `components/challenges/detail-screen.tsx` (graduated headline) | Marker | being written up |
| `challenge-saves-stat` | `components/challenges/detail-screen.tsx` (stats) | Marker | saves tile |
| `idea-anonymous` | `components/challenges/submit-idea-screen.tsx` (form end) | Row | "Post anonymously" |
| `idea-photo` | `components/challenges/submit-idea-screen.tsx` (form) | Button | "Add a photo" |
| `idea-required-fields` | `components/challenges/submit-idea-screen.tsx` (validation) | Marker | only title + summary required |
| `makers-live-done-tabs` | `components/builds/makers-wanted-screen.tsx` (header) | Tab | "Live", "Done" |
| `makers-ask-first` | `components/builds/makers-wanted-screen.tsx` (row actions) | Button | "Ask first" |
| `makers-row-meta` | `components/builds/makers-wanted-screen.tsx` (row) | Marker | build time and cost |
| `build-request-options` | `components/builds/ask-for-build-screen.tsx` (URGENCIES) | Marker | options and optional note |
| `build-thread-cost-panel` | `components/builds/build-thread-screen.tsx` | Marker | parts cost panel |
| `report-problem-mobile` | `components/builds/build-thread-screen.tsx`, `components/exchanges/thread-screen.tsx` | Button | "Report a problem" |
| `handover-code-actions` | `components/exchanges/thread-screen.tsx` (code card) | Button | "New code" |
| `exchange-toy-photo` | `components/exchanges/thread-screen.tsx` (header) | Marker | toy photo |
| `notification-second-line` | `components/inbox/inbox-screen.tsx` (note card) | Marker | body line |
| `org-recycling-details` | `components/recycling/recycling-screen.tsx` (org card), `components/recycling/intake-screen.tsx` (what you can take) | Marker | machines, max, hours |
| `recycling-photo-upload` | `components/recycling/recycling-screen.tsx` (booking) | Button | "Add a photo of the sorted plastic" |
| `recycling-intake-credit-rule` | `components/recycling/intake-screen.tsx` (credit fields) | Marker | credit from weight |

- [ ] Place each row; typecheck; run `npx jest tests/unit/components/explore tests/unit/components/challenges tests/unit/components/builds tests/unit/components/exchanges tests/unit/components/recycling tests/unit/components/inbox`.
- [ ] `node scripts/pending.mjs`; confirm.
- [ ] Commit: `feat(mobile): register and draw pending explore, challenges and makers work`.

#### Task 8: Mobile — Me, editor, account, organisation, admin

| Id | File (packages/mobile/…) | Form | What |
|---|---|---|---|
| `me-count-badges` | `app/(tabs)/me.tsx` (Row count) | Marker | counts from caps |
| `me-rows-structure` | `app/(tabs)/me.tsx` (groups) | Row | "Makers wanted" under challenges |
| `money-panel-detail` | `app/(tabs)/me.tsx` (MoneyPanel) | Marker | item, person, settled |
| `my-tutorials-meta` | `components/my-tutorials/list-screen.tsx` (row meta) | Marker | backing, sections done |
| `my-tutorials-views` | `components/my-tutorials/list-screen.tsx` (row meta) | Marker | view count |
| `editor-backing` | `components/my-tutorials/hub.tsx` ("Backed by" row) | Row | "Backing" |
| `editor-part-buy-links` | `components/my-tutorials/sections/items-section.tsx` (part row) | Button | "Buy links" |
| `editor-safety-notes` | `components/my-tutorials/sections/safety-section.tsx` (end) | Button | "Add a safety note" |
| `my-toy-inline-requests` | `components/my-toys/editor.tsx` (requests count) | Marker | inline requests with Accept |
| `toy-pause-unavailable` | `components/my-toys/editor.tsx` (actions) | Button | "Mark unavailable" |
| `my-challenges-meta` | `components/challenges/my-screen.tsx` (row) | Marker | date and counts |
| `saved-parts` | `components/saved/saved-screen.tsx` (TILES) | Row | "Printable parts" |
| `saved-list-meta` | `components/saved/saved-list-screen.tsx` (row) | Marker | difficulty · time · author |
| `add-printer-rates` | `components/printing/add-printer-screen.tsx` (end) | Row | "Your standard rates" |
| `customization-metrics` | `components/profile-screen.tsx` (profile detail) | Row | "Customization" |
| `child-switch-sound` | `components/profile/child-editor-home.tsx` | Marker | switch used, sound tolerance |
| `wizard-steps` | `components/profile/child-wizard.tsx` (steps) | Marker | enjoys, measurements |
| `wizard-mascot-done` | `components/profile/child-wizard.tsx` (finish) | Marker | mascot per step, ready screen |
| `review-checklist` | `components/organisation/review-detail-screen.tsx` (checklist) | Marker | summary/steps/safety rows |
| `inventory-states` | `components/organisation/inventory-screen.tsx` (states) | Marker | needs clean, retired, who holds |
| `admin-counts` | `app/(my)/admin.tsx` | Marker | count cards and reports card |
| `android-one-tap` | already referenced — leave |  |  |

- [ ] Place each row; typecheck; run `npx jest tests/unit/app tests/unit/components/my-tutorials tests/unit/components/my-toys tests/unit/components/saved tests/unit/components/profile tests/unit/components/organisation tests/unit/components/printing`.
- [ ] `node scripts/pending.mjs`; confirm.
- [ ] Commit: `feat(mobile): register and draw pending Me, editor, account and org work`.

#### Task 9: Web and API

| Id | File | Form | What |
|---|---|---|---|
| `web-toy-family-notes` | `packages/web/app/toy-library/[id]/page.tsx` | Marker | "Notes from the family" |
| `web-toy-offer-a-toy` | the swap-request form used by `/toy-library/[id]/request` (`packages/web/app/toy-library/[id]/request/page.tsx` or the component it renders) | Marker | "Pick a toy to offer" |
| `web-org-public-sections` | `packages/web/app/organizations/[id]/page.tsx` | Marker | four sections (verify each is absent, not merely empty for the fixture) |
| `web-event-detail` | `packages/web/app/get-involved/events/[id]/page.tsx`, `…/register/page.tsx` | Marker | about, cost |
| `web-events-by-month` | `packages/web/app/get-involved/events/page.tsx` | Marker | month groups |
| `web-admin-review-list` | `packages/web/app/admin/review/page.tsx` | Marker | row meta and search |
| `makers-ask-first` | the web makers-wanted row component (search `I'll build this` under `packages/web`) | Button | "Ask first", `className` matching "I'll build this" |
| `site-content-learn-legal-editing` | the admin site-content page (search `Site content` under `packages/web/app/admin`) | Marker | Learn/Legal tabs read-only |
| `print-estimates` | `packages/web/app/printing/request/page.tsx` (or the form it renders) | Marker | time and grams |
| `org-visit-map` | `packages/web/app/organizations/[id]/page.tsx` | Marker | map |
| `locations-and-distance`, `printer-stats`, `print-settings`, `org-recycling-details`, `part-prices` | `packages/api/src/routes/{printers,organizations,tutorials,toys}.ts` at the select that would return the field | Marker | api/db side |
| `site-url` | `supabase/config.toml`, above the `[auth]` `site_url` line | Marker | hosted Site URL is still `http://localhost:3000` |

- [ ] Place each row; `cd packages/web && npx tsc --noEmit -p . && npm run -s test:unit`; `cd packages/api && npx tsc --noEmit -p .`.
- [ ] `node scripts/pending.mjs`; confirm.
- [ ] Commit: `feat: register pending web and API work`.

#### Task 10: Content TODOs become registry references

| Id | File | Change |
|---|---|---|
| `team-page` | `packages/web/app/about/team/page.tsx` | `// PENDING(team-page)` above the TODO placeholders (strings stay) |
| `contributor-terms-legal` | `packages/web/app/legal/contributor-terms/page.tsx` | replace `TODO:` with `PENDING(contributor-terms-legal):`; add "draft copy: board POLICY table" |
| `org-leader-terms-legal` | `packages/web/app/legal/org-leader-terms/page.tsx` | same |
| `intended-purpose-review` | `packages/web/app/legal/intended-purpose/page.tsx` | `TODO(splat)` → `PENDING(intended-purpose-review)` |
| `privacy-data-region` | `packages/web/app/privacy/page.tsx` (region TODO) | same |
| — | `packages/web/app/privacy/page.tsx` (pickup-address `TODO(splat)`) | Leave as is: a scheduled purge of pickup addresses is not in the appendix. List it in the Task 11 report as a candidate item for Byron. |
| `org-facts` | `packages/web/lib/org-facts.ts` | `PENDING(org-facts)` in the header comment |
| `terms-version` | `packages/types/src/index.ts` at `AGREEMENT_VERSIONS` | `// PENDING(terms-version): still 'v0-todo'` |

- [ ] Apply; `cd packages/web && npx tsc --noEmit -p . && npm run -s test:unit` (the org-facts guard tests read those strings — they must still pass).
- [ ] `node scripts/pending.mjs`; confirm.
- [ ] Commit: `chore: loose TODOs become pending-registry references`.

---

### Task 11: The recycling bug, cleanup, full verification

**Files:**
- Modify: `packages/mobile/components/recycling/recycling-screen.tsx`
- Test: `packages/mobile/tests/unit/components/recycling/recycling-screen.test.tsx`
- Delete: `docs/superpowers/plans/2026-09-30-sign-in-remaining-work.md`
- Modify: `packages/mobile/tests/e2e/auth.spec.ts` (keep), add `packages/web/tests/e2e/public/not-built.spec.ts`

- [ ] **Step 1: Failing test for the bug**

```tsx
it('stops loading when signed out', async () => {
  mockUseAuth.mockReturnValue({ session: null })
  render(<RecyclingScreen />)
  await waitFor(() => expect(screen.queryByTestId('recycling-skeleton')).toBeNull())
})
```

(Use the file's existing auth mock name and the skeleton's actual testID; add `testID="recycling-skeleton"` to the skeleton if it has none.)

- [ ] **Step 2: Run — FAIL (skeleton stays).** `cd packages/mobile && npx jest tests/unit/components/recycling/recycling-screen.test.tsx`
- [ ] **Step 3: Fix** — in `load`, replace `if (!me) return` with `if (!me) { setLoading(false); return }` (match the file's state setter name).
- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Web e2e**

```ts
// packages/web/tests/e2e/public/not-built.spec.ts
import { test, expect } from '@playwright/test'
test('a registry item has a Not built yet page', async ({ page }) => {
  await page.goto('/not-built/impact-map')
  await expect(page.getByText('Not built yet')).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Deliveries map')
})
```

Run: `cd packages/web && npx playwright test tests/e2e/public/not-built.spec.ts` — PASS.

- [ ] **Step 6: Remove the superseded checklist** and point the three references at `docs/PENDING.md`: `git rm docs/superpowers/plans/2026-09-30-sign-in-remaining-work.md`; `git grep -l "sign-in-remaining-work"` and update each hit.
- [ ] **Step 7: Full verification**

```bash
node scripts/pending.mjs
(cd packages/api && npx vitest run tests/unit)          # drift test: all 4 pass
(cd packages/mobile && npx tsc --noEmit -p . && npx jest)
(cd packages/web && npx tsc --noEmit -p . && npm run -s test:unit)
(cd packages/mobile && npx playwright test tests/e2e/auth.spec.ts)
```

Expected: all green; `docs/PENDING.md` lists 104 open items, each with "In code" locations.

- [ ] **Step 8: Commit and push**

```bash
git add -A packages docs scripts
git commit -m "fix(mobile): signed-out Recycling stops loading; docs/PENDING.md replaces the sign-in checklist"
git -c credential.helper= -c credential.helper='!gh auth git-credential' push origin development
```
