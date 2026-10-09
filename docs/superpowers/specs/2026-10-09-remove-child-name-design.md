# Remove the child's name everywhere

Status: design, not built. Decided with Byron on 2026-10-09. A username for members was considered and dropped; nothing in this spec adds one or changes how a member's own name is shown.

## Goal

No child's name is collected, stored, copied or shown anywhere in SPLAT Connect. A child is identified to their own family only by position ("Child 1", "Child 2") and, where useful, age. Wording that used the name says "your child".

Why: a child's first name was reaching a public board (Makers wanted) and was stored with answers about their disability. The family gets nothing from the name that position and age do not already give.

## Decisions

1. **Both name fields go.** `child_profiles.name` (the stored name) and `toy_transactions.child_label` (the free-text "Who is it for?" on a build request, e.g. "Leo, 3", shown on the public board). `build_brief` stays; its hint tells people not to use names. Free text cannot be enforced, and this spec says so.
2. **Labels.** A list of children shows "Child N" by `created_at` order, plus ", age X" when the age is set. One helper in `packages/types` replaces three inlined copies. Deleting a child renumbers the rest, as it does today.
3. **Copy.** Every sentence that used the name says "your child": "Suits your child", "About your child", the wizard headings, "Your child's profile is ready", "One hand is enough for your child". The `{name}` placeholder leaves `CHILD_QUESTIONS`.
4. **Data.** Two steps, because the hosted "development" project is live with real accounts and a dropped column cannot be restored.
   1. Ship code that no longer reads or writes either field. Verify on web and phone.
   2. A later migration drops both columns. Take a database backup first (`~/splat-connect-db-backups`). The down-migration can recreate the columns empty, not restore values.
5. **Avatar and delete phrase.** The initial letter becomes the child's number in a circle. The typed delete phrase becomes `confirm_delete_Child_1`, matching the visible label.
6. **Parity boards.** The Soft Pop boards still show "Name or nickname" and "Ollie". They are not edited. The removal is recorded as an explained divergence in the parity harness.
7. **Privacy page.** Change only the sentences that become false, and flag them for the lawyer. Legal copy stays code-only.

## What identifies a child afterwards

The row `id` (uuid) is already the key everywhere: the API, `/dashboard/child/[id]`, `/account/child/[id]`, PATCH and DELETE. `parent_id` scopes ownership and `created_at` gives order. Nothing in the database uses the name for uniqueness, lookup or foreign keys. `020_multi_child_profiles.sql` already says the name "never identifies a row on its own", and null names already render as "Child N".

Two places depend on order rather than name and are unchanged: `fitLine` and `packages/web/app/library/page.tsx` use the oldest child with a matching score.

## Scope by layer

### Database
- New migration (step 2): `alter table child_profiles drop column name`; `alter table toy_transactions drop column child_label` (and its 60-character check, from `064_open_build_requests.sql`).
- `supabase/SCHEMA.md` is already stale (omits `name`, `created_at`, shows `parent_id unique`). Correct it in the same change.
- `scripts/check-schema-guards.sh` (child_profiles block, ~665-684) never asserts `name`. Add a guard that both columns are gone, so a restored migration cannot bring them back.

### API (`packages/api/src`)
- `routes/child-profiles.ts`: remove `'name'` from `EDITABLE` (line 54). `GET /` selects `*`; select explicit columns once the column is gone.
- `routes/toy-transactions.ts`: stop selecting or nulling `child_label` (lines ~186, 253, 274) and stop writing it (line ~1446, `short('child_label', 60)`). The board and thread responses lose the field.
- No change needed in notifications, recommendations, `me.ts`, `events.ts`, `public.ts` or `contributors.ts` (no hits).

### Types (`packages/types/src`)
- `index.ts`: `ChildProfile.name` (:66), `ChildAnswers` pick (:135), `TutorialTransaction.child_label` (:414). Remove `name` from the `ChildDone` pick used by mobile.
- `index.ts:65` comment points at a `packages/web/lib/child-label.ts` that does not exist. Replace it with the new helper's location.
- `suits.ts`: `CHILD_QUESTIONS` `{name}` placeholders (:80-83), `fitLine` (:174-176) becomes "Suits your child".
- New `childLabel(index, age)` helper, used by web and mobile.

### Web (`packages/web`)
- Child editor and wizard: remove the "Name or nickname" input (`components/child-editor.tsx:253`) and "First name (optional)" (`components/child-wizard.tsx:65-68`); wizard headings (:109, :115, :247); editor heading fallback (:232) and `answersOf` (:41).
- `components/delete-entity-button.tsx:45,79,91`: phrase and labels from the passed label.
- `app/dashboard/profile/page.tsx:109,121,124` and `app/dashboard/child/[id]/page.tsx:19-21`: use the helper; avatar becomes the number.
- `app/library/page.tsx:36-41` and `library-client.tsx:134,249`: stop passing the name; heading "About your child".
- Guide detail: `app/tutorials/[id]/page.tsx:50,66` and `components/tutorial-view.tsx:29,139` (the fit callout) follow `fitLine`.
- Build requests: remove "Who is it for?" (`components/ask-openly-form.tsx:89,120,244-251`) and its display (`components/makers-wanted-board.tsx:47,281-283`); update the `build_brief` hint and the page comment at `app/get-involved/makers-wanted/page.tsx:5`.
- `components/story-form.tsx:124,190,229`: placeholders "Leo's drum" and "Hannah, Leo's mum". Not the child profile name, but they model putting a child's name in public story copy. Replace with neutral examples. Optional; confirm before doing.
- `app/privacy/page.tsx:27,141,144,159`: see decision 7.

### Mobile (`packages/mobile`)
- Wizard: remove the name field (`components/profile/child-wizard.tsx:116-121`) and the `name` in the about step (:35, :48, :80, :171); headings (:86, :107, :145).
- `components/profile/child-editor-home.tsx:71,84-88`: remove the "Name or nickname" field; header becomes "Child profile".
- `components/profile/child-profile-home.tsx:29-32,119`: helper and numbered avatar. `+ Add a child` already posts `{}`.
- `components/profile/child-done.tsx:42,47`: "Your child's profile is ready", "…suit your child".
- `lib/library-filters.ts:70-71`, `components/home/library-screen.tsx:146`, `components/home/detail-screen.tsx:343`: copy and the `childName` argument.
- Build requests: `components/builds/ask-for-build-screen.tsx:42,84,147` (remove the field), `makers-wanted-screen.tsx:392` and `build-thread-screen.tsx:437` (stop showing `child_label`).
- No name is stored in SecureStore, AsyncStorage, route params or deep links.

### Seeds, scripts, docs
- `scripts/seed-demo/seed.js`: child 'Zara' (:587), `child_label` values (:823-838), names inside `build_brief` text such as "Arlo's classroom", and the helper at :867. The build-day event question "Child's first name (so we can label the toy)" (:623) is an organisation-authored event question, so leave it and note it.
- `scripts/parity/seed.js`: `child_label` (:167, :502-510).
- `scripts/parity/app-screen-map.json` (:9-16 "suits ollie", :776 `child`, :849 `wizard`), `screen-map.json` (:75, 851, 860) and the report files: record the divergence from the boards as explained.
- Docs that mention the name: `docs/superpowers/plans/2026-08-11-multi-child-profiles.md`, `…/2026-10-01-people-orgs-me-build.md:4645`. Leave as history.

## Tests to change

Roughly 35 files assert names such as Emma, Sam and Ollie.
- API: `integration/child-profiles/crud.test.ts`, `integration/rls/direct-access.test.ts` (uses 'Zed'; switch to age only), `integration/account-deletion/delete.test.ts`, `unit/suits.test.ts`, `integration/…/open-builds.test.ts` and `builds-board.test.ts` (`child_label`).
- Web unit: `child-editor`, `child-wizard`, `delete-entity-button`, `tutorial-view`, `makers-wanted-board`, and the pages `dashboard-child-edit` and `dashboard-profile`. Web e2e: `dashboard/shell.spec.ts:169-209` (Emma flow and `confirm_delete_Emma`).
- Mobile unit: the `profile/` tests (`child-wizard`, `child-done-failure`, `child-editor-home`, `child-profile-edges`, `child-profile-home`), `home/library-screen`, `home/detail-screen`, `library/filter-page`, and the build and Makers wanted tests. Mobile e2e: `child-profile-home.spec.ts`, `auth-edges.spec.ts:137-146`.
- New: a unit test for `childLabel`; a guard that neither column exists; an API test that PATCH with `name` is ignored and POST with `child_label` is ignored.

## Order of work

1. Types: the helper, copy changes, remove the fields.
2. API: stop reading and writing both fields.
3. Web, then mobile, with their tests.
4. Seeds, parity map, docs, privacy sentences.
5. Verify (below). Ship to `development` only, as usual.
6. Later, after Byron confirms the apps work: the drop migration with backup, plus the schema guard and SCHEMA.md.

## Verification

- `scripts/verify-plan.sh --run --e2e` for each package, web and mobile one after the other.
- The whole `npx jest` for `packages/mobile`, because a subset once missed a guard test.
- `node scripts/pending.mjs --check` and the web and mobile parity runs (web 118/118, mobile 60/61 before) to confirm only the recorded divergences change.
- Look at the wizard, child list, a guide's fit line and the Makers wanted board on the simulator. iOS-only layout is invisible to web tests.

## Risks

- `build_brief` free text and org-authored event questions can still contain a child's name. This spec removes the prompts that ask for one, not the possibility.
- After step 1 and before step 2 the columns still exist and hold old names. Nothing displays them, but they stay readable to the owner through the API until the drop. Do step 2 promptly.
- Renumbering: deleting "Child 1" turns "Child 2" into "Child 1". Unchanged from today.

## Out of scope

Member names and any username (dropped), the `build_brief` content, the organisation event questions, and the Soft Pop boards.
