# Getting home from anywhere (mobile)

Date: 2026-10-06
Mockups: https://claude.ai/artifact/WdsP8zR1HCdjhdMCFs516n. The relevant rows are "What apps usually do" and "A cross instead of Back and Home".

## Problem

Content links loop: guide → also worth a look → creator → organisation → toy → guide. Each hop pushes a screen, so the trail never ends. Today the only way out is Back, tapped once per screen.

## Decision

Byron looked at these options on 2026-10-06:

- a Home button in the header (built, then removed);
- a trail under the header;
- the tab bar on every screen, stacked and hiding on scroll (built, then reverted);
- holding Back to see the history;
- replacing a guide instead of pushing.

He chose **the cross**. Every screen without the tab bar has a ✕ at the top left where Back was. One tap closes the whole trail and lands on the last screen that showed the tab bar. One page back is iOS's edge swipe or Android's system Back.

## Design

- The tab bar stays where it was: on the tab roots only. Those are Home, Map, Inbox and Me, plus the guide and toy libraries, at depth 0.
- `lib/last-bar-path.ts` records the last tab root the bar was shown on. `TabBar` calls `rememberBarPath` whenever it renders.
- `CloseToTabsButton` in `components/ui/CloseButton.tsx` is the `headerLeft` in `lib/nav-options.ts`, so every stack screen gets it from one place. On a tap it calls `closedState()` (`lib/close-to-tabs.ts`) and dispatches the result as one `CommonActions.reset`, which does three things:
  - drops anything pushed over the tabs, such as the (my) and printing stacks;
  - trims the tab you were in, and the tab you land on, back to their first screen;
  - selects the landing tab.
- Why not the router's own calls: in this expo-router, `router.navigate` pushes a fresh copy in a stack, and `router.dismissTo` only works inside one stack.
- The guide editor's ✕ flushes the draft first. Its autosave is debounced by 250ms, and leaving the editor clears the pending save.
- Sheets and modals (Add a guide, Ask for a build, Request a print), build mode and the photo viewer keep their own ✕. Those close only themselves.
- The Home button (option B) is gone.

## Testing

- **Unit:** `close-to-tabs.test.ts` checks the state rewrite on the real state shape, including expo-router's `__root` wrapper. `hidden-tab-back.test.tsx` checks the ✕ on the real layouts:
  - it closes a three-guide trail to Home;
  - it lands on the guide list when the trail started there;
  - it closes a (my) screen together with the trail under it;
  - each time, the tab bar is showing afterwards.

  `tutorial-editor-back.test.tsx` checks that the editor saves before it closes.
- **E2E:** `home.spec.ts` closes a guide back to the guide list, and a guide opened from Home back to Home.
