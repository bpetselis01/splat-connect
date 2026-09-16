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
| 0 | Green the branch + ledgers | none | chore | in progress | no | |
| 1 | Design tokens + shared primitives | global (web `globals.css` + mobile `theme.ts`) | restyle | todo | no | |
| 2 | `/dashboard` hub | `/dashboard` | restyle | todo | | |
| 3 | Exchanges list | `/dashboard/exchanges` | restyle | todo | | |
| 4 | Exchange detail (canonical layout) | `/dashboard/exchanges/[id]` | restyle | todo | | |
| 5 | Build detail | `/dashboard/exchanges/build/[id]` | new build | todo | | |
| 6 | Print requests + detail | `/dashboard/print-requests`, `/[id]` | new build | todo | | |
| 7 | Printers | `/dashboard/printers` | new build | todo | | |
| 8 | Cost panel | component | restyle | todo | | |
| 9 | Tutorials + saved | `/dashboard/tutorials`, `/dashboard/saved/*` | restyle | todo | no | |
| 10 | Organisation screens | `/dashboard/organisation/*` | new build | todo | | |
| 11 | Get involved explainers | `/get-involved/*` | restyle | todo | no | |
| 12 | Org onboarding + admin queue | `/dashboard/organisation`, `/admin` | new build | todo | | |

Mobile screens are not in this table. F1 converts `packages/mobile/lib/theme.ts`
alongside the web tokens because `tone.test.ts` contrast-checks the same badge
bg/fg pairs on both sides; the mobile screen pass is scheduled separately, after
the web patterns have proven out once.
