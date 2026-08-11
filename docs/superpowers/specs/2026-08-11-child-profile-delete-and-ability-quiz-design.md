# Child profile: delete confirmation dialog + web ability quiz

## Problem

1. `DeleteChildButton` (web) uses a two-click arm/3-second-timeout pattern with no
   typed confirmation. A child profile is hand-entered data with no undo — an
   accidental double-click deletes it.
2. `ChildProfileForm` (web) requires MACS level and BFMF score to be entered
   directly. Mobile already has a quick multiple-choice quiz
   (`AbilityScreen`/`estimate-ability.ts`) that estimates both for a parent who
   doesn't know the clinical terms, but this was deliberately not ported to web.

## 1. Delete confirmation dialog

Reuses the native `<dialog>` pattern already established by
`ContributorTermsDialog` (`packages/web/components/contributor-terms-dialog.tsx`):
`showModal()`/`close()` via a ref + effect, and backdrop-click-to-cancel via
`if (e.target === ref.current) onClose()`. No new dialog machinery.

- `DeleteChildButton` gains a `label: string` prop. Its only caller,
  `app/dashboard/child/[id]/page.tsx`, already computes `childLabel(child, index)`
  for the page heading — that same string is passed through, no new computation.
- Clicking "Delete child profile" opens the dialog. This replaces the existing
  2-click arm/timeout flow entirely.
- Dialog body: a warning line, a text input, and Cancel/Delete buttons. Delete is
  `disabled` until the input exactly matches
  `` `confirm_delete_${label.replace(/ /g, '_')}` `` (case-sensitive) — e.g.
  `confirm_delete_Child_1` or `confirm_delete_Mary_Jane`.
- Confirming calls the same `browserApiClient.delete(...)` → redirect →
  `router.refresh()` flow that exists today; busy/error states carry over
  unchanged.
- Cancel, Escape, or a backdrop click close the dialog and reset the typed text
  without calling delete — same as `ContributorTermsDialog`'s `onClose`-only
  contract (closing and confirming are never both triggered by one interaction).

## 2. Shared ability-estimate module

`packages/mobile/lib/estimate-ability.ts` (the `QUESTIONS` array and
`estimateAbility()`) has no React Native dependency, so it moves into
`@splat-connect/types`, which already exports straight from `./src/index.ts`
with no build step:

- New file `packages/types/src/estimate-ability.ts` — `QUESTIONS`,
  `estimateAbility()`, `MacsLevel`, `BfmfLevel`, `AbilityQuestion`, and the
  `ponytail:` placeholder-mapping caveat comment, moved verbatim.
- Re-exported from `packages/types/src/index.ts` via
  `export * from './estimate-ability'`.
- `packages/mobile/components/profile/ability-screen.tsx` (and its test) import
  `QUESTIONS`/`estimateAbility` from `@splat-connect/types` instead of the local
  lib file.
- `packages/mobile/lib/estimate-ability.ts` and its test are deleted — one
  source of truth, so a future change to the question set or mapping applies to
  both platforms automatically.

This does not change the existing "web re-implements mobile UI" convention
(`child-label.ts`, the `ChildProfileForm` docstring) — that convention is about
React Native components being unusable in a browser. `estimate-ability.ts` is
pure logic with no such constraint.

## 3. Web ability quiz

Inside `ChildProfileForm`'s existing "Ability profile" card, directly below the
MACS/BFMF selects:

- A toggle: **"Don't know MACS level? Fill out this quick survey."** Expands
  the 4 shared `QUESTIONS`, each rendered as a row of `.chip` buttons
  (`aria-pressed`, the same pattern already used in `app/upload/page.tsx`)
  instead of mobile's custom `Chip` component.
- An "Estimate" button, disabled until all 4 questions are answered, calls the
  shared `estimateAbility()` and sets `macs_level`/`bfmf_score` to the result
  with `macs_source`/`bfmf_source: 'estimated'` — via the form's existing
  `set()` helper, no new state-management pattern.
- Editing either dropdown manually already resets its `_source` back to
  `'manual'` (existing code) — no new logic needed there.
- Local quiz-answer state (`useState<(number | null)[]>`) lives in
  `ChildProfileForm` itself, same as `AbilityScreen` — only the derived
  MACS/BFMF result is persisted into form state.

## Testing

- `DeleteChildButton`: dialog opens on click; Delete stays disabled until the
  exact phrase is typed (including the unnamed-child fallback label case);
  Cancel/Escape/backdrop-click all close without calling delete; confirmed
  delete still calls `DELETE /api/child-profiles/:id` and redirects.
- `packages/types`: `estimateAbility()` unit tests move with the file (pure
  function, no platform dependency).
- Mobile `ability-screen.test.tsx`: update the import path, otherwise unchanged
  — behavior is identical since the values didn't change.
- `ChildProfileForm`: quiz toggle expands/collapses; Estimate stays disabled
  until 4/4 answered; completing the quiz sets both fields with
  `source: 'estimated'`; changing a dropdown afterward reverts its source to
  `'manual'`.
