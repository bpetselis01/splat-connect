# Soft Pop — decisions that change the Claude Code brief

**Status:** approved 2026-09-16, not started.
**Companion, not a replacement:** `Splat Connect frontend overhaul/claude-code-prompt.md`
is the spec. It is good and it stays authoritative for the design system scales
(§4), the three patterns (§5), the copy rules (§6), the Supabase discipline (§3)
and the per-round verification block (§7).

**This document records only what we decided differently, and why.** It does not
restate the brief. That is deliberate: the Pixel redesign ran two documents
describing the same work, they contradicted each other on font role and page
count, and the contradiction had to be patched back inline with strikethrough
markers so a later reader could not act on the wrong one. One source per fact.

---

## 0. What the brief could not have known

The brief says, in §4: *"Colour — only the existing tokens: `--surface --surface2
--canvas …`. Never introduce a hex."*

None of those tokens exist in this repo. They are the prototype's tokens. What
the repo has is a complete, shipped design system called **Pixel**, and the two
are visual opposites:

| | Pixel (shipped, on `development`) | Soft Pop (the brief) |
|---|---|---|
| Shadows | hard, **zero blur**, offsets 6/5/4/3 | soft blurs `--e1..--e4` (2/12/28/48px) + `--glow` |
| Borders | 3px / 2px solid ink | `--line` = `rgba(28,37,48,0.09)` hairline |
| Radii | 10/8/6/20/4/2 | 8/12/16/20/28 + 999px pills |
| Headings | Nunito 900 | Baloo 2 800 |
| Numerals | Jersey 10 (numerals only) | JetBrains Mono |
| Canvas | `#eaf4fa` blue | `#faf9f7` warm off-white |

Pixel is not a leftover. It shipped in three phases 2026-08-26 → 08-29, the last
being Phase 3 "behind the rail" — 45 single-file commits covering the logged-in
dashboard, which is exactly what brief features 2–10 redesign. `.pixel` is set on
every route (`app/layout.tsx:104` and `:145`), and five test files police it:
`pixel-tokens.test.ts`, `pixel-font.test.ts`, `press-motion.test.ts`,
`tone.test.ts`, `soft-register.test.ts`.

So this is the third direction — Playroom → Pixel → Soft Pop.

---

## 1. Soft Pop replaces Pixel entirely

**Decided:** Soft Pop supersedes Pixel across the product. Pixel's token names,
fonts and component-layer rules retire.

Not "dashboard only". A split was offered and declined: it would leave the phone
and the site speaking two visual languages and would fork every shared component,
since `.card`, `.panel`, `.alert`, `.field` and the badge tones are used on both
sides of the rail.

## 2. The token vocabulary is the artboard's, not the repo's

**Decided:** adopt the brief's exact token names rather than keeping Pixel's names
with Soft Pop values.

The reason is mechanical. The artboards reference these names about nine thousand
times — `var(--line)` 1098, `var(--muted)` 1024, `var(--bw)` 1003, `var(--surface)`
794, `var(--ink)` 699, `var(--b600)` 406, `var(--e2)` 232, `var(--glow)` 124. Adopting
the same names means prototype markup ports with its CSS variables intact, with no
translation layer and no per-value rewriting.

Keeping Pixel's names would also leave traps: `--shadow-pixel-card` holding a soft
blurred shadow is a lie that the next reader pays for.

The swap is mostly tokenisable. Pixel's look is already in its token values
(`--shadow-pixel-card: 5px 5px 0`, `--border-pixel`, `--radius-pixel`) and `.card`
consumes them rather than hardcoding. The component layer still needs rewriting,
but it is not a teardown.

## 3. Execution: swap in place (approach A)

**Decided:** F1 redefines the tokens, rewrites the component layer onto them, and
retires the Pixel names in one round. Every route changes appearance at F1;
rounds 2–12 fix structure per screen.

This matches the brief's own F1 — *"No screen changes yet beyond adopting tokens."*

Rejected: a parallel `.soft` root migrated route by route. Smaller blast radius per
round and trivially reversible, but two complete systems would coexist for 12+
rounds, every shared component would fork to serve both, `theme.ts` cannot
realistically run parallel, and it still ends in a cleanup round that deletes
Pixel.

Also rejected: rebuilding the component layer from artboard markup. Highest
fidelity, but it discards hardening that is not visual — see §7.

## 4. Mobile tokens travel with F1; mobile screens are a later pass

**Decided:** F1 converts `packages/web/app/globals.css` **and**
`packages/mobile/lib/theme.ts`. Screen rounds 2–12 stay web-only. Mobile screens
become a separate pass after.

The two token layers are coupled: `theme.ts`'s `colors.tone` holds the same badge
bg/fg pairs as web's `badge.tsx`, and `tone.test.ts` contrast-checks them as one
contract. Converting one and not the other splits it.

Note `theme.ts` already carries the history — its header reads *"Pixel language:
ink borders, hard offset shadows, small radii. The blurred shadow and 14–18px radii
of the soft pass are gone."* Soft Pop's 14px/18px radii are close to what Pixel
removed there.

## 5. Baseline: green the branch before F1

**Decided:** Round 0 precedes all design work.

The brief says branch `main`. That is wrong for this repo: `main` is 624 commits
behind, work lives on `development`, and as of 2026-09-16 `development` carries 6
unpushed commits and a red API integration suite (8 failures / 315 passing).

Round 0:

1. Fix the 8 integration failures. Four real causes, all diagnosed 2026-09-16:
   - three tests call `/api/upload/toy-cover` and `/api/upload/toy-switch-photo`,
     which `a4359f7c` replaced with `/api/upload/toy-photo` → 404;
   - one asserts that replacing a photo deletes the old file, which append-only
     deliberately no longer does (`expected 2 to be 1`);
   - two assert the publish-validation string `'Cover photo'`, renamed to
     `'A photo'` in `toys.ts:75`;
   - one uploads an untyped `new Blob([...])`, sent as `application/octet-stream`
     and refused by 053's bucket MIME allowlist. Its `beforeAll` swallows the
     upload error, so it surfaces as a confusing 400 later.

   These are tests asserting behaviour that was intentionally removed. They are
   rewritten or deleted against the new photo contract, not repaired.

2. Push the 6 commits so CI sees this work.
3. Create `FEATURES.md` and `SUPABASE.md` per the brief §1.

**Added, not in the brief: a CI trigger on `development` pushes.** `.github/workflows/ci.yml`
fires on `pull_request` and pushes to `main` only. The entire photo-array line —
roughly nine commits — reached the shared branch without any CI run, which is how
`development` came to sit with a third of its mobile E2E suite dying in setup and
nobody knowing. Beginning a 12-round overhaul on that same blind spot would repeat
the failure at much larger scale.

One local-only failure is **not** in scope and must not be "fixed": the
`admin-endpoints` sampling test fails against a local DB holding 1,729 tutorials
because `/api/admin/spot-check` does an unordered `.limit(10)`. It passes on a fresh
CI database. Worth noting separately that the endpoint's doc comment claims "a
random sample" and there is no randomisation, so in production it spot-checks the
same ten rows forever — a real defect, filed, but not a Round 0 blocker.

## 6. Seven of the brief's routes do not exist

**Decided:** the feature list is re-labelled restyle vs new build. The brief reads
as "restyle 12 things"; it is closer to "restyle 5 features, build 5 more from
nothing across 7 new routes".

Verified missing 2026-09-16:
`dashboard/exchanges/build/[id]`, `dashboard/print-requests/[id]`,
`dashboard/printers`, `dashboard/organisation/{review,events,recycling,profile}`.
`dashboard/organisation/` currently holds only `orders/`, `toys/` and `page.tsx`.

| Kind | Features |
|---|---|
| Restyle (route exists) | F2 `/dashboard`, F3 exchanges list, F4 exchange detail (canonical), F9 tutorials + saved, F11 explainer copy |
| New build (route missing) | F5 build detail, F6 print-request detail, F7 printers, most of F10, F12 org onboarding + admin queue |
| Component | F8 cost panel |

The new builds are where `SUPABASE.md` earns its keep; several should be expected
to land `needs db` rather than `done`. The brief's §3 list of easy-to-miss schema
changes was written for exactly these — stage vocabularies, per-row identity on a
detail route, cost line items, handover codes, org role gating, accurate badge
counts.

## 7. Carry forward what is not visual

A design-system swap must not silently drop hardening that survived the last one.
Each of these encodes a bug that actually shipped:

- **Press motion** lives in one block at the end of `globals.css`; a family declares
  `--pop-rest` and the rest is arithmetic. `press-motion.test.ts` exists because
  Tailwind compiles a comma-separated selector group into a single `:is()`, which
  takes the specificity of its most specific argument — grouping a `:has()` selector
  with the base family list dragged the rule to (0,3,0), outranked every per-family
  override, made every press travel zero distance, and **nothing errored**. Keep
  `:has()` and `:not()` selectors in their own rules.
- **Contrast tests must read values at test time.** `tone.test.ts` reads
  `--color-muted` out of `globals.css` rather than asserting a hex, because a
  contrast test asserting a hardcoded hex tests nothing. It also composites text set
  by `opacity` over tinted cards — four homepage blurbs shipped between 3.28 and
  4.36:1 that way.
- **`--radius-field` must not be deleted** while call sites consume it. The recorded
  worst case removed a custom property whose consumers remained, and the suite stayed
  green; every form input site-wide would have lost its radius.
- **Diff the *set* of custom properties and selectors before/after any CSS task.**
  Additions are fine; losses are the bug. This failure mode bit the Pixel branch
  three times.

The five Pixel guard tests are therefore **rewritten to police Soft Pop, not
deleted.** The guarantees outlive the design system; only the values change.

## 8. Reading the prototype

**Decided:** read the artboards directly. The brief's rule — *"You do not have the
prototype file in this repo… ask me to paste the section you need"* — is obsolete.

Both artboards are on disk under `Splat Connect frontend overhaul/`:
`SPLAT Connect - Web.dc.html` (1.4MB) and `SPLAT Connect - Mobile.dc.html` (394KB,
105 screen states). Split them on the `<sc-if value="{{ … }}">` blocks rather than
reading either whole; the sample data sits in the trailing `<script type="text/x-dc">`
block.

The brief's underlying rule stands unchanged: **no invented design.** If a value is
in neither the artboard nor §4, ask.

Ignore `support.js` and `image-slot.js` — generated Claude Design canvas runtime, no
design content.

---

## Open, deliberately

- **Mobile screen rounds are unscheduled.** Tokens land in F1; the screen pass is
  specced after the web rounds settle, so the patterns have proven out once first.
- **`/api/admin/spot-check` randomisation** is a real defect, out of scope here.
- **The untracked 46MB `Splat Connect frontend overhaul/` and 12MB `.ua/`** sit in
  the repo root. Gitignore before the first Round 0 commit so neither lands in one.
