# Regulatory, privacy and licensing remediation — 1 September 2026

Record of the five-work-package remediation (TGA intended-purpose, Privacy
Act/APP, terms/safety/navigation, licensing, contributor safety gate). One
commit per work package on `development`; WP4 lives on the `licensing` branch
and **must not merge until the founders' IP assignment deed is executed and
the UNSW student-IP question is resolved**.

## WP0 audit findings

- **Clinical-scale surface.** The estimator lived where expected:
  `packages/types/src/estimate-ability.ts` exporting `estimateAbility`,
  consumed by web's `child-survey-form.tsx` and mobile's `ability-screen.tsx`,
  with manual MACS/BFMF dropdowns always visible on both platforms. The exact
  high-risk string ("Not sure of your child's MACS or BFMF level? Answer these
  questions and we'll estimate both for you.") was live on web; mobile's
  variant said "we'll estimate MACS and BFMF for you". The placeholder-mapping
  warning comment already existed in the estimator.
- **`primary_diagnosis` did not drive matching — nothing does.** No matching
  or recommendation engine exists anywhere; `tutorial_recommendations` is
  contributor-curated tutorial→tutorial links. The column was written by both
  platforms' forms, displayed back in profile lists, and read by
  `child-steps.ts` for a progress checkmark. That is the complete list, so it
  was **removed** (see below). MACS/BFMF are equally collected-but-unconsumed;
  they were kept (the prompt only authorised removing diagnosis) but the same
  finding applies to them — flagged for a future decision.
- **Legal pages** all existed on the shared ProsePage pattern with good voice:
  privacy, terms, safety, code-of-conduct, contributor-terms, org-leader-terms.
  None of the WP2 additions were already covered. Terms had **no blanket
  liability-exclusion clause** — the ACL carve-out was added as belt-and-braces,
  not as a fix. Contributor terms are still an explicit placeholder ("not
  binding, will be replaced").
- **Footer already existed and was already everywhere** —
  `components/public-footer.tsx` driven by `FOOTER_LEGAL` in
  `lib/public-nav.ts`, threaded through `app/layout.tsx`, e2e-tested. The
  prompt's "couldn't find footer links" was stale. WP3's navigation work
  reduced to one new footer entry.
- **Licensing**: no LICENSE, no LICENSES/, no NOTICE, no CONTRIBUTING.md, no
  `license` field anywhere, no SPDX headers. README said "No licence file at
  the repository root yet" (not the "[Your License Here]" the prompt
  remembered — same meaning).
- **Contribution flow**: tutorials had a real review gate
  (`draft/pending/approved/rejected`, admin actions, review notifications, org
  backing) but **no safety declaration and no maturity field**. Review status
  is a different axis from maturity, so WP5 added a new column rather than
  extending `status`.
- **Supabase region is not in the repo** — `config.toml` is local-only; the
  hosted project is configured in the dashboard. Left as TODO(splat).

## WP1 — user-facing strings changed (old → new)

Web `child-survey-form.tsx`:
- "Not sure of your child's MACS or BFMF level? Answer these questions and
  we'll estimate both for you." → "A few questions about how your child uses
  their hands. We use your answers to suggest guides and devices that are
  likely to suit them. This is not an assessment, and it doesn't replace
  advice from your child's occupational therapist."
- Button "Estimate & save" → "Save answers"
- Success "Saved" → "Saved — we'll use this to suggest guides"

Web `child-ability-form.tsx`:
- "Primary diagnosis" field → removed
- Always-visible "MACS level"/"BFMF score" selects → collapsed
  `<details>` disclosure headed "Clinical scores (optional)" with: "If an
  occupational therapist or paediatrician has given you a MACS or BFMF level,
  you can enter it here and we'll use it instead of our own estimate. Leave
  this blank if you're not sure — you don't need it."

Web `app/dashboard/profile/page.tsx`:
- "A profile can include age, diagnosis and grip details…" → "…age, hand use
  and grip details…"
- Child card line "Age 5 · Cerebral palsy" → "Age 5"

Mobile `ability-screen.tsx`:
- Section "Diagnosis" (with Primary diagnosis dropdown) → section "Hand use"
  (dropdown removed; hand involvement/assisting hand kept)
- Quiz toggle "Not sure of the clinical terms?" / "Answer a few simple
  questions instead — we'll estimate MACS and BFMF for you." → "How does your
  child use their hands?" / "A few questions. We use your answers to suggest
  guides and devices that are likely to suit them. This is not an assessment,
  and it doesn't replace advice from your child's occupational therapist."
- Section "Hand function" with its MACS/BFMF hint → collapsed "Clinical scores
  (optional)" disclosure, same copy as web
- Button "Estimate" → "Save answers"
- Screen intro "Used to match tutorials and 3D print models to your child's
  needs." → "Used to match guides and devices to how your child plays."

Mobile `child-profile-home.tsx`:
- "A profile can hold age, diagnosis and grip details…" → "…age, hand use and
  grip details…"; summary line drops the diagnosis half

Mobile `child-editor-home.tsx`:
- Ability row hint "Diagnosis, hand involvement, MACS and BFMF" → "Hand use,
  and any clinical scores from your therapist"

Language sweep: remaining hits of therapy/therapist across about/get-involved
pages describe real organisations and the child's own clinicians (consumer
framing already) and were left alone. The "Clinical scores (optional)" label
is the sanctioned exception. No user-facing "assessment", "patient",
"treatment", "prescribe", "orthotic" or "rehabilitation" copy existed.

## WP1 — other changes

- Estimator renamed `estimateAbility` → `deriveFitProfile` (file
  `derive-fit-profile.ts`), result keys `macs/bfmf` → `macsInternal/bfmfInternal`,
  INTENDED PURPOSE regulatory comment added above the preserved placeholder
  warning. Clean rename, no alias — all consumers are in-repo.
- New page `/legal/intended-purpose` ("What SPLAT Connect is (and isn't)"),
  linked from the footer, the terms page, and the privacy page.
- `NotMedicalNote` disclaimer component (web + mobile twins) rendered on the
  child-profile editors and beside suggested-guide lists ("Also worth a look"
  on web, PicksRow on mobile).

## `primary_diagnosis` — finding and action

Does not drive matching (nothing does — see WP0). Removed end to end:
migration `051_drop_primary_diagnosis.sql`, types, API allowlist, both
platforms' forms and displays, `child-steps.ts`, tests. **Take a database
backup before running 051 against the hosted project.** Applied locally.

## Dependency licence audit (WP4, `licensing` branch)

`pnpm licenses list --prod`, 1 September 2026: MIT (591), ISC (33),
Apache-2.0 (20), BSD-3-Clause (16), BlueOak-1.0.0 (6), BSD-2-Clause (5),
0BSD (2), MPL-2.0 (2), Unlicense (2), CC-BY-4.0 (1), LGPL-3.0-or-later (1),
Python-2.0 (1), plus dual-licensed node-forge (used under BSD-3-Clause),
type-fest, fb-dotslash, and `@expo-google-fonts/*` under MIT AND OFL-1.1 —
the OFL half covers bundled font files, which are assets, not linked code.
**Nothing incompatible with GPL-3.0-or-later.** Full record in `/NOTICE` on
the branch.

## Every TODO(splat)

- `packages/web/app/privacy/page.tsx` — retention periods are commitments,
  not yet automation; build a deletion job or document the manual process.
- `packages/web/app/privacy/page.tsx` — confirm the hosted Supabase project's
  region and name it in "Where it is stored" (Australian residency strongly
  preferred; check the dashboard — `ap-southeast-2` is the one you want).
- `packages/web/app/legal/intended-purpose/page.tsx` — legal review of the
  intended-purpose wording before edits to its substance.
- `CONTRIBUTING.md` (licensing branch) — replace the placeholder safety-page
  URL with the real deployed URL.

## Needs legal review rather than my judgement

- The intended-purpose page and the "Not a medical device" terms section —
  drafted per the prompt, but they state SPLAT's regulatory position.
- The contributor terms are still the pre-existing "not binding" placeholder;
  the CLA in CONTRIBUTING.md (licensing branch) needs a lawyer's pass and
  needs to be reconciled with those terms when they're written.
- The retention schedule's "7 years for records required by law" — confirm
  which records that actually is for an unincorporated association moving to
  ACNC registration.
- Whether MACS/BFMF should be collected at all while nothing consumes them
  (same APP 3 data-minimisation logic that removed the diagnosis).

## Where the prompt no longer matched the codebase

- The footer and legal-page reachability already existed; WP3's navigation
  work became one FOOTER_LEGAL entry.
- The README licence section said "No licence file at the repository root
  yet", not "[Your License Here]".
- Terms contained no liability-exclusion clause to counteract; the ACL
  sentence was added anyway as protection-preserving.
- The estimator's placeholder warning comment already existed (kept, added to).
- The exchange feature exists, so the pickup-address retention line stayed.
- The safety page already had a soldering section; WP3's items were merged
  into it rather than added as a duplicate section.
- Web's survey consumer is `child-survey-form.tsx` (not
  `child-profile-form.tsx` as an old comment said).

## Test evidence

After each work package: `pnpm -r typecheck` clean; web unit 1006 passed;
mobile unit 463 passed; api unit 161 passed; api integration 318 passed
(includes new safety-gate and maturity-listing tests); affected e2e specs
green on both platforms (web contributor/admin/library/collaborators 41
passed, mobile authoring/organisation/library 14 passed, ability-profile 3
passed, footer 4 passed). Migrations 051 and 052 applied to the local
database; the hosted project still needs them (backup first).
