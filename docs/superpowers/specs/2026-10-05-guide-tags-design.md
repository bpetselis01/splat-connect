# Guide tags, child questions and the Recommended sort — design

Mockup (approved 2026-10-05): https://claude.ai/artifact/MjecaqmdhYM89j9YqcDJWP
Sub-project A of the guide overhaul (A tags → B filters → C editors → D guide page → E data reset). This spec also carries the parts of B and C that A drives: the filter groups, the sort, and the editors' tag section.

## Why

The 127 tags (Movement, Hands, Play, Fit) and the 079 child questions (working hand, press force, aim, hold) describe arm and hand ability. They leave out children whose needs are about seeing, hearing, communicating, learning or sensory regulation. MMC's library separates what a device *is* (Device Type) from who it is for. We follow that split, and we keep the child side one-to-one with the guide side, so nothing gets converted.

## The vocabulary (`packages/types/src/suits.ts`)

**Four child questions.** The onboarding, the filter page's "About <child>" section, the guide editor and the toy editor all show these, with the same answers:

| Key | Child column | Guide/toy column | Values |
|---|---|---|---|
| Helps with | `helps_with text[]` | `helps_with text[]` | moving, seeing, hearing, communicating, learning, calm, daily |
| How they use it | `access text[]` + `one_hand bool` | `access text[]` + `one_hand bool` | press, touch, grasp, head, foot, eyes, voice, watch |
| Press force | `press_force text` (one) | `press_force text[]` (every press it works with) | very_light, light, moderate, full |
| Play | `enjoys text[]` | `play text[]` | light, sound, move, soft, calm, water, build, pretend |

**Guide only:** `device_types text[]`, 12 values: adapted_toy, switch, switch_interface, mounting, controller, communication, vision, hearing, sensory, learning, daily_living, tablet.

Labels are as in the mockup. One module exports each list, and the API, both clients and the seeds import it.

## Matching

- **Filters.** Within a group any choice matches; across groups all must. "One hand is enough" matches `one_hand = true`. While a group is filtered, an item with no answer to it is left out (unchanged from 127).
- **Recommended** (`recommendScore(item, child)`) is the number of shared answers: |helps_with ∩| + |access ∩| + |play ∩ enjoys| + (both one_hand ? 1 : 0) + (child.press_force ∈ item.press_force ? 1 : 0). Guides sort by score, high first, then newest. With no child, or every score 0, the order is newest first.
- `suitsChild`, `matchesForChild` and `childNeedsLine` (080) are rewritten on this score: a guide "suits" a child when its score is above 0. The web guide page's "Suits <child>" note and the onboarding's done-screen count both use it.

## Data (migration 128)

- `tutorials`: add `device_types`, `helps_with`, `access`, `one_hand`, `press_force`; widen the `play` check to the 8 values; drop `movement`, `hands`, `fit`, `switch_target`, `switch_force`, `switch_hold`; drop `suits_fit_ok()`.
- `toys`: add `helps_with`, `access`, `one_hand`, `press_force`; widen `play`; drop `movement`, `hands`, `fit`.
- `child_profiles`: add `helps_with`, `access` (text[] not null default '{}'), `one_hand bool not null default false`; widen the `enjoys` check; drop `working_hand`, `aim`, `hold`. `press_force`, `everyday_needs` and the three measurements stay. Measurements leave the onboarding but stay in the profile editor, for makers sizing a print. Everyday needs stay as profile-only notes.
- Array checks use `<@` against the value lists. The public column grants on tutorials and toys follow the new columns.
- Local first. The hosted database moves in sub-project E, together with its data reset.

## Screens

**Mobile guide library filter page**, top to bottom:
- Sort by: Recommended / Newest / Quickest / Easiest. Default is Recommended.
- About <child>: Helps with, How the child uses it (+ One hand is enough), Press force, Play. The section opens filled in from the child profile, as a suggestion until "Show".
- About the guide: Device type, Difficulty, Build time, Parts.
- Removed: Guide type, For your child, Movement, Hands, Measurements.

**Mobile toy library filter page:** Show, Availability, Condition, then the four child groups, then Sort by (unchanged).

**Child onboarding (web and mobile wizards).** The four questions, one step each, with the name and age step before them and Everyday needs after. Working hand, aim, hold and measurements leave the wizard. Both child editors take the same fields, and the measurements stay in the editors.

**Guide editor (web and mobile).** A "Who it's for" section with Device type plus the four questions. The guide details section loses its three switch-tag pickers. **Toy editor:** the four questions.

## Testing

- Unit (types): every list and its label, `readSuits` for the new fields (bad values → the 400 sentence), `matchesSuits` (OR within, AND across, one-hand, untagged left out), `recommendScore` and the Recommended order.
- API integration: tutorials, toys and child profiles round-trip the new fields and refuse bad values. The dropped columns are gone from the allowlists.
- Mobile/web unit: the filter page groups, the wizards' steps, the editors' sections.
- e2e: filter guides by Device type and an access method. A child profile puts its matches first under Recommended.
- Seeds tag guides, toys and the demo children with the new fields, so filters and Recommended return results.
