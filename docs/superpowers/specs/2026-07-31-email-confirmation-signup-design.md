# Email Confirmation at Signup, and a Real Terms Dialog

**Date:** 2026-07-31
**Status:** Approved design, ready for implementation planning
**Scope:** `packages/web` only. No API or schema change. `supabase/config.toml`
changes, which also affects `packages/mobile`'s local dev — noted, not designed
here.

**Builds on:** `2026-07-30-contributor-terms-signup-design.md`. That design's
decision 3 named the exact contradiction this resolves: `profile-screen.tsx`'s
`check-email` mode "assumes a confirmation step that `config.toml` says does
not occur," and its Out of Scope section lists "Mobile's vestigial
`check-email` mode... resolving it is not required here." This design turns
that assumption into the real, permanent behaviour, and gives web the flow
mobile already anticipated (`87bcdb3`, `161614c`, `11d1bb1` — "accept
contributor terms during signup," "gate the profile tab on contributor
terms," "stop the contributor-terms gate flashing, add terms link and
sign-out escape hatch").

## Goal

Five problems, one connected fix:

1. Signup gives no indication a confirmation step exists, then fails to reach
   the dashboard for a reason the user is never told.
2. Reading the contributor terms during signup navigates away from the form
   and discards everything typed so far.
3. Signup has no password-confirmation field.
4. An account that already accepted the terms at signup is asked again on
   first visit to `/dashboard`.
5. `/onboarding/contributor-terms` looks unfinished and its copy is wrong for
   the account landing on it.

(4) turns out not to be a bug to suppress — it's a symptom of (1) not being
built yet. Once email confirmation is real, terms acceptance can no longer
happen *at* signup (no session exists until the email is confirmed), so it
moves to first sign-in, using the same gate that already exists for
pre-terms legacy accounts. (2), (3), and (5) are then fixed on top of that.

## What is wrong today

**`supabase/config.toml:232`, under `[auth.email]`, sets
`enable_confirmations = false`.** (The setting at line 267 is a different
key, under `[auth.sms]`, for phone OTP — unrelated; not touched by this
design.) `app/signup/page.tsx:46-53` is written around that: `signUp()`
returns a live session immediately, so the page posts to `/api/agreements`
right after and shows "You're all set" with a working `/dashboard` link.

Despite that, the user is hitting confirmation-required behaviour. Rather
than chase a local config-drift theory, the decision (confirmed with the
user) is to make email confirmation a real, permanent, intentional feature —
including locally — not to diagnose it away.

**The terms link navigates away from the signup form.**
`app/signup/page.tsx` renders "I have read and accept the [contributor
terms](/legal/contributor-terms)" as a plain `Link`. Clicking it is a full
route change; the signup form unmounts, and every field typed so far is
gone on return.

**No confirm-password field.** `app/signup/page.tsx` collects `password`
only. Mobile's `components/profile-screen.tsx` already has this
(`confirmPassword` state, "Passwords do not match" on submit) — this design
gives web the same field, same validation shape.

**Issue 4's actual cause:** `app/signup/page.tsx`'s post-signup
`POST /api/agreements` call is explicitly non-fatal (`terms-gate.tsx`'s own
documented rule: never report an acceptance the server didn't record). If
that call fails — or, after this design ships, *always*, since no session
exists to make it with — the checkbox ticked during signup was never
persisted. Middleware's terms check (`middleware.ts`, unchanged by this
design) correctly finds no row and redirects to
`/onboarding/contributor-terms`. The user isn't wrong that they "already
accepted" — they did, but nothing durable happened yet.

**`/onboarding/contributor-terms` today:** plain heading, one paragraph,
`<TermsGate>` (terms as an outbound link, not inline), no way to leave except
accepting. Its copy — "Your account was created before we asked contributors
to accept terms" — is specifically about legacy accounts and becomes false
the moment new signups start landing here routinely.

## Decisions

**1. `enable_confirmations = true` at `supabase/config.toml:232` only.**
Requires a local Supabase restart (`supabase stop && supabase start`) to take
effect — not code, a manual step for whoever implements this. This is the
*shared* local instance, so `packages/mobile`'s local dev picks it up too;
mobile's code already assumes it can be on (see Goal), so this should be a
non-event there, but its own e2e suite may currently assume instant sessions
the way web's does — not verified, out of scope, flagged for whoever touches
mobile next.

**2. `signUp()`'s post-call acceptance POST stays, unchanged in shape.**
`app/signup/page.tsx` keeps attempting `POST /api/agreements` right after
`signUp()`, matching mobile's `auth-context.tsx:signUp()`. With confirmations
on, this will no-op every time (no session exists yet) — kept anyway, for
symmetry with mobile and so the call is meaningful again if confirmations
are ever selectively disabled for some environment. The real recording moves
to decision 6.

**3. The signup confirmation screen changes from "You're all set" to "Check
your email."** No dashboard link (there's no session to use it with). Copy
matches mobile's `check-email` mode: *"We've sent a confirmation link to
{email}. Confirm your email, then sign in."*

**4. The terms checkbox becomes a button that opens a `<dialog>`, not a
link.** `app/signup/page.tsx`'s terms row changes from checkbox+link to a
single row: an unfilled tick + "Read and accept the contributor terms" as a
`<button type="button">`. Clicking it calls `showModal()` on a native
`<dialog>` rendered in the same tree — same pattern already shipped for the
mobile nav drawer's `<dialog>` (`packages/web/components/shell-frame.tsx`),
so focus trap, Escape-to-close, and backdrop dismissal come from the
platform, not new code.

Inside the dialog: the terms content (decision 8), a checkbox ("I have read
and accept…"), and Reject / Accept buttons. Accept is disabled until the
checkbox is ticked.

**Exact dismissal behaviour, confirmed with the user:** Reject, Escape, and
clicking the backdrop all close the dialog **without** recording acceptance
— the row stays unfilled. **Only** ticking the checkbox and clicking Accept
closes the dialog, fills the row's tick, changes its label to "Contributor
terms accepted" (still clickable, to reopen and review), and is the sole
thing that enables the Create account button.

Because this is a dialog over the same page rather than a navigation, every
field already typed is simply still there when it closes. This is what
actually fixes the "input disappears" complaint — not a save/restore
mechanism, just never unmounting the form.

**5. New component: `ContributorTermsDialog`.**

```ts
// components/contributor-terms-dialog.tsx
function ContributorTermsDialog({
  open,
  onClose,      // Reject, Escape, or backdrop click — never on accept
  onAccepted,   // only on tick + Accept
}: {
  open: boolean
  onClose: () => void
  onAccepted: () => void
})
```

Owns a `<dialog>` ref; a `useEffect` calls `showModal()`/`close()` off
`open`. A click handler on the `<dialog>` element itself (not its content
wrapper) distinguishes backdrop clicks from inside clicks — the standard
native-`<dialog>` trick, since a click on the backdrop's own hit-testing
lands on the `<dialog>` element, while a click inside content stops there.
The native `cancel` event (fired by Escape) also calls `onClose`. Renders a
`TermsGate` (decision 7) inside.

**6. Acceptance recording moves to first sign-in — reusing the existing
gate, not inventing a new mechanism.** This mirrors mobile's shipped
pattern exactly: try at signup (decision 2, now a guaranteed no-op),
unconditionally show "check your email" (decision 3), and let
`/onboarding/contributor-terms` catch anyone left unrecorded on their next
authenticated visit. `middleware.ts`'s existing `termsGatedPrefixes` check
needs no change — it already does this for legacy accounts.

**7. `TermsGate` (`components/terms-gate.tsx`) gains two additive props,
existing call sites unaffected:**

```ts
function TermsGate({
  type,
  onAccepted,
  requireCheckbox = false,
  mode = 'record',   // new. 'record' (default): unchanged, calls POST
                      // /api/agreements as today. 'local': accept() calls
                      // onAccepted() directly, no network call — used only
                      // by the signup dialog, where no session exists yet.
  content,           // new, optional ReactNode. Rendered in a scrollable
                      // box in place of today's "Please read the X" link
                      // line. Passed by the signup dialog and the
                      // onboarding page (decision 9); the org-leader gate
                      // (unaffected by this design) passes neither prop
                      // and keeps its current link-only appearance.
}: {
  type: AgreementType
  onAccepted: () => void
  requireCheckbox?: boolean
  mode?: 'record' | 'local'
  content?: React.ReactNode
})
```

**8. New component: `ContributorTermsContent`.** The (currently placeholder)
terms text is extracted into one module, imported by both
`app/legal/contributor-terms/page.tsx` (the standalone page — unchanged
otherwise, still the canonical full-page read) and passed as `TermsGate`'s
new `content` prop from the signup dialog and the onboarding page. One copy
of the text, three places it can appear, no drift between them. Still
governed by `2026-07-30-contributor-terms-signup-design.md` decision 8 — no
placeholder legal language is generated, and acceptances continue to record
against `AGREEMENT_VERSIONS.contributor_terms = 'v0-todo'`, void pending
real terms.

**9. `/onboarding/contributor-terms` redesign.** Same card language as
`components/coming-soon.tsx` (icon badge in `brand-tint`/`brand-deep`,
`card`, `text-ink`/`text-muted` tokens) — the newest, most current
"single-purpose informational page" pattern already shipped in this
codebase, rather than inventing a new visual treatment.

Copy changes from the legacy-specific "Your account was created before we
asked contributors to accept terms" to age-agnostic wording: *"One thing
before you continue"* / *"Please review and accept the contributor terms to
carry on."* True for a brand-new signup confirming for the first time and
for a genuinely old pre-terms account alike.

`<TermsGate type="contributor_terms" requireCheckbox content={<ContributorTermsContent />} onAccepted={() => router.replace(next)} />`
— `mode` stays the default `'record'` here; a real session exists on this
page, so acceptance is actually persisted, same as today.

New: a "Sign out" link beneath the accept button, mirroring the escape
hatch mobile shipped in `11d1bb1`. Today's page has no way to leave except
accepting — a real gap for anyone who lands here and doesn't want to accept
right now.

**10. `/auth/confirmed` copy and behaviour change.** This page is shared
infrastructure — both web signups and mobile signups
(`packages/mobile/lib/auth-context.tsx`'s `emailRedirectTo`) land here after
clicking the email link, since deep-linking straight back into a mobile app
from an email client isn't reliable.

Heading stays "Email confirmed." Body copy changes to *"Your email has been
confirmed. Sign in to your account to continue."* Auto-redirects to `/login`
after 3 seconds, with visible countdown text ("Redirecting you to sign in
in 3…2…1…") rather than a silent jump, plus a manual "Sign in now" link
underneath for anyone who doesn't want to wait — covers both the
accessibility concern (a timed redirect with no user-triggered alternative
is a WCAG 2.2.1 problem) and mobile users who'd rather just close the tab.

**11. Confirm-password field.** `app/signup/page.tsx` gains a
`confirmPassword` field, placed directly after Password. Validated on
submit, not live-as-you-type — "Passwords do not match" shown the same way
the existing duplicate-email error is shown (`role="alert"`), matching
mobile's existing validation shape and placement exactly.

## Error handling

- `signUp()` errors (including the existing duplicate-email case): unchanged.
- The post-signup acceptance POST (decision 2): already non-fatal, unchanged
  — now a guaranteed no-op under `enable_confirmations = true`, which is
  expected, not a regression to fix.
- The onboarding page's Accept button (`mode: 'record'`): unchanged —
  `TermsGate`'s existing "Could not record your acceptance. Please try
  again" failure path still applies; a real session exists here so a failure
  is a genuine API/network problem, not a design gap.
- The signup dialog's Accept (`mode: 'local'`): cannot fail — no network
  call.
- Confirm-password mismatch: client-side only, blocks submit.
- `/auth/confirmed` redirect: the manual "Sign in now" link is the fallback
  if the timer somehow doesn't fire.

## Testing

- **E2E, web:** signup shows "Check your email," not "You're all set," and
  makes no attempt to reach `/dashboard`.
- **E2E, web:** the terms dialog — opening it, ticking + accepting enables
  Create account and preserves already-typed fields; rejecting, pressing
  Escape, and clicking the backdrop all leave Create account disabled and
  preserve fields identically.
- **E2E, web:** a password/confirm-password mismatch blocks submission with
  a visible error.
- **E2E, web:** `tests/e2e/auth/signup.spec.ts` needs rewriting — its
  current assertions (immediate "You're all set," immediate `/upload`
  access) describe behaviour this design removes. Anything needing an
  authenticated post-signup user should use the existing service-role test
  helper (`createTestUser`, which already bypasses public `signUp()` via
  `admin.createUser({ email_confirm: true })`), not attempt to click a real
  confirmation email in Playwright.
- **E2E, web:** `/onboarding/contributor-terms` — reachable and functional
  independent of *why* the account lacks a terms row (legacy account vs.
  freshly confirmed signup); the "Sign out" escape hatch actually signs out.
- **Unit, web:** `TermsGate`'s new `mode` and `content` props — `'local'`
  mode calls `onAccepted` without a network call; `'record'` mode is
  unchanged from today's behaviour; `content` renders when passed and the
  plain link renders when it isn't (org-leader call site).
- **Unit, web:** `ContributorTermsDialog` — backdrop click, Escape, and
  Reject all call `onClose` and never `onAccepted`; ticking + Accept calls
  only `onAccepted`.
- Existing suites needing updates as a consequence, not enumerated further
  here (implementation-plan detail): `tests/unit/pages/signup.test.tsx`,
  `tests/unit/app/signup-page.test.tsx`,
  `tests/unit/app/onboarding-contributor-terms.test.tsx`,
  `tests/unit/components/terms-gate.test.tsx`.
- **Unaffected, verified:** API integration tests
  (`packages/api/tests/helpers/auth.ts`'s `createTestUser`) create users via
  the service-role admin client with `email_confirm: true`, bypassing public
  `signUp()` entirely — this design does not touch them.

## Out of scope

- **`packages/mobile` code changes.** Mobile's `check-email` mode, confirm-
  password field, and terms-acceptance-at-signup pattern already exist and
  already anticipate this exact config; nothing here requires touching
  mobile. Its e2e suite's assumptions under a now-real
  `enable_confirmations = true`, mentioned in decision 1, are unverified and
  left for whoever next works in that package.
- **Real contributor-terms legal text.** Unchanged from
  `2026-07-30-contributor-terms-signup-design.md` decision 8 — still
  `v0-todo`, still void pending a lawyer.
- **Detecting whether `/auth/confirmed` was reached from web or mobile.**
  Considered (a query param on `emailRedirectTo`, or user-agent sniffing)
  and rejected — decision 10's one-page-two-actions approach (redirect +
  manual link) serves both audiences without needing to tell them apart.
- **`hasAcceptedContributorTerms` swallowing its query error**
  (`tutorials.ts:100-107`), already flagged out of scope in the prior spec.
  Still someone else's fix.
