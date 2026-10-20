# What "covered" means in the journey map

`scripts/journeys/journeys.json` has one row per element a Member, Maker or admin can use. Each row lists the layers that must test it. A layer is covered when a tagged test asserts the row's outcome at that layer. A test that only renders the screen, or only checks that a handler exists, does not count, even when it carries the tag. Reviewers apply this rule when they read a new test or a new tag.

Each layer asserts a different outcome. A unit test (`web-unit`, `mobile-unit`) asserts the arguments the handler sends, or the result of the pure logic behind the element. An e2e test (`web-e2e`, `mobile-e2e`) asserts what the user sees afterwards: the new row, the changed badge, the redirect, the copy. An `api` integration test asserts what the server stored: the database row, the notification and the count. A `device` flow (Maestro) asserts the same user-visible result on a real build, for the rows that need a phone: cold start, session persistence, deep links, native widgets.

A test case claims a journey by putting the id first in its title: `test('WD03 accept a build request', …)`, `it('G09 G10 thank and note', …)`, `it.each(rows)('G09 %s', …)`, or a Maestro flow's top-level `name: "A14 deep link cold start"`. Playwright `@tag` tokens may come before the ids. The claim sits beside the assertion that backs it, so title a test with an id only when it asserts that layer's outcome. `describe` titles, `.skip`, `.fixme`, `.todo`, comments and a dynamic `${id}` title claim nothing (the last is an error). A file-level `// journeys:` line with ids is malformed ("put the id in the test title"). A file-level `// journeys: (none — reason)` opts a file out and needs a reason. Run `pnpm test:journeys` to see the gaps, and `pnpm test:journeys:write` to regenerate `docs/testing/journeys.md`.

## Examples

### Unit

| Counts | Does not count |
|---|---|
| G09 "Thank" calls `POST /api/tutorials/:id/thanks` with the guide id, and the button shows its thanked state | `expect(screen.getByText('Thank')).toBeTruthy()` and nothing else |
| The filter logic returns only the Guides that match a chosen age and kind | A snapshot of the filter page |

### E2E

| Counts | Does not count |
|---|---|
| After "Accept" on an Exchange request, the thread shows the pickup step and the inbox badge drops by one | The thread screen loads without an error |
| A Member without the contributor terms is redirected to the terms screen, and the screen's copy shows | `page.goto('/terms')` followed by a check that the page title exists |

### API

| Counts | Does not count |
|---|---|
| Rejecting a Toy request writes the `toy_rejected` notification for the requester, with the link to the Exchange, and the requester's unread count rises by one | The route returns 200 |

### Device

| Counts | Does not count |
|---|---|
| The flow signs in, kills the app, relaunches it and asserts the Member is still on Home | A flow that launches the app and takes a screenshot |

A device cell counts for a flow under `packages/mobile/.maestro/flows/` that has been run on a phone or emulator with `pnpm device:test` before the change merges; the checker reads the flow files, not a run log, so the run is on the author. CI does not run the flows: the `Maestro Android` job was removed on 2026-10-20 (evening) after eight runs on the free runner (7.8 GB, 2 cores) never got past the first screen and exhausted the Actions allowance. The local recipe is in `docs/testing/maestro-ci-research-2026-10-20.md`.

The web auth rows WA30–WA38 (recovery, code sign-in, verify) read the emailed code out of local Supabase's mail catcher (Mailpit, port 54324) through `latestCode(email, after)` in `supabase/e2e-seed.ts`, which web and mobile e2e both re-export; the spec asserts the screen after the real code is typed, so the template and the code screen are both under test.

## Routes

Every web `page.tsx` and every mobile screen file needs a journey row naming it in `route`, or an entry in `scripts/journeys/routes-without-journeys.json` with the reason it has none. The check fails on a route with neither, on an entry whose route is gone or now has a row (delete it), and on a row whose `route` matches no file. A reason starting `TODO:` is a placeholder; the list only shrinks.

## Required layers and waivers

`check.mjs` rejects a row whose `required` is under-set. `kind` sets the minimum: a `static` row needs its platform's unit layer, a `nav` row adds the platform's e2e layer, and a `write` row adds `api`. A row may require more. Any `notifies` entry written as a notification type (snake_case, such as `toy_rejected`) needs `api`, because only the server stores the notification; prose entries such as `OTP mail` do not count. A row with an `api` call needs `api`. A `counts` entry sets no layer: a count read from the server is proven through its `api` call, and a count with no API call (step progress, filter counts, a tab badge) is proven at unit or e2e. `device: true` and a `device` entry in `required` go together in both directions. A waiver is `"waived": { "<layer>": { "reason": "...", "date": "YYYY-MM-DD" } }` on a layer the row requires; the reason is non-empty and the date is real and not in the future.

## Notifications and counts

`node scripts/journeys/notifications.mjs` (part of `pnpm test:journeys`) holds two lists to this rule. It reads the `NotificationType` union from `packages/types/src/index.ts` and fails on a type with no creator in `packages/api/src` or in a migration that inserts into `notifications` (a dead type: delete it, or allow-list it in the script with a dated reason), on a type with no asserting test, and on a row whose `notifies` names a type no longer in the union. A type's asserting test is an `it`/`test` in `packages/api/tests/integration/**` with the type's name in its title; it drives the real route as the real seat and asserts the notification row (type, recipient, link). `describe` titles do not count.

Server-side counts are a fixed list in the same script (`COUNTS`), one entry per number, keyed by the route that computes it. A count's test carries `counts:<name>` in its title, for example `counts:admin-counts.reports`, performs the action that moves the number through its route, reads the count before and after, and undoes the action. A test that reads a seeded fixture does not count. A new count is added to `COUNTS` in the commit that adds it; the generated `docs/testing/journeys.md` lists both tables.

## How to add a journey

1. Add a row to `scripts/journeys/journeys.json`. Pick the next free id: a letter plus two digits on mobile (`Q50`), `W` plus a letter plus two digits on web (`WM40`). Fill `platform`, `route` (the screen file or page route, which the route check matches against real files), `kind` (`static`, `nav` or `write`), `seat` (`anon`, `P`, `L` or `A`), `setter` (who puts the data in the state the screen shows: `n/a`, `P`, `L`, `A`, `web`, `mobile` or `none`), `screen`, `element`, `api`, `db`, `notifies`, `counts`, `device`, and `required`. Set `required` to the layers the row's `kind`, `api` and `notifies` demand (see "Required layers and waivers").
2. Put the id first in the title of each test that asserts the row's outcome, at every required layer: `test('Q50 approving a request tells the family', …)`. One test may carry several ids when it asserts all of them.
3. Run `pnpm test:journeys`, then `pnpm test:journeys:write` to regenerate `docs/testing/journeys.md`, and commit the regenerated file with the row.

If you forget something, the check says so. A route with no row prints `no journey row: web /foo`. A row with a layer lint failure prints the rule, for example `a row with an api call must require api` or `write requires api`. A required layer with no tagged test prints `Q50 api` under "Required layers with no tagged test". A file-level `// journeys:` line with ids prints `file-level tag: put the id in the test title`, and a dynamic `${id}` title prints `dynamic id in title`. A `notifies` type no test asserts, or a count with no `counts:<name>` test, fails `notifications.mjs`. A stale `docs/testing/journeys.md` prints `run pnpm test:journeys:write`. The notification matrix and the coverage map are both generated, so never edit them by hand.

A screen with no journey needs an entry in `routes-without-journeys.json` with a real reason; a reason that starts with `TODO:` fails the check.

## Re-audit 2026-10-20

After the ratchets closed, 100 rows (50 mobile, 50 web, at least 2 per id group, biased to rows with `api`, `notifies` or `counts`) were re-read against the tests that carry their ids. The full table is in `docs/testing/journeys-reaudit-2026-10-20.md`.

| Platform | Layer | Cells | OUTCOME | INTERACTION | RENDER | WRONG |
|---|---|---|---|---|---|---|
| mobile | mobile-unit | 50 | 48 | 1 | 1 | 0 |
| mobile | mobile-e2e | 50 | 48 | 2 | 0 | 0 |
| mobile | api | 45 | 44 | 1 | 0 | 0 |
| mobile | device | 3 | 3 | 0 | 0 | 0 |
| web | web-unit | 50 | 49 | 0 | 1 | 0 |
| web | web-e2e | 47 | 46 | 1 | 0 | 0 |
| web | api | 40 | 40 | 0 | 0 | 0 |

285 cells: 278 OUTCOME, 5 INTERACTION, 2 RENDER, 0 WRONG. The seven cells below OUTCOME are listed with their fixes in the re-audit file.
