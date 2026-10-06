# Getting home from anywhere (mobile)

Date: 2026-10-06
Mockups: https://claude.ai/artifact/WdsP8zR1HCdjhdMCFs516n, rows "Getting home from anywhere" and "B and C on the guide page".

## Problem

The tab bar (Home · Map · Inbox · Me) showed only on the tab roots. Every other
screen hid it, and content links into a loop (guide → also worth a look →
creator → organisation → toy → guide …). Each hop pushes a screen, so the trail
never ends and the only way out was Back, once per screen.

## Decision

Byron compared A (tab bar on every screen), B (a Home button in the header) and
C (a trail under the header), and a close cross. He rejected B, C and the cross
and chose **A: the tab bar on every signed-in screen, with hide-on-scroll** on
reading pages. The usual Back arrow stays in the header.

## Design

- `components/tab-bar.tsx` is one global overlay, rendered by `app/_layout.tsx`
  after the root `<Stack/>`. It used to be the Tabs navigator's bar, which could
  never show on `(my)` and `printing`: they are siblings of `(tabs)` in the root
  stack. `(tabs)/_layout.tsx` now passes `tabBar={() => null}`.
- `lib/tab-bar-routes.ts` is a table, first match wins, from the route segments
  to `{ show, lit }`. Hidden: `(auth)`, `(onboarding)`, `terms`, the conversation
  screens (exchange thread, build thread, org conversations, challenge detail,
  print job), and the sheets and build mode (native modals cover the bar on a
  phone; web draws them as plain screens). Home, Guides, Toys and Explore light
  Home. Screens pushed over the tabs (`(my)`, `printing`, `not-built`) light the
  last tab the user was on, Me by default.
- A tap runs `router.navigate('/<tab>')`, which unwinds to that tab's root even
  from deep in a stack or off a pushed screen.
- `lib/tab-bar-visibility.ts` holds one shared value, `tabBarHidden` (0 shown,
  1 hidden), and `useHideTabBarOnScroll()`: hide after about 10px of travel down
  past y 40, show after about 10px of travel up or near the top. The bar resets
  to shown on every path change and slides off the bottom by animating it.
- Clearance. `stackScreenOptions.contentStyle` pads every stack scene by
  `tabBarClearance`, so a footer or last row never sits under the bar.
  `noBarClearance` opts out: stack roots and reading pages that pad their own
  scroll content, sheets, build mode, chats and the first run.
- Reading pages (guide, toy, Learn article and hub, creator and organisation
  profiles) call the scroll hook. A pinned band (`components/ui/BarBand.tsx`:
  the guide's Start building, the article's Next) sits just above the bar and
  drops to the bottom edge, clearing the home indicator, when the bar slides
  away. Its page pads its scroll content by the band's height plus `barLift`.

## Removed

The option B Home button (`HomeButton`, `WithHome`, the shared `headerRight`,
the not-built Home button and `nav-home.spec.ts`).

## Not verified here

iOS-only insets (the web build reports `insets.bottom = 0`), the keyboard over a
form that is also padded for the bar, and the slide on a device.
