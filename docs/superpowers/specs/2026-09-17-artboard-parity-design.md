# Artboard parity: making the live web app match the Soft Pop design

**Date:** 2026-09-17
**Status:** approved, unattended execution
**Scope:** web only (92 artboard screens). Mobile is explicitly out.

## The problem

The live web app carries the Soft Pop tokens but does not read as the Soft Pop
design. Byron's framing: "the live version still does not look completely like
the Claude Design ... I don't want to catch every error you're making, there
seem to be a lot."

The last clause is the actual requirement. A pass that fixes the screens I
happen to look at, and reports success, is the failure mode being complained
about. So the deliverable is not "the screens look better" — it is a
**re-runnable measurement that produces a number, and that number reaching
zero**. Any claim of parity that isn't backed by that report is worthless.

## What was measured before writing this

`/about` against artboard `#about`:

| | Artboard | Live |
|---|---|---|
| H1 | Baloo 2, 52px, 800 | Nunito, 32px, 900 |
| H2 | Baloo 2, 21px, 800 | Nunito, 20px, 800 |
| Section head | "In this section", 26px | "More about SPLAT", 20px |
| Height | 666px | 1984px |
| Cards | 4 doors | 5, plus `PIXEL ART` placeholders |

### Root cause of the global mismatch

`packages/web/app/globals.css:771` applies `--font-display` to `.numeral` and
nothing else. That restriction is correct for **Pixel**, the retired system,
where the display face was Jersey 10 and deliberately numerals-only. Soft Pop
repointed `--font-display` to Baloo 2 but never lifted the restriction, and in
the Soft Pop tokens Baloo 2 is the face for the whole heading ramp —
`type.display`, `type.h1`, `type.h2`, `type.h3` all reference `{font.display}`.

Consequence: every heading in the app renders in the body font. `font-display`
appears in 26 files; 98 files contain an `<h1>`. The tokens were ported
correctly and then never applied.

This is the highest-leverage single fix in the job and the clearest example of
the class of error being complained about: the design system is present in the
codebase and not in the pixels.

### Two further systemic findings

1. **Stale Pixel-era content.** Live pages still render `PIXEL ART` placeholder
   slots from the retired system.
2. **Route-map divergence.** The artboard's route map and the live route tree
   disagree: `/tutorials`→`/library`, `/toys`→`/toy-library`,
   `/organisations`→`/organizations`. A naive comparison 404s and reports a
   false "missing screen". A mapping table is required; renaming 119 live
   routes is out of scope and would break links and tests.

## Non-goals

- Mobile (`SPLAT Connect - Mobile.dc.html`, 37 screens).
- Renaming live routes to match the artboard's route map.
- Refactoring unrelated to parity.

## Decisions taken

| Question | Answer |
|---|---|
| Scope | Web only, 92 screens |
| Comparison target | Seeded local Supabase stack; cloud dev as sanity-check |
| Parity bar | Everything, including large set-pieces and copy |

The parity bar means **content parity is in scope**. The artboard's About says
materially different things than live About; this pass changes copy, not only
styling.

## Architecture

### Comparison harness — `scripts/parity/`

Chosen approach: **structural fingerprint diff as the gate, screenshots only
for screens the diff flags.**

The alternative — screenshotting all 92 screens and reviewing each pair every
round — was rejected because round 5 costs the same as round 1. The loop only
terminates if each round is cheaper than the last, which means later rounds
must re-check only what is still failing.

| Unit | Responsibility |
|---|---|
| `screen-map.json` | artboard screen id → live route, role, viewport. The one place route divergence is recorded. |
| `fingerprint.js` | Given a page, return a normalised design fingerprint. Identical code runs against both sides. |
| `compare.js` | Diff two fingerprints into typed findings. Pure; no browser. |
| `run.js` | Drive Playwright over the map, write `parity-report.json`, screenshot flagged screens. |

The fingerprint is the contract between the two sides, and it is the whole
design. It must capture what makes a page look wrong while ignoring what
legitimately differs (real data vs prototype data).

Captured per screen:

- headings: tag, text, computed font-family / size / weight / colour
- section order and count; landmark text in document order
- component inventory: buttons, cards, inputs, tabs, with computed
  radius / shadow / background / padding on the first of each kind
- page height at a fixed viewport
- canvas, surface and ink colours actually resolved

Deliberately **not** captured: exact text of data-bearing rows, image URLs,
counts of list items. Those differ legitimately between prototype and real
data, and including them would drown the report in false positives — the
failure mode that makes a parity report ignorable.

### Fingerprint mapping

Markup differs between the two sides, so nodes are matched by **visible text
and semantic role**, not by selector or DOM position. A heading is matched to
its counterpart by normalised text where possible, else by ordinal within its
level. Unmatched nodes on either side are reported as `missing` / `extra`,
which is what catches a dropped section.

### Finding types

`font`, `size`, `weight`, `colour`, `radius`, `shadow`, `spacing`,
`missing-section`, `extra-section`, `copy`, `set-piece`.

Each carries screen id, live route, and both observed values, so a finding is
actionable without re-deriving it.

## Execution plan

### Wave 0 — systemic

Fixes that move many screens at once. Everything else is measured only after
these land, because measuring before them produces 92 copies of the same
finding.

1. Lift the numerals-only restriction on `--font-display`; apply the Soft Pop
   heading ramp (`display`/`h1`/`h2`/`h3` sizes, weights, line-heights).
2. Build `screen-map.json`, recording route divergence.
3. Clear the `placeholder.invalid` rows breaking `/`, `/library`,
   `/toy-library`. Fixture data, not a schema change.
4. Remove stale `PIXEL ART` placeholder slots.

**Checkpoint:** run the harness, record the remaining finding count. That
number is the honest size of the remaining job.

### Waves 1–5 — by screen group

Public site → My SPLAT → Organisation → Admin → Learn. Each wave ends with a
harness re-run; a wave is done when its screens report zero findings.

### Set-pieces

Tracked as named line items so they cannot hide inside a wave. Known:

- Home's five-scene CSS-3D scroll-world hero (`data-scroll-world`), scrubbed by
  scroll, `prefers-reduced-motion` snapping to static scenes.

Others will be identified by `missing-section` findings on large regions.

## Environment

- **Compare against** the seeded local Supabase stack.
- **Sanity-check** on cloud dev, so a fix that only works on fixtures is caught.
- The stale e2e server on :3105 is killed before any run. It serves a
  days-old build and would silently pass stale markup into the comparison —
  the trap recorded in project memory as `stale-e2e-server-reuse`.
- Artboard served statically; screens addressed by URL hash (`#toys_public`),
  confirmed working.

## Verification

Parity is claimed only when `parity-report.json` reports zero findings across
all 92 screens, and the report is committed alongside the changes so the claim
is checkable rather than asserted. Existing unit and e2e suites must stay
green; `tsc --noEmit` and the production build must stay clean.

## Risks

| Risk | Handling |
|---|---|
| Fingerprint too strict → noise drowns real findings | Data-bearing content excluded by design; tune on Wave 0 output before scaling to 92 screens |
| Fingerprint too loose → false parity | Screenshot audit of a sample that passes, each round |
| Copy changes contradict regulatory wording | Legal//safety/intended-purpose pages excluded from copy findings; styling only |
| Set-pieces dominate effort | Tracked separately with their own line items |
