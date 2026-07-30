# Contributor Terms at Signup

**Date:** 2026-07-30
**Status:** Approved design, ready for implementation planning
**Scope:** `packages/web` and `packages/mobile`. No API or schema change.

## Goal

Every account accepts the contributor terms once, at signup. Accounts created
before this shipped are asked once, on a screen they cannot navigate past.

## What is wrong today

**Editing an approved tutorial fails with a 403 the UI cannot resolve.**
`app/tutorials/[id]/edit/page.tsx:75-77` sets `status: 'pending'` whenever the
tutorial being edited is `approved` or `rejected` — editing published work
re-submits it for review, which is intended. `packages/api/src/routes/tutorials.ts:132`
refuses `status: 'pending'` from any user without an accepted `contributor_terms`
row. A contributor whose tutorial predates the terms gate therefore cannot edit
their own published work, and the edit page offers no way to accept.

The API is correct. `tutorials.ts:128-131` anticipates exactly this case:

> gating creation alone would let drafts that predate the terms sail through while
> blocking their authors from touching them.

The gap is that only one surface ever acted on it.

**The upload wizard handles this; nothing else does.** `app/upload/page.tsx:82-87`
fetches `/api/agreements/me` on mount and renders `<TermsGate>` at line 657 when
`contributor_terms` is absent, with the comment *"rather than let six steps of work
end in a bare 403."* `app/tutorials/[id]/edit/page.tsx` has no equivalent check, and
`saveDetails` does not catch the failure — so the Server Action throws and Next
renders an unhandled 500.

**Mobile has no agreement handling at all.** `components/profile-screen.tsx` is the
only mobile signup entry point (`mode: 'signin' | 'signup' | 'check-email'`, line 19);
`lib/auth-context.tsx:54` exposes the `signUp` it calls. Neither reads or writes
`user_agreements`.

**The test suite cannot see the bug.** `tests/e2e/contributor/edit-tutorial.spec.ts`
has 10 tests and 11 `acceptTerms()` calls — every test seeds acceptance in setup.
Line 25 is a test named *"editing an approved tutorial resets its status to pending"*,
the precise broken flow, passing only because line 28 seeds the row the real user
lacks.

## Decisions

**1. Acceptance is captured at signup, on both clients.** A required checkbox
labelled with a link to `/legal/contributor-terms`. Submit stays disabled until it
is ticked. Web: `app/signup/page.tsx`. Mobile: `components/profile-screen.tsx`,
signup mode only.

**2. Web records acceptance immediately after `signUp()`.** `supabase/config.toml:232`
sets `enable_confirmations = false`, so `signUp()` returns a live session — the
behaviour `app/signup/page.tsx:46-53` already documents and relies on. POST
`/api/agreements { agreement_type: 'contributor_terms' }` with that session.

**3. Mobile records acceptance only if a live session exists.** `profile-screen.tsx:49`
switches to `check-email` after signup, assuming a confirmation step that
`config.toml` says does not occur. Rather than resolve that contradiction — the
hosted project may differ from local config, and `check-email` is out of scope —
mobile attempts the POST when a session is present and skips it otherwise. A skipped
acceptance is not lost: decision 5 asks again at first sign-in.

This deliberately never writes an acceptance that cannot be attributed to a session,
and never silently discards one.

**4. A failed acceptance POST does not fail signup.** The account exists and the user
is signed in. `terms-gate.tsx:8-12` sets the precedent — it does not call `onAccepted`
on failure, because *"telling the UI an acceptance was recorded when the server never
recorded one leaves the user facing a 403 they cannot explain."* Same rule: report
nothing false, let the gate in decision 5 catch it.

**5. Existing accounts are caught by a blocking screen.** New route
`app/onboarding/contributor-terms/page.tsx`: the terms, a checkbox, an accept button.
On success it POSTs to `/api/agreements` and returns the user to `?next=`.

`middleware.ts` gains a check after the existing admin block, on these prefixes only:

| Blocked | Open |
|---|---|
| `/dashboard` `/upload` `/my-tutorials` `/organizations` `/tutorials/*/edit` | `/` `/library` `/tutorials/[id]` `/legal/*` `/login` `/signup` `/onboarding/*` |

**`/tutorials` is matched by pattern, not prefix.** `app/tutorials/[id]/page.tsx` is
the public tutorial detail view and middleware leaves it open today
(`middleware.ts:64` lists only `/upload`, `/my-tutorials`, `/dashboard`,
`/organizations`). Blocking the `/tutorials` prefix would take public browsing with
it — every library result links into it. Only `/tutorials/*/edit` is gated.

Public browsing keeps its current cost — the extra `user_agreements` query runs only
on blocked paths. This mirrors the existing per-route `profiles` query at
`middleware.ts:76-86` rather than introducing a new pattern.

**`/admin` is not gated.** Contributor terms govern submitting work, not reviewing
it; blocking review would stall the queue over an unrelated agreement. Admins are
gated on the contributor surfaces above like anyone else, since `role` defaults to
`contributor` for every account (`001_schema.sql:9`) and an admin may also author.

**6. Mobile blocks in the nav guard, off the existing fetch.**
`lib/auth-context.tsx:36-47` already refetches the profile when session identity
changes. Agreements are fetched in that same effect and exposed as
`hasContributorTerms`. `app/_layout.tsx` renders the blocking screen in place of the
tab navigator when a session exists and the flag is false.

One effect, not two: independent fetches would produce two loading states that can
disagree, and the guard would flicker.

**7. The API gate is untouched.** `tutorials.ts:132` and the RLS policies stay exactly
as they are. This work adds affordances to satisfy the gate, never to bypass it —
the division `terms-gate.tsx:8` already states: *"The gate is a UX affordance only."*

**8. No placeholder legal text is written.** `app/legal/contributor-terms/page.tsx`
already renders a non-binding notice, and its header comment instructs:
*"No placeholder legal language is to be generated here."* Acceptances against
`AGREEMENT_VERSIONS.contributor_terms = 'v0-todo'` are already marked void pending
real terms. The mobile screen shows the same warning. This design records consent
against `v0-todo` knowing those records will be discarded — the mechanism is what is
being built, not the agreement.

## Testing

**The fixture blindness is part of the fix.** At least one test in
`edit-tutorial.spec.ts` must run *without* `acceptTerms()` and assert the gate,
otherwise the next regression hides the same way.

- **E2E, web:** a signed-in account with no terms row is redirected from `/dashboard`
  to the interstitial; accepting returns it to `/dashboard`; editing an approved
  tutorial then succeeds — the flow that fails today, end to end.
- **E2E, web:** signup with the box ticked writes the row and never shows the
  interstitial.
- **E2E, web:** the open paths in decision 5 stay reachable without a terms row —
  specifically `/library` and a public `/tutorials/[id]` detail page, guarding against
  the prefix-match mistake decision 5 calls out.
- **Unit, web + mobile:** submit disabled until the box is ticked; a failed
  acceptance POST still leaves a usable signed-in account.
- **Unit, mobile:** the guard renders the blocking screen when `hasContributorTerms`
  is false and the tabs when true.

## Out of scope

**`hasAcceptedContributorTerms` swallows its error.** `tutorials.ts:100-107` does
`const { data } = await ...`, discarding `error`. A query failure and a genuine
non-acceptance both return `false`, so an RLS or connectivity fault would present as
"You must accept the contributor terms" — a message that would send an operator
looking in the wrong place. Verified not to be the cause of the current bug (the row
is genuinely absent, confirmed with a service-role read that bypasses RLS). Needs its
own fix.

**Discarding `v0-todo` acceptances when real terms land.** A migration for whenever
the terms are written.

**Mobile's vestigial `check-email` mode.** `profile-screen.tsx:49` contradicts
`config.toml:232`. Decision 3 is correct under either, so resolving it is not required
here.
