# Content hand-off: what only Byron can supply

**Date:** 2026-10-19
**Status:** Waiting on Byron. Everything here is in `packages/types/src/pending.ts` under `kind: "content"`.

Research (2026-10-19) found no public record of the organisation (ABN Lookup,
guessed domains, web; ACNC timed out), so org facts and the team cannot be
researched. Legal text cannot be written here (the pages forbid placeholder legal
language). Byron chose his own photos over stock. So each item below is a
fill-in: supply the answer and the code change is a paste.

## 1. Organisation facts → `packages/web/lib/org-facts.ts`

| Field | What to give | Example of the shape |
|---|---|---|
| `legalName` | The name on the ABN / ACNC / association register. If unincorporated, the name the group uses and say so. | "SPLAT Connect Inc." |
| `basedIn` | City and state | "Sydney, NSW" |
| `founded` | Year | "2025" |
| `contactEmail` | A role address you will read, not a personal Gmail | "hello@<domain>" |

The about tests turn from `it.todo` to real assertions once `legalName` and `basedIn` are set.

## 2. Team → `TEAM_MEMBERS` in `packages/web/app/about/team/page.tsx`

Per person: name, role, a 2–3 sentence bio, optionally what they do for a living
(the page promises "everyone here does something else for a living"), and a
square headshot (optional; initials show without one). The first person listed
gets the large card. Get each person's OK to publish their name and photo.

## 3. Photos (7 slots, your own, no stock)

For every photo:
- Landscape, at least 1600 px wide; the app crops to fill, so keep the subject centred with space around it.
- **No children's faces.** Hands are fine, and with consent from the parent.
- No brand logos facing the camera. Daylight by a window beats a flash.
- Send the originals; they get resized and compressed when added.

| Slot | Screen | What to shoot | Why |
|---|---|---|---|
| `toy-adaptation-101` | Learn: Toy adaptation 101 | A battery toy with its battery cover off and a battery interrupter, with its 3.5 mm socket, sitting in the compartment. Close up, on a plain table. | The article's core idea is the interrupter; one photo shows it. |
| `switch-types` | Learn: Switch types explained | Three or four switches side by side: a big button switch, a lever or a grasp switch, all plugged into nothing. Shot from above. | The article compares switch types; a line-up says that at a glance. |
| `choosing-a-toy` | Learn: Choosing a toy to adapt | Two or three good candidate toys (a simple on/off battery toy that moves or lights up) on a table, with the battery covers visible. | "Signs a toy will be easy": an obvious battery compartment. |
| `tools-and-materials` | Learn: Tools and materials | The article's *minimum* kit laid out neatly: a small Phillips screwdriver set, wire strippers, a coil of stranded hook-up wire, a few 3.5 mm mono sockets, heat-shrink. No soldering station. | The article starts with "The minimum"; a cluttered bench would contradict it. |
| `safety-and-cleaning` | Learn: Safety and cleaning | An adapted toy being wiped with a cloth, plus the battery cover screwed shut. Adult hands only. | The article's three hazards include batteries; show the cover closed. |
| `printing-basics` (article) | Learn: 3D printing basics | A desktop printer mid-print, close on the nozzle and the first layers, with a reel of filament beside it. | Matches "Which filament" and "Settings that matter". |
| `printing-basics-hero` | Printing → Printing basics screen | A finished printed part next to the toy or aid it belongs to, e.g. a printed switch mount or knob. | This screen is the door into printing for families, so show the result, not the machine. |

The two `printing-basics` photos can come from one session. Send them in and the
slots get wired up (an optional `hero` per Learn article, plus the basics screen).

## 4. Legal: contributor terms, leader terms, intended purpose, terms version

Waiting on the lawyer. The review pack is the private Claude doc Byron holds;
a research memo with sources (Australian product-safety, TGA, privacy, volunteer
liability, IP and moral rights, name) now sits beside it. When the reviewed terms
come back:
1. Put the text in the three legal pages and drop their To be completed notices.
2. Bump `AGREEMENT_VERSIONS` **and** add a migration changing
   `public.current_agreement_version` to match (agreements.test.ts fails otherwise).
   Everyone is asked to accept again; v0-todo acceptances stop counting.
3. Resolve the self-approval conflict the review pack names before step 1.
