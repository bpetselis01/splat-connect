# Soft Pop Round 0 — green the branch, then set up the ledgers

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `development` to a verified-green baseline, close the CI blind spot that let the photo-array work land unverified, and create the two ledgers the brief runs on — so every later round's verification means something.

**Architecture:** No product code changes. Six of the eight API integration failures are tests asserting a photo contract that `a4359f7c` deliberately replaced; they are rewritten against the append-only contract, not repaired. One is a test fixture tripping 053's bucket MIME allowlist. The eighth is local-data-only and is explicitly left alone. Then one CI trigger and two new markdown files.

**Tech Stack:** Vitest (`vitest run -c vitest.integration.config.ts`), Hono, Supabase JS, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-16-soft-pop-design.md` (§5 Baseline)

## Global Constraints

- **Test command is `pnpm --filter @splat-connect/api test:integration`.** Never bare `vitest run` — it collects the Playwright specs and reports failing files that are not failing.
- **Local Supabase must be up** (`supabase start`, Docker running). Integration tests talk to `127.0.0.1:54321`.
- **`MAX_PHOTOS = 5`**, exported from `@splat-connect/types` (`packages/types/src/index.ts:46`).
- **The upload contract since `a4359f7c`:** `/api/upload/photo` (tutorials → `toy-photos` bucket) and `/api/upload/toy-photo` (toys → `toy-photos-library`). Both **append**; neither replaces. Stored filename is `{entityId}/{crypto.randomUUID()}.{ext}` — original filenames are not preserved, so no assertion may depend on them. Both cap at `MAX_PHOTOS` and answer a sixth with 400.
- **`/api/upload/toy-cover` and `/api/upload/toy-switch-photo` no longer exist.** Any request to them 404s.
- **053 gave `toy-photos` and `toy-photos-library` an `allowed_mime_types` list.** An upload with no explicit MIME type is sent as `application/octet-stream` and refused. Test fixtures must declare a type.
- **Publish validation vocabulary** (`packages/api/src/routes/toys.ts:75-79`): `'A photo'`, `'A photo showing the switch'`, `'Offer type'`. `'Cover photo'` is gone.
- **One commit per logical change.** Do not batch tasks into one commit.
- **Do not touch `tests/integration/orgs/admin-endpoints.test.ts`.** See Task 7.

---

### Task 1: Rewrite the toy photo gallery tests against the append-only contract

All three tests in this file call routes that no longer exist. The first two assert filename-based replacement semantics that the append-only route deliberately removed — "replacing a cover photo deletes the old cover" is behaviour that was intentionally deleted, so they are replaced rather than repaired.

The third (`rejects a photo upload for a toy the caller does not own`, lines 91-103) **currently passes for the wrong reason**: it posts to the dead `/api/upload/toy-cover` and expects 404, and a missing route refuses everybody. It asserts nothing about ownership today. Retargeting it is what makes it a real test again.

**Files:**
- Modify: `packages/api/tests/integration/storage/toy-photos.test.ts` — the helper at 8-17, the two `it` blocks at 40-89, and the third `it` block at 91-103

The file is 104 lines: `describe` opens at 39 and closes at 104. Do not replace the `describe` line or its closing brace — replace the `it` blocks inside it, or the third test is orphaned and the file will not parse.

**Interfaces:**
- Consumes: `app` from `src/app.js`; `createTestUser`, `deleteTestUser`, `adminClient` from `tests/helpers/auth.js`; `MAX_PHOTOS` from `@splat-connect/types`.
- Produces: nothing other tasks read.

- [ ] **Step 1: Replace the `uploadRequest` helper and both tests**

Replace lines 8-17 (the `uploadRequest` helper) with a version that targets the live route:

```ts
function uploadRequest(token: string, file: File, id: string = toyId) {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('toyId', id)
  return app.request('/api/upload/toy-photo', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  })
}
```

Add `MAX_PHOTOS` to the imports at the top of the file:

```ts
import { MAX_PHOTOS } from '@splat-connect/types'
```

Replace **lines 40-89 only** — the two `it` blocks, leaving `describe(` on line 39 and the third test from line 91 in place:

```ts
  // Why:   a4359f7c made this route append-only. The route it replaced deleted
  //        every existing file first, so a toy could only ever hold one photo.
  // How:   uploads two photos and expects both to survive.
  it('appends each photo instead of replacing the last one', async () => {
    const first = await uploadRequest(
      user.token,
      new File(['jpg-bytes'], 'a.jpg', { type: 'image/jpeg' })
    )
    const second = await uploadRequest(
      user.token,
      new File(['png-bytes'], 'b.png', { type: 'image/png' })
    )
    expect(first.status).toBe(200)
    expect(second.status).toBe(200)

    const { data: files } = await adminClient().storage.from('toy-photos-library').list(toyId)
    expect(files?.length).toBe(2)
  })

  // Why:   the delete the old route performed WAS the cap. Removing it is what
  //        MAX_PHOTOS is for, and nothing else enforces it on this path.
  // How:   fills the gallery to MAX_PHOTOS, then asks for one more.
  it('refuses the photo past MAX_PHOTOS', async () => {
    const { data: before } = await adminClient().storage.from('toy-photos-library').list(toyId)
    for (let i = (before?.length ?? 0); i < MAX_PHOTOS; i++) {
      const res = await uploadRequest(
        user.token,
        new File([`fill-${i}`], `fill-${i}.jpg`, { type: 'image/jpeg' })
      )
      expect(res.status).toBe(200)
    }

    const overflow = await uploadRequest(
      user.token,
      new File(['too-many'], 'six.jpg', { type: 'image/jpeg' })
    )
    expect(overflow.status).toBe(400)
    expect(((await overflow.json()) as { error: string }).error).toContain(String(MAX_PHOTOS))
  })
```

Note there is no closing `})` at the end of that block — the `describe`'s own closing brace is still on line 104 where it always was.

- [ ] **Step 2: Retarget the ownership test so it stops passing vacuously**

In the third test (now following the two above), change the request path from the dead route to the live one:

```ts
    const res = await app.request('/api/upload/toy-photo', {
```

Leave `expect(res.status).toBe(404)` as it is. `checkToyOwner` answers a toy the caller does not own with 404, so the assertion is unchanged — it simply starts being caused by authorisation rather than by a missing route.

- [ ] **Step 3: Run the file and verify all three tests pass**

Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/storage/toy-photos.test.ts`
Expected: 3 passed. Before this change two failed with `expected 404 to be 200` and the third passed for the wrong reason.

If the ownership test now returns 200 rather than 404, stop: `checkToyOwner` is not gating this route, which is a real authorisation bug to report rather than patch here.

- [ ] **Step 4: Commit**

```bash
git add packages/api/tests/integration/storage/toy-photos.test.ts
git commit -m "test(api): the toy photo specs assert the append-only contract

a4359f7c replaced /api/upload/toy-cover and /toy-switch-photo with a single
append-only /toy-photo, and all three specs in this file still called the old
routes. The two gallery ones asserted the replacement semantics that change
removed, and 404'd.

The third asserts that a caller who does not own the toy is refused, and it was
passing on that same 404 — a missing route refuses everybody, so it tested
nothing. Pointing it at the live route is what puts checkToyOwner back under it.

Rewritten rather than repaired: 'replacing a cover photo deletes the old cover'
describes behaviour that was deliberately deleted. What replaces it is the rule
that actually holds now — every upload appends, and the MAX_PHOTOS cap is what
took over from the delete the old route performed.

Filenames are a uuid per file since 053, so nothing may assert on them."
```

---

### Task 2: Point the org stock photo test at the live route

This file's second test (`refuses someone who leads no organisation at all`, line 55-58) currently **passes for the wrong reason** — it expects 404 and gets 404 because the route does not exist, not because authorisation refused it. Fixing the route name is what makes that assertion meaningful again, so run the whole file and confirm both tests pass afterwards.

**Files:**
- Modify: `packages/api/tests/integration/storage/org-toy-photos.test.ts:18-27`

**Interfaces:**
- Consumes: same helpers as Task 1.
- Produces: nothing other tasks read.

- [ ] **Step 1: Retarget the helper**

Replace the `uploadCover` function (lines 18-27) with:

```ts
function uploadPhoto(token: string, id: string) {
  const fd = new FormData()
  fd.append('file', new File(['jpg-bytes'], 'stock.jpg', { type: 'image/jpeg' }))
  fd.append('toyId', id)
  return app.request('/api/upload/toy-photo', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  })
}
```

Then rename both call sites from `uploadCover(` to `uploadPhoto(` (lines 49 and 56), and change the first test's name from `lets a leader upload a cover photo for their org's stock` to `lets a leader upload a photo for their org's stock`.

- [ ] **Step 2: Run the file**

Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/storage/org-toy-photos.test.ts`
Expected: 2 passed. Confirm the outsider test still returns 404 — if it now returns 200, `checkToyOwner` is not gating org stock and that is a real bug to report, not to patch here.

- [ ] **Step 3: Commit**

```bash
git add packages/api/tests/integration/storage/org-toy-photos.test.ts
git commit -m "test(api): org stock photos upload through the route that exists

The helper posted to /api/upload/toy-cover, which a4359f7c removed. The leader
test failed on the 404.

The outsider test in the same file was passing on that same 404 — it expects a
refusal and a missing route refuses everybody, so it asserted nothing. It only
starts testing authorisation again now that the route is real."
```

---

### Task 3: Rewrite the tutorial photo test against append-only

Same class as Task 1, different bucket. `/api/upload/photo` exists, so this one fails on semantics (`expected 2 to be 1`) rather than a 404.

**Files:**
- Modify: `packages/api/tests/integration/storage/upload.test.ts` — the `replacing a photo deletes the old file (jpg -> png leaves exactly one)` test

**Interfaces:**
- Consumes: the file's existing `uploadRequest` helper and `tutorialId`.
- Produces: nothing other tasks read.

- [ ] **Step 1: Replace the test**

Replace the whole `it('replacing a photo deletes the old file (jpg -> png leaves exactly one)', ...)` block with:

```ts
  // Why:   this route appended-only since a4359f7c; it used to delete every
  //        existing object before writing, which capped a tutorial at one photo.
  // How:   uploads two and expects both, which is the inverse of the old assertion.
  it('appends each photo, so a guide can carry a gallery', async () => {
    const first = await uploadRequest(
      '/api/upload/photo',
      user.token,
      new File(['jpg-bytes'], 'photo.jpg', { type: 'image/jpeg' })
    )
    expect(first.status).toBe(200)

    const second = await uploadRequest(
      '/api/upload/photo',
      user.token,
      new File(['png-bytes'], 'photo.png', { type: 'image/png' })
    )
    expect(second.status).toBe(200)

    const { data: files } = await adminClient().storage.from('toy-photos').list(tutorialId)
    expect(files?.length).toBe(2)
  })
```

- [ ] **Step 2: Run the file**

Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/storage/upload.test.ts`
Expected: all pass. This test previously failed `expected 2 to be 1`.

- [ ] **Step 3: Commit**

```bash
git add packages/api/tests/integration/storage/upload.test.ts
git commit -m "test(api): a guide's photos append rather than replace

The assertion was 'jpg -> png leaves exactly one', which was true only while the
route deleted every existing object before writing. a4359f7c removed that delete
deliberately — one photo per guide was the bug it fixed — so the spec now asserts
the gallery it produces instead."
```

---

### Task 4: Follow the publish-validation rename in the two toy specs

`missingPublishFields` (`packages/api/src/routes/toys.ts:75`) has said `'A photo'` since `a4359f7c`; these two specs still assert `'Cover photo'`. The source is correct — only the tests are stale.

**Files:**
- Modify: `packages/api/tests/integration/toys/crud.test.ts:102`
- Modify: `packages/api/tests/integration/toys/org-inventory.test.ts:155`

**Interfaces:**
- Consumes: the publish endpoint's `{ missing: string[] }` response body.
- Produces: nothing other tasks read.

- [ ] **Step 1: Update both assertions**

In `crud.test.ts:102`, change:

```ts
    expect(blockedBody.missing).toContain('Cover photo')
```

to:

```ts
    expect(blockedBody.missing).toContain('A photo')
```

In `org-inventory.test.ts:155`, change:

```ts
    expect(((await blocked.json()) as any).missing).toContain('Cover photo')
```

to:

```ts
    expect(((await blocked.json()) as any).missing).toContain('A photo')
```

- [ ] **Step 2: Run both files**

Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/toys/crud.test.ts tests/integration/toys/org-inventory.test.ts`
Expected: all pass. Both previously failed `expected [ 'A photo', 'Offer type' ] to include 'Cover photo'`.

- [ ] **Step 3: Commit**

```bash
git add packages/api/tests/integration/toys/crud.test.ts packages/api/tests/integration/toys/org-inventory.test.ts
git commit -m "test(api): the publish blockers say 'A photo', not 'Cover photo'

053 replaced the single cover with photo_urls, and a4359f7c renamed the blocker
to match — a toy needs a photo, and which one is the cover is now just position
in the array. These two specs kept asserting the old wording."
```

---

### Task 5: Declare a MIME type on the storage gate fixture

The bucket gate test uploads `new Blob(['photo gate'])` with no type. supabase-js sends that as `application/octet-stream`, and 053 gave both photo buckets an `allowed_mime_types` list that refuses it. The upload error is swallowed by `beforeAll`, so the failure surfaces later as a confusing `expected 400 to be 200` on a public URL fetch for an object that was never written.

Verified directly: an untyped Blob is refused with `mime type application/octet-stream is not supported`; the same bytes tagged `image/jpeg` upload fine; `tutorial-pdfs`, which has no MIME list, still accepts untyped.

**Files:**
- Modify: `packages/api/tests/integration/storage/storage-gate.test.ts:23`

**Interfaces:**
- Consumes: `adminClient()` storage API.
- Produces: nothing other tasks read.

- [ ] **Step 1: Type the photo blob**

Change line 23 from:

```ts
  await admin.storage.from('toy-photos').upload(photoPath, new Blob(['photo gate']), { upsert: true })
```

to:

```ts
  // 053 gave the photo buckets an allowed_mime_types list. An untyped Blob is
  // sent as application/octet-stream and refused, and this upload's error is
  // not checked — so an untyped fixture fails later, as a 400 on the fetch
  // below, for an object that was never written. The pdf and stl buckets above
  // have no MIME list, which is why only this one needs the type.
  await admin.storage
    .from('toy-photos')
    .upload(photoPath, new Blob(['photo gate'], { type: 'image/jpeg' }), { upsert: true })
```

- [ ] **Step 2: Run the file**

Run: `pnpm --filter @splat-connect/api exec vitest run -c vitest.integration.config.ts tests/integration/storage/storage-gate.test.ts`
Expected: all pass, including `toy-photos stays public`.

- [ ] **Step 3: Commit**

```bash
git add packages/api/tests/integration/storage/storage-gate.test.ts
git commit -m "test(api): the storage gate fixture declares its photo's MIME type

053 gave both photo buckets an allowed_mime_types list, and an untyped Blob
reaches storage as application/octet-stream and is refused. beforeAll does not
check the upload's error, so the object silently never existed and the failure
landed three lines later as a 400 from the public fetch.

Only toy-photos needs this; tutorial-pdfs and stl-files carry no MIME list."
```

---

### Task 6: Run the whole integration suite and confirm the expected residue

This is the gate for Tasks 1-5. Exactly one failure should remain, and it must be the local-data one described in Task 7.

**Files:** none

- [ ] **Step 1: Run the full suite**

Run: `pnpm --filter @splat-connect/api test:integration`
Expected: `Tests  1 failed | 322 passed (323)`, the single failure being `tests/integration/orgs/admin-endpoints.test.ts > the admin queue and spot-check > samples tutorials the admin did not approve, and excludes their own`.

If any *other* test fails, stop and diagnose before continuing — do not proceed to Task 7.

---

### Task 7: Record the spot-check defect without papering over it

The remaining failure is not a branch problem. `/api/admin/spot-check` (`packages/api/src/routes/admin.ts:438-448`) does an unordered `.limit(10)` over approved tutorials; the local database holds 1,729 of them, so a tutorial created by the test cannot land in the first ten. It passes on CI's fresh database.

The endpoint's own docstring calls it *"A random sample of tutorials someone other than the admin approved"* and there is no randomisation, so in production it spot-checks the same ten rows forever. That is a real defect and the reason this task writes it down rather than fixing the test.

**Files:**
- Create: `SUPABASE.md`
- Create: `FEATURES.md`

**Interfaces:**
- Consumes: nothing.
- Produces: the two ledgers every later round updates.

- [ ] **Step 1: Create `FEATURES.md`**

```md
# Features

One row per round, in the order we do them. Statuses: `todo` / `in progress` /
`needs db` / `awaiting review` / `done`.

Restyle = the route exists and changes appearance. New build = the route does
not exist yet (verified 2026-09-16). See
`docs/superpowers/specs/2026-09-16-soft-pop-design.md` §6.

| # | Feature | Screens | Kind | Status | Needs DB | Verified by |
|---|---------|---------|------|--------|----------|-------------|
| 0 | Green the branch + ledgers | none | chore | in progress | no | |
| 1 | Design tokens + shared primitives | global (web + mobile theme.ts) | restyle | todo | no | |
| 2 | `/dashboard` hub | /dashboard | restyle | todo | no | |
| 3 | Exchanges list | /dashboard/exchanges | restyle | todo | | |
| 4 | Exchange detail (canonical layout) | /dashboard/exchanges/[id] | restyle | todo | | |
| 5 | Build detail | /dashboard/exchanges/build/[id] | new build | todo | | |
| 6 | Print requests + detail | /dashboard/print-requests, /[id] | new build | todo | | |
| 7 | Printers | /dashboard/printers | new build | todo | | |
| 8 | Cost panel | component | restyle | todo | | |
| 9 | Tutorials + saved | /dashboard/tutorials, /dashboard/saved/* | restyle | todo | no | |
| 10 | Organisation screens | /dashboard/organisation/* | new build | todo | | |
| 11 | Get involved explainers | /get-involved/* | restyle | todo | no | |
| 12 | Org onboarding + admin queue | /dashboard/organisation, /admin | new build | todo | | |
```

- [ ] **Step 2: Create `SUPABASE.md`**

```md
# Database queue

**Nothing is deleted from this file.** Items move from `Pending` to `Applied`
with the migration filename and the date it was applied.

## Pending

_(none yet — F5, F6, F7, F10 and F12 are expected to add entries.)_

## Applied

_(none yet in this project. Migrations 001-054 predate it.)_

## Filed, not blocking

### `/api/admin/spot-check` does not sample
`packages/api/src/routes/admin.ts:438-448` is documented as "A random sample of
tutorials someone other than the admin approved" and performs an unordered
`.limit(10)`. In production it returns the same ten rows every time, so the
control it implements — catching a bad self-approval by sampling — does not
actually sample.

Surfaced 2026-09-16 because `tests/integration/orgs/admin-endpoints.test.ts`
fails against a local database holding 1,729 tutorials: a freshly created
tutorial cannot appear in the first ten. It passes on CI's fresh database, so
this is not a branch regression and the test is deliberately left untouched.

Fix is a query change (randomise or order), not a schema change, so it needs no
migration. Out of scope for Round 0.
```

- [ ] **Step 3: Commit**

```bash
git add FEATURES.md SUPABASE.md
git commit -m "docs: add the FEATURES and SUPABASE ledgers

The two files the brief runs on. FEATURES marks each round restyle or new build,
because seven of the routes it names do not exist yet and a round that builds a
screen from nothing is not the same size as one that restyles it.

SUPABASE opens with one filed item: /api/admin/spot-check is documented as a
random sample and does an unordered limit(10), so it re-checks the same ten rows
forever. It is the last integration failure on this branch, it fails only against
a local database large enough to show it, and it is a query bug rather than a
schema one — recorded here rather than fixed silently or left as noise."
```

---

### Task 8: Close the CI blind spot

`.github/workflows/ci.yml` fires on `pull_request` and pushes to `main`. Work pushed straight to `development` after a PR merges runs nothing — which is how roughly nine commits of photo-array work reached the shared branch unverified, leaving a third of the mobile E2E suite dying in setup with nobody aware.

**Files:**
- Modify: `.github/workflows/ci.yml:8-12`

**Interfaces:**
- Consumes: the existing `changes` job's path filters.
- Produces: CI coverage for direct pushes to `development`.

- [ ] **Step 1: Add `development` to the push trigger**

Change:

```yaml
on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:
```

to:

```yaml
on:
  push:
    # `development` is here because work lands on it directly between PRs, and
    # a push with no open PR used to run nothing at all. Roughly nine commits of
    # the photo-array line reached the shared branch that way in September 2026;
    # by the time anything ran them, 33 of 77 mobile E2E tests were dying in
    # setup. The concurrency group below still cancels superseded runs on it.
    branches: [main, development]
  pull_request:
  workflow_dispatch:
```

- [ ] **Step 2: Verify the concurrency rule still behaves**

Read `.github/workflows/ci.yml:14-18` and confirm `cancel-in-progress` is `${{ github.ref != 'refs/heads/main' }}`. `development` pushes are therefore cancellable, which is what we want — only merges to `main` get a guaranteed complete recorded run. No change needed; this step is a read.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run the suite on pushes to development

The workflow fired on pull_request and pushes to main, so a push to development
with no open PR ran nothing. That is not hypothetical: the photo-array work
landed on development in September 2026 between PRs and no run ever saw it, so a
generated-column write in the mobile e2e fixtures went unnoticed until a third of
that suite was failing in setup.

Superseded runs on development are still cancelled by the existing concurrency
group; only main is exempt."
```

---

### Task 9: Push, and confirm CI is green on the branch

**Files:** none

- [ ] **Step 1: Push**

Push via gh's credential helper — the osxkeychain helper hangs in this sandbox.

```bash
git push origin development
```

- [ ] **Step 2: Watch the run this push triggers**

```bash
gh run list --branch development --limit 3
gh run watch "$(gh run list --branch development --limit 1 --json databaseId --jq '.[0].databaseId')"
```

Expected: the workflow now triggers on the push itself (it would have run nothing before Task 8). Type Check, Unit Tests, Integration, Web E2E and Mobile E2E all green.

`Migration Drift` is expected to fail with `SUPABASE_ACCESS_TOKEN / SUPABASE_PROJECT_REF are not configured` — those secrets have never been set on this repo, and the job fails loudly by design rather than passing silently. Confirm the message is that one. If the secrets get set later, both `check-migration-drift.sh` and `check-schema-guards.sh` already pass locally against the linked project as of 2026-09-16.

- [ ] **Step 3: Mark Round 0 done**

Set row 0's Status to `done` in `FEATURES.md` and fill `Verified by` with the run URL.

```bash
git add FEATURES.md
git commit -m "docs: Round 0 verified green on CI"
git push origin development
```

---

## Round 0 verification block

Hand this back when Tasks 1-9 are complete, per the brief §7:

```md
### F0 Green the branch + ledgers — awaiting review
Changed: 6 integration specs, .github/workflows/ci.yml, FEATURES.md, SUPABASE.md
DB: none

Verify:
1. `pnpm --filter @splat-connect/api test:integration` — 322 passed, 1 failed
   (admin-endpoints spot-check, local-data-only, filed in SUPABASE.md)
2. CI on the development push — every job green except Migration Drift, which
   fails on unset secrets by design
3. FEATURES.md — 13 rows, each marked restyle or new build

Known gaps: /api/admin/spot-check does not randomise (filed, not fixed).
Mobile screen rounds unscheduled. F1 plan written after this round is confirmed.
```
