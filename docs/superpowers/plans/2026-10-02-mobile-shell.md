# Mobile Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Float the mobile tab bar as translucent glass, change the tabs to Home / Map / Inbox / Me, and fix the grey ground and cramped search spacing on Explore, Guides and Toys.

**Architecture:** The custom `TabBar` (`packages/mobile/components/tab-bar.tsx`) moves from in-flow to absolutely positioned over the content, with a `BlurView` plus a translucent white overlay. Tab roots reserve space through one constant. `home` and `map` are new tab routes; `guides`, `toy-library` and `explore` stay as hidden tabs, so every existing route and deep link is unchanged.

**Tech Stack:** Expo 57 / expo-router 57, React Native, react-native-reanimated, `expo-blur` (new), jest + @testing-library/react-native, Playwright mobile e2e, XcodeBuildMCP simulator.

**Spec:** `docs/superpowers/specs/2026-10-02-mobile-shell-design.md`. One deviation, decided while writing this plan: the spec said Explore's screens would move under `home/` with redirects. Explore is already a hidden-tab stack with ~10 screens and many links (`/explore/learn`, `/explore/challenges`, `/explore/recycling`, `/explore/about`...). They stay where they are, so no redirect is needed and no link can break. Home's tab root renders the Explore feature list; the `explore` index route stays but nothing links to it (Me's "Everything in Explore" row goes).

## Global Constraints

- Tab labels exactly: `Home`, `Map`, `Inbox`, `Me`; order exactly that.
- Bar: pill, 66px tall, 14px side margins, bottom offset `max(insets.bottom, 14)`, fill `rgba(255,255,255,0.62)` over a blur (intensity 60, tint light), hairline `theme.colors.border`, `theme.shadow(3)`.
- Page ground is `theme.colors.background` (`#faf9f7`) on every tab root; gap under a search field is at least `theme.spacing(4)`.
- Inbox badge: red (`theme.colors.danger`) only if white text on it passes 4.5:1 (it is `#e05252`: 3.82:1, so it does NOT pass); keep the apricot badge with `ink` text as today.
- Soft Pop tokens only (`lib/theme.ts`); no new literal colours except the 62% white.
- Models: Sonnet or Haiku only for any sub-agent. Commit with explicit paths, one commit per task, ending with:
  `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01WpofdMRBNWRR4MQ8uMVLiV`.
- Never run web and mobile e2e at the same time; `lsof` the e2e port first (memory: stale e2e server reuse).
- No push.

## Review Focus

- Large text size: tab labels must not push the pill taller than 66px (cap `maxFontSizeMultiplier` at 1.3).
- Blur unavailable (web export, jest, old Android): bar still renders with the plain 62% white fill and no crash.
- A list's last row on every tab root clears the bar and the home indicator (padding = `TAB_BAR_CLEARANCE`).
- Opening `/guides` or `/toy-library` directly (deep link, notification) shows the bar with Home highlighted; a pushed child (`/guides/[id]`) shows no bar.
- Unread badge 100+ renders `99+` and does not overflow the tab.

---

### Task 1: Floating glass bar

**Files:**
- Modify: `packages/mobile/components/tab-bar.tsx`
- Create: `packages/mobile/lib/tab-bar-layout.ts`
- Modify: `packages/mobile/package.json` (add `expo-blur`)
- Test: `packages/mobile/tests/unit/components/tab-bar.test.tsx`

**Interfaces:**
- Produces: `export const TAB_BAR_HEIGHT = 66`, `export const TAB_BAR_OFFSET = 14`, `export function tabBarClearance(insetBottom: number): number` returning `TAB_BAR_HEIGHT + Math.max(insetBottom, TAB_BAR_OFFSET) + theme.spacing(3)` — the bottom padding a tab root must reserve.
- Consumes: `theme` from `lib/theme.ts`.

- [ ] **Step 1: Install the module.** From `packages/mobile`: `npx expo install expo-blur`. Confirm it appears in `package.json` and `pnpm-lock.yaml`. Add `jest.mock('expo-blur', ...)` to `jest-setup.js` rendering `View` for `BlurView` (check how other native modules are mocked there first).
- [ ] **Step 2: Write failing tests** in `tab-bar.test.tsx` (read the existing file first and keep its helpers): the bar element (`testID="tab-bar"`) has `position: 'absolute'`, `left: 14`, `right: 14`, `height: 66`, `bottom` equal to `Math.max(insets.bottom, 14)`; there is a `BlurView` child; `tabBarClearance(34)` equals `66 + 34 + 12`, `tabBarClearance(0)` equals `66 + 14 + 12`; label `Text` has `maxFontSizeMultiplier={1.3}`; a badge of 150 shows `99+`.
- [ ] **Step 3: Run** `pnpm --filter @splat-connect/mobile exec jest tests/unit/components/tab-bar.test.tsx` — expect FAIL.
- [ ] **Step 4: Implement.** Create `lib/tab-bar-layout.ts` with the three exports above. In `tab-bar.tsx` drop the `shelf` wrapper and its `backgroundColor`; render `<View testID="tab-bar" style={[styles.bar, { bottom: Math.max(insets.bottom, TAB_BAR_OFFSET) }]}><BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />{items}</View>` with `styles.bar = { position: 'absolute', left: 14, right: 14, height: TAB_BAR_HEIGHT, flexDirection: 'row', padding: 6, borderRadius: theme.radii.pill, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.62)', borderWidth: theme.border.hairline, borderColor: theme.colors.border, ...theme.shadow(3) }`. (`overflow: 'hidden'` clips the blur to the pill; if the shadow vanishes on iOS, wrap in an outer shadow View and keep the clip on an inner one.) Add `maxFontSizeMultiplier={1.3}` to the label; cap the badge text with `badge > 99 ? '99+' : String(badge)`.
- [ ] **Step 5: Run the tab-bar tests** — expect PASS. Run `pnpm --filter @splat-connect/mobile exec tsc --noEmit`.
- [ ] **Step 6: Apply the clearance to every tab root.** Find the scroll containers of the roots (`components/home/library-screen.tsx`, `components/inbox/inbox-screen.tsx`, `app/(tabs)/me.tsx`, `components/explore/explore-screen.tsx`, the toy library screen, and the Home and Map screens from Task 2) and add `paddingBottom: tabBarClearance(insets.bottom)` to each `ScrollView`/`FlatList` `contentContainerStyle`, using `useSafeAreaInsets()`. Add one unit test per root asserting its content container carries that padding (render with the safe-area mock; follow how existing screen tests mock insets).
- [ ] **Step 7: Commit** `feat(mobile): the tab bar floats as translucent glass over the content`.

### Task 2: Home / Map / Inbox / Me tabs

**Files:**
- Modify: `packages/mobile/app/(tabs)/_layout.tsx`
- Create: `packages/mobile/app/(tabs)/home/_layout.tsx`, `packages/mobile/app/(tabs)/home/index.tsx`, `packages/mobile/app/(tabs)/map.tsx`
- Modify: `packages/mobile/components/tab-bar.tsx` (HIDDEN set, ICONS, focused mapping)
- Modify: `packages/mobile/components/explore/explore-screen.tsx` (a `home` presentation: title "Home", own header, no back button)
- Modify: `packages/mobile/app/(tabs)/me.tsx:55-63` (remove the "Everything in Explore" row and its comment; remove the Explore eyebrow card only if it becomes empty — read lines 240-270 first)
- Modify: `packages/types/src/pending.ts` (entry `map-tab`), regenerate `docs/PENDING.md` with `node scripts/pending.mjs`
- Test: `tests/unit/components/tab-bar.test.tsx`, `tests/unit/app/tabs-layout.test.tsx` (create if absent), `tests/unit/components/explore-screen.test.tsx` (extend)

**Interfaces:**
- Consumes: `TabBar`, `tabBarClearance` (Task 1); `ExploreScreen` (current default export of `components/explore/explore-screen.tsx`).
- Produces: tab route names `home`, `map`, `inbox`, `me`; hidden: `guides`, `toy-library`, `explore`. `BAR_ROOTS = new Set(['home','map','inbox','me','guides','toy-library'])` and `BUTTONS = ['home','map','inbox','me']` inside `tab-bar.tsx`. Rule: the bar renders when the current route is in `BAR_ROOTS` and its stack depth is 0; the focused button is `current.name` if it is in `BUTTONS`, else `home`.

- [ ] **Step 1: Failing tests.** In `tab-bar.test.tsx`: with routes `[home, map, inbox, me, guides, toy-library, explore]`, exactly four tab buttons render, in the order Home, Map, Inbox, Me; with `state.index` on `guides` the Home button has `accessibilityState.selected === true`; on `guides` at depth 1 and on `explore` at any depth the bar returns null; unread badge stays on Inbox only. In the layout test: `Tabs.Screen` entries `guides`, `toy-library`, `explore` have `href: null`; `home` is the first screen. In the explore-screen test: with `variant="home"` the title reads "Home" and no back button is rendered.
- [ ] **Step 2: Run them** — expect FAIL.
- [ ] **Step 3: Implement the layout.** `_layout.tsx` screens in order: `home` (title `Home`), `map` (`Map`), `inbox` (`Inbox`), `me` (`Me`), then `guides`, `toy-library`, `explore` each with `options={{ href: null }}`. Keep the existing `badges` wiring. In `tab-bar.tsx`: `ICONS` gets `home: { on: 'home', off: 'home-outline' }`, `map: { on: 'map', off: 'map-outline' }`; replace `HIDDEN` with `BAR_ROOTS`/`BUTTONS` as specified above; the `items` list maps over `BUTTONS` (find each route by name); `focused` uses the mapping rule.
- [ ] **Step 4: Home screen.** `app/(tabs)/home/_layout.tsx` is a `Stack` with `stackScreenOptions` (copy the pattern from `app/(tabs)/explore/_layout.tsx`) and `unstable_settings = { initialRouteName: 'index' }`; `index.tsx` renders `<ExploreScreen variant="home" />`. In `ExploreScreen` add the optional `variant?: 'explore' | 'home'` prop: `home` hides the stack-header back affordance and shows a "Home" title with the shared animated Mascot in the way `TabHero` does for the library screens. Everything else (search, door cards, impact block, destinations) is unchanged. Add to the Home list two door cards at the top, **Guides** (`/guides`) and **Toys** (`/toy-library`), in the same `DoorCard` style, since those tabs are gone; check no duplicate entry already exists.
- [ ] **Step 5: Map placeholder.** Add to `pending.ts` an entry `'map-tab'`: `{ title: 'Map', blurb: 'The map of toys, printers, events and drop-offs near you is coming.', kind: 'build', platforms: ['mobile'], needs: 'Map pins, filters and list view (sub-project 6 of the 2026-10-02 notes)' }`. `app/(tabs)/map.tsx` renders the same pending component the other screens use for a drawn-but-off feature (grep `pending=` / `NotBuilt` in `components/` and reuse it; code refers to it as `pending="map-tab"`). Run `node scripts/pending.mjs`; the drift test `packages/api/tests/unit/pending-features.test.ts` must pass.
- [ ] **Step 6: Me.** Remove the "Everything in Explore" row; keep Recycling, Learn, Design challenges, About rows; nothing may link to `/explore` (the index) any more. Update `me` tests.
- [ ] **Step 7: Run** `pnpm --filter @splat-connect/mobile exec jest` (full), `tsc --noEmit`, and the route parity script (`grep -rn "route parity\|nav-parity" ../../scripts packages/mobile/tests -l` to find it; memory note `mobile-nav-route-parity`). Update the parity map for the renamed roots. Expect all green.
- [ ] **Step 8: Commit** `feat(mobile): tabs are Home, Map, Inbox and Me; Guides and Toys move onto Home`.

### Task 3: Grey ground and search gap

**Files:** diagnosis first; likely `components/home/library-screen.tsx`, `components/explore/explore-screen.tsx`, the toy library screen, `components/ui/Screen.tsx`, `components/ui/TextField.tsx`. Create `lib/layout.ts` exporting `SEARCH_GAP = theme.spacing(4)` only if three screens share it.
- Test: one render test per screen asserting its root/scroll `backgroundColor` is `theme.colors.background` and the gap style below the search.

- [ ] **Step 1: Diagnose on the simulator** (XcodeBuildMCP: `session_show_defaults`, `build_run_sim`, `screenshot`) at 390pt for Home (Explore list), Guides and Toys. Record which element paints grey (candidates: a `surfaceSunken` container, a `ScrollView`/`FlatList` with its own colour, a bare `View` between `Screen` and the list, iOS default scroll background). Write the finding (element, file:line, colour) in the commit message. If the grey does not reproduce, say so and stop this task rather than guessing.
- [ ] **Step 2: Failing tests** for the identified cause (root/scroll background token, search field bottom spacing >= 16).
- [ ] **Step 3: Fix at the cause**, not per screen where one shared component is the cause.
- [ ] **Step 4: Re-screenshot** the three screens plus Inbox and Me at 390pt and at the largest text size, scrolled so a list passes behind the bar; save them to the scratchpad directory.
- [ ] **Step 5: Run** mobile jest + tsc. **Commit** `fix(mobile): one page ground and a proper gap under the search field`.

### Task 4: Regression pass

- [ ] **Step 1:** Run the artboard parity harness for mobile (`scripts/parity/app.js`, memory `artboard-parity-harness`; serve a fresh export, do not reuse a stale server) on Guides, Toys, Explore/Home, Inbox and Me. Update `explained` entries that referred to the old in-flow bar; no new unexplained diff may remain.
- [ ] **Step 2:** Run the phone-width audit (`scripts/parity/mobile.js` at 390px). Expect no new findings.
- [ ] **Step 3:** Run the Maestro smoke flow (memory `mobile-hermes-runtime-parity`) and the mobile Playwright e2e specs that tap the tab bar (`grep -rn "tab-bar\|Guides\|Toys" packages/mobile/tests/e2e -l`), updating selectors that expected Guides/Toys tabs. Check `lsof` for the e2e ports first.
- [ ] **Step 6: Wrap up:** `node scripts/pending.mjs`, `graphify update .`, commit parity reports `chore(parity): reports after the mobile shell`.

## Self-review

- Spec coverage: floating bar (T1), new tabs + Home body + Map placeholder + Me cleanup + pending entry (T2), grey/gap diagnosis and fix (T3), parity and tests (T4). The `/explore/*` redirect item is dropped on purpose (routes unchanged, noted at top).
- No deep-link regressions: `guides`, `toy-library`, `explore` keep route names, so existing links, notifications and e2e URLs resolve unchanged.
- Type consistency: `TAB_BAR_HEIGHT`, `TAB_BAR_OFFSET`, `tabBarClearance`, `BAR_ROOTS`, `BUTTONS` are defined in T1/T2 and used consistently.
