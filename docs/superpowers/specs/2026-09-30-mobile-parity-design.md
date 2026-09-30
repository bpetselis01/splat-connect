# Mobile parity — design (sub-project 3 of 4)

Date: 2026-09-30 · Follows web parity (sub-project 2, closed 118/118) in the
plan set by `2026-09-30-pending-work-registry-design.md`. Measures the mobile
app against the Claude Design board
(`Splat Connect frontend overhaul/SPLAT Connect - Mobile.dc.html`, 61 screens
in `mobile-design-notes.md`) and closes what it finds.

## Decisions (Byron, 2026-09-30)

| Question | Decision |
|---|---|
| What the app runs on | Both, layered: the Expo web build at phone size gives the number; iOS simulator screenshots give the picture pass |
| Where the harness lives | Extend `scripts/parity`, sharing its engine with web |

## Goal and done

`scripts/parity/app-parity-report.json` shows **0 unexplained findings across
all 61 board screens**, picture-pass findings included, committed with the
harness documented. Every remaining difference is fixed in `packages/mobile`
or explained (intended, fixture, or an open pending-registry id).

Out of scope: Android (the board is iPhone-framed), and building registry
features (sub-project 4).

## Pieces

### `scripts/parity/app-screen-map.json`

One row per board screen, same fields and meanings as `screen-map.json`:

```json
{ "id": "guide_detail", "name": "Guide detail", "boardRoute": "guides/[id]",
  "route": "/guides/[id]", "sampleFrom": "/guides", "role": "parent",
  "seedRole": "leader", "derivedFrom": "…", "suffix": "…", "stateOnly": true,
  "skip": "reason", "explained": [ … ] }
```

- `id` is the board's `#hash`; `boardRoute` comes from `mobile-design-notes.md`;
  `route` is the expo-router path, mapped by hand where they disagree.
- `skip` (new, with a reason) is for a board template with no single app
  screen ("List screen", "Loading") when no representative route fits.
- The pending drift test (`packages/api/tests/unit/pending-features.test.ts`)
  reads both maps: a `pending` exemption must name an open registry id, every
  other exemption needs a `reason`.

### `scripts/parity/app.js` — the numeric runner

- Board: `http://localhost:8899/SPLAT%20Connect%20-%20Mobile.dc.html#<id>`,
  fingerprinted inside the `[data-screen-label]` element only, never the
  iPhone frame.
- App: the Expo web export at a 390×844 viewport, fingerprinted inside the
  screen body.
- Findings go through the shared `compare()` then `explain()` into
  `app-parity-report.json`. Flags as web: `--id`, `--group`, `--failing`,
  `--shots` (writes `pairs/app/<id>.board.png` / `.app.png`).

### Shared engine, options not forks

`fingerprint.js`, `compare.js`, `seed.js`, `auth.js` and `routes.js` are
shared. Mobile needs become options on them:

- `collectFingerprint(scope, { exclude })` — the app side drops its tab bar
  and stack header (selectors fixed in the runner).
- `role="heading"` counts as semantic, like `<h1>`–`<h6>`. React Native text is
  otherwise `<div>`s, found by the existing size and weight rule on both sides.
- Sign-in: the mobile web build keeps the Supabase session in localStorage, so
  `auth.js` gains a way to write the session there instead of the
  `@supabase/ssr` cookie.
- Seeds: `seed()` returns routes by screen id. App routes differ from web
  routes, so the seed returns record ids and each runner builds its own paths.

### Stack

`stack.sh up` adds the Expo web export (`expo export -p web` then
`serve -s dist`) on its own port, 3112, beside web :3110, API :3111 and the
artboard :8899. It uses an export, not the dev server, so HMR never interferes.
The API's `CORS_ORIGIN` must admit :3112. If it takes only one origin, the
runner's Chromium is launched with `--disable-web-security`, as the demo build
already needs.

### Picture pass — `scripts/parity/app-shots.sh`

- A Maestro flow (`packages/mobile/.maestro/parity/`) signs in, deep-links
  the iOS simulator to each mapped route (`splatconnect://…`) and saves a
  screenshot per screen id.
- `sidebyside.py` stitches `board | app` pairs.
- Agents judge the pairs by screen group, as the September web picture pass
  did. Each confirmed drift is recorded as a `picture` finding in
  `app-parity-report.json` (merged by screen id), so it is counted and
  explained like the numeric ones.
- It covers what the web build cannot see: safe areas (react-native-web
  reports `insets.top = 0`), sheets, native font rendering.

## Known asymmetries, handled up front

| Asymmetry | Handling |
|---|---|
| Board chrome (status bar, tab bar) is the iPhone frame | Board scoped to `[data-screen-label]`; app excludes its tab bar and header |
| React Native has no heading tags | Size and weight rule, plus `role="heading"` as semantic |
| Board sample data vs our rows | Existing data-volume, record-title and record-prose rules apply |
| Sheets and modals over another screen | Open the sheet via its route, or `stateOnly` |
| Board templates with no app screen | A representative route, or `skip` with a reason |
| Web build blind to safe area and native fonts | Not claimed by the number; the picture pass |

## Order of work

1. Harness: map, runner, shared-engine options, stack, their checks in `compare.test.js`.
2. First run, then triage every finding from the pictures before acting,
   disbelieving the harness first.
3. Fix real drift in `packages/mobile`, one commit per fix; explain the rest.
4. Picture pass; close or explain its findings.
5. Commit the reports, and document both harnesses in the header of `run.js` and `app.js`.

## Testing

- Each new `compare`/`fingerprint` option gets a check in `compare.test.js`.
- The drift test covers `app-screen-map.json` exemptions.
- Every mobile fix keeps green: mobile unit, mobile e2e (Playwright), the
  Maestro flows, and web parity at 118/118. Web and mobile e2e never run at
  once, and web e2e never runs while the parity stack is up (shared `.next`).
