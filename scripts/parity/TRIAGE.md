# Triage brief — mobile app parity findings

READ-ONLY. Do not edit files. Repo: `/Users/byronpetselis/Documents/splat-connect`.

`scripts/parity/app.js` compares the mobile app (Expo, `packages/mobile`, measured as its
web export at 390×844) with the Claude Design mobile board. Findings per screen are in
`scripts/parity/app-parity-report.json` (`screens[].findings`, `route`).

- Pictures: `scripts/parity/pairs/app/sbs/<id>-<n>.png` (board left, app right, full
  scale). Full size: `pairs/app/<id>.board.png` and `<id>.live.png`.
- Screen id → app route: `scripts/parity/app-screen-map.json`.
- The board: `Splat Connect frontend overhaul/SPLAT Connect - Mobile.dc.html` (390 KB;
  grep a screen's copy or `'<id>'`, and use sed ranges only). Per-screen intent:
  `Splat Connect frontend overhaul/mobile-design-notes.md`.
- Tokens: `Splat Connect frontend overhaul/splat-soft-pop.tokens.json`, the app's
  `packages/mobile/lib/theme.ts`.
- The registry of unbuilt work: `packages/types/src/pending.ts`.

The harness has often measured itself. React Native web renders text as
`<div dir="auto">`, headings as `role="heading"` or bold text, and fonts as
`Baloo2_800ExtraBold` (normalised to "Baloo 2" at 800). Fields are a bare `<input>`
inside a styled view. Disbelieve a finding until the picture and the code confirm it.
A finding that appears on many screens at once is more likely the harness.

Classify EVERY finding on your screens as exactly one of:

- **styling:** real visual drift. Give the `packages/mobile` file:line, the exact
  change, and the board or token value that justifies it.
- **pending:** a board feature the app lacks. Give the `pending.ts` id, or say
  "unregistered" and propose an id plus a one-line blurb.
- **fixture:** board sample data against our seeded data. Say whether a cheap, honest
  change to `scripts/parity/seed.js` would remove it; otherwise it gets an exemption.
- **intended:** the app differs on purpose. Give a one-line reason (what it does for
  users), with evidence (a code comment, a registry decision, a memory).
- **harness-bug:** the measurement is wrong. Say what it mis-measures and the fix.

Output: one line per finding, in the form
`<screen> | <finding type + what> | <class> | <detail/fix>`. Then at most 5 lines of
notes. No preamble.
