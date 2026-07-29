# Auth Entry Flow

**Date:** 2026-07-29
**Status:** Approved design, ready for implementation planning
**Sub-project 2 of 3.** Depends on `2026-07-29-shared-account-foundation-design.md`,
which must ship first. Sub-project 3 is `2026-07-29-unified-dashboard-design.md`.

## Goal

Everyone signs in the same way, through a door that says what it is, and lands
somewhere that works for them.

## What is wrong today

**The "Contribute" button is the only account entry point and it lies twice.**
`nav.tsx:113-121` shows a `Contribute` button to logged-out visitors, linking to
`/signup`. It is wrong about the destination — a returning contributor wanting to
sign in has no obvious control — and after sub-project 1 it is wrong about the
audience, because the account behind it now serves parents and leaders too.

**`/signup` describes an approval flow that was removed on Jul 23.** The page
heading is *"Request contributor access"* (`signup/page.tsx:58`), the button says
*"Request access"* (line 110), and the success heading says *"Request received"*
(line 42) — directly above copy reading *"Your account has been created. You can
log in and start uploading tutorials right away."* The account is created
instantly. `2026-07-23-remove-account-approval-design.md` removed the gate and
left the words.

**The cross-link already exists and is worded backwards.** `login/page.tsx:110-115`
reads *"Want to contribute? Request access"* — framing signup as a petition, and
framing the general-purpose account as contributor-only.

**Login routes a parent nowhere.** `login/page.tsx:59-64` branches
contributor → `/dashboard`, admin → `/admin`, everything else → `/`. A parent gets
the third branch. `dashboard/page.tsx:54` would bounce them anyway:
`if (profile!.role !== 'contributor') redirect('/')`.

## Decisions

**1. Signup asks nothing about role.** Name, email, password. No parent-or-contributor
choice — it cannot be answered accurately at signup, since a parent who later
uploads a tutorial was never *not* a contributor. `role` keeps being written by the
existing trigger as provenance (decision 1 of sub-project 1). The signup form
passes `{ name }` exactly as it does now; no code change to the `signUp` call.

**2. Sign-in is the door; signup is reached from it.** The logged-out nav control
becomes **"Sign in"** → `/login`, and `/login` carries the link onward to `/signup`.
This is the flow originally asked for, and it is the conventional order: most
people arriving at an account control already have an account.

**3. One post-login destination.** Everyone lands on `/dashboard`; admins land on
`/admin`. The three-way branch collapses to two, and the `else → '/'` that stranded
parents is deleted.

**4. "Contribute" is retired as a label.** With one account type behind it, a
button naming one of three audiences is wrong for the other two. Nothing on the
logged-out site will say "you could contribute" once this ships — that belongs on
the home page as a section if it is wanted, not smuggled into a nav button. Not
built here.

**5. Copy drops the petition framing throughout.** "Request contributor access" →
"Create your account". "Request access" → "Create account". "Request received" →
"You're all set". "Want to contribute? Request access" → "New here? Create an
account".

## Architecture

No new routes, no new components, no API change. `/login` and `/signup` keep their
paths and their forms; what changes is where they point and what they say.

### Changes

| File | Line | Change |
|---|---|---|
| `packages/web/components/nav.tsx` | 113-121 | logged-out button: `Contribute` → `Sign in`, `/signup` → `/login` |
| `packages/web/components/nav.tsx` | 67-69 | gate Dashboard / Upload / My Tutorials on `role !== null`, not `role === 'contributor'` |
| `packages/web/app/signup/page.tsx` | 42, 58, 110 | headings and button copy |
| `packages/web/app/login/page.tsx` | 59-64 | collapse routing to admin → `/admin`, everyone else → `/dashboard` |
| `packages/web/app/login/page.tsx` | 110-115 | reword the cross-link |
| `packages/web/app/dashboard/page.tsx` | 54 | delete `if (profile!.role !== 'contributor') redirect('/')` |
| `packages/web/app/page.tsx` | 1-22 | the header comment documents the old signup flow |

### Two changes that look out of place and are not

**`nav.tsx:67-69`** gates the contributor links on `role === 'contributor'`. After
sub-project 1 widens `lib/auth.ts` to return `'parent'`, those links would be
hidden from parents — who can now author. Widening the gate to "any signed-in
user" keeps the nav coherent in the window between this sub-project and the next.
Sub-project 3 supersedes this by moving those links into dashboard tabs.

**`dashboard/page.tsx:54`** redirects any non-contributor away from `/dashboard`.
Decision 3 sends everyone there, so this line would bounce every parent straight
back out. It has to go in the same change that starts routing them there.

## Error handling

Unchanged. The existing failure paths on both forms (`login/page.tsx` error state,
`signup/page.tsx:105` alert) keep their behaviour; only their wording is touched
where it repeats the "request" framing.

The full-reload navigation at `login/page.tsx:60-64` is preserved. Its comment
records why: `router.refresh()` + `router.push()` left the nav showing the
logged-out state, so `window.location.href` forces the server to re-render the
layout with the auth cookie. Collapsing the branches must not quietly turn that
back into a client navigation.

## Testing

**E2E (`packages/web/tests/e2e/`):**
- A logged-out visitor sees "Sign in" in the nav, and it lands on `/login`.
- From `/login`, the cross-link reaches `/signup`.
- A newly registered account lands on `/dashboard` and sees the dashboard, not a
  redirect to `/`.
- A parent account (created with `role: 'parent'`) signs in and lands on
  `/dashboard` — the case that is broken today, and the reason this sub-project
  cannot ship before sub-project 1.
- An admin still lands on `/admin`.

**Unit:**
- `nav.tsx` renders "Sign in" when logged out and the contributor links for any
  signed-in role.
- No surface renders the strings "Request access", "Request received", or
  "Request contributor access". Worth asserting directly: this copy already
  survived one cleanup it should not have.

## Out of scope

- A "become a contributor" pitch on the logged-out home page (decision 4).
- Password reset, email verification, OAuth — none exist today and none are added.
- Changing what `/signup` submits. The role written at signup is provenance and
  stays as it is.
- The dashboard's contents. Everyone lands there; making it useful for all three
  audiences is sub-project 3.
