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
| 6 | Print requests + detail | `/dashboard/print-requests`, `/[id]` | new build | todo | | |
| 7 | Printers | `/dashboard/printers` | new build | todo | | |
| 8 | Cost panel | component | restyle | awaiting review | 056 applied | full suite + Playwright; view and edit share one shell |
| 9 | Tutorials + saved | `/dashboard/tutorials`, `/dashboard/saved/*` | restyle | awaiting review | no | full suite; card type measured off the artboard |
| 10 | Organisation screens | `/dashboard/organisation/*` | new build | todo | | |
| 11 | Get involved explainers | `/get-involved/*` | restyle | awaiting review | no | full suite; leads trimmed, step bodies left (safety copy) |
| 12 | Org onboarding + admin queue | `/dashboard/organisation`, `/admin` | new build | todo | | |

## Scope, measured

The brief's 12 features are a starting order, not the scope. The prototype's own
screen picker maps **119 screens to routes**; matched against the repo with
dynamic segments accounted for, **71 have a route and 48 do not**. The full list
is `docs/superpowers/specs/2026-09-16-soft-pop-routes.json`, and the breakdown is
in §3 of the extraction spec beside it.

Three things that changes:

- **`/learn` goes from 6 lessons to 19.** Thirteen new lessons — three named
  builds, four checkpoints, wiring a connector, handover. That is a content
  project, not a restyle, and `uploads/` holds the workshop printout and the Ms
  Rachel maker guide they are presumably drawn from.
- **Some "missing" routes are renames.** `/toys` is today's `/toy-library`,
  `/learn/ask` is `/learn/ask-an-expert`. Those need redirects, not screens.
- **`/design-system` and `/design-system/states` are real routes in the
  prototype.** The first now exists.

Mobile screens are not in this table. F1 converts `packages/mobile/lib/theme.ts`
alongside the web tokens because `tone.test.ts` contrast-checks the same badge
bg/fg pairs on both sides; the mobile screen pass is scheduled separately, after
the web patterns have proven out once.
