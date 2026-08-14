# Child profiles list: match My toys / My tutorials

## Problem

`app/dashboard/child/page.tsx` predates the card-grid pattern shared by
`app/dashboard/toys/page.tsx` and `app/dashboard/page.tsx` (tutorials). It
renders children as a plain vertical stack of thin link-rows, puts its
"Add child" CTA at the bottom of the page instead of the header, and has no
empty state at all.

## Decision: no photo band

`ChildProfile` has no photo field (unlike `Toy.cover_photo_url` /
`Tutorial.toy_photo_url`). `CardPhoto` falls back to a 🧸 placeholder for a
null `src`, which is wrong for a child. Child cards skip `CardPhoto`
entirely and are text-only — title plus one detail line, no top band.

## Changes to `app/dashboard/child/page.tsx`

- **Header**: `flex flex-wrap items-center justify-between` row — title +
  description on the left, `+ Add child` (`btn btn-accent`) on the right.
  Replaces the current stacked title/description with the CTA link
  detached at the bottom of the page.
- **Empty state** (`children.length === 0`): centered `Child` icon (already
  exported from `components/icons.tsx`, currently only used in the nav
  rail) in the `empty-badge` treatment, "You haven't added any child
  profiles yet.", one supporting line, CTA button. Mirrors
  `app/dashboard/toys/page.tsx`'s empty state.
- **Card grid** (non-empty): `<ul className="grid max-w-5xl grid-cols-1
  gap-4 sm:grid-cols-2 md:grid-cols-3">`. Each `<li>` wraps a `Link` with
  `card card-link flex h-full flex-col overflow-hidden`, inner `p-4` div
  containing `childLabel(child, i)` as a truncated bold title and the
  existing age/diagnosis line beneath it. No status badge — children have
  no status field.

## Testing

`tests/unit/pages/dashboard-child-list.test.tsx`: existing assertions
(link roles, hrefs, throw-on-fetch-failure) hold unchanged since cards stay
links. Add one assertion covering the new empty state, matching the level
of coverage the toys/tutorials list tests give their own empty states.

## Out of scope

- Renaming the "Child profiles" nav/tab label.
- Adding a photo/avatar field to `ChildProfile` — no product need surfaced
  for this change.
