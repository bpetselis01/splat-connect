# What "covered" means in the journey map

`scripts/journeys/journeys.json` has one row per element a Member, Maker or admin can use. Each row lists the layers that must test it. A layer is covered when a tagged test asserts the row's outcome at that layer. A test that only renders the screen, or only checks that a handler exists, does not count, even when it carries the tag. Reviewers apply this rule when they read a new test or a new tag.

Each layer asserts a different outcome. A unit test (`web-unit`, `mobile-unit`) asserts the arguments the handler sends, or the result of the pure logic behind the element. An e2e test (`web-e2e`, `mobile-e2e`) asserts what the user sees afterwards: the new row, the changed badge, the redirect, the copy. An `api` integration test asserts what the server stored: the database row, the notification and the count. A `device` flow (Maestro) asserts the same user-visible result on a real build, for the rows that need a phone: cold start, session persistence, deep links, native widgets.

A test case claims a journey by putting the id first in its title: `test('WD03 accept a build request', …)`, `it('G09 G10 thank and note', …)`, `it.each(rows)('G09 %s', …)`, or a Maestro flow's top-level `name: "A14 deep link cold start"`. Playwright `@tag` tokens may come before the ids. The claim sits beside the assertion that backs it, so title a test with an id only when it asserts that layer's outcome. `describe` titles, `.skip`, `.fixme`, `.todo`, comments and a dynamic `${id}` title claim nothing (the last is an error). A file-level `// journeys:` line survives only on the files in `scripts/journeys/legacy-file-tags.json`, which shrinks as files move their ids into titles; migrate a file all at once and delete its line and its legacy entry together. A file-level `// journeys: (none — reason)` opts a file out and needs a reason. Run `pnpm test:journeys` to see the gaps, and `pnpm test:journeys:write` to regenerate `docs/testing/journeys.md`.

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

A device cell counts only for a flow the `Maestro Android` job in `ci.yml` runs on every PR that touches the `mobile` path filter. A flow that has only run on a local simulator or phone proves nothing for the rule.

## Routes

Every web `page.tsx` and every mobile screen file needs a journey row naming it in `route`, or an entry in `scripts/journeys/routes-without-journeys.json` with the reason it has none. The check fails on a route with neither, on an entry whose route is gone or now has a row (delete it), and on a row whose `route` matches no file. A reason starting `TODO:` is a placeholder; the list only shrinks.

## Required layers and waivers

`check.mjs` rejects a row whose `required` is under-set. `kind` sets the minimum: a `static` row needs its platform's unit layer, a `nav` row adds the platform's e2e layer, and a `write` row adds `api`. A row may require more. Any `notifies` entry written as a notification type (snake_case, such as `toy_rejected`) needs `api`, because only the server stores the notification; prose entries such as `OTP mail` do not count. A row with an `api` call needs `api`. A `counts` entry sets no layer: a count read from the server is proven through its `api` call, and a count with no API call (step progress, filter counts, a tab badge) is proven at unit or e2e. `device: true` and a `device` entry in `required` go together in both directions. A waiver is `"waived": { "<layer>": { "reason": "...", "date": "YYYY-MM-DD" } }` on a layer the row requires; the reason is non-empty and the date is real and not in the future.
