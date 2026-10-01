# Picture-pass brief — iOS simulator against the mobile board

READ-ONLY. Do not edit repo files. Repo: `/Users/byronpetselis/Documents/splat-connect`.

Pairs: `scripts/parity/pairs/app-ios/<id>-<n>.png` (board left, iPhone 17e simulator right,
same width). Full size: `pairs/app/<id>.board.png` and `<id>.ios.png`. Route and role per
screen: `scripts/parity/app-screen-map.json`. Intent per screen:
`Splat Connect frontend overhaul/mobile-design-notes.md`. The board HTML:
`Splat Connect frontend overhaul/SPLAT Connect - Mobile.dc.html` (grep, sed ranges only).
App code: `packages/mobile`.

The numeric pass (the web export) already matched type, radii, colours, copy and
sections on every screen, and explained the rest in each row's `explained` list.
Report ONLY what a picture shows and the numbers cannot:
- safe area and status bar (content under the notch or clipped; hero meant to bleed under it)
- navigation chrome: a header the board does not draw, or the board's header missing
- sheets and modals presented differently (full screen versus sheet)
- layout: order of blocks, alignment, spacing that is clearly off (more than about 8pt)
- native text rendering that breaks a line or truncates where the board does not
Ignore sample data (names, counts, photos) and anything already in the row's
`explained` list. Disbelieve a finding that the data explains.

Output ONLY a JSON array, written with the Write tool to the file path given in your
prompt:
`[{"id": "<screen id>", "what": "<short, specific>", "board": "<what the board draws>",
"live": "<what the app draws>", "class": "styling|pending|intended|fixture",
"fix": "<packages/mobile file:line and change, for styling>"}]`
An empty array is a valid answer. Then reply with one line: the count.

Decided calls (2026-10-01): a centred iOS header title and the app's search on
Explore and Toys, Continue card on Learn and challenge filters are `intended`. Give a `pending` finding its registry id in `fix`
(ids in `packages/types/src/pending.ts`).
