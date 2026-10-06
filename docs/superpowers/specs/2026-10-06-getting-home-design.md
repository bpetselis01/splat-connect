# Getting home from anywhere (mobile)

Date: 2026-10-06
Mockups: https://claude.ai/artifact/WdsP8zR1HCdjhdMCFs516n, rows "Getting home from anywhere" and "B and C on the guide page".

## Problem

The tab bar (Home · Map · Inbox · Me) shows only on the tab roots: Home, Map,
Inbox, Me, the guide library and the toy library. Every other screen hides it,
and content links into a loop (guide → also worth a look → creator →
organisation → toy → guide …). Each hop pushes a screen, so the trail never
ends and the only way out is Back, once per screen.

## Decision

Byron compared three options (A: tab bar on every screen; B: a Home button in
the header; C: a trail under the header). He ruled A out as clutter and chose
**B**: every screen without the tab bar has a Home button at the top right of
its header; a screen with the tab bar never has one.

## Design

- `components/ui/HomeButton.tsx`: a pill (house icon + "Home", accent tint)
  that calls `router.navigate('/home')`, unwinding to the Home tab already in
  the stack. `WithHome` puts a screen's own header button beside it.
- `lib/nav-options.ts` sets `headerRight` to HomeButton for every stack, so all
  drill-down screens get it from one place. Tab roots draw no header.
- Screens that already had a right-hand button keep it beside Home: My
  tutorials (Add a tutorial), Design challenges (Submit an idea), and the guide
  editor (its save status).
- The "Not built yet" screen has no header; it gets a Home button under Go
  back, only when signed in (it also opens before sign-in).

### Exceptions (no Home)

- Sign-in screens and first-run onboarding: there is no Home yet.
- The terms screen that must be accepted.
- Sheets that slide up with a close: Add a guide, Ask for a build, Request a
  print (`headerRight: () => null`).
- Full-screen build mode and the delete-account flow: each has its own close,
  and closing lands on a screen that has Home.

### Not in this change

The B mockup labelled Back with the previous page's name. Most screens have
generic titles ("Guide"), so that label is a separate change if wanted.

## Testing

- Unit: HomeButton goes to /home; the shared header options render it;
  WithHome keeps a screen's own button; Not built yet shows Home only when
  signed in.
- E2E (`tests/e2e/nav-home.spec.ts`): from an organisation reached through a
  guide, Home is one tap; Learn carries one Home and it goes Home. The full
  mobile e2e suite passes with the new header button.
