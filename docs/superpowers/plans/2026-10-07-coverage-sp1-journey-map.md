# Coverage SP1: Journey Map and Drift Check — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the mobile journey inventory into the repo as data, make every test declare which journeys it covers, and add a check that fails when a journey's required layers have no covering test.

**Architecture:** `packages/mobile/tests/journeys.json` is the single list of journeys (id, seat, screen, element, chain, which layers are required, who can set the resulting state). Test files carry a one-line `journeys:` tag. `scripts/journeys/check.mjs` cross-references the two and exits 1 on gaps or unknown tags; `scripts/journeys/render.mjs` writes `docs/testing/mobile-journeys.md` from the same data and the check fails if that file is stale. Both run in CI.

**Tech Stack:** Node 26 ESM scripts with `node:test`, JSON data validated by a Jest test in packages/mobile, GitHub Actions (`.github/workflows/ci.yml`).

**Spec:** `docs/superpowers/specs/2026-10-07-mobile-coverage-audit-design.md` (§3, §4 SP1, §6). Source inventory: `docs/testing/mobile-journeys-inventory-2026-10-07.md` (Task 1 copies it in from `.superpowers/coverage-audit/inventory.md`).

## Global Constraints

- Agents on sonnet/haiku only. One commit per task at its commit step; nothing pushed. Every commit ends with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01F8bxN6TMsn3AKemANnZTcg`.
- Journey IDs are exactly the inventory's (A01…Q17, including combined rows such as `A09, A10` split into `A09` and `A10`, and `Z01, Z02` into `Z01` and `Z02`). No new IDs in SP1 except `G30` for the Files-tab 3D pill (Task 10 of the guide-page plan) and `G31` for the model screen's ✕/Ask-someone footer.
- The tag line is `// journeys: ID ID …` (TS/JS test files) or `# journeys: ID ID …` (Maestro YAML), within the first 10 lines of the file, IDs separated by single spaces, uppercase.
- Layers and their file globs: `unit` = `packages/mobile/tests/unit/**/*.test.{ts,tsx}`; `e2e` = `packages/mobile/tests/e2e/*.spec.ts`; `api` = `packages/api/tests/**/*.test.ts`; `device` = `packages/mobile/.maestro/flows/*.yaml`.
- `required` per journey follows spec ruling 3: a journey with an API call requires `api`; every journey requires `unit`; `e2e` is required unless the journey is device-only (native gesture/modal/WebView/cold start) or pure device storage with no visible result; `device` is required only for native-only behaviour. SP1 sets these flags honestly from the inventory; it does not waive anything.
- Scripts never modify test files; tagging is done by hand in Tasks 3–4.

## Review Focus

1. A test file with two `journeys:` lines, or a tag with lowercase/duplicate IDs: the check must report it, not silently take the first. Pinned in Task 2.
2. A journey whose required layer is `device` but no Maestro flow is tagged: the check must list it under device, not pass because unit/e2e are green. Pinned in Task 2.
3. A journey ID that exists in a tag but not in `journeys.json` (typo): the check fails naming the file. Pinned in Task 2.
4. The rendered doc committed from a different machine's line endings or ordering: `render.mjs` must be deterministic (sorted by ID, LF) so `--check` does not flap. Pinned in Task 2.
5. A journey row in `journeys.json` with an unknown `seat`/`setter`/layer key: the Jest schema test must fail. Pinned in Task 1.

---

### Task 1: The journey data and its schema test

**Files:**
- Create: `docs/testing/mobile-journeys-inventory-2026-10-07.md` (copy of `.superpowers/coverage-audit/inventory.md`)
- Create: `packages/mobile/tests/journeys.json`
- Create: `packages/mobile/tests/unit/journeys-schema.test.ts`

**Interfaces:**
- Produces the JSON shape every later task and script reads:
```ts
type Layer = 'unit' | 'e2e' | 'api' | 'device'
type Journey = {
  id: string                       // 'G23'
  seat: 'P' | 'L' | 'A'            // who performs it
  screen: string                   // 'guides/[id] Feedback tab'
  element: string                  // 'composer → FeedbackSheet Post'
  api: string[]                    // ['POST /api/tutorials/:id/notes'] ([] when none)
  db: string[]                     // ['tutorial_notes']
  notifies: string[]               // ['tutorial_noted']
  counts: string[]                 // ['Feedback badge']
  setter: 'mobile' | 'web' | 'none' | 'n/a'   // who can act on the resulting state
  required: Layer[]                // layers that must have a tagged test
  waived?: Partial<Record<Layer, string>>     // SP1 leaves this absent
}
```

- [ ] **Step 1: Copy the inventory into docs**

Run from the worktree root: `mkdir -p docs/testing && cp .superpowers/coverage-audit/inventory.md docs/testing/mobile-journeys-inventory-2026-10-07.md`. Prepend one line: `> Snapshot of the scout's inventory; the living map is docs/testing/mobile-journeys.md, generated from packages/mobile/tests/journeys.json.`

- [ ] **Step 2: Write the failing schema test**

`packages/mobile/tests/unit/journeys-schema.test.ts`:
```ts
// journeys: (none — this file checks the map itself)
import journeys from '../journeys.json'
import { readFileSync } from 'fs'
import { join } from 'path'

const LAYERS = ['unit', 'e2e', 'api', 'device'] as const
const SEATS = ['P', 'L', 'A'] as const
const SETTERS = ['mobile', 'web', 'none', 'n/a'] as const

describe('journeys.json', () => {
  it('has unique uppercase ids in inventory order', () => {
    const ids = journeys.map((j) => j.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[A-Z]\d{2}$/)
  })

  it('covers every id the inventory names', () => {
    const inv = readFileSync(join(__dirname, '../../../../docs/testing/mobile-journeys-inventory-2026-10-07.md'), 'utf8')
    const named = new Set([...inv.matchAll(/^\| ([A-Z]\d{2})(?:, ([A-Z]\d{2}))? \|/gm)].flatMap((m) => [m[1], m[2]].filter(Boolean)))
    const have = new Set(journeys.map((j) => j.id))
    expect([...named].filter((id) => !have.has(id))).toEqual([])
  })

  it('every row has a valid seat, setter and required layers', () => {
    for (const j of journeys) {
      expect(SEATS).toContain(j.seat)
      expect(SETTERS).toContain(j.setter)
      expect(j.required.length).toBeGreaterThan(0)
      for (const l of j.required) expect(LAYERS).toContain(l)
      expect(j.required).toContain('unit')
      if (j.api.length) expect(j.required).toContain('api')
      for (const key of ['api', 'db', 'notifies', 'counts'] as const) expect(Array.isArray(j[key])).toBe(true)
    }
  })

  it('names the new guide-page journeys', () => {
    expect(journeys.find((j) => j.id === 'G30')?.element).toMatch(/3D/)
  })
})
```
Add `"resolveJsonModule": true` to `packages/mobile/tsconfig.json` compilerOptions if it is not already set (check first).

- [ ] **Step 3: Run it (fails: file not found)**

Run: `cd packages/mobile && pnpm test:unit -- tests/unit/journeys-schema.test.ts`
Expected: FAIL — cannot find `../journeys.json`.

- [ ] **Step 4: Write `journeys.json`**

Transcribe every row of the inventory's §2 tables into the shape above. Rules:
- Split combined IDs (`A09, A10`; `Z01, Z02`) into two rows each with their own element text.
- `api`: the inventory's API cell split on `;` and `,` into full strings prefixed `/api` where missing; a dash or "client"/"device"/"local" cell → `[]`.
- `db`, `notifies`, `counts`: split the cell on `;`/`,`; a dash → `[]`. Strip the inventory's bold markers and parenthetical notes, keeping the name only (`toy_request`, not `**toy_request** to owner`).
- `setter`: `mobile` when the setter cell names a mobile screen or "(mobile)"; `web` when it says web/admin web; `none` when it says "nowhere"/"no caller"/"unimplemented"; `n/a` for a dash.
- `required`: `['unit']` always; add `'api'` when `api` is non-empty; add `'e2e'` for every journey except: device-storage-only rows with no visible result (H04, H06 keep e2e — they have visible rows; B06, G21 do not), pure `Linking` rows (Z10, Q16, G17 keep e2e because the URL is asserted via `window.open`), and native-only rows; add `'device'` for G11, Y03, Y04 (native paging), B05, G15 (fullScreenModal), G30/G31 (WebView), A05/A14 (cold start), H07 (tab bar), Z04 (sign-out clears session), B04 and G27 (modal over modal on iOS, from the guide-page ledger's device-check list).
- Add rows:
  - `G30`: seat P, screen `guides/[id] Files tab`, element `3D pill → /guides/[id]/model`, api `['GET /api/public/tutorials/:id']`, db `['stl_files']`, notifies `[]`, counts `[]`, setter `n/a`, required `['unit','e2e','api','device']`.
  - `G31`: seat P, screen `guides/[id]/model`, element `✕ → back; Ask someone to print → /printing`, api `[]`, db `[]`, notifies `[]`, counts `[]`, setter `n/a`, required `['unit','e2e','device']`.
- Keep inventory order (section by section, ID ascending).

Example rows (first three) to copy the shape from:
```json
[
  { "id": "A01", "seat": "P", "screen": "(auth)/welcome", "element": "Get started → create-account", "api": [], "db": [], "notifies": [], "counts": [], "setter": "n/a", "required": ["unit", "e2e"] },
  { "id": "A02", "seat": "P", "screen": "(auth)/welcome", "element": "I already have an account → sign-in", "api": [], "db": [], "notifies": [], "counts": [], "setter": "n/a", "required": ["unit", "e2e", "device"] },
  { "id": "A03", "seat": "P", "screen": "(auth)/sign-in", "element": "Apple/Google button → /not-built or signInWithIdToken", "api": ["Supabase auth"], "db": ["auth.users"], "notifies": [], "counts": [], "setter": "none", "required": ["unit", "e2e", "api"] }
]
```
("Supabase auth" counts as an API entry; the api layer for it is the auth integration tests.)

- [ ] **Step 5: Run the schema test (passes)**

Run: `cd packages/mobile && pnpm test:unit -- tests/unit/journeys-schema.test.ts`
Expected: PASS, 4 tests. If "covers every id" lists missing IDs, add them; do not loosen the regex.

- [ ] **Step 6: Commit**

```bash
git add docs/testing/mobile-journeys-inventory-2026-10-07.md packages/mobile/tests/journeys.json packages/mobile/tests/unit/journeys-schema.test.ts packages/mobile/tsconfig.json
git commit -m "test(mobile): the journey map as data, with the inventory it was transcribed from"
```

---

### Task 2: `check.mjs`, `render.mjs`, their tests, the generated doc, CI

**Files:**
- Create: `scripts/journeys/lib.mjs`, `scripts/journeys/check.mjs`, `scripts/journeys/render.mjs`, `scripts/journeys/check.test.mjs`
- Create: `docs/testing/mobile-journeys.md` (generated)
- Modify: `package.json` (root scripts), `.github/workflows/ci.yml`

**Interfaces:**
- Consumes `packages/mobile/tests/journeys.json` (Task 1 shape).
- Produces:
```js
// scripts/journeys/lib.mjs
export const LAYERS = { unit: 'packages/mobile/tests/unit/**/*.test.{ts,tsx}', e2e: 'packages/mobile/tests/e2e/*.spec.ts', api: 'packages/api/tests/**/*.test.ts', device: 'packages/mobile/.maestro/flows/*.yaml' }
export function parseTags(text)                       // → { ids: string[], errors: string[] } from the first 10 lines
export function coverage(journeys, filesByLayer)      // → { gaps: [{id, layer}], unknown: [{file, id}], duplicates: [file], waived: [{id, layer, reason}] }
export function renderDoc(journeys, cov)              // → markdown string, deterministic
```
- `check.mjs` exits 0 when `gaps`, `unknown` and `duplicates` are all empty and the rendered doc equals the committed one; otherwise prints each item and exits 1. `--write` regenerates the doc instead of comparing.

- [ ] **Step 1: Write the failing tests**

`scripts/journeys/check.test.mjs` (run with `node --test scripts/journeys/`):
```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseTags, coverage, renderDoc } from './lib.mjs'

const J = [
  { id: 'G23', required: ['unit', 'e2e', 'api'], seat: 'P', screen: 's', element: 'e', api: ['POST /x'], db: [], notifies: [], counts: [], setter: 'n/a' },
  { id: 'B05', required: ['unit', 'device'], seat: 'P', screen: 's', element: 'e', api: [], db: [], notifies: [], counts: [], setter: 'n/a', waived: { device: 'simulator only' } },
]

test('parseTags reads one tag line within the first 10 lines', () => {
  assert.deepEqual(parseTags('// header\n// journeys: G23 B05\nimport x'), { ids: ['G23', 'B05'], errors: [] })
  assert.deepEqual(parseTags('# journeys: B05\nappId: x'), { ids: ['B05'], errors: [] })
  assert.deepEqual(parseTags('no tag here'), { ids: [], errors: [] })
})

test('parseTags rejects a second tag line, lowercase and duplicate ids', () => {
  assert.equal(parseTags('// journeys: G23\n// journeys: B05').errors.length, 1)
  assert.equal(parseTags('// journeys: g23').errors.length, 1)
  assert.equal(parseTags('// journeys: G23 G23').errors.length, 1)
})

test('coverage lists a gap per missing required layer, honours waivers, names unknown tags', () => {
  const files = { unit: { 'u.test.ts': ['G23', 'B05'] }, e2e: {}, api: { 'a.test.ts': ['G23', 'Z99'] }, device: {} }
  const c = coverage(J, files)
  assert.deepEqual(c.gaps, [{ id: 'G23', layer: 'e2e' }])
  assert.deepEqual(c.unknown, [{ file: 'a.test.ts', id: 'Z99' }])
  assert.deepEqual(c.waived, [{ id: 'B05', layer: 'device', reason: 'simulator only' }])
})

test('a device-only gap is reported even when unit is green', () => {
  const c = coverage([{ ...J[1], waived: undefined }], { unit: { 'u.test.ts': ['B05'] }, e2e: {}, api: {}, device: {} })
  assert.deepEqual(c.gaps, [{ id: 'B05', layer: 'device' }])
})

test('renderDoc is deterministic and sorted by id', () => {
  const c = coverage(J, { unit: { 'u.test.ts': ['G23', 'B05'] }, e2e: {}, api: { 'a.test.ts': ['G23'] }, device: {} })
  const a = renderDoc(J, c), b = renderDoc([...J].reverse(), c)
  assert.equal(a, b)
  assert.match(a, /\| B05 \|/)
  assert.ok(a.indexOf('| B05 |') < a.indexOf('| G23 |'))
  assert.ok(!a.includes('\r'))
})
```

- [ ] **Step 2: Run them (fail: module not found)**

Run: `node --test scripts/journeys/`
Expected: FAIL — `./lib.mjs` not found.

- [ ] **Step 3: Implement**

`scripts/journeys/lib.mjs`:
```js
// The journey map's rules: how tests declare coverage, what counts as a gap,
// and the doc rendered from both. check.mjs and render.mjs are thin CLIs.
export const LAYERS = {
  unit: 'packages/mobile/tests/unit/**/*.test.{ts,tsx}',
  e2e: 'packages/mobile/tests/e2e/*.spec.ts',
  api: 'packages/api/tests/**/*.test.ts',
  device: 'packages/mobile/.maestro/flows/*.yaml',
}
const TAG = /^(?:\/\/|#)\s*journeys:\s*(.*)$/

export function parseTags(text) {
  const lines = text.split('\n').slice(0, 10)
  const hits = lines.map((l) => l.match(TAG)).filter(Boolean)
  const errors = []
  if (hits.length > 1) errors.push('more than one journeys: line')
  if (!hits.length) return { ids: [], errors }
  const raw = hits[0][1].trim()
  if (raw.startsWith('(')) return { ids: [], errors }   // "(none — …)" opt-out
  const ids = raw.split(/\s+/).filter(Boolean)
  for (const id of ids) if (!/^[A-Z]\d{2}$/.test(id)) errors.push(`bad id ${id}`)
  if (new Set(ids).size !== ids.length) errors.push('duplicate id')
  return { ids, errors }
}

export function coverage(journeys, filesByLayer) {
  const known = new Set(journeys.map((j) => j.id))
  const covered = {}
  const unknown = []
  for (const [layer, files] of Object.entries(filesByLayer)) {
    covered[layer] = new Set()
    for (const [file, ids] of Object.entries(files)) {
      for (const id of ids) (known.has(id) ? covered[layer].add(id) : unknown.push({ file, id }))
    }
  }
  const gaps = [], waived = []
  for (const j of [...journeys].sort((a, b) => a.id.localeCompare(b.id))) {
    for (const layer of j.required) {
      if (covered[layer]?.has(j.id)) continue
      const reason = j.waived?.[layer]
      if (reason) waived.push({ id: j.id, layer, reason })
      else gaps.push({ id: j.id, layer })
    }
  }
  return { gaps, unknown, waived, covered }
}

export function renderDoc(journeys, cov) {
  const mark = (j, layer) => (!j.required.includes(layer) ? '–' : cov.covered[layer]?.has(j.id) ? '✅' : j.waived?.[layer] ? `⚠️ ${j.waived[layer]}` : '❌')
  const rows = [...journeys].sort((a, b) => a.id.localeCompare(b.id)).map((j) =>
    `| ${j.id} | ${j.seat} | ${j.screen} | ${j.element} | ${j.notifies.join(', ') || '–'} | ${j.counts.join(', ') || '–'} | ${j.setter} | ${mark(j, 'unit')} | ${mark(j, 'e2e')} | ${mark(j, 'api')} | ${mark(j, 'device')} |`
  )
  return [
    '# Mobile journeys — coverage map',
    '',
    'Generated by `scripts/journeys/render.mjs` from `packages/mobile/tests/journeys.json`; do not edit. ✅ a tagged test covers the layer · ❌ required and missing · ⚠️ waived (reason) · – not required.',
    '',
    `Gaps: ${cov.gaps.length} · Waived: ${cov.waived.length}`,
    '',
    '| ID | Seat | Screen | Element | Notifies | Counts | Setter | Unit | E2E | API | Device |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
    ...rows,
    '',
  ].join('\n')
}
```

`scripts/journeys/check.mjs`:
```js
#!/usr/bin/env node
// Fails when a journey's required layer has no tagged test, a tag names an
// unknown journey, a file carries a malformed tag, or the rendered doc is
// stale. `--write` regenerates docs/testing/mobile-journeys.md instead.
import { readFileSync, writeFileSync } from 'node:fs'
import { globSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LAYERS, parseTags, coverage, renderDoc } from './lib.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const journeys = JSON.parse(readFileSync(resolve(root, 'packages/mobile/tests/journeys.json'), 'utf8'))
const filesByLayer = {}
const malformed = []
for (const [layer, pattern] of Object.entries(LAYERS)) {
  filesByLayer[layer] = {}
  for (const file of globSync(pattern, { cwd: root }).sort()) {
    const { ids, errors } = parseTags(readFileSync(resolve(root, file), 'utf8'))
    for (const e of errors) malformed.push(`${file}: ${e}`)
    if (ids.length) filesByLayer[layer][file] = ids
  }
}
const cov = coverage(journeys, filesByLayer)
const doc = renderDoc(journeys, cov)
const docPath = resolve(root, 'docs/testing/mobile-journeys.md')
if (process.argv.includes('--write')) {
  writeFileSync(docPath, doc)
  console.log(`wrote ${docPath}: ${cov.gaps.length} gaps, ${cov.waived.length} waived`)
  process.exit(0)
}
let failed = false
const say = (title, items, fmt) => { if (items.length) { failed = true; console.error(`\n${title} (${items.length})`); for (const i of items) console.error('  ' + fmt(i)) } }
say('Malformed tags', malformed, (m) => m)
say('Unknown journey ids', cov.unknown, (u) => `${u.file}: ${u.id}`)
say('Required layers with no tagged test', cov.gaps, (g) => `${g.id} ${g.layer}`)
let current = ''
try { current = readFileSync(docPath, 'utf8') } catch {}
if (current !== doc) { failed = true; console.error('\ndocs/testing/mobile-journeys.md is stale: run pnpm test:journeys:write') }
if (cov.waived.length) { console.log(`\nWaived (${cov.waived.length})`); for (const w of cov.waived) console.log(`  ${w.id} ${w.layer}: ${w.reason}`) }
console.log(`\n${journeys.length} journeys, ${cov.gaps.length} gaps`)
process.exit(failed ? 1 : 0)
```
(`globSync` is in `node:fs` from Node 22; this repo runs Node 26.)

`scripts/journeys/render.mjs`: `import './check.mjs'` is wrong (it would run the check); instead make it a two-liner that spawns `check.mjs --write`: 
```js
#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
execFileSync(process.execPath, [new URL('./check.mjs', import.meta.url).pathname, '--write'], { stdio: 'inherit' })
```

Root `package.json` scripts: `"test:journeys": "node scripts/journeys/check.mjs"`, `"test:journeys:write": "node scripts/journeys/render.mjs"`, `"test:journeys:unit": "node --test scripts/journeys/"`.

`.github/workflows/ci.yml`: in the job that runs `pnpm -r typecheck` (line ~67), add after it:
```yaml
      - name: Journey map
        run: pnpm test:journeys:unit && pnpm test:journeys
```

- [ ] **Step 4: Run the script tests, then generate the doc**

Run: `node --test scripts/journeys/` → PASS (5 tests).
Run: `pnpm test:journeys:write` → writes `docs/testing/mobile-journeys.md`; the count of gaps will be large (nothing is tagged yet) — that is expected at this step.
Run: `pnpm test:journeys` → exits 1 listing gaps only (no malformed, no unknown, doc not stale). Confirm the three sections print correctly.

- [ ] **Step 5: Commit**

```bash
git add scripts/journeys package.json .github/workflows/ci.yml docs/testing/mobile-journeys.md
git commit -m "test: journey coverage check — tests declare the journeys they cover, CI fails on an untagged required layer"
```

---

### Task 3: Tag the mobile unit tests

**Files:**
- Modify: every file under `packages/mobile/tests/unit/**` that the inventory's §4 names in its U column (the §3a table gives the file → area map; §4 gives file → journey IDs).

**Interfaces:**
- Consumes the tag convention (Task 2). Produces tagged unit files; `pnpm test:journeys` afterwards shows unit gaps only where no unit test truly exists.

- [ ] **Step 1: Build the file → IDs list**

From `docs/testing/mobile-journeys-inventory-2026-10-07.md` §4, for every row take the U cell (e.g. `✅auth-screens-edge`, `✅detail-screen-actions`, `✅guide-parts`) and map the short name to its file under `tests/unit/**` (the §3a table shows the directory; e.g. `detail-screen-actions` → `tests/unit/components/home/detail-screen-actions.test.tsx`, `SaveButton` → `tests/unit/components/ui/save-button.test.tsx` — resolve by `ls`, never guess). Collect, per file, the set of IDs. Write the mapping to `.superpowers/coverage-audit/unit-tags.json` as `{ "<file>": ["G23", …] }` for the reviewer.

- [ ] **Step 2: Add the tag line**

For each file, insert `// journeys: <IDs sorted>` as the first line after any leading comment block that starts the file (if the file starts with `import`, insert at line 1). Files the inventory does not name get no tag. Do not change anything else in those files.

- [ ] **Step 3: Verify**

Run: `pnpm test:journeys` from the root. Expected: no "Malformed tags", no "Unknown journey ids"; the gaps list no longer contains `unit` entries except for L26 and Z10 (the inventory's two ❌ unit cells) — list any other remaining `unit` gap in your report with why (a journey whose only unit test was mis-named in the inventory is tagged after resolving the real file; a journey with no unit test at all stays a gap).
Run: `cd packages/mobile && pnpm test:unit` → still green (tags are comments).
Run: `pnpm test:journeys:write` to refresh the doc.

- [ ] **Step 4: Commit**

```bash
git add packages/mobile/tests/unit docs/testing/mobile-journeys.md
git commit -m "test(mobile): unit tests declare the journeys they cover"
```

---

### Task 4: Tag the e2e specs, API tests and Maestro flows; record the true gap list

**Files:**
- Modify: `packages/mobile/tests/e2e/*.spec.ts`, `packages/api/tests/**/*.test.ts`, `packages/mobile/.maestro/flows/*.yaml` named in §4's E/A/D columns.
- Modify: `docs/testing/mobile-journeys.md` (regenerated)

- [ ] **Step 1: Build the file → IDs lists** as in Task 3 from §4's E (`guides-detail:27` → `tests/e2e/guides-detail.spec.ts`), A (`guides/notes` → `packages/api/tests/integration/guides/notes.test.ts`; `unit/review-notifications` → `packages/api/tests/unit/review-notifications.test.ts`; ◐ partial cells count as covered for SP1 — note them in the report) and D (`guide-page` → `.maestro/flows/guide-page.yaml`) columns. Write `.superpowers/coverage-audit/other-tags.json`.

- [ ] **Step 2: Add the tags** (`// journeys:` for TS, `# journeys:` for YAML, within the first 10 lines — for YAML put it right after the leading comment block, before `appId:`).

- [ ] **Step 3: Verify and record**

Run: `pnpm test:journeys`. Expected: no malformed, no unknown; the remaining gaps are the audit's real backlog. Run `pnpm test:journeys:write`. Copy the printed gap list into `docs/testing/mobile-journeys-gaps-2026-10-07.md` grouped by layer with a one-line note per group naming which later sub-project owns it (SP2 notification rows: the `api` gaps for journeys whose `notifies` is non-empty; SP3: journeys with non-empty `counts` lacking e2e; SP4a/b/c: the rest of the `e2e` gaps by seat; SP5: `unit` gaps and `setter: web|none` rows; SP6: `device` gaps).
Run: `cd packages/api && pnpm test:unit` and `cd packages/mobile && pnpm test:unit` → green. Maestro YAML is not executed here.

- [ ] **Step 4: Commit**

```bash
git add packages/mobile/tests/e2e packages/api/tests packages/mobile/.maestro docs/testing
git commit -m "test: e2e, API and device tests declare their journeys; the remaining gaps are the audit backlog"
```

---

## Self-review notes
- Spec §3 → Tasks 1–2 (data, tags, check, render, doc, CI); §4 SP1 exit ("the check runs and prints the true ❌ list; nothing waived") → Task 4 Step 3; §6 → Task 2 tests.
- Review Focus 1–4 → Task 2 tests; 5 → Task 1 schema test.
- Names consistent: `journeys.json`, `parseTags`/`coverage`/`renderDoc`, `LAYERS`, `test:journeys`, `test:journeys:write`, `test:journeys:unit`, `docs/testing/mobile-journeys.md`.
- Nothing is waived in SP1; `waived` exists in the schema so later sub-projects can use it.
