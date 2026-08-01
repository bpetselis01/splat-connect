# Remove the `parent` account role

## Context

`profiles.role` currently allows three values: `admin`, `contributor`, `parent`.
Web already treats `contributor` and `parent` identically everywhere it
matters — `capabilities.ts` has no `isParent` ("nothing ever branched on
it"), `nav.tsx` gates only on `role !== null`, and
`supabase/migrations/009_shared_account_capability.sql` widened
`is_approved_contributor()` to any signed-in account specifically because "a
parent and a contributor are the same kind of account now." Mobile is the one
place real behavior still branches on the value: every mobile signup hardcodes
`role: 'parent'`, and the Profile tab renders an entirely different screen
(`ChildProfileHome` vs `ProfileScreen`) depending on it.

This removes `parent` as a distinct role across the DB, types, web, and
mobile, collapsing the account model to `admin` / `contributor` — finishing
what migration 009 already established in practice.

**Out of scope:** adding mobile-side contribution/authoring (upload, org
membership, capability gating like web's `AppShell`). That's a separate,
much larger future project. This design exists partly so that future work
doesn't have to revisit mobile's account model — every mobile account is
already "a contributor" by the time that work starts.

## Data layer

- New migration:
  1. Backfill every `profiles.role = 'parent'` row to `role = 'contributor'`.
  2. Tighten the `role` check constraint (from migration 003) to
     `check (role in ('admin', 'contributor'))`.
  3. Simplify `handle_new_user()`'s signup trigger: remove the
     `case when raw_user_meta_data->>'role' = 'parent' then 'parent' else
     'contributor' end` branch — every new signup becomes `'contributor'`
     unconditionally, matching web's existing behavior.
- `supabase/seed.sql`'s "Seed Parent" row becomes a contributor, consistent
  with the backfill.

## Web changes

- `packages/types/src/index.ts`: `Role` narrows from
  `'admin' | 'contributor' | 'parent'` to `'admin' | 'contributor'`.
- `packages/web/lib/auth.ts`: role-parsing narrows to match (drops the
  `'parent'` branch).
- `packages/web/components/nav.tsx`: doc comment listing valid roles is
  updated. No behavioral change — nothing here ever branched on `'parent'`.

No `packages/api` changes: it already treats every signed-in profile
uniformly (`is_approved_contributor()` was widened in migration 009), with
no route or middleware branching on `role === 'parent'`.

## Mobile changes

- `lib/auth-context.tsx`: signup stops sending `role: 'parent'` in
  `options.data`. The trigger now assigns `'contributor'` on its own.
- `app/(tabs)/profile/index.tsx`: drops the `role === 'parent'` branch. The
  Profile tab always renders one merged screen once signed in and past the
  contributor-terms gate. The existing signed-out (sign in/sign up) and
  terms-gate states in `ProfileScreen` are unaffected — the merged screen
  only takes over exactly where `ChildProfileHome` used to.
- New merged Profile screen with a segmented "Account" / "Child Profile"
  switcher at the top:
  - **Account** segment = today's `ProfileScreen` signed-in content (email,
    "Open Web Dashboard" link, sign out) minus the role label — showing
    "Contributor" for every account adds nothing today since there's no
    mobile-side contributor capability yet to distinguish it from.
  - **Child Profile** segment = today's `ChildProfileHome`, as-is, except its
    own internal Sign Out button is removed (redundant now that Account has
    one — avoids two sign-out buttons on one tab).
  - Selection is sticky: defaults to Account on the first-ever visit, then
    remembers the last-selected segment locally (`AsyncStorage`), persisting
    across app restarts.
  - The bottom tab bar is unchanged (still 5 tabs: Profile, Scanner, Home,
    Toy Library, 3D Print) — this is nesting within the Profile tab, not a
    new tab.

## Testing

- **DB:** integration test asserting the backfill converts existing
  `role='parent'` rows to `'contributor'`, and that `handle_new_user()` now
  always assigns `'contributor'` on signup regardless of metadata.
- **Web:** sweep `packages/web/tests` for `'parent'` in fixtures/typed
  literals and update them. No behavioral test changes expected, since
  nothing on web branched on the value.
- **Mobile:**
  - `auth-context.tsx` signup test: assert metadata no longer includes
    `role`.
  - Replace `profile/index.tsx`'s role-branching test with one asserting the
    merged screen always renders regardless of role.
  - New unit tests for the merged Profile screen: defaults to Account on
    first visit, switches segments on tap, persists the last segment via
    `AsyncStorage` across remounts.
  - Drop the now-redundant Sign Out test on `ChildProfileHome` (that
    behavior moved to the Account segment).
  - Rewrite `tests/e2e/parent-signup.spec.ts` (renamed away from "parent")
    to: sign up → land on the Profile tab → see Account by default → tap
    Child Profile → see the three data-capture sub-screens (Ability
    Profile, Everyday Needs, Customization Metrics). The old assertion that
    a fresh signup lands directly on `ChildProfileHome`'s content no longer
    holds, since the first-time default is now Account.
  - `tests/e2e/helpers.ts`: `uniqueParentEmail()` / `signUpParent()` are
    renamed or removed in favor of the existing contributor equivalents,
    since mobile signup no longer produces a functionally distinct account
    type.
