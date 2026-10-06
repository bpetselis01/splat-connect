# Guide and Toy library redesign — design

Mockup (approved 2026-10-05): https://claude.ai/artifact/ShzTgXeatRGxuzzrGKUgT8
Mobile only for the screens; contributors' editors on both clients (see Scope).

## Screens

Both libraries become **hero + search + filter button + list**:

- **Hero:** the title and the mascot (Guides: wave, Toys: hold), plus one sentence:
  - Guides: "Step-by-step guides to adapt toys and build switches, with the parts to print."
  - Toys: "Adapted toys you can ask for, given by families and organisations near you."
  - The greeting ("Good evening, Fat") and "Given by families near you" go.
- **Search** as today, with the **filter button** beside it (the Map's button: dark with a count badge while any filter is on).
- **Chosen filters** show as removable tags under the search; a tap removes one.
- **List** headed "All guides" / "Matching guides" with the count and the sort in use.

The filter button opens a **full-height filter page** (EatClub's pattern): ✕ and Reset in the header, groups down the page, and a sticky "Show N guides/toys" button that applies and closes. Closing with ✕ discards unapplied choices, as the Map's sheet does.

| Guides | Toys |
|---|---|
| Guide type (All / Toy adaptation / Assistive tech) | Show (Toys / Organisations) |
| For your child (Suits <name>) | Availability (Available now, Switch-adapted) |
| Difficulty (Easy / Medium / Hard) | Condition (the GRADES) |
| Build time (Under 30 min, Under 1 hour) | Movement · Hands · Play · Measurements |
| Parts (Printable) | Sort by (Newest / Nearest first) |
| Movement · Hands · Play · Measurements | |
| Sort by (Newest / Quickest / Easiest) | |

Everything on the screen today (type switch, Filters panel, sort control) moves onto this page; nothing is lost. One component, `components/library/filter-page.tsx`, takes a list of groups and draws both.

## New data: who a guide or toy suits

The board's child questions (/onboarding/child), now on guides and toys too. The answer lists live in `@splat-connect/types`:

| Field | Values | Source |
|---|---|---|
| `movement text[]` | press, lever, grasp, proximity | new `MOVEMENTS` (the board's Movement step) |
| `hands text[]` | both, one, left, right | new `HANDS` (the board's Hands step) |
| `play text[]` | light, sound, move, soft, calm, water | existing `ENJOYS` (120) |
| `fit jsonb` | `{ palm_width_mm?: [min,max], reach_cm?: [min,max], tray_mm?: [min,max] }` | existing `CHILD_MEASURES` ranges |

Migration 127 adds the four columns to `tutorials` and `toys`: nullable, with array `check` constraints against the value lists, and a `check` that `fit` keys are only the three measures. The existing column grants follow, so the public lists can read them.

**Filter rules.** Within a group, any choice matches (OR); across groups, all must match (AND). A measurement matches when the item's range contains the typed number. While a group filter is on, an item with no answer for that group is left out: "suits" has to mean someone said so.

**Pre-fill.** With a child profile, the filter page opens with that child's answers pre-chosen as suggestions (working hand → Hands, enjoys → Play, measurements). Nothing is applied until "Show".

## Contributors

The mobile guide editor and toy editor gain a **"Who it suits"** section: four chip groups and three optional min–max pairs. None are required to publish; untagged items simply don't match those filters. The demo seeds (seed.js, sydney.js) tag their guides and toys, so the filters return results.

## Scope

- **In:** both mobile library screens, the filter page, migration 127, the API reading and writing the fields (`tutorials`, `toys`, the public lists), and the mobile editors.
- **Web editors:** the same "Who it suits" section, so a guide published on the web isn't untaggable. If you'd rather keep this to mobile for now, it comes out of scope.
- **Out:** the web library screens (they keep today's filters).

## Testing

- Unit: the filter rules (OR within a group, AND across, ranges, untagged left out), the filter page (draft vs applied, Reset, count), both library screens.
- API integration: the fields round-trip, bad values are refused.
- e2e: open the filter page, choose Movement + Play, see only tagged guides; remove a tag from under the search.
- On the phone: both libraries and the filter page, light and dark.
