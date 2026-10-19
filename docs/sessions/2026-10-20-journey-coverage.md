# Session Q&A Log: Journey coverage (web + mobile)

**Date:** 2026-10-20
**Mode:** New Feature
**Scope:** Deep
**Phases completed:** 0, 1, 2, 3, 4, 5, 6, 7
**Outcome:** Requirements (R1–R18) and a 24-unit plan produced, reviewed (CEO, Design, Engineering), deepened and committed

---

## Questions & Answers by Phase

### Phase 0: Intake & Route

**Q:** Mobile already has a journey map with 0 gaps and a CI checker. Extend that system to web, fresh audit of both, or web only?
**User:** Fresh audit of both, mobile included.
**AI position:** Recommended extending the existing system; read "fresh audit" as re-deriving both inventories and verifying every tag against what its test asserts, keeping the checker. Said so and invited correction.
**Resolved:** Both inventories re-derived from code; the mechanism kept.

### Phase 2: Challenge & Explore

**Q:** What should "covered" mean for a journey, per layer?
**User:** Outcome at every required layer.
**AI position:** Recommended it. A render-only test tagged with a journey reads as coverage and isn't; ~40% of web e2e is render-only.
**Resolved:** Unit asserts the handler call; e2e the user-visible result; api the row, notification and count. Per-test tags follow from this.

**Q:** The Maestro device flows have never run in CI. What happens to the 13 device-required journeys?
**User:** Promote Android Maestro to a required CI job.
**AI position:** Recommended it; the only layer that runs on Hermes.
**Resolved:** Required CI job.

**Q (gate):** Ready to proceed to Phase 3, with the product bugs registered rather than fixed (except the `website_url` XSS)?
**User:** Proceed to Phase 3.
**AI position:** Fixing the bugs in this plan would double it and mix product decisions into a test plan.
**Resolved:** 16 bugs go to `pending.ts` as decisions; the XSS is fixed in-plan.

### Phase 4: Structure

**Q:** When should the Android Maestro job gate a PR?
**User:** Option 1 (PR check when mobile changes) without the nightly.
**AI position:** Had offered PR-check plus nightly.
**Resolved:** PR check only; no nightly. R12 was later corrected to match (engineering review P0).

**Q:** A journey on both platforms: one shared row or one per platform?
**User:** One row per platform.
**AI position:** Recommended it; avoids a 350×253 matching exercise and leaves the mobile tags untouched.
**Resolved:** Per-platform rows; `api` layer shared by route.

### Phase 5: Validate

**Q:** Which scope mode for the CEO review?
**User:** HOLD SCOPE.
**AI position:** Recommended it.
**Resolved:** 23 units made bulletproof; no additions, no cuts.

**Q:** The CI `mobile` path filter also fires on API, types and supabase changes. Use it, or a narrower filter?
**User:** Use the existing `mobile` filter.
**AI position:** Recommended it; API and schema changes are what break phone journeys on Hermes.
**Resolved:** `if: needs.changes.outputs.mobile == 'true'`.

---

## Key Decisions

| Decision | Chosen | Phase | Rationale |
|----------|--------|-------|-----------|
| Mechanism | Keep `journeys.json` + tagged tests + `check.mjs`; re-derive both inventories | 0 | Tag quality where tags exist is high (46/50 unit, 45/49 e2e OUTCOME); the inventory froze, not the mechanism |
| Bar for "covered" | Outcome at every required layer | 2 | Render-only tags are the loophole |
| Device layer | Android Maestro as a required PR check on the `mobile` filter, no nightly | 2, 4, 5 | Only Hermes layer; API/schema changes break phone journeys |
| Row shape | One row per platform | 4 | No matching exercise; mobile tags untouched |
| Tag granularity | Per test case, parsed by TypeScript AST | 4, 5 | 26 files tag > 6 ids; `.each` in 84 mobile unit files defeats a regex |
| Bugs found | Register in `pending.ts`, fix only the XSS | 2 | Product decisions, not test gaps |
| Seed helpers | One Playwright-free shared module | 5 | Five helpers would otherwise be copy-pasted a third time |
| Web e2e scaling | `--shard` matrix, measured after the first web group | 5 | Each CI leg has its own Supabase; seat tags were unnecessary |
| Maestro cache | Saved by the PR job on pushes to `development`; no warm-up workflow | 6 | Caches restore only from the same or base branch |

---

## Positions Where AI Pushed Back

| Topic | AI Position | User Response | Final Resolution |
|-------|------------|---------------|------------------|
| Resume vs fresh audit | Extend the existing mobile system; what rotted is the inventory | Fresh audit of both | Fresh inventories, same mechanism; audit confirmed tag quality is high and drift (17 screens) is the real problem |
| Fixing product bugs in this plan | Against: doubles the plan, mixes product decisions in | Proceed without | Registered as 16 `pending.ts` decisions; XSS fixed |
| Maestro nightly | Offered PR check + nightly | PR check only | No nightly; a weekly cache warm-up was also rejected in favour of merge-time cache saves |
| Maestro path filter | Broader `mobile` filter (API changes included) | Agreed | `mobile` filter |
