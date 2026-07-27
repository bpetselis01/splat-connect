# Contribution Friction Cuts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development`
> (recommended) or `superpowers:executing-plans` to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-07-28-org-delegated-review-design.md` §7

**Goal:** Remove three pieces of friction from the contributor journey: signup copy that
describes an approval queue removed two migrations ago, two hard minimums in the upload
wizard that block legitimate tutorials, and a required `difficulty` field that asks the
maker for a reviewer's judgment before they can click Next once.

**Architecture:** No architecture. Four strings in one page, four conditions in one
validation module, one default value. The only care needed is in the tests, which
currently assert the behaviour being removed.

**Tech Stack:** Next.js 16, React 19, Vitest 2.

**Dependencies:** None. This plan is independent of the org accounts work and can ship
before, after, or alongside it. It touches `lib/validation.ts`, which the org web plan
does not.

## Global Constraints

- Keep the `parts` and `tools` fields and their per-item validation. Only the
  **minimum count** goes; a part with a blank name is still invalid.
- Do not touch email confirmation. It is a genuine hard stop between signup and
  contributing, and spam control on a platform serving disabled children is worth
  one click. Called out explicitly in the spec as not cut.
- **One file per commit**, and the three cuts stay separate — they are independent, and
  one may need reverting without the others. Each message says what that file's change
  does, not "friction cuts".

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/web/app/signup/page.tsx` | **Modify.** Four strings. No logic change. |
| `packages/web/lib/validation.ts` | **Modify.** Drop two minimums and the step-1 difficulty requirement. |
| `packages/web/app/upload/page.tsx` | **Modify.** Default `difficulty` to `'medium'`. |
| `packages/web/tests/unit/lib/validation.test.ts` | **Modify.** Existing tests assert the removed rules. |

---

## Task 1: Fix the stale signup copy

**Files:**
- Modify: `packages/web/app/signup/page.tsx`

The page currently contradicts itself: it is headed "Request contributor access", the
button says "Request access", and the success screen says "Request received" — then
immediately adds "You can log in and start uploading tutorials right away." Migrations
005 and 006 removed the approval gate entirely. Every new contributor is told they are
in a queue that does not exist.

- [ ] **Step 1: Change the four strings**

| Location | From | To |
|---|---|---|
| Success heading | `Request received` | `You're all set` |
| Success body | `Your account has been created. You can log in and start uploading tutorials right away.` | `Check your email to confirm your address, then sign in and start uploading tutorials.` |
| Form heading | `Request contributor access` | `Create your contributor account` |
| Submit button | `Request access` | `Create account` |

Also change the footer link text `Already have access?` to `Already have an account?`,
which is the fifth instance of the same stale framing.

The new success body mentions email confirmation deliberately. The old copy said users
could log in "right away", which is false — confirmation stands between signup and
sign-in, and saying so is the difference between a clear next step and a broken flow.

- [ ] **Step 2: Verify no other page repeats the framing**

```bash
grep -rn "Request access\|Request contributor\|request received\|Already have access" packages/web/app packages/web/components
```

Expected: no matches after the edit. Fix any that remain.

- [ ] **Step 3: Check the E2E suite does not select on the old strings**

```bash
grep -rn "Request access\|Request received" packages/web/tests
```

If a selector matches the old text, update it — a copy change that breaks a test is the
test doing its job.

- [ ] **Step 4: Commit**

```bash
git add packages/web/app/signup/page.tsx
git commit -m "fix(web): remove stale approval-queue copy from signup"
```

---

## Task 2: Drop the parts and tools minimums

**Files:**
- Modify: `packages/web/lib/validation.ts:56-70` and `:84-97`
- Modify: `packages/web/tests/unit/lib/validation.test.ts`

Both are hard walls. A fully-printed toy has STL files and no purchased parts; a simple
modification needs no tools. Neither case can currently get past step 3 or 4.

- [ ] **Step 1: Update the failing tests first**

Find the existing cases in `packages/web/tests/unit/lib/validation.test.ts` that assert
an empty `parts` or `tools` array blocks advancement, and invert them:

```typescript
it('allows advancing past parts with none listed', () => {
  // A fully-printed toy has STL files and no purchased parts.
  expect(canAdvanceFromStep(3, { ...draft, parts: [] })).toBe(true)
})

it('allows advancing past tools with none listed', () => {
  // A simple modification needs no tools.
  expect(canAdvanceFromStep(4, { ...draft, tools: [] })).toBe(true)
})

it('still rejects a part with a blank name', () => {
  expect(canAdvanceFromStep(3, {
    ...draft,
    parts: [{ name: '  ', quantity: 1, is_optional: false, buy_links: [] }],
  })).toBe(false)
})

it('still rejects a part with a zero quantity', () => {
  expect(canAdvanceFromStep(3, {
    ...draft,
    parts: [{ name: 'Velcro strap', quantity: 0, is_optional: false, buy_links: [] }],
  })).toBe(false)
})

it('still rejects a tool with a blank name', () => {
  expect(canAdvanceFromStep(4, {
    ...draft,
    tools: [{ name: '', is_optional: false, buy_links: [] }],
  })).toBe(false)
})
```

The three "still rejects" cases are the point of this task: the minimum goes, the
per-item validation stays. Without them a later refactor could delete both and the
suite would not notice.

- [ ] **Step 2: Run and verify they fail**

```bash
pnpm --filter @splat-connect/web test -- validation
```

Expected: FAIL on the two "allows advancing" cases.

- [ ] **Step 3: Drop the minimums**

In `canAdvanceFromStep`, cases 3 and 4 lose only their length check:

```typescript
    case 3:
      // No minimum: a fully-printed toy has STL files and no purchased parts.
      // Every part that IS listed still has to be valid.
      return draft.parts.every(
        (p) => p.name.trim().length > 0 && Number.isInteger(p.quantity) && p.quantity >= 1
      )
    case 4:
      // No minimum: a simple modification needs no tools.
      return draft.tools.every((t) => t.name.trim().length > 0)
```

`Array.prototype.every` returns `true` for an empty array, so removing the length check
is the entire change.

In `getMissingFields`, delete these two lines:

```typescript
  if (tutorial.parts.length === 0) missing.push('At least one part')
  if (tutorial.tools.length === 0) missing.push('At least one tool')
```

- [ ] **Step 4: Run and verify they pass**

```bash
pnpm --filter @splat-connect/web test -- validation
```

Expected: PASS.

- [ ] **Step 5: Update the module's header comment**

`lib/validation.ts:15-21` documents the step requirements and now describes rules that
no longer exist. Change steps 3 and 4 to "Parts: each listed part needs a name and a
quantity (none required)" and the equivalent for tools.

- [ ] **Step 6: Commit**

```bash
git add packages/web/tests/unit/lib/validation.test.ts
git commit -m "test(web): expect empty parts and tools lists to pass validation

Also pins the per-item rules that stay: a blank name or a zero quantity is
still invalid. Without those cases a later refactor could delete both the
minimum and the per-item check unnoticed."

git add packages/web/lib/validation.ts
git commit -m "fix(web): drop the one-part and one-tool minimums from the upload wizard

Both were hard walls. A fully-printed toy has STL files and no purchased
parts; a simple modification needs no tools."
```

---

## Task 3: Stop requiring difficulty at step 1

**Files:**
- Modify: `packages/web/lib/validation.ts:47-52`
- Modify: `packages/web/app/upload/page.tsx`
- Modify: `packages/web/tests/unit/lib/validation.test.ts`

Difficulty is a reviewer's judgment, not the maker's, yet it blocks the very first
"Next". Default it to `medium` and let review adjust it.

- [ ] **Step 1: Update the tests**

```typescript
it('advances from step 1 on a title alone', () => {
  expect(canAdvanceFromStep(1, { ...draft, title: 'Spoon grip', difficulty: '' })).toBe(true)
})

it('still requires a title', () => {
  expect(canAdvanceFromStep(1, { ...draft, title: '   ', difficulty: 'easy' })).toBe(false)
})
```

- [ ] **Step 2: Run and verify the first fails**

```bash
pnpm --filter @splat-connect/web test -- validation
```

Expected: FAIL on "advances from step 1 on a title alone".

- [ ] **Step 3: Drop the difficulty check from case 1**

```typescript
    case 1:
      // Difficulty is a reviewer's judgment, not the maker's — it defaults to
      // 'medium' and review adjusts it, so it must not block the first Next.
      return draft.title.trim().length > 0
```

Leave `getMissingFields` alone: it validates a saved `TutorialWithDetails`, where
`difficulty` is `not null` in the database, so a missing value there is a real problem
worth reporting.

- [ ] **Step 4: Default the draft's difficulty**

In `packages/web/app/upload/page.tsx`, find the initial `UploadDraft` state and change
`difficulty: ''` to `difficulty: 'medium'`. Keep the picker on step 1 so a contributor
who does have a view can still set it.

- [ ] **Step 5: Run the full web suite**

```bash
pnpm --filter @splat-connect/web test
```

Expected: PASS. If an upload-flow E2E test asserts the Next button is disabled until
difficulty is chosen, update it — that is the behaviour being removed.

- [ ] **Step 6: Commit**

```bash
git add packages/web/tests/unit/lib/validation.test.ts
git commit -m "test(web): expect step 1 to advance on a title alone"

git add packages/web/lib/validation.ts
git commit -m "fix(web): stop requiring difficulty to advance from step 1

Difficulty is a reviewer's judgment, not the maker's, yet it blocked the very
first Next. getMissingFields is left alone — it validates a saved tutorial,
where difficulty is NOT NULL in the database."

git add packages/web/app/upload/page.tsx
git commit -m "fix(web): default a new tutorial draft's difficulty to medium"
```

---

## Task 4: Verification

- [ ] **Step 1: Full web suite and typecheck**

```bash
pnpm --filter @splat-connect/web test && pnpm typecheck
```

Expected: PASS.

- [ ] **Step 2: Walk the wizard manually**

```bash
pnpm dev:web
```

Enter only a title on step 1 and click through to submit with no parts and no tools.
Expected: submission succeeds. This is the case the three cuts exist to unblock, and it
is worth seeing work rather than inferring from green tests.

- [ ] **Step 3: Refresh the graph and commit**

```bash
graphify update .
git add graphify-out && git commit -m "chore(graph): update after validation changes"
```

---

## Not in scope

- **Email confirmation stays.** A genuine hard stop, deliberately kept.
- **Clickable step indicator.** The wizard is strictly linear (`setStep(s + 1)`), so
  correcting step 2 from step 6 costs four Back clicks. Noted in the spec for later; it
  is a real change to the wizard's navigation model rather than a copy or validation
  tweak, and does not belong in a ~10-line plan.

## Done when

- A contributor can complete the wizard with a title, files, and nothing else.
- No page tells a new signup they are waiting for approval.
- The per-item validation for parts and tools still rejects blank names and zero
  quantities.
