# Ability Profile — Child Profile Design

**Date:** 2026-07-21
**Branch:** development

---

## Problem

The mobile scaffold spec (`2026-07-21-mobile-app-scaffold-design.md`) explicitly deferred every feature that depends on a `parent` role and a child-profile data model — neither exists in the schema yet. The mockup's Profile tab, once signed in as a parent, shows a "Child profile" section with three linked sub-screens — **Ability Profile** (primary diagnosis, MACS level, hand involvement, BFMF score, with an optional guided questionnaire that estimates MACS/BFMF from plain-language answers), **Everyday Needs** (top challenges, grip preference, usage environment), and **Customization Metrics** (palm width, wrist circumference, optional forearm length, hand dominance, sensory preferences) — all three editing one underlying profile, described in the mockup as data eventually used "to match tutorials and 3D print models to your child's needs."

This spec is the first parent-owned feature: it introduces the `parent` role, a single child profile per parent account, and the three data-capture screens above. Nothing yet reads or acts on this data — that's for whichever future spec builds tutorial/print matching.

---

## Decisions

- **All three sub-screens in one spec.** Ability Profile, Everyday Needs, and Customization Metrics are three tabs of one record and share the same new plumbing (parent role, child profile table, signup). Splitting them into separate specs would just repeat that setup for no isolation benefit.
- **Single child per parent account.** The mockup shows no child switcher. The schema still leaves room for multi-child later (see Data model) without a key restructuring, but there's no switcher UI this round.
- **Capture-and-store only.** Nothing in this slice reads the profile — Toy Library, 3D Print, and tutorial matching are all still out of scope, and there's no tagging scheme on `tutorials` to match against yet. Building that matching logic now would mean inventing a scheme no consumer needs yet.
- **Bare signup, no onboarding wizard.** Parent account creation is plain email/password/name. The child profile starts empty and gets filled in later from the Profile tab — the mockup only ever shows an already-populated editing view, never a signup or onboarding flow, so there's nothing to fabricate a design for.
- **Guided questionnaire included, with a known-limitation flag.** The mockup's "Not sure of the clinical terms?" flow (4 fixed questions → estimated MACS/BFMF) ships as a naive lookup table. This is explicitly **not a validated clinical instrument** and needs review by someone with real MACS/BFMF domain expertise before being trusted for actual assistive-device decisions.
- **Mobile-only.** No equivalent web parent interface. Parents are a mobile-only audience per the original scaffold decision; `packages/web` stays the contributor/admin CMS.
- **Account fields limited to what already exists.** The mockup's "Account" section shows Name/Email/Phone, but `profiles` only has `name`/`email` today and nothing in the app consumes a phone number. This slice reuses the existing `name`/`email` columns and drops the phone field rather than adding an unused column to a shared table.

---

## Out of scope (future specs)

- Multi-child support (switcher UI, per-child navigation).
- Any consumer of the profile: tutorial/print matching, Toy Library, 3D Print, Toy Scanner.
- Web-side parent interface.
- Validating/revising the MACS/BFMF estimation lookup table against real clinical guidance.

---

## Architecture

### Data model (new migration)

- `profiles.role` check constraint extended: `'admin' | 'contributor' | 'parent'`.
- `handle_new_user()` trigger updated to read `role` from `raw_user_meta_data`, but **only honors the literal value `'parent'`** — anything else (including omitted) still defaults to `'contributor'`, exactly as today. This closes a self-serve escalation path: without the whitelist, a client could pass `role: 'admin'` at signup and grant itself admin.
- New `child_profiles` table:
  - `id uuid primary key default gen_random_uuid()`
  - `parent_id uuid references public.profiles on delete cascade not null unique` — the `unique` constraint (not primary key) enforces "one child per parent" today; a future multi-child spec only has to drop this constraint, not restructure the key.
  - `age integer`
  - Ability Profile: `primary_diagnosis text`, `macs_level text`, `macs_source text default 'manual' check (macs_source in ('manual','estimated'))`, `hand_involvement text check (hand_involvement in ('bilateral','unilateral'))`, `assist_hand text check (assist_hand in ('left','right'))`, `bfmf_score text`, `bfmf_source text default 'manual' check (bfmf_source in ('manual','estimated'))`
  - Everyday Needs: `challenges text[] default '{}'`, `challenge_other text`, `grip_type text`, `env_context text`
  - Customization Metrics: `palm_width_mm numeric`, `wrist_circ_mm numeric`, `needs_arm_attachment boolean not null default false`, `forearm_length_mm numeric`, `hand_dominance text`, `sensory_preferences text[] default '{}'`
  - `updated_at timestamptz not null default now()`
  - Every field besides `id`/`parent_id`/`updated_at` is nullable — the profile fills in incrementally, nothing is required at creation.
- RLS: parent can select/insert/update their own row (`parent_id = auth.uid()`); admin gets full access via the existing `is_admin()` helper, matching the pattern used on every other table. No delete policy — nothing in this slice deletes a child profile.

### Auth

- New mobile signup screen (Profile tab, shown when signed out, alongside the existing sign-in form): name / email / password → `supabase.auth.signUp()` called directly client-side with `options.data: { name, role: 'parent' }` — the same direct-to-Supabase pattern the existing sign-in already uses.
- The existing sign-in screen and `lib/api-client.ts` token attachment (built in the scaffold spec) work unchanged for parent accounts.

### API — `packages/api/src/routes/child-profile.ts`

- `GET /api/child-profile` — returns the caller's row, or `null` if not yet created.
- `PUT /api/child-profile` — upserts (by `parent_id`) the editable fields.
- Both behind `authMiddleware`, gated to `role === 'parent'` (403 for admin/contributor) at the route level, using `createUserClient(token)` so RLS is the actual enforcement — same shape as `contributors.ts`.

### Mobile screens (`packages/mobile`)

```
app/(tabs)/
  profile.tsx                  # branches: signed-out (sign in/sign up), admin/contributor (unchanged), parent (child profile home)
  profile/
    ability.tsx                 # Ability Profile sub-screen
    everyday-needs.tsx          # Everyday Needs sub-screen
    customization.tsx           # Customization Metrics sub-screen
```

- **Child profile home**: Name/Email (read from `profiles`), Age, and three tappable summary rows leading to the sub-screens below.
- **Ability Profile**: primary diagnosis dropdown, MACS level dropdown (tagged when set by the questionnaire), hand involvement (bilateral/unilateral, plus which-hand-assists when unilateral), BFMF score dropdown, and the collapsible "Not sure of clinical terms?" questionnaire (4 fixed multiple-choice questions → naive lookup table → sets `macs_level`/`bfmf_score` and tags `macs_source`/`bfmf_source = 'estimated'`).
- **Everyday Needs**: challenge chips (multi-select, max 3, with free-text "other"), grip type chips, environment context dropdown.
- **Customization Metrics**: palm width / wrist circumference / forearm length (numeric, mm, with measurement guidance text per the mockup), arm-attachment toggle gating the forearm length field, hand dominance dropdown, sensory preference chips.
- All fields autosave via a debounced `PUT /api/child-profile` — no explicit "Save" button, matching the mockup's live `onChange` bindings.

### MACS/BFMF estimation (known limitation)

- 4 fixed questions, each with 3–4 plain-language options (content lifted from the mockup's `questions`/`q.options` structure).
- A pure function `estimateAbility(answers) -> { macs, bfmf }` maps the answer combination to a value via a small hardcoded lookup table.
- **This table is a placeholder, not a validated clinical instrument.** It needs review and revision by someone with real MACS/BFMF domain expertise before being relied on for actual assistive-device decisions. Flagged inline in the code and here so it isn't mistaken for validated logic.

### Testing

- Unit test for `estimateAbility()` — table-driven, asserts each fixed answer combination maps to the expected `{ macs, bfmf }`.
- API route test for `child-profile.ts` — role gating (403 for admin/contributor) and RLS-scoped GET/PUT, mirroring `contributors.test.ts`.
- Render test for the signup form, mirroring the existing sign-in test.

---

## Compatibility notes

No new Expo/native dependencies beyond what the mobile scaffold already installed — this slice is forms, dropdowns, and REST calls against the existing Supabase + Hono stack.
