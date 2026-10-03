# Mobile shell: floating tab bar, new tab set, page background fixes

Sub-project 3 of the 2026-10-02 mobile notes (notes 9, 10, 12). Mockup approved by Byron: https://claude.ai/artifact/6Bi9Q7Su9WQ5YmbwfhWkbd

## Outcome

The mobile app's bottom bar floats over the content as translucent glass, its four tabs are Home, Map, Inbox and Me, and the Explore, Guides and Toys pages lose their grey background and cramped spacing. Success is: scrolling a list shows it passing behind the bar; every old destination (Guides, Toys, Explore's screens) is still reachable in the same number of taps or fewer; the board parity and mobile route-parity checks stay green.

## What Byron said, and what I assumed

Said: tabs "Home, Map, Inbox, Me"; the bar should look like it floats, with the UI visible scrolling behind; Explore, Guides and Toys have a very small gap between the search bar and the cards and a weird grey background. Mockup approved with: Guides and Toys leave the bar and become Home shortcuts; pill bar; Inbox keeps its unread badge.

Assumed (correct me): the grey background is `surfaceSunken` or a mismatched `background` on those three screens. This is unverified, so the first plan task is to find the actual cause on a device-size render before changing any style. Home's customizable grid is sub-project 5 and the Map is sub-project 6, so this sub-project ships both tabs with minimal working content (below).

## Design

### 1. Floating translucent bar (`components/tab-bar.tsx`)

Today the bar is "in flow, not floating": a `shelf` View with a solid `background` colour sits under the content, so nothing can scroll behind it.

- The bar is positioned absolutely at the bottom: 14px side margins, `max(insets.bottom, 14)` from the bottom edge, 66px tall, pill radius. The shelf wrapper and its solid background go.
- Fill is glass: `expo-blur` `BlurView` (intensity ~60, light tint) under a 62% white overlay, hairline border, `theme.shadow(3)`. Android, where blur is weak, gets the same 62% white without blur; the bar stays legible either way.
- Every tab root screen gets bottom padding equal to bar height + offset (one exported constant, `TAB_BAR_CLEARANCE`) so the last row clears the bar. Pushed screens (no bar) are unaffected.
- `expo-blur` is a new native module: the iOS `ios/` dir needs `expo prebuild` and `pod install` (already needed for the removed `expo-video`; see memory `stale-ios-prebuild-dir`). Android is unaffected.
- Active tab, spring icon, haptic and badge behaviour are unchanged. The badge colour moves from apricot to danger red per the mockup only if it passes contrast; otherwise it stays apricot.

### 2. New tab set

Tab routes become `home`, `map`, `inbox`, `me`, with icons home, map, mail, person.

- `app/(tabs)/home/` is new. Until sub-project 5, its index renders the current Explore screen's feature list as Home's body (the same cards, same destinations), under a "Home" title. This makes Home useful on day one and gives sub-project 5 one screen to replace.
- `guides` and `toy-library` stay as routes (their screens, params and deep links are untouched) but become hidden tabs (`href: null`), exactly like `explore` is hidden today. Home's feature list links to them. Pushed from Home, they behave like any hidden-tab stack: no bar on a pushed child; the tab roots show it.
- `explore` is removed as a hidden tab and its content moves under `home/`. Old deep links to `/explore/*` keep working through redirects, because notification and email links may point there.
- `map` is a new route whose body is the board's "Not built yet" screen via a new pending entry `map-tab` (kind build, platform mobile), replaced in sub-project 6.
- A guide or toy opened from anywhere keeps its own stack; "back" from a hidden-tab root returns to Home.
- Me's "Explore" card, which exists only because Explore had no tab, is removed; Me keeps its other cards.

### 3. Page background and spacing fixes (Explore/Home, Guides, Toys)

First task in the plan is a diagnosis: render each screen at 390px in the simulator, identify what paints grey (candidates: `surfaceSunken` on a container, a `ScrollView` with its own background, the `Screen` wrapper's `background` against the page), and measure the gap between the search field and the first card. The fix is then one change at the cause, not per-screen patches.

- Target: every tab root uses `theme.colors.background` (`#faf9f7`) edge to edge, with no secondary grey ground behind cards.
- Gap between a search field and the content below it is `theme.spacing(4)` (16px) at least, via one shared constant used by the three screens.
- Guides and Toys get their final layout (hero, search, filter button) in sub-project 4; this sub-project only fixes ground and spacing so the shell is clean first.

### 4. Pending registry and parity

- Add `map-tab` to `packages/types/src/pending.ts` and regenerate `docs/PENDING.md`.
- Route parity (`mobile-nav-route-parity`) expects each web hub row to have a mobile screen and a my-routes line. Home's list keeps every existing row, so parity must stay green; the plan updates the parity map for the renamed tab roots.
- The artboard parity harness (`scripts/parity/app.js`, 60/61) is re-run for Guides, Toys, Explore and Me, and any `explained` entries that referenced the old bar are updated.

## Errors and edge cases

- Blur unavailable (web export, older Android): fall back to the solid 62% white fill; no crash.
- Unread badge >99 shows "99+".
- A signed-out or gated user never sees the bar (existing `useAuthGate` redirect unchanged).
- Large text sizes: tab labels cap at 1.3x so the pill stays 66px.

## Testing

- Unit: `TabBar` renders four tabs with the right names and routes; hidden routes (`guides`, `toy-library`, `explore`) get no button; the badge renders on Inbox; the bar is absolutely positioned and clears the home indicator (assert styles); `TAB_BAR_CLEARANCE` is applied by each tab root.
- Unit: `/explore/*` redirect targets resolve; Home's feature list links to every former Explore destination plus Guides and Toys.
- Route parity script green (`mobile-nav-route-parity`).
- Simulator: screenshots of Home, Guides, Toys, Inbox and Me at 390 and at the largest text size, scrolled so a list passes behind the bar; compare against the approved mockup.
- Maestro smoke flow still passes (Hermes layer).

## Out of scope

Home's customizable grid (sub-project 5), the Map and list view (6), the Guides/Toys hero and filter sheet (4).
