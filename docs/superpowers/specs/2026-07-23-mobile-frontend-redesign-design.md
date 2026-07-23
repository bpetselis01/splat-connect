# Mobile Frontend Redesign — Design Spec

**Date:** 2026-07-23
**Status:** Approved for implementation
**Scope:** Sub-project 1 of 2 — the mobile app (`packages/mobile`), all screens. Web (`packages/web`) is a separate follow-up spec, out of scope here.

---

## Context

The mobile app's visual design has never had a dedicated pass — each screen inlines its own `StyleSheet`, there's no shared UI kit, and no animation library is installed. Colors and font are already correct: `packages/mobile/lib/theme.ts` already matches the reference design (`SPLAT_mobile_claude_design/`) exactly — `#1998d5`/`#0f6f9c` primary, `#1c242b` text, `#eaf6fb`/`#f5fbfd` light backgrounds, Nunito font. The reference design also establishes a shape/elevation language not yet reflected in the app: soft rounded corners (`10–16px` cards, `999px` pill buttons) and one subtle shadow (`0 2px 10px rgba(28,36,43,0.08)`).

This is a visual/UX redesign only. **Hard constraint: preserve all existing functionality.** No screens, routes, navigation structure, or data flows change — only how they look and how touch feedback feels.

### Why colors/fonts aren't in scope

`theme.ts` already carries the reference palette and Nunito. The gap this spec closes is shape, spacing, elevation, and motion — the app currently has none of the "soft, calm, rounded" character the reference design establishes.

---

## Theme extension

Additive only — no existing `theme.colors` keys change.

```ts
// packages/mobile/lib/theme.ts additions
radii: { sm: 8, md: 12, lg: 16, pill: 999 },
shadow: { shadowColor: '#1c242b', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 2 } },
motion: { pressScale: 0.96, duration: 180 },
```

`radii` values match the reference design's card (`10–16px`) and pill-button (`999px`) usage. `shadow` is a single preset — the reference design only uses one shadow, no elevation scale is needed. `motion` constants keep every `AnimatedPressable` press and every staggered reveal consistent.

---

## Shared UI kit — `packages/mobile/components/ui/`

New primitives, each replacing ad hoc inline styles in the screens that consume them:

| Component | Purpose | Notes |
|---|---|---|
| `Button.tsx` | Pill-shaped, primary/secondary/ghost variants | Wraps `AnimatedPressable`; renders as `<Pressable accessibilityRole="button">` so `getByRole('button', {name})` queries keep working |
| `Card.tsx` | Rounded container with the shared shadow | Used for tutorial list rows, profile section containers, nav tiles |
| `Chip.tsx` | Pill selector for filters/multi-select | Same accessible-button semantics as `Button`; used for difficulty filter and all ability-screen selector buttons |
| `ScreenHeader.tsx` | Title + optional small (~28px) logo mark | Logo shown only on the two root tab screens (library, profile landing) — not on drill-down screens, matching how apps typically reserve the brand mark for top-level nav |
| `AnimatedPressable.tsx` | Press-scale wrapper (`reanimated`) | Used inside `Button`/`Chip` and anywhere else tappable |
| `StaggeredList.tsx` | Thin wrapper around `FlatList`'s `renderItem` | Index-based fade/slide-in delay; used on the library screen's tutorial list |

`difficulty-badge.tsx` and `fields.tsx` are **restyled in place** (pull from the new `radii`/theme tokens) rather than replaced — they're already shared, tested components; no need to duplicate them into the new `ui/` kit.

### Motion approach

No animation props threaded through every primitive. Motion is scoped to the two places it reads as polish: touch feedback (`AnimatedPressable`, used inside `Button`/`Chip`) and list/screen entrance (`StaggeredList`). This was chosen over baking animation into every primitive (more surface area than needed) or bolting it on screen-by-screen after a static pass (duplicates animation logic per screen instead of sharing it).

**Dependency:** `react-native-reanimated`, added via `npx expo install react-native-reanimated` (resolves the Expo SDK 57–compatible version) plus its babel plugin. Our usage — press-scale, opacity/translate fades — is within Reanimated's well-supported web-export subset. Since the mobile E2E harness depends on `expo export -p web` succeeding, **the first implementation step is confirming the babel plugin + a trivial animated component survive `expo export -p web`**, before any screen work begins.

---

## Screens covered

**Home tab:**
- `library-screen.tsx` — `ScreenHeader` (with logo), search field restyled with theme tokens, `Chip` row for the difficulty filter, tutorial rows become `Card` inside `StaggeredList`
- `detail-screen.tsx` — parts/tools become `Card` sections, "Preview Tutorial" becomes the pill `Button`
- `preview-screen.tsx` — "Open in Browser" fallback becomes the pill `Button`

**Profile tab:**
- `profile-screen.tsx` (root — signed-out auth forms + signed-in state) — `ScreenHeader` (with logo), auth actions → `Button`
- `ability-screen.tsx` — all selector buttons (condition, grip, laterality, grade, numeric) → `Chip`
- `customization-screen.tsx` — restyled with theme tokens; consumes restyled `fields.tsx`
- `everyday-needs-screen.tsx` — restyled; the existing native `Switch` is retained (correct semantics already), only its track/thumb colors are retheme
- `child-profile-home.tsx` — the three nav tiles (Ability Profile / Customization Metrics / Everyday Needs) become `Card`
- `coming-soon.tsx` — minor retheme only, no structural change

---

## Hard constraint: preserve test contracts

This redesign changes styling only — no copy, no structural/semantic changes. Every string, placeholder, and accessible role/name that the existing test suite (17 unit test files, 9 E2E spec files) queries on must keep working exactly as-is, including:

- Placeholders: `Search tutorials`, `Age`, `Forearm length`, `Palm width`, `Wrist circumference`, `Describe the other challenge`
- Text: `Preview Tutorial`, `Open in Browser`, `Sign Out`, `Welcome Back`, `Create an account`, `Ability Profile`, `Customization Metrics`, `Everyday Needs`, `Estimate`, `Not sure of the clinical terms?`, difficulty labels (`Easy`/`EASY`/`Medium`/etc.)
- Roles: `getByRole('button', { name })` for every ability-screen selector (`Cerebral palsy`, `Fatigue`, `Left`/`Right`, `Pincer`/`Soft`, `School`/`Other`, `I`/`II`, numeric grades), `getByRole('switch')`

`Button` and `Chip` render as real `<Pressable accessibilityRole="button">` specifically so these selectors keep resolving unchanged.

---

## Testing / verification

No new tests are needed — this is a pure visual layer over already-tested behavior. Per screen, the gate is: its existing unit test file plus its existing E2E spec(s) still pass after restyling. The reanimated web-export spike (above) is verified by running `expo export -p web` and confirming no build error, before screen work starts.

---

## Out of scope

- Web (`packages/web`) redesign — separate follow-up spec, sub-project 2
- Any new screens, routes, or feature changes
- Dark mode (reference design has no dark palette)
- Custom iconography — `@expo/vector-icons` (already installed) continues to cover icon needs
