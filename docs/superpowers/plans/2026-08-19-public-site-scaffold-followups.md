# Public Site Scaffold — Follow-ups

Recorded at the end of the implementation run for
`docs/superpowers/specs/2026-08-19-public-site-scaffold-design.md`.

Everything Critical and Important from the per-task reviews and the final
whole-branch review was fixed before merge. This is what was deliberately
deferred, plus the decisions that need a human.

## Blocking before launch

**The organisation's real details are not filled in.** `packages/web/lib/org-facts.ts`
and `TEAM_MEMBERS` in `packages/web/app/about/team/page.tsx` hold `TODO:`
sentinels. `/about` and `/contact` render them. Nothing was invented, because a
fabricated About page is worse than a visibly empty one.

Needed:

- `legalName` — the organisation's registered name
- `basedIn` — city, state
- `founded` — the year it started operating
- `contactEmail` — a real address
- at least one team member: full name, role, one-to-two sentence bio

Two guard tests in `packages/web/tests/unit/app/about.test.tsx` are `it.todo`
pending these. Flipping each back to `it()` re-arms them — they are marked with
`TODO.re-arm` comments.

The final reviewer suggested going further: a production-build guard in
`org-facts.ts` that throws when `legalName` still starts with `TODO`, so the
gap bites at build time rather than only in a test report. Worth doing.

## Decisions for the project owner

**The `/library` page heading.** Its nav label is now "Guides" but its own `h1`
still reads "Toy Adaptation Library" (`packages/web/app/library/library-client.tsx`).
The spec scoped the rename to the nav label deliberately, so this was left
alone — but clicking "Guides" and landing on a differently-named page is a
real inconsistency. Changing it touches two E2E specs.

**Signed-in users cannot reach the new public pages.** `AppShell` wins on every
route for a signed-in user, so they never see the top bar, section subnav or
footer, and `packages/web/lib/nav-model.ts` gives the rail no entry to `/learn`,
`/get-involved`, `/about`, `/contact` or the trust pages. The sharp edge: the
contributor track and the six Learn articles are written *for* contributors,
who are signed in by definition. Closing this means a rail redesign, which the
spec put out of scope. The spec has been corrected — it previously claimed the
opposite.

**Rate limiting on `POST /api/public/notify`.** The platform's first
unauthenticated write. A 254-character email cap now exists in both the handler
and migration `036`, but there is no request-rate limit and no read path on
`notify_signups`, so abuse would go unnoticed until someone opens the console.

## Imagery under-delivered against the spec

The spec's slot inventory asks for roughly 17 image slots; 8 shipped. Missing:
Learn hub article cards (×6), homepage audience doors (×3), and header banners
on four of the six Learn articles. The Learn hub — the page the spec singled
out as needing to tell a story — is currently a plain text card grid.

This is a plan defect rather than an implementation one: the plan prescribed
what shipped, and no single task's brief owned the spec's table. Closing it
needs an illustration affordance on `HubGrid`/`NavItem`, not just page edits.

Related: `packages/web/public/illustrations/bear-on-shelf.svg` is unused — its
only slot (Impact story cards) is scaffolded, and scaffolds get no artwork.

**The homepage's second catalogue preview is also missing.** The spec asks for
recent guides *and* recent toys side by side; the second column shows "Learn the
basics" instead, and `/api/public/toys` is never called from the homepage.

## Accessibility polish

- `aria-current="page"` is applied to two elements at once on `/organizations` —
  the top bar's Impact link and the subnav's Organisations link
  (`packages/web/components/nav.tsx:65`). Use `aria-current="true"` for the
  section and reserve `"page"` for the subnav.
- The footer emits six `<h2>`s on every page and is not wrapped in a labelled
  landmark. `<nav aria-label="Site map">` would make "one click from anywhere"
  true for a screen-reader user, not only a mouse user.
- `ComingSoon`'s exit CTA is a bare "Guides", which reads poorly in a links list
  and collides with the top bar. "Browse the Guides" would match the homepage hero.

## Code and test polish

- `SCAFFOLD_KEYS` uses a `c.featureKey!` non-null assertion; a type-narrowing
  filter would make the invariant compiler-enforced.
- `nav.tsx` role links use a bare `pathname.startsWith(l.href)` with no
  trailing-slash guard. Harmless today; would misfire on an `/admin*` sibling.
- `isBare` sits in `app/layout.tsx`, so reaching it in a test needs two
  framework mocks. Extract when a third predicate or a second such test appears.
- `RATIO_CLASS` in `editorial-image.tsx` mixes `aspect-square` with
  `aspect-[3/2]`; `rounded-[14px]` appears where `rounded-field` exists.
- The SOON pill's class string is written three times (`section-nav.tsx`,
  `public-footer.tsx`, `hub-grid.tsx`). A `.badge-soon` in `globals.css` would
  hold it once.
- `/library`, `/toy-library` and `/impact` export no `metadata`, so all three
  inherit the root title.
- `app/get-involved/contributors/page.tsx` says "Browse the directory to find
  one" without linking `/organizations`.
- Migration `035`'s `grant insert` is redundant — `004_data_api_grants.sql`
  already grants on new tables and RLS is what blocks reads. Harmless, but the
  neighbouring comment implies it is narrowing something.
- `packages/web/tests/unit/app/impact-hub.test.tsx` cannot fail on a change to
  `app/impact/page.tsx` — it duplicates `hub-grid.test.tsx`. Deleting it is more
  honest than keeping it.
- Copy-count assertions in `learn-articles.test.tsx` are change detectors: they
  fail for any copy edit including improvements. Defensible for the
  legally-reviewed trust pages, less so for the articles.
- No unit coverage of the homepage's `TRACKS`/`liveArticles` filters or its
  zero-state; `home.spec.ts` scopes the launcher via `.locator('..')`.
- No regression test for a subnav child whose path is a prefix of a deeper path.
- Integration `afterAll` cleanup does not fire on a hard crash — pre-existing
  across every suite in `tests/integration/public/`.
- Straight vs curly apostrophe inconsistency in the ask-an-expert copy,
  inherited from the plan.
