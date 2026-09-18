# Features

One row per round, in the order we do them. Statuses: `todo` / `in progress` /
`needs db` / `awaiting review` / `done`.

**Kind** matters as much as status. Restyle = the route exists and changes
appearance. New build = the route does not exist yet — verified 2026-09-16, and
seven of the routes the brief names are in that column. A round that builds a
screen from nothing is not the same size as one that restyles it, and it is far
likelier to need a migration. See
`docs/superpowers/specs/2026-09-16-soft-pop-design.md` §6.

| # | Feature | Screens | Kind | Status | Needs DB | Verified by |
|---|---------|---------|------|--------|----------|-------------|
| 0 | Green the branch + ledgers | none | chore | done | no | local suite; CI blocked on the `workflow` scope |
| 1 | Design tokens + shared primitives | global (web `globals.css` + mobile `theme.ts`) | restyle | done | no | full suite + CI; /design-system vs artboard |
| 2 | `/dashboard` hub | `/dashboard` | restyle | awaiting review | 055 applied | full suite + CI; screenshot vs artboard |
| 3 | Exchanges list | `/dashboard/exchanges` | restyle | awaiting review | no | full suite; screenshot vs artboard |
| 4 | Exchange detail (canonical layout) | `/dashboard/exchanges/[id]` | restyle | awaiting review | 056 applied | full suite; screenshot vs artboard |
| 5 | Build detail | `/dashboard/exchanges/build/[id]` | new build | awaiting review | 057 applied | full suite + Playwright end to end; open makers-wanted board parked |
| 6 | Print requests + detail | `/dashboard/print-requests`, `/[id]`, `/printing/requests` | new build | awaiting review | 058 applied | full suite + Playwright end to end |
| 7 | Printers | `/dashboard/printers`, `/new` | new build | awaiting review | 058 applied | full suite + Playwright; org print orders render the same screen |
| 8 | Cost panel | component | restyle | awaiting review | 056 applied | full suite + Playwright; view and edit share one shell |
| 9 | Tutorials + saved | `/dashboard/tutorials`, `/dashboard/saved/*` | restyle | awaiting review | no | full suite; card type measured off the artboard |
| 10 | Organisation screens | `/dashboard/organisation/{profile,publish,recycling,orders}` | new build | awaiting review | 059 applied | full suite + Playwright; public org page consumes all of it |
| 11 | Get involved explainers | `/get-involved/*` | restyle | awaiting review | no | full suite; leads trimmed, step bodies left (safety copy) |
| 12 | Org onboarding + admin queue | `/get-involved/organisations/request`, `/admin/organization-requests` | new build | awaiting review | 060 applied | full suite + Playwright end to end |
| 13 | Retire the navigation rail | global (`app/layout.tsx`, `lib/trail.ts`) | new build | awaiting review | no | full suite + Playwright; the artboard's hub note settles it |
| 14 | `/design-system/states` | `/design-system/states` | new build | awaiting review | no | computed styles vs the artboard's `stateRows`, control by control |
| 15 | Events | `/get-involved/events/**`, `/dashboard/events`, `/dashboard/org/events/[id]`, `/dashboard/organisation/events/new` | new build | awaiting review | 061 applied | full suite + Playwright end to end; RSVP → manage screen |
| 16 | Stories | `/about/stories`, `/[id]`, `/dashboard/organisation/stories/new` | new build | awaiting review | 062 applied | full suite + Playwright; `/impact/news` redirects |
| 17 | Recycling | `/get-involved/recycling`, `/drop-off` | new build | awaiting review | 063 applied | full suite + Playwright; booked one end to end |
| 18 | Makers wanted | `/get-involved/makers-wanted`, `/new` | new build | awaiting review | 064 applied | full suite + Playwright; the board F5 parked |
| 19 | Admin queues + contact form | `/admin/{inbox,reports,build-requests,print-jobs,content}`, `/contact` | new build | awaiting review | 065 applied | full suite + Playwright; safety report reached the inbox |
| 20 | Request, wizard, org queue | `/toy-library/[id]/request`, `/onboarding/child`, `/dashboard/organisation/requests` | new build | awaiting review | no | full suite + Playwright; the wizard saved step one |
| 21 | The Learn course | `/learn` + 16 lessons | new build | awaiting review | no | full suite + Playwright; every lesson has a page and every page a place |
| 22 | The last scaffolds | `/learn/ask-an-expert`, `/about/{partners,support}`, `/dashboard/saved/organisations` | new build | awaiting review | no | full suite; `/impact/map` stays a scaffold on purpose |

## Scope, measured

**Closed on 2026-09-17.** The prototype's screen picker maps **119 screens to
routes**. Matched against the repo with dynamic segments and the five renames
accounted for, **all 119 have a route** — re-run the diff in
`docs/superpowers/specs/2026-09-16-soft-pop-routes.json` against `packages/web/app`
to check.

What that took, beyond the brief's twelve:

- **The rail is gone.** The artboard's own note on the My SPLAT hub is "replaces
  the old sidebar entirely", and none of its 119 screens draws one. Every account
  page carries the public header and a breadcrumb trail (`lib/trail.ts`).
- **`/learn` went from 6 lessons to 19**, as the extraction spec predicted. The
  build lessons and checkpoints are the artboard's own tables, extracted to
  `packages/web/lib/learn-content.json` rather than re-authored — they were
  written at a bench with a camera, and the 56 photographs are of the actual toys.
- **Five renames redirect rather than break.** `/toys` → `/toy-library`,
  `/learn/ask` → `/learn/ask-an-expert`, `/learn/safe-handling` →
  `/learn/safety-and-cleaning`, `/impact/news` → `/about/stories`,
  `/impact/events` → `/get-involved/events`.
- **Two screens stay scaffolds on purpose.** The artboard's own Deliveries map
  and Printable parts screens are "Not built yet" with a notify form. Shipping
  either would be inventing a feature the design does not have.

### Known gaps, deliberate

- **"Ask first" on the Makers wanted board.** The artboard draws it beside
  "I'll build this". It needs a thread on a request with no second party, and
  `toy_transaction_messages` is keyed to a transaction whose two sides are the
  whole basis of who may read it. Two buttons that both claim would be worse
  than one honest one.
- **Site content's Learn and Legal tabs are read-only.** The course outline
  lives in `lib/learn-course.ts` and the four legal documents in files. Editing
  a legal document can force every contributor to accept it again, which is not
  something to hang off an autosaving textarea — the artboard says the same.
- **`/impact/map` and `/printing/parts`** — see above.

Mobile screens are not in this table. F1 converts `packages/mobile/lib/theme.ts`
alongside the web tokens because `tone.test.ts` contrast-checks the same badge
bg/fg pairs on both sides; the mobile screen pass is scheduled separately, after
the web patterns have proven out once.
