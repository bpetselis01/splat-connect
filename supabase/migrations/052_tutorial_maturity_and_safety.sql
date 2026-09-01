-- WP5 of the regulatory remediation: the two contributor-facing controls that
-- keep an untested design from reaching a child.
--
-- maturity: how far along the design is, declared by its author and worn as a
-- badge. Existing rows default to 'complete' — everything live today went
-- through review as a finished guide, and the default public library listing
-- now shows only 'complete' items (public.ts), so any other default would
-- vanish the current library. Mirrors how Makers Making Change marks immature
-- designs plainly rather than hiding them.
--
-- safety_declared_at: when the author affirmed the safety checklist (button
-- cells behind a tool-opened compartment, small parts for the intended age,
-- sharp edges and pinch points, non-toxic cleanable materials, no mains
-- voltage, cords and straps checked for strangulation). Stamped by the API on
-- the save that carries the affirmation; a draft cannot be submitted for
-- review without it (tutorials.ts). Existing rows are backfilled to their
-- creation date: they predate the checklist, and blocking a live guide's next
-- requeue on a form its author never saw would be a retroactive gate.
alter table public.tutorials
  add column maturity text not null default 'complete'
    check (maturity in ('concept', 'prototype', 'in_progress', 'complete')),
  add column safety_declared_at timestamptz;

update public.tutorials set safety_declared_at = created_at;
